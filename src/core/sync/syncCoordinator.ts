import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncService, SyncResult } from './syncService';
import { OutboxManager } from './outbox';
import { AuthStore } from '../auth/authStore';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'ERROR';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  errorMessage: string | null;
}

export type SyncStateListener = (state: SyncState) => void;

export class SyncCoordinator {
  private static db: SQLiteDatabase | null = null;
  private static isSyncing = false;
  private static queuedSync = false;
  private static appStateSubscription: any = null;
  private static networkSubscription: any = null;
  private static wasOffline = false;
  private static onDataChangedCallback: (() => void) | null = null;

  private static currentState: SyncState = {
    status: 'IDLE',
    lastSyncedAt: null,
    pendingCount: 0,
    errorMessage: null,
  };

  private static listeners = new Set<SyncStateListener>();

  static getState(): SyncState {
    return { ...this.currentState };
  }

  static subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentState });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const copy = { ...this.currentState };
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch {}
    }
  }

  /**
   * Initializes the coordinator with the active tenant database handle.
   */
  static async init(db: SQLiteDatabase, onDataChanged?: () => void): Promise<void> {
    this.db = db;
    this.isSyncing = false;
    this.queuedSync = false;
    this.onDataChangedCallback = onDataChanged || null;

    // Load initial metadata from database
    try {
      const lastSync = await OutboxManager.getMeta(db, 'last_synced_at');
      const pending = await OutboxManager.getPending(db, 100);
      this.currentState = {
        status: pending.length > 0 ? 'PENDING' : 'IDLE',
        lastSyncedAt: lastSync,
        pendingCount: pending.length,
        errorMessage: null,
      };
      this.notifyListeners();
    } catch {
      // Non-fatal
    }

    this.setupListeners();

    // Trigger initial authenticated sync
    this.triggerSync('initial_setup');
  }

  /**
   * Cleans up coordinator on logout or account switch.
   */
  static reset(): void {
    this.db = null;
    this.isSyncing = false;
    this.queuedSync = false;
    this.onDataChangedCallback = null;
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.networkSubscription) {
      this.networkSubscription.remove();
      this.networkSubscription = null;
    }
    this.currentState = {
      status: 'IDLE',
      lastSyncedAt: null,
      pendingCount: 0,
      errorMessage: null,
    };
    this.notifyListeners();
  }

  private static setupListeners(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.triggerSync('app_foreground');
      }
    });

    if (this.networkSubscription) {
      this.networkSubscription.remove();
    }
    // Event-driven network listener — no continuous battery-draining polling
    try {
      this.networkSubscription = Network.addNetworkStateListener((event) => {
        const isOnline = Boolean(event.isConnected && event.isInternetReachable !== false);

        if (!isOnline) {
          this.wasOffline = true;
          if (this.currentState.status !== 'OFFLINE' && this.currentState.status !== 'SYNCING') {
            this.currentState.status = 'OFFLINE';
            this.notifyListeners();
          }
        } else if (this.wasOffline && isOnline) {
          this.wasOffline = false;
          // Connectivity recovered: Trigger sync!
          this.triggerSync('network_recovery');
        }
      });
    } catch {
      // Fallback for non-supported test environments
    }
  }

  /**
   * Called by repositories immediately after committing local mutations.
   */
  static notifyMutation(): void {
    if (!this.db) return;
    this.triggerSync('local_mutation');
  }

  /**
   * Single-flight sync execution with request coalescing.
   */
  static async triggerSync(triggerSource: string = 'manual'): Promise<SyncResult | null> {
    if (!this.db) return null;

    const isAuth = await AuthStore.isAuthenticated();
    if (!isAuth) {
      this.currentState.status = 'IDLE';
      this.notifyListeners();
      return null;
    }

    if (this.isSyncing) {
      // Coalesce: Mark queued so next sync runs immediately upon completion
      this.queuedSync = true;
      return null;
    }

    this.isSyncing = true;
    this.currentState.status = 'SYNCING';
    this.currentState.errorMessage = null;
    this.notifyListeners();

    try {
      const netState = await Network.getNetworkStateAsync();
      const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

      if (!isOnline) {
        this.wasOffline = true;
        const pending = await OutboxManager.getPending(this.db, 100);
        this.currentState = {
          ...this.currentState,
          status: 'OFFLINE',
          pendingCount: pending.length,
          errorMessage: 'Device is offline. Changes stored locally.',
        };
        this.isSyncing = false;
        this.notifyListeners();
        return null;
      }

      const res = await SyncService.syncAll(this.db);

      const pending = await OutboxManager.getPending(this.db, 100);
      const lastSync = await OutboxManager.getMeta(this.db, 'last_synced_at');

      if (res.success) {
        this.currentState = {
          status: pending.length > 0 ? 'PENDING' : 'IDLE',
          lastSyncedAt: lastSync || new Date().toISOString(),
          pendingCount: pending.length,
          errorMessage: null,
        };
        if (res.pushedCount > 0 || res.pulledCount > 0) {
          this.onDataChangedCallback?.();
        }
      } else {
        this.currentState = {
          status: 'ERROR',
          lastSyncedAt: lastSync,
          pendingCount: pending.length,
          errorMessage: res.errors?.[0] || 'Sync incomplete',
        };
      }

      this.notifyListeners();
      return res;
    } catch (err: any) {
      const pending = this.db ? await OutboxManager.getPending(this.db, 100).catch(() => []) : [];
      this.currentState = {
        ...this.currentState,
        status: 'ERROR',
        pendingCount: pending.length,
        errorMessage: err?.message || 'Sync failed',
      };
      this.notifyListeners();
      return null;
    } finally {
      this.isSyncing = false;
      if (this.queuedSync) {
        this.queuedSync = false;
        setTimeout(() => {
          this.triggerSync('queued_request');
        }, 300);
      }
    }
  }
}

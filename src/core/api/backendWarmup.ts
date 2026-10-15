import { ApiClient } from './client';

let isWarmingUp = false;
let warmUpCompleted = false;

const TIMEOUT_MS = 12000;

function getHealthUrl(): string {
  try {
    const base = ApiClient.getBaseUrl();
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}/health/`;
  } catch {
    return 'https://credkeep-v2-staging.onrender.com/api/v2/health/';
  }
}

/**
 * Triggers an asynchronous, non-blocking health check ping to wake the configured backend server.
 * - Single-flight: Prevents duplicate concurrent requests.
 * - Non-blocking: Bounded timeout, does not throw or block UI.
 * - No credentials or tokens attached.
 */
export function triggerBackendWarmup(): void {
  if (isWarmingUp || warmUpCompleted) {
    return;
  }

  isWarmingUp = true;
  const healthUrl = getHealthUrl();

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  fetch(healthUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: controller.signal,
  })
    .then((res) => {
      clearTimeout(timer);
      isWarmingUp = false;
      if (res.ok) {
        warmUpCompleted = true;
      }
    })
    .catch(() => {
      clearTimeout(timer);
      isWarmingUp = false;
      // Best-effort warm-up; failures are swallowed silently
    });
}

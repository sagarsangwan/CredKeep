# CredKeep V2 — Live Vertical Slice Integration Milestone Report

**Execution Date:** 2026-10-11  
**Branch:** `feat/v2/migration-and-ops`  
**Base HEAD:** `14700199698b479610c84fe441543d528949b4e7`  
**Status:** COMPLETED & VERIFIED END-TO-END  

---

## 1. Executive Summary

This engineering milestone proves that **CredKeep V2 functions end-to-end** across the real React Native / TypeScript mobile sync client, the live Django REST Framework API, and an isolated PostgreSQL 15 database engine with enforced Row Level Security (RLS).

All four known Codex findings (3 P1, 1 P2) have been resolved with focused regression tests. A live integration vertical slice was executed against a running backend, proving end-to-end multi-device replication, strict tenant isolation, idempotent push operations, and mathematical ledger reconciliation.

---

## 2. Resolution of Four Known Codex Findings

| Finding ID | Severity | Root Cause | Resolution | Regression Tests |
|---|---|---|---|---|
| **Finding 1** | **P1** | `reapplyPendingCollections` in `syncService.ts` evaluated penalty balances using the latest date, improperly diverting earlier payments into penalties accrued after the payment date. | Updated `reapplyPendingCollections` to dynamically query and bound penalty balances to each pending collection's specific `effective_date`. | `src/__tests__/cross-loan.test.ts` (`bounds penalty balance by payment effective date during pending collection replay`) — **PASS** |
| **Finding 2** | **P1** | `LoanRepository.createLoanWithSchedule` lacked local idempotency checks prior to inserting loans into SQLite, allowing duplicate local records on retry with the same `clientOpId`. | Added `sync_outbox` idempotency verification before loan insertion, checking attribute equality and returning existing records. | `src/__tests__/cross-loan.test.ts` (`enforces loan creation idempotency and prevents duplicate local loan creation on retry with clientOpId`) — **PASS** |
| **Finding 3** | **P1** | `PortfolioSummaryView` in `backend/api/views_sync.py` omitted remaining Interest Only (bullet) loan principal from `total_outstanding_balance_paise`. | Added calculation of remaining bullet principal (`loan.principal_paise - sum(allocated_principal)`) to `total_outstanding_balance_paise`. | `backend/api/tests_sync.py` (`test_portfolio_summary_includes_bullet_principal_and_reconciles_penalties`) — **PASS** |
| **Finding 4** | **P2** | Per-loan `outstanding_balance_paise` in `PortfolioSummaryView` did not include per-loan unpaid penalties, causing a mismatch with portfolio totals. | Added per-loan accrued unpaid penalties to each loan's `outstanding_balance_paise`, guaranteeing `total_outstanding_balance_paise == sum(loan.outstanding_balance_paise)`. | `backend/api/tests_sync.py` (`test_portfolio_summary_includes_bullet_principal_and_reconciles_penalties`) — **PASS** |

---

## 3. Real PostgreSQL Backend Verification (Step 2)

An isolated disposable PostgreSQL 15.15 instance was provisioned via Docker (`credkeep_disposable_pg` on port 5435) without modifying or touching any production or user databases.

### Environment & Roles
- **PostgreSQL Version:** 15.15 (Debian 15.15-1.pgdg130+1)
- **Database Name:** `credkeep_v2_disposable`
- **Application Role:** `credkeep_app` (restricted privileges; cannot bypass RLS)
- **Superuser Role:** `postgres` (migration runner)

### Verification Commands & Results (`backend/verify_step2.py`)
1. **Migrations:** Applied cleanly via `manage.py migrate` (tenants, ledger, auth, authtoken, sessions).
2. **Table Existence:** Verified all 20 required tables exist.
3. **RLS Policy Enforcement:**
   - 8 tables have active RLS policies (`relrowsecurity = true`, `relforcerowsecurity = true`).
   - Tables: `tenants_device`, `ledger_borrower`, `ledger_loanaccount`, `ledger_kist`, `ledger_transaction`, `ledger_schedulemodification`, `ledger_synclog`, `ledger_syncoutbox`.
4. **Tenant Isolation at Database Role Level:**
   - Querying as `credkeep_app` without tenant context returned **0 rows** (blocked by RLS).
   - Setting `app.current_tenant` to Tenant 1 returned **1 row**.
   - Switching to Tenant 2 while querying Tenant 1 returned **0 rows** (strict cross-tenant barrier).
5. **Django Authentication:**
   - User creation, password hashing (PBKDF2 SHA256), and DRF token generation verified.
6. **Atomic Transactions & Rollback:**
   - Committed payments persisted with allocations intact.
   - Forced transaction error rolled back cleanly; left **0 partial records** in PostgreSQL.

---

## 4. Real API Integration & Mobile Sync Client Results (Steps 3 & 4)

Executed via Jest integration harness `src/__tests__/live-vertical-slice.integration.test.ts` running real React Native client services (`ApiClient`, `AuthService`, `AuthStore`, `BorrowerRepository`, `LoanRepository`, `TransactionRepository`, `SyncService`) against the live Django server (`http://127.0.0.1:8000`) and PostgreSQL database.

| Step | Milestone Requirement | Live Test Result | Evidence |
|---|---|---|---|
| **Step 3.1 & 3.2** | Register & log in Lender A against live Django backend | **PASSED** (932 ms) | Token issued: `8997a6e1...`, Tenant ID: `37a7710c-...` |
| **Step 3.3** | Register Device A for Lender A | **PASSED** (41 ms) | Registered device UUID in `tenants_device` |
| **Step 3.4 - 3.6** | Device A creates borrower, Monthly Kist loan, ₹2,600 collection, and Bullet loan locally | **PASSED** (13 ms) | SQLite created 12 kists; payment allocated ₹2,000 P, ₹600 M, ₹0 Pen; 4 outbox records queued |
| **Step 3.7 & 3.8** | Push operations to Django/PostgreSQL via real mobile sync client | **PASSED** (8,837 ms) | 4 operations pushed; server returned `ACCEPTED`; outbox transitioned to `SYNCED`; authoritative portfolio created in PostgreSQL |
| **Step 3.9** | Retry identical push payload to verify idempotency | **PASSED** (154 ms) | Server returned `ACCEPTED`/`ALREADY_EXISTS`; zero duplicate transactions recorded |
| **Step 3.10 & 3.11** | Register Device B, execute real PULL, and verify complete multi-device replication | **PASSED** (204 ms) | Fresh Device B database pulled server changes; replicated borrower, both loans, paid schedule, and collection transaction |
| **Step 3.12** | Register Lender B and verify strict multi-tenant isolation | **PASSED** (1,277 ms) | Lender B has 0 loans, 0 collections; cross-tenant payment push against Lender A's loan was **REJECTED** (400/LoanAccount not found) |

### Financial Reconciliation Results
- **Active Loans Count:** 2
- **Total Principal (Paise):** 7,400,000 (₹74,000 = ₹24,000 Monthly + ₹50,000 Bullet)
- **Total Collections (Paise):** 260,000 (₹2,600 = 1 payment)
- **Portfolio Total Outstanding:** 10,880,000 paise (₹108,800)
  - Remaining Monthly Kist balance: ₹28,600
  - Bullet Principal balance: ₹50,000
  - Bullet Markup schedule: ₹5,000
  - Accrued overdue penalties (server clock): ₹25,200
- **Reconciliation Invariant:** `total_outstanding_balance_paise == sum(loan.outstanding_balance_paise)` holds with **exact equality** (10,880,000 == 10,880,000).

---

## 5. Verification Boundary & Quality Gates (Step 5)

| Gate | Target | Result |
|---|---|---|
| **Regression Tests (Client)** | `src/__tests__/cross-loan.test.ts` | **50 / 50 PASSED** (0 failures) |
| **Live Integration Slice** | `src/__tests__/live-vertical-slice.integration.test.ts` | **7 / 7 PASSED** (0 failures) |
| **Regression Tests (Backend)** | `backend/api/tests_sync.py` | **2 / 2 PASSED** (0 failures) |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 ERRORS** |
| **ESLint Quality Gate** | `npx expo lint` | **0 ERRORS** (22 legacy warnings) |

---

## 6. What Remains Unverified & Current Blockers

- **What Remains Unverified:**
  - Physical native Android device execution (requires physical hardware / Android emulator running APK build).
  - Production cloud deployment on Render (intentionally out of scope for this local integration milestone).
  - Production migration of real legacy customer SQLite databases (requires production migration window).
- **Exact Blockers:** None for this milestone. All requirements of Step 1 through Step 6 are fulfilled deterministically on local infrastructure.

---

## 7. Files Changed in this Milestone

- `backend/api/views_sync.py` (bullet principal inclusion, penalty reconciliation, operation_type compatibility)
- `backend/api/tests_sync.py` (backend portfolio summary regression tests)
- `src/core/sync/syncService.ts` (effective-date penalty bounding, push acknowledgment handling)
- `src/core/database/loanRepository.ts` (loan creation local idempotency)
- `src/core/database/borrowerRepository.ts` (RFC 4122 UUID fallback generation)
- `src/core/auth/authStore.ts` (RFC 4122 UUID fallback generation)
- `src/__tests__/cross-loan.test.ts` (focused regression tests for defect fixes)
- `src/__tests__/live-vertical-slice.integration.test.ts` (live end-to-end integration test harness)
- `backend/verify_step2.py` (database RLS and transactional integrity verification script)

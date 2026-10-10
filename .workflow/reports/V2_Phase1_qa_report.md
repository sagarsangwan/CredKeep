OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12490-bf2a-7ad0-a9ec-289f2e33219d
--------
user
Perform QA on V2_Phase1. Review the git diff between feat/bugfix/second-phone-install and feat/v2-backend-foundation. Verify cross-loan isolation, atomic financial mutations, payment idempotency, transaction conservation, and error handling. Check the regression test. Return APPROVED or REWORK with concrete file-level findings.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the branch diff and regression test against the financial invariants, using the code-review and financial verification skills.

exec
/bin/bash -lc 'pwd && git status --short && cat .agents/skills/code-review/SKILL.md && cat .agents/skills/financial-invariant-verification/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 1185ms:
/mnt/f/personal projects/credkeep
 M .agents/rules/graphify.md
 M .agents/skills/code-review/SKILL.md
 M .agents/skills/code-review/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/SKILL.md
 M .agents/skills/diagnosing-bugs/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh
 M .agents/skills/tdd/SKILL.md
 M .agents/skills/tdd/agents/openai.yaml
 M .agents/skills/tdd/mocking.md
 M .agents/skills/tdd/tests.md
 M .agents/workflows/graphify.md
 M .codex/hooks.json.disabled
 M .workflow/mock-cmd.bat
 M .workflow/plans/Android_SafeArea.md
 M .workflow/plans/Android_SafeArea_prompt.txt
 M .workflow/plans/Borrower_Profile.md
 M .workflow/plans/Borrower_Profile_Impl.md
 M .workflow/plans/Borrower_Profile_Impl_prompt.txt
 M .workflow/plans/Borrower_Profile_prompt.txt
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/plans/CK-V2-ARCH-001.md
 M .workflow/plans/CK-V2-ARCH-001_prompt.txt
 M .workflow/plans/PIN_App_Lock.md
 M .workflow/plans/PIN_App_Lock_prompt.txt
 M .workflow/plans/Second_Phone_Install.md
 M .workflow/plans/Second_Phone_Install_prompt.txt
 M .workflow/plans/test_invocation.md
 M .workflow/plans/test_invocation_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_report.md
 M .workflow/reports/V2_Phase1_qa_prompt.txt
 M .workflow/reports/V2_Phase1_qa_report.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/reports/mock-task_qa_prompt.txt
 M AGENTS.md
 M backend/api/admin.py
 M backend/api/apps.py
 M backend/api/models.py
 M backend/api/tests.py
 M backend/credkeep_backend/asgi.py
 M backend/credkeep_backend/wsgi.py
 M backend/manage.py
 M backend/tenants/admin.py
 M backend/tenants/apps.py
 M backend/tenants/migrations/0001_initial.py
 M backend/tenants/migrations/0002_device.py
 M backend/tenants/views.py
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

The issue tracker should have been provided to you. If `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-matt-pocock-skills`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here, not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.), fetched via the workflow in `docs/agents/issue-tracker.md`.
2. A path the user passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

**Standards sub-agent prompt** should include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full (the sub-agent has no other access to it).
- The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** should include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings, because the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
---
name: financial-invariant-verification
description: Rules for verifying financial math and data invariants
---

# Financial Invariant Verification

1. Double-entry ledger must always balance.
2. Payments must not cross loan boundaries.
3. Calculations must be deterministic.

exec
/bin/bash -lc 'git rev-parse feat/bugfix/second-phone-install feat/v2-backend-foundation && git diff --stat feat/bugfix/second-phone-install...feat/v2-backend-foundation && git log --oneline feat/bugfix/second-phone-install..feat/v2-backend-foundation && cat package.json && cat .workflow/V2_TASKS.md' in /mnt/f/personal projects/credkeep
 succeeded in 826ms:
8a3be8d96632da4fd26fca1387731fa6c4b1063e
a455ede26199a8005ece958433c67e4b753e5f3e
 .workflow/MODEL_POLICY.md                  |   19 +-
 .workflow/V2_TASKS.md                      |   53 +
 .workflow/plans/CK-V2-ARCH-001.md          | 2144 ++++++++++++++++++++++++++++
 .workflow/plans/CK-V2-ARCH-001_prompt.txt  |    1 +
 .workflow/plans/test_invocation.md         |   20 +
 .workflow/plans/test_invocation_prompt.txt |    1 +
 .workflow/reports/V2_Phase1_qa_prompt.txt  |    1 +
 .workflow/reports/V2_Phase1_qa_report.md   | 1971 +++++++++++++++++++++++++
 AGENTS.md                                  |   14 +-
 backend/.env.example                       |    4 +
 backend/.gitignore                         |    5 +
 backend/README.md                          |   38 +
 backend/api/__init__.py                    |    0
 backend/api/admin.py                       |    3 +
 backend/api/apps.py                        |    5 +
 backend/api/migrations/__init__.py         |    0
 backend/api/models.py                      |    3 +
 backend/api/tests.py                       |    3 +
 backend/api/urls.py                        |    7 +
 backend/api/views.py                       |   28 +
 backend/credkeep_backend/__init__.py       |    0
 backend/credkeep_backend/asgi.py           |   16 +
 backend/credkeep_backend/settings.py       |  113 ++
 backend/credkeep_backend/urls.py           |   11 +
 backend/credkeep_backend/wsgi.py           |   16 +
 backend/manage.py                          |   22 +
 backend/pytest.ini                         |    3 +
 backend/requirements.txt                   |  Bin 0 -> 944 bytes
 backend/tenants/__init__.py                |    0
 backend/tenants/admin.py                   |    3 +
 backend/tenants/apps.py                    |    5 +
 backend/tenants/middleware.py              |   38 +
 backend/tenants/migrations/0001_initial.py |   27 +
 backend/tenants/migrations/0002_device.py  |   25 +
 backend/tenants/migrations/0003_rls.py     |   28 +
 backend/tenants/migrations/__init__.py     |    0
 backend/tenants/models.py                  |   30 +
 backend/tenants/tests.py                   |  139 ++
 backend/tenants/views.py                   |    3 +
 docs/v2/01-v1-audit.md                     |   56 +
 docs/v2/02-system-architecture.md          |   29 +
 docs/v2/03-backend-design.md               |   29 +
 docs/v2/04-threat-model.md                 |   18 +
 docs/v2/05-tenant-isolation.md             |   21 +
 docs/v2/06-data-model.md                   |   38 +
 docs/v2/07-financial-invariants.md         |   27 +
 docs/v2/08-migrations.md                   |   24 +
 docs/v2/09-sync-protocol.md                |   40 +
 docs/v2/10-sync-failure-matrix.md          |   13 +
 docs/v2/11-v1-migration.md                 |   23 +
 docs/v2/12-api-contract.md                 |   42 +
 docs/v2/13-hosting.md                      |   28 +
 docs/v2/14-operations.md                   |   20 +
 docs/v2/15-test-strategy.md                |   22 +
 docs/v2/16-release-roadmap.md              |   31 +
 docs/v2/17-risk-register.md                |    9 +
 docs/v2/18-open-decisions.md               |   12 +
 docs/v2/README.md                          |   26 +
 src/__tests__/cross-loan.test.ts           |  303 +++-
 src/core/database/transactionRepository.ts |    9 +-
 60 files changed, 5523 insertions(+), 96 deletions(-)
a455ede feat(v2): implement backend foundation and models
{
  "name": "credkeep",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "crypto-js": "^4.2.0",
    "expo": "~57.0.27",
    "expo-build-properties": "~57.0.22",
    "expo-constants": "~57.0.21",
    "expo-crypto": "~57.0.3",
    "expo-document-picker": "~57.0.3",
    "expo-file-system": "~57.0.7",
    "expo-linking": "~57.0.12",
    "expo-local-authentication": "~57.0.3",
    "expo-router": "~57.0.25",
    "expo-secure-store": "~57.0.4",
    "expo-sharing": "~57.0.22",
    "expo-sqlite": "~57.0.4",
    "expo-status-bar": "~57.0.1",
    "lucide-react-native": "^1.54.0",
    "react": "19.2.3",
    "react-native": "0.86.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "~4.26.0",
    "react-native-svg": "^15.15.4"
  },
  "devDependencies": {
    "@react-native/jest-preset": "^0.86.3",
    "@types/crypto-js": "^4.2.2",
    "@types/jest": "29.5.14",
    "@types/react": "~19.2.2",
    "eslint": "^9.0.0",
    "eslint-config-expo": "~57.0.2",
    "jest": "^29.7.0",
    "jest-expo": "^57.0.5",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "test": "jest"
  },
  "private": true,
  "overrides": {
    "react-dom": "19.2.3"
  }
}
# V2 Executable Backlog

This backlog drives the autonomous execution of CredKeep V2.

## Phase 1: Backend Foundation
- [ ] **CK-V2-BE-001**: Scaffold Django Project & Config
  - *Scope:* Init Django, DRF, PostgreSQL connection (psycopg3).
  - *Acceptance:* `python manage.py check` passes.
- [ ] **CK-V2-SEC-001**: Implement Identity & Tenancy Models
  - *Scope:* Create Tenant, User linking, Device models.
  - *Acceptance:* Models created, initial migrations applied.
- [ ] **CK-V2-SEC-002**: Implement PostgreSQL RLS
  - *Scope:* Add RunSQL migrations to enforce `tenant_id` scoping.
  - *Acceptance:* Tests prove cross-tenant queries return empty.

## Phase 2: Domain Data Models
- [ ] **CK-V2-LEDGER-001**: Implement Borrower & Loan Models
  - *Scope:* Create Borrower, LoanAccount, Kist models.
- [ ] **CK-V2-LEDGER-002**: Implement Transaction Models
  - *Scope:* Create append-only Transaction model and SyncOutbox.
  - *Acceptance:* Models created, migrations generated.

## Phase 3: Financial Engine Core
- [ ] **CK-V2-LEDGER-003**: Implement Payment Allocation Logic
  - *Scope:* Port the V1 waterfall allocation to Python.
  - *Acceptance:* Unit tests pass against V1 fixtures.
- [ ] **CK-V2-LEDGER-004**: Implement Penalty Assessment Logic
  - *Scope:* Port V1 penalty logic (₹100/day).
  - *Acceptance:* Unit tests pass against V1 fixtures.

## Phase 4: Sync API
- [ ] **CK-V2-API-001**: Implement Authentication API
  - *Scope:* Registration and Login endpoints.
- [ ] **CK-V2-SYNC-001**: Implement PUSH Endpoint
  - *Scope:* Accept batch operations, idempotency check, trigger allocations.
- [ ] **CK-V2-SYNC-002**: Implement PULL Endpoint
  - *Scope:* Return state changes since `cursor`.

## Phase 5: Mobile Integration
- [ ] **CK-V2-MOB-001**: Mobile Auth UI & SecureStore
  - *Scope:* Add Login/Register screens, store JWT in SecureStore.
- [ ] **CK-V2-MOB-002**: Sync Client & Outbox
  - *Scope:* Modify local SQLite to mark pending txns, send to PUSH endpoint.
- [ ] **CK-V2-MOB-003**: Apply Server State
  - *Scope:* Fetch from PULL endpoint, update local SQLite.

## Phase 6: Migration & Ops
- [ ] **CK-V2-MIG-001**: V1 Local Data Extractor
  - *Scope:* Read V1 SQLite, structure into PUSH payloads.
- [ ] **CK-V2-OPS-001**: Dockerize and Deploy
  - *Scope:* Create Dockerfile, prepare `render.yaml`.
- [ ] **CK-V2-QA-001**: Final Verification
  - *Scope:* E2E test on Android device.

exec
/bin/bash -lc 'if test -f graphify-out/graph.json; then graphify query "V2 Phase 1 financial mutations payment idempotency cross loan isolation regression test"; fi' in /mnt/f/personal projects/credkeep
 exited 127 in 61ms:
/bin/bash: line 1: graphify: command not found

exec
/bin/bash -lc 'git diff feat/bugfix/second-phone-install...feat/v2-backend-foundation -- src/core/database/transactionRepository.ts src/__tests__/cross-loan.test.ts && cat src/core/database/transactionRepository.ts' in /mnt/f/personal projects/credkeep
 succeeded in 143ms:
diff --git a/src/__tests__/cross-loan.test.ts b/src/__tests__/cross-loan.test.ts
index 2cb688e..24409bd 100644
--- a/src/__tests__/cross-loan.test.ts
+++ b/src/__tests__/cross-loan.test.ts
@@ -3,91 +3,248 @@ import { TransactionRepository } from '../core/database/transactionRepository';
 import { toPaise } from '../core/domain/money';
 
 describe('Cross-Loan Isolation', () => {
+  let dbState: {
+    loans: any[],
+    schedules: any[],
+    transactions: any[]
+  };
   let mockDb: any;
-  let loanRepo: LoanRepository;
   let txRepo: TransactionRepository;
-  let queries: any[] = [];
-  let executionLog: any[] = [];
-  let runAsyncCallbacks: any[] = [];
-
+  
   beforeEach(() => {
-    queries = [];
-    executionLog = [];
-    runAsyncCallbacks = [];
-    
-    mockDb = {
-      withExclusiveTransactionAsync: jest.fn(async (cb) => {
-        // mock tx is the same as db here for test tracking, but in reality expo passes a tx object
-        const tx = { ...mockDb };
-        await cb(tx);
-      }),
-      runAsync: jest.fn(async (query, params) => {
-        queries.push({ query, params });
-        executionLog.push('runAsync');
-      }),
-      prepareAsync: jest.fn(async (query) => {
-        return {
-          executeAsync: jest.fn(async (params) => {
-            queries.push({ query, params });
-            executionLog.push('executeAsync');
-          }),
-          finalizeAsync: jest.fn(async () => {})
-        };
-      }),
-      getFirstAsync: jest.fn(async (query, params) => {
-        if (query.includes('loans WHERE id = ?')) {
-          return { id: params[0], product_type: 'instalment', status: 'ACTIVE' };
+    dbState = {
+      loans: [
+        { id: 'loan-a', product_type: 'instalment', status: 'ACTIVE', principal_paise: toPaise(2000) },
+        { id: 'loan-b', product_type: 'bullet', status: 'ACTIVE', principal_paise: toPaise(3000) }
+      ],
+      schedules: [
+        {
+          loan_id: 'loan-a',
+          installment_number: 1,
+          total_due_paise: 260000,
+          principal_component_paise: 200000,
+          markup_component_paise: 60000,
+          principal_paid_paise: 0,
+          markup_paid_paise: 0,
+          effective_due_date: '2026-01-01',
+          status: 'PENDING'
+        },
+        {
+          loan_id: 'loan-b',
+          installment_number: 1,
+          total_due_paise: 350000,
+          principal_component_paise: 300000,
+          markup_component_paise: 50000,
+          principal_paid_paise: 0,
+          markup_paid_paise: 0,
+          effective_due_date: '2026-01-01',
+          status: 'PENDING'
         }
-        if (query.includes('operation_id = ?')) {
+      ],
+      transactions: []
+    };
+
+    const createDbMock = (state: any, shouldThrowOnUpdate: boolean = false) => {
+      return {
+        withExclusiveTransactionAsync: jest.fn(async (cb) => {
+          // Clone state for transaction
+          const txState = {
+            loans: JSON.parse(JSON.stringify(state.loans)),
+            schedules: JSON.parse(JSON.stringify(state.schedules)),
+            transactions: JSON.parse(JSON.stringify(state.transactions))
+          };
+          const tx = createDbMock(txState, shouldThrowOnUpdate);
+          
+          try {
+            await cb(tx);
+            // Commit
+            state.loans = txState.loans;
+            state.schedules = txState.schedules;
+            state.transactions = txState.transactions;
+          } catch (e) {
+            // Rollback (do nothing)
+            throw e;
+          }
+        }),
+        getFirstAsync: jest.fn(async (query: string, params: any[] = []) => {
+          if (query.includes('FROM loans WHERE id = ?')) {
+            return state.loans.find(l => l.id === params[0]) || null;
+          }
+          if (query.includes('operation_id = ?')) {
+            return state.transactions.find(t => t.operation_id === params[0]) || null;
+          }
+          if (query.includes('SUM(amount_paise)')) {
+            const sum = state.transactions
+              .filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT')
+              .reduce((acc, t) => acc + t.amount_paise, 0);
+            return { total: sum };
+          }
+          if (query.includes('SUM(allocated_penalty_paise)')) {
+            const sum = state.transactions
+              .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
+              .reduce((acc, t) => acc + t.allocated_penalty_paise, 0);
+            return { total: sum };
+          }
+          if (query.includes('SUM(allocated_principal_paise)')) {
+            const sum = state.transactions
+              .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
+              .reduce((acc, t) => acc + (t.allocated_principal_paise || 0), 0);
+            return { total: sum };
+          }
           return null;
-        }
-        if (query.includes('SUM(amount_paise)')) {
-          return { total: 0 };
-        }
-        if (query.includes('SUM(allocated_penalty_paise)')) {
-          return { total: 0 };
-        }
-        return null;
-      }),
-      getAllAsync: jest.fn(async (query, params) => {
-        if (query.includes('repayment_schedules')) {
-          return [
-            {
-              installment_number: 1,
-              total_due_paise: 260000,
-              principal_component_paise: 200000,
-              markup_component_paise: 60000,
-              principal_paid_paise: 0,
-              markup_paid_paise: 0,
-              effective_due_date: '2026-01-01',
-              status: 'PENDING'
-            }
-          ];
-        }
-        if (query.includes('PENALTY_ASSESSMENT')) {
+        }),
+        getAllAsync: jest.fn(async (query: string, params: any[] = []) => {
+          if (query.includes('FROM repayment_schedules WHERE loan_id = ?')) {
+            return state.schedules.filter(s => s.loan_id === params[0]);
+          }
+          if (query.includes('PENALTY_ASSESSMENT')) {
+            return state.transactions.filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT');
+          }
           return [];
-        }
-        return [];
-      })
+        }),
+        runAsync: jest.fn(async (query: string, params: any[] = []) => {
+          if (query.includes('INSERT INTO transactions')) {
+            state.transactions.push({
+              id: params[0],
+              operation_id: params[1],
+              loan_id: params[2],
+              transaction_type: params[3],
+              is_cash: params[4],
+              payment_method: params[5],
+              amount_paise: params[6],
+              allocated_principal_paise: params[7],
+              allocated_markup_paise: params[8],
+              allocated_penalty_paise: params[9],
+              unallocated_surplus_paise: params[10],
+              effective_date: params[11],
+              created_at: params[12]
+            });
+          }
+          if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
+            const loan = state.loans.find(l => l.id === params[0]);
+            if (loan) loan.status = 'SETTLED';
+          }
+        }),
+        prepareAsync: jest.fn(async (query: string) => {
+          return {
+            executeAsync: jest.fn(async (params: any[]) => {
+              if (shouldThrowOnUpdate && query.includes('UPDATE repayment_schedules')) {
+                throw new Error('DB failure during update');
+              }
+              if (query.includes('UPDATE repayment_schedules')) {
+                const schedule = state.schedules.find(s => s.loan_id === params[3] && s.installment_number === params[4]);
+                if (schedule) {
+                  schedule.principal_paid_paise = params[0];
+                  schedule.markup_paid_paise = params[1];
+                  schedule.status = params[2];
+                }
+              }
+            }),
+            finalizeAsync: jest.fn(async () => {})
+          };
+        })
+      };
     };
-    
-    loanRepo = new LoanRepository(mockDb);
+
+    mockDb = createDbMock(dbState, false);
     txRepo = new TransactionRepository(mockDb);
   });
 
-  it('Payment against Loan B should only update Loan B', async () => {
-    const loanBId = 'loan-b';
-    const amount = toPaise(2600); // 1 kist
+  it('Payment against Loan B should only update Loan B and satisfy conservation', async () => {
+    // Perform partial payment on Loan B (1500)
+    await txRepo.recordCashPayment('loan-b', toPaise(1500), 'op-b-1', '2026-01-02');
+    
+    // Verify Loan A is unchanged
+    const loanASchedule = dbState.schedules.find(s => s.loan_id === 'loan-a');
+    expect(loanASchedule.principal_paid_paise).toBe(0);
+    expect(loanASchedule.markup_paid_paise).toBe(0);
+    
+    // Verify Loan B updated
+    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
+    expect(loanBSchedule.markup_paid_paise).toBeGreaterThan(0);
+    expect(loanBSchedule.status).toBe('PARTIALLY_PAID'); // partial payment
     
-    await txRepo.recordCashPayment(loanBId, amount, 'test-op', '2026-01-02');
+    // Conservation assertion
+    const collections = dbState.transactions.filter(t => t.transaction_type === 'COLLECTION');
+    expect(collections.length).toBe(1);
     
-    // Let's check which queries were run
-    const updates = queries.filter(q => q.query.includes('UPDATE repayment_schedules'));
+    const amountPaid = collections[0].amount_paise;
+    const allocatedPrincipal = collections[0].allocated_principal_paise;
+    const allocatedMarkup = collections[0].allocated_markup_paise;
+    const allocatedPenalty = collections[0].allocated_penalty_paise;
+    const surplus = collections[0].unallocated_surplus_paise;
     
-    expect(updates.length).toBeGreaterThan(0);
-    for (const update of updates) {
-      const loanIdIndex = update.params.length - 2; // Assuming WHERE loan_id = ? AND installment_number = ?
-      expect(update.params[loanIdIndex]).toBe(loanBId);
-    }
+    expect(amountPaid).toBe(allocatedPrincipal + allocatedMarkup + allocatedPenalty + surplus);
+    expect(amountPaid).toBe(toPaise(1500));
+  });
+
+  it('Payment idempotency: skips execution if operation_id exists', async () => {
+    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
+    const txCount = dbState.transactions.length;
+    
+    // Repeat same operation ID
+    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
+    expect(dbState.transactions.length).toBe(txCount);
+  });
+  
+  it('Bullet Principal test: fully pays bullet loan and settles it', async () => {
+    // Pay on due date so there's no penalty
+    await txRepo.recordCashPayment('loan-b', toPaise(3500), 'op-b-full', '2026-01-01');
+    
+    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
+    expect(loanBSchedule.status).toBe('PAID');
+    
+    const loanB = dbState.loans.find(l => l.id === 'loan-b');
+    expect(loanB.status).toBe('SETTLED');
+  });
+
+  it('Rollback: throws and propagates if an error occurs during transaction after successful writes', async () => {
+    // Inject mock that throws on update
+    const errorMockDb = mockDb = { ...mockDb, withExclusiveTransactionAsync: jest.fn(async (cb) => {
+      // Clone state
+      const txState = {
+        loans: JSON.parse(JSON.stringify(dbState.loans)),
+        schedules: JSON.parse(JSON.stringify(dbState.schedules)),
+        transactions: JSON.parse(JSON.stringify(dbState.transactions))
+      };
+      
+      // Override prepareAsync to throw
+      const tx = { ...mockDb, 
+        getFirstAsync: async (q: string, p: any[]) => {
+          if (q.includes('FROM loans WHERE id = ?')) return txState.loans.find((l:any) => l.id === p[0]);
+          return null;
+        },
+        getAllAsync: async (q: string, p: any[]) => {
+          if (q.includes('FROM repayment_schedules')) return txState.schedules.filter((s:any) => s.loan_id === p[0]);
+          return [];
+        },
+        runAsync: async (q: string, p: any[]) => {
+          if (q.includes('INSERT INTO transactions')) txState.transactions.push({ id: p[0], transaction_type: p[3] });
+        },
+        prepareAsync: async (q: string) => ({
+          executeAsync: async () => { throw new Error('DB failure during update'); },
+          finalizeAsync: async () => {}
+        })
+      };
+      
+      try {
+        await cb(tx);
+        // Will not reach here due to error
+      } catch(e) {
+        throw e;
+      }
+    })};
+    
+    txRepo = new TransactionRepository(errorMockDb);
+
+    await expect(txRepo.recordCashPayment('loan-a', toPaise(2600), 'fail-op', '2026-01-02'))
+      .rejects.toThrow('DB failure during update');
+      
+    // Verify that the global dbState remains completely unchanged
+    expect(dbState.transactions.length).toBe(0);
+    const loanA = dbState.loans.find(l => l.id === 'loan-a');
+    expect(loanA.status).toBe('ACTIVE');
+    const scheduleA = dbState.schedules.find(s => s.loan_id === 'loan-a');
+    expect(scheduleA.principal_paid_paise).toBe(0);
   });
 });
diff --git a/src/core/database/transactionRepository.ts b/src/core/database/transactionRepository.ts
index 22688c4..45a4cee 100644
--- a/src/core/database/transactionRepository.ts
+++ b/src/core/database/transactionRepository.ts
@@ -81,20 +81,19 @@ export class TransactionRepository {
           allocatedPenalty += a.allocatedToPenalty;
         }
 
-        let bulletPrincipalPaid = 0;
+        let pastPrincipalPaid = 0;
         if (loan.product_type === 'bullet') {
           const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
             `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
             [loanId]
           );
-          bulletPrincipalPaid = pastPrincipalPaidRes?.total || 0;
-          const remainingPrincipal = loan.principal_paise - bulletPrincipalPaid;
+          pastPrincipalPaid = pastPrincipalPaidRes?.total || 0;
+          const remainingPrincipal = loan.principal_paise - pastPrincipalPaid;
           
           if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
             const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
             allocatedPrincipal += payPrincipal;
             result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
-            bulletPrincipalPaid += payPrincipal;
           }
         }
         
@@ -144,7 +143,7 @@ export class TransactionRepository {
              await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
           }
         } else if (loan.product_type === 'bullet') {
-          if (bulletPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
+          if ((pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
              await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
           }
         }
import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { allocatePayment, KistAllocationState } from '../domain/allocation';
import { Paise } from '../domain/money';

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  async recordCashPayment(
    loanId: string, 
    paymentAmount: Paise, 
    operationId: string,
    effectiveDate: string
  ) {
      let returnResult: any = null;

      await this.db.withExclusiveTransactionAsync(async (tx) => {
        // Idempotency check
        const existing = await tx.getFirstAsync(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
        if (existing) {
          returnResult = existing;
          return;
        }

        const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
        if (!loan) throw new Error('Loan not found');
        
        // Ensure schedule is up to date (for bullet loans)
        const { LoanRepository } = require('./loanRepository');
        const loanRepo = new LoanRepository(tx);
        await loanRepo.extendScheduleIfNeeded(loanId, tx);

        // Load current kists
        const dbKists = await tx.getAllAsync<any>(
          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`, 
          [loanId]
        );
        
        const kists: KistAllocationState[] = dbKists.map(k => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
          principalPaid: k.principal_paid_paise as Paise,
          markupPaid: k.markup_paid_paise as Paise,
          status: k.status,
          isDue: k.effective_due_date <= effectiveDate
        }));
        
        // Assess penalties up to effectiveDate
        await this.assessPenalties(loanId, effectiveDate, tx);

        // Fetch outstanding penalty
        // Outstanding penalty = (Total PENALTY_ASSESSMENT amounts) - (Total allocated_penalty_paise from all collections)
        const penaltyAssessments = await tx.getFirstAsync<any>(
          `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
          [loanId]
        );
        const penaltyPaid = await tx.getFirstAsync<any>(
          `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
          [loanId]
        );
        
        const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
        const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
        const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid) as Paise;
  
        const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
        
        const transactionId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        
        let allocatedPrincipal = 0;
        let allocatedMarkup = 0;
        let allocatedPenalty = 0;
        
        for (const a of result.allocations) {
          allocatedPrincipal += a.allocatedToPrincipal;
          allocatedMarkup += a.allocatedToMarkup;
          allocatedPenalty += a.allocatedToPenalty;
        }

        let pastPrincipalPaid = 0;
        if (loan.product_type === 'bullet') {
          const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
            [loanId]
          );
          pastPrincipalPaid = pastPrincipalPaidRes?.total || 0;
          const remainingPrincipal = loan.principal_paise - pastPrincipalPaid;
          
          if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
            const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
            allocatedPrincipal += payPrincipal;
            result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
          }
        }
        
        await tx.runAsync(`
          INSERT INTO transactions (
            id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
            amount_paise, allocated_principal_paise, allocated_markup_paise, 
            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
          paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
          result.unallocatedFunds, effectiveDate, createdAt
        ]);
        
        // Update repayment schedules
        const updateStmt = await tx.prepareAsync(`
          UPDATE repayment_schedules
          SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
          WHERE loan_id = ? AND installment_number = ?
        `);
        
        try {
          for (const k of result.updatedKists) {
            // Only update if changed
            const orig = kists.find(o => o.kistNumber === k.kistNumber)!;
            if (k.amountPaid !== orig.amountPaid || k.status !== orig.status) {
               await updateStmt.executeAsync([
                 k.principalPaid, k.markupPaid, k.status || 'PENDING', loanId, k.kistNumber
               ]);
            }
          }
        } finally {
          await updateStmt.finalizeAsync();
        }
        // Check if loan should be closed
        let allKistsPaid = true;
        for (const k of result.updatedKists) {
          if (k.status !== 'PAID') {
            allKistsPaid = false;
            break;
          }
        }
        
        if (loan.product_type === 'instalment') {
          if (allKistsPaid && result.remainingPenalty <= 0) {
             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
          }
        } else if (loan.product_type === 'bullet') {
          if ((pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
          }
        }
        
        returnResult = { success: true, transactionId, result };
      });
      
      return returnResult;
  }

  async previewPenalties(loanId: string, currentDate: string): Promise<number> {
    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const { LoanRepository } = require('./loanRepository');
    const loanRepo = new LoanRepository(this.db);
    await loanRepo.extendScheduleIfNeeded(loanId);

    const dbKists = await this.db.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await this.db.getAllAsync<any>(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map(a => a.effective_date));

    // Dynamic import to avoid circular dep
    const { calculateNewPenalties } = require('../domain/penalty');
    const { toPaise } = require('../domain/money');

    const state = {
      loanId,
      rule: { dailyRatePaise: toPaise(100) },
      kists: dbKists.map(k => ({
        kistNumber: k.installment_number,
        dueDate: k.effective_due_date,
        amountDue: k.total_due_paise,
        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
        isFullyPaid: k.status === 'PAID'
      })),
      assessedDates
    };

    const { newPenaltyAmount } = calculateNewPenalties(state, currentDate);
    return newPenaltyAmount;
  }

  async assessPenalties(loanId: string, currentDate: string, tx: any = this.db): Promise<number> {
    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.status !== 'ACTIVE') return 0;

    const { LoanRepository } = require('./loanRepository');
    const loanRepo = new LoanRepository(tx);
    await loanRepo.extendScheduleIfNeeded(loanId, tx);

    const dbKists = await tx.getAllAsync(
      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId]
    );

    const assessments = await tx.getAllAsync(
      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
      [loanId]
    );

    const assessedDates = new Set<string>(assessments.map((a: any) => a.effective_date));

    // Dynamic import to avoid circular dep if any, or just require
    const { calculateNewPenalties, LoanPenaltyState } = require('../domain/penalty');
    const { toPaise } = require('../domain/money');

    const state = {
      loanId,
      rule: { dailyRatePaise: toPaise(100) },
      kists: dbKists.map((k: any) => ({
        kistNumber: k.installment_number,
        dueDate: k.effective_due_date,
        amountDue: k.total_due_paise,
        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
        isFullyPaid: k.status === 'PAID'
      })),
      assessedDates
    };

    const { newPenaltyAmount, newAssessedDates } = calculateNewPenalties(state, currentDate);

    if (newPenaltyAmount > 0) {
      for (const date of newAssessedDates) {
        const transactionId = crypto.randomUUID();
        const operationId = `penalty-${loanId}-${date}`;
        
        // Check if it already exists to be safe
        const existing = await tx.getFirstAsync(`SELECT id FROM transactions WHERE operation_id = ?`, [operationId]);
        if (!existing) {
          await tx.runAsync(`
            INSERT INTO transactions (
              id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
              amount_paise, allocated_principal_paise, allocated_markup_paise, 
              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transactionId, operationId, loanId, 'PENALTY_ASSESSMENT', 0, 'SYSTEM',
            toPaise(100), 0, 0, 0, 0, date, new Date().toISOString()
          ]);
        }
      }
    }

    return newPenaltyAmount;
  }

  async getEarningsSummary(filter?: { loanId?: string, borrowerId?: string, loanStatus?: string }) {
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filter?.loanId) {
      whereClauses.push('t.loan_id = ?');
      params.push(filter.loanId);
    }
    if (filter?.borrowerId) {
      whereClauses.push('l.borrower_id = ?');
      params.push(filter.borrowerId);
    }
    if (filter?.loanStatus) {
      whereClauses.push('l.status = ?');
      params.push(filter.loanStatus);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Calculate actual cash received
    const collectedQuery = await this.db.getFirstAsync<any>(`
      SELECT 
        SUM(t.allocated_principal_paise) as principal_returned,
        SUM(t.allocated_markup_paise) as markup_received,
        SUM(t.allocated_penalty_paise) as penalty_received,
        SUM(t.forgiven_principal_paise) as principal_waived,
        SUM(t.forgiven_markup_paise) as markup_waived,
        SUM(t.forgiven_penalty_paise) as penalty_waived
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      ${whereStr} AND t.transaction_type = 'COLLECTION'
    `, params);

    // Calculate outstanding (what is due but not paid)
    // For outstanding penalty, sum PENALTY_ASSESSMENT minus collected penalty
    const penaltyAssessments = await this.db.getFirstAsync<any>(`
      SELECT SUM(t.amount_paise) as total
      FROM transactions t
      JOIN loans l ON t.loan_id = l.id
      ${whereStr} AND t.transaction_type = 'PENALTY_ASSESSMENT'
    `, params);

    const totalPenaltyAssessed = penaltyAssessments?.total || 0;
    const penaltyReceived = collectedQuery?.penalty_received || 0;
    const penaltyWaived = collectedQuery?.penalty_waived || 0;
    const outstandingPenalty = Math.max(0, totalPenaltyAssessed - penaltyReceived - penaltyWaived);

    return {
      principalReturned: collectedQuery?.principal_returned || 0,
      markupReceived: collectedQuery?.markup_received || 0,
      penaltyReceived,
      principalWaived: collectedQuery?.principal_waived || 0,
      markupWaived: collectedQuery?.markup_waived || 0,
      penaltyWaived,
      outstandingPenalty,
      totalEarnings: (collectedQuery?.markup_received || 0) + penaltyReceived
    };
  }

  async getBorrowerSummary(borrowerId: string) {
    const loans = await this.db.getAllAsync<any>(
      `SELECT * FROM loans WHERE borrower_id = ?`,
      [borrowerId]
    );

    let totalPrincipalRemaining = 0;
    let totalMarkupRemaining = 0;
    let totalPenaltyRemaining = 0;
    let activeLoanCount = 0;

    for (const loan of loans) {
      if (loan.status === 'ACTIVE') {
        activeLoanCount++;
      }

      const earnings = await this.getEarningsSummary({ loanId: loan.id });
      totalPenaltyRemaining += earnings.outstandingPenalty;

      const kistSum = await this.db.getFirstAsync<any>(`
        SELECT 
          SUM(principal_component_paise) as total_principal,
          SUM(markup_component_paise) as total_markup,
          SUM(principal_paid_paise) as paid_principal,
          SUM(markup_paid_paise) as paid_markup
        FROM repayment_schedules
        WHERE loan_id = ?
      `, [loan.id]);

      const markupRem = (kistSum?.total_markup || 0) - (kistSum?.paid_markup || 0);
      totalMarkupRemaining += Math.max(0, markupRem);

      if (loan.product_type === 'bullet') {
        const bulletPrincipal = loan.principal_paise;
        const paidQuery = await this.db.getFirstAsync<any>(`
          SELECT SUM(allocated_principal_paise) as paid_principal, SUM(forgiven_principal_paise) as waived_principal
          FROM transactions 
          WHERE loan_id = ?
        `, [loan.id]);
        const paid = paidQuery?.paid_principal || 0;
        const waived = paidQuery?.waived_principal || 0;
        totalPrincipalRemaining += Math.max(0, bulletPrincipal - paid - waived);
      } else {
        const prinRem = (kistSum?.total_principal || 0) - (kistSum?.paid_principal || 0);
        totalPrincipalRemaining += Math.max(0, prinRem);
      }
    }

    return {
      activeLoanCount,
      totalPrincipalRemaining,
      totalMarkupRemaining,
      totalPenaltyRemaining,
      totalOutstanding: totalPrincipalRemaining + totalMarkupRemaining + totalPenaltyRemaining
    };
  }
}

exec
/bin/bash -lc 'git show feat/v2-backend-foundation:backend/tenants/middleware.py && git show feat/v2-backend-foundation:backend/tenants/models.py && git show feat/v2-backend-foundation:backend/tenants/migrations/0003_rls.py && git show feat/v2-backend-foundation:backend/tenants/tests.py && cat jest.config.js && rg --files src/core/database' in /mnt/f/personal projects/credkeep
 succeeded in 403ms:
from django.db import connection, DatabaseError
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist

class TenantMiddleware:
    """
    Middleware to extract the tenant from the authenticated user and set it in the database context.
    Sets a session-level configuration for PostgreSQL RLS and resets it after the request.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            request.tenant = None
            return self.get_response(request)

        try:
            tenant = request.user.owned_tenant
            request.tenant = tenant
        except ObjectDoesNotExist as e:
            raise PermissionDenied("User does not have an active tenant.") from e

        db_context_set = False
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
                db_context_set = True

        try:
            response = self.get_response(request)
            return response
        finally:
            if db_context_set and connection.vendor == 'postgresql':
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("RESET credkeep.current_tenant")
                except DatabaseError:
                    pass
import uuid
from django.db import models
from django.conf import settings

class Tenant(models.Model):
    """
    Represents a single lender's isolated workspace.
    In V2, this is a strict 1:1 relationship with the owner user.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_tenant'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Device(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='devices')
    push_token = models.CharField(max_length=255, blank=True, null=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Device {self.id} for {self.tenant.name}"
from django.db import migrations

def forward_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("""
            ALTER TABLE tenants_device ENABLE ROW LEVEL SECURITY;
            ALTER TABLE tenants_device FORCE ROW LEVEL SECURITY;
            CREATE POLICY tenant_isolation_policy ON tenants_device
                USING (tenant_id = NULLIF(current_setting('credkeep.current_tenant', true), '')::uuid);
        """)

def reverse_rls(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("""
            DROP POLICY IF EXISTS tenant_isolation_policy ON tenants_device;
            ALTER TABLE tenants_device NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE tenants_device DISABLE ROW LEVEL SECURITY;
        """)

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_device'),
    ]

    operations = [
        migrations.RunPython(forward_rls, reverse_code=reverse_rls),
    ]
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from tenants.models import Tenant
from django.db import connection

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user_with_tenant():
    user = User.objects.create_user(username='lender1', password='password')
    tenant = Tenant.objects.create(name='Lender 1 Workspace', owner=user)
    return user, tenant

@pytest.fixture
def user_without_tenant():
    return User.objects.create_user(username='lender2', password='password')

@pytest.mark.django_db
def test_health_check(api_client):
    url = reverse('health-check')
    response = api_client.get(url)
    assert response.status_code == 200
    assert response.data == {"status": "ok"}

@pytest.mark.django_db
def test_readiness_check(api_client):
    url = reverse('readiness-check')
    response = api_client.get(url)
    # Even with SQLite, this should return 200 ok
    assert response.status_code == 200
    assert response.data == {"status": "ready"}

@pytest.mark.django_db
def test_cross_tenant_isolation(api_client, user_with_tenant, user_without_tenant):
    """
    Validates application-level tenant isolation logic.
    User 1 should not see User 2's devices or tenant data (when endpoints are implemented).
    Since we don't have endpoints yet, we verify that the middleware correctly throws PermissionDenied
    when user_without_tenant tries to access protected views, and succeeds for user_with_tenant.
    """
    user1, tenant1 = user_with_tenant
    
    # Test user without tenant gets blocked
    api_client.force_login(user=user_without_tenant)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 403 # PermissionDenied

    # Test user with tenant passes
    api_client.force_login(user=user1)
    response = api_client.get(reverse('health-check'))
    assert response.status_code == 200

@pytest.mark.django_db
def test_rls_sql_generation(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
            cursor.execute("SHOW credkeep.current_tenant")
            result = cursor.fetchone()
            assert result[0] == str(tenant.id)
            cursor.execute("RESET credkeep.current_tenant")
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

from tenants.models import Device

@pytest.fixture
def device_for_tenant1(user_with_tenant):
    user, tenant = user_with_tenant
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
    device = Device.objects.create(tenant=tenant, push_token='token1')
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("RESET credkeep.current_tenant")
    return device

@pytest.mark.django_db
def test_cross_tenant_device_isolation(user_with_tenant, device_for_tenant1):
    """
    Validates RLS for Device model if postgres.
    """
    user1, tenant1 = user_with_tenant
    
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            # Set to tenant1
            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant1.id)])
            
            # Tenant 1 should see the device
            cursor.execute("SELECT id FROM tenants_device")
            result = cursor.fetchall()
            assert len(result) == 1
            
            # Reset and try as user_without_tenant (simulated with random uuid)
            cursor.execute("SET credkeep.current_tenant = '00000000-0000-0000-0000-000000000000'")
            cursor.execute("SELECT id FROM tenants_device")
            result2 = cursor.fetchall()
            assert len(result2) == 0
            
            cursor.execute("RESET credkeep.current_tenant")
    else:
        pytest.skip("Skipping RLS validation on SQLite backend.")

@pytest.mark.django_db
@pytest.mark.skipif(connection.vendor != 'postgresql', reason="Requires PostgreSQL RLS")
def test_postgresql_restricted_role_isolation(user_with_tenant, device_for_tenant1):
    user, tenant = user_with_tenant
    other_tenant = Tenant.objects.create(name="Other Tenant", owner=User.objects.create_user(username='other_user', password='password'))
    
    with connection.cursor() as cursor:
        try:
            # We must be able to switch to the restricted app role.
            # If the role doesn't exist, this will throw, failing the test if run on a real pg instance.
            cursor.execute("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'credkeep_app') THEN CREATE ROLE credkeep_app; END IF; END $$;")
            cursor.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO credkeep_app;")
            cursor.execute("SET ROLE credkeep_app")
            
            # Set context to other_tenant
            cursor.execute("SET credkeep.current_tenant = %s", [str(other_tenant.id)])
            
            # Cross-tenant reads should fail / return 0
            devices = Device.objects.all()
            assert devices.count() == 0, "Role failed to isolate reads"
            
            # Rejected writes
            with pytest.raises(Exception):
                # RLS should reject this insert under credkeep_app
                Device.objects.create(tenant=tenant, push_token="hack")
                
        finally:
            cursor.execute("RESET ROLE")
            cursor.execute("RESET credkeep.current_tenant")
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
};
src/core/database/loanRepository.test.ts
src/core/database/db.ts
src/core/database/DatabaseProvider.tsx
src/core/database/borrowerRepository.ts
src/core/database/schema.ts
src/core/database/loanRepository.ts
src/core/database/transactionRepository.ts

codex
The payment path scopes its reads and writes by loan and uses an exclusive transaction. The new regression test covers isolation, conservation, replay, and rollback, but uses a database mock. I’m checking what that mock can prove and whether the PostgreSQL tests exercise RLS correctly. Graphify is unavailable in this environment.

exec
/bin/bash -lc "git branch --show-current && rg --files -g 'bun.lock*' -g '*lock*' -g 'python*' -g 'pytest*' backend . | head -30 && cat backend/credkeep_backend/settings.py && cat backend/api/views.py && cat backend/README.md && cat src/core/domain/allocation.ts && rg -n 'extendScheduleIfNeeded|bullet|principal_component' src/core/database/loanRepository.ts src/core/domain/schedule.ts" in /mnt/f/personal projects/credkeep
 succeeded in 104ms:
feat/v2-backend-foundation
./package-lock.json
backend/pytest.ini
./backend/pytest.ini
"""
Django settings for credkeep_backend project.
"""

from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environ
env = environ.Env(
    DEBUG=(bool, False)
)
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'rest_framework',
    'drf_spectacular',
    
    # Local apps
    'tenants',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'tenants.middleware.TenantMiddleware',
]

ROOT_URLCONF = 'credkeep_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'credkeep_backend.wsgi.application'

# Database
DATABASES = {
    'default': env.db('DATABASE_URL', default=f'sqlite:///{BASE_DIR}/db.sqlite3')
}
DATABASES['default']['ATOMIC_REQUESTS'] = True

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# Spectacular Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'CredKeep V2 API',
    'DESCRIPTION': 'Offline-first Lending Management API',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
import logging
from django.utils.decorators import method_decorator
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

@method_decorator(transaction.non_atomic_requests, name='dispatch')
class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"}, status=status.HTTP_200_OK)

@method_decorator(transaction.non_atomic_requests, name='dispatch')
class ReadinessCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.db import connection, DatabaseError
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return Response({"status": "ready"}, status=status.HTTP_200_OK)
        except DatabaseError:
            return Response({"status": "unready"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
# CredKeep V2 Backend

This is the Django/DRF backend for CredKeep V2.

## Local Development Setup

1. **Prerequisites:** Python 3.11+, PostgreSQL 15+.
2. **Virtual Environment:**
   ```bash
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL credentials
   ```
5. **Database Setup:**
   Ensure PostgreSQL is running and create the database:
   ```sql
   CREATE DATABASE credkeep_v2;
   ```
6. **Migrations:**
   ```bash
   python manage.py migrate
   ```
7. **Run Server:**
   ```bash
   python manage.py runserver
   ```
8. **Run Tests:**
   ```bash
   pytest
   ```
import { Paise, subtractPaise, addPaise } from './money';
import { PaymentAllocation } from './models';

export type KistAllocationState = {
  kistNumber: number;
  amountDue: Paise;
  principalDue: Paise;
  markupDue: Paise;
  amountPaid: Paise;
  principalPaid: Paise;
  markupPaid: Paise;
  isDue?: boolean;
  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
};

function allocateWithinKist(
  amount: Paise,
  kist: KistAllocationState
): { p: Paise; m: Paise } {
  const unpaidPrincipal = subtractPaise(kist.principalDue, kist.principalPaid);
  const unpaidMarkup = subtractPaise(kist.markupDue, kist.markupPaid);

  if (amount >= addPaise(unpaidPrincipal, unpaidMarkup)) {
    return { p: unpaidPrincipal, m: unpaidMarkup };
  }

  // Allocate to markup first, then principal
  let m = amount;
  if (m > unpaidMarkup) {
    m = unpaidMarkup;
  }
  
  const p = subtractPaise(amount, m);
  
  return { p, m };
}

export type AllocationInput = {
  paymentAmount: Paise;
  kists: KistAllocationState[];
  outstandingPenalty: Paise;
};

export type AllocationResult = {
  updatedKists: KistAllocationState[];
  allocations: PaymentAllocation[];
  remainingPenalty: Paise;
  unallocatedFunds: Paise;
};

export function allocatePayment(input: AllocationInput): AllocationResult {
  let remainingFunds = input.paymentAmount;
  let remainingPenalty = input.outstandingPenalty;
  
  const updatedKists = input.kists.map(k => {
    let resolvedStatus = k.status;
    if (!resolvedStatus || (resolvedStatus as string) === 'PENDING' || resolvedStatus === 'UNPAID' || resolvedStatus === 'PARTIALLY_PAID') {
      resolvedStatus = k.amountPaid >= k.amountDue ? 'PAID' : (k.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }
    // Also auto-fix if amountPaid somehow >= amountDue but status isn't PAID
    if (k.amountPaid >= k.amountDue && resolvedStatus !== 'PAID') {
      resolvedStatus = 'PAID';
    }
    return { ...k, status: resolvedStatus };
  });
  
  const allocations: PaymentAllocation[] = [];
  
  // Phase 1: Due instalments (oldest first)
  for (const kist of updatedKists) {
    if (kist.isDue !== false && kist.status !== 'PAID' && remainingFunds > 0) {
      const remainingDue = subtractPaise(kist.amountDue, kist.amountPaid);
      const allocatedToKist = Math.min(remainingFunds, remainingDue) as Paise;
      
      kist.amountPaid = addPaise(kist.amountPaid, allocatedToKist);
      remainingFunds = subtractPaise(remainingFunds, allocatedToKist);
      
      if (kist.amountPaid >= kist.amountDue) {
        kist.status = 'PAID';
      } else {
        kist.status = 'PARTIALLY_PAID';
      }
      
      if (allocatedToKist > 0) {
        const { p, m } = allocateWithinKist(allocatedToKist, kist);
        kist.principalPaid = addPaise(kist.principalPaid, p);
        kist.markupPaid = addPaise(kist.markupPaid, m);

        allocations.push({
          amount: allocatedToKist,
          allocatedToKist: kist.kistNumber,
          allocatedToPrincipal: p,
          allocatedToMarkup: m,
          allocatedToPenalty: 0 as Paise
        });
      }
    }
  }
  
  // Phase 2: Outstanding penalties
  if (remainingFunds > 0 && remainingPenalty > 0) {
    const allocatedToPenalty = Math.min(remainingFunds, remainingPenalty) as Paise;
    remainingPenalty = subtractPaise(remainingPenalty, allocatedToPenalty);
    remainingFunds = subtractPaise(remainingFunds, allocatedToPenalty);
    
    allocations.push({
      amount: allocatedToPenalty,
      allocatedToKist: 0, // 0 indicates loan-level penalty
      allocatedToPrincipal: 0 as Paise,
      allocatedToMarkup: 0 as Paise,
      allocatedToPenalty: allocatedToPenalty
    });
  }
  
  // Phase 3: Future non-due instalments (pre-payments)
  for (const kist of updatedKists) {
    if (kist.isDue === false && kist.status !== 'PAID' && remainingFunds > 0) {
      const remainingDue = subtractPaise(kist.amountDue, kist.amountPaid);
      const allocatedToKist = Math.min(remainingFunds, remainingDue) as Paise;
      
      kist.amountPaid = addPaise(kist.amountPaid, allocatedToKist);
      remainingFunds = subtractPaise(remainingFunds, allocatedToKist);
      
      if (kist.amountPaid >= kist.amountDue) {
        kist.status = 'PAID';
      } else {
        kist.status = 'PARTIALLY_PAID';
      }
      
      if (allocatedToKist > 0) {
        const { p, m } = allocateWithinKist(allocatedToKist, kist);
        kist.principalPaid = addPaise(kist.principalPaid, p);
        kist.markupPaid = addPaise(kist.markupPaid, m);

        allocations.push({
          amount: allocatedToKist,
          allocatedToKist: kist.kistNumber,
          allocatedToPrincipal: p,
          allocatedToMarkup: m,
          allocatedToPenalty: 0 as Paise
        });
      }
    }
  }

  return {
    updatedKists,
    allocations,
    remainingPenalty,
    unallocatedFunds: remainingFunds
  };
}
src/core/database/loanRepository.ts:39:        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
src/core/database/loanRepository.ts:77:    await this.extendScheduleIfNeeded(loanId);
src/core/database/loanRepository.ts:85:  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
src/core/database/loanRepository.ts:87:    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE') return;
src/core/database/loanRepository.ts:115:        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
src/core/domain/schedule.ts:10:  productType: 'instalment' | 'bullet';
src/core/domain/schedule.ts:60:  } else if (productType === 'bullet') {

exec
/bin/bash -lc 'bunx jest --runInBand --no-cache src/__tests__/cross-loan.test.ts' in /mnt/f/personal projects/credkeep
 exited 127 in 63ms:
/bin/bash: line 1: bunx: command not found

exec
/bin/bash -lc 'bunx tsc --noEmit' in /mnt/f/personal projects/credkeep
 exited 127 in 66ms:
/bin/bash: line 1: bunx: command not found

exec
/bin/bash -lc 'bunx expo lint' in /mnt/f/personal projects/credkeep
 exited 127 in 82ms:
/bin/bash: line 1: bunx: command not found

exec
/bin/bash -lc 'npx --no-install jest --runInBand --no-cache src/__tests__/cross-loan.test.ts' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'npx --no-install tsc --noEmit' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'CI=1 npx --no-install expo lint --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "python -m pytest --version && python -c 'import django; print(django.get_version())'" in /mnt/f/personal projects/credkeep
 exited 127 in 120ms:
/bin/bash: line 1: python: command not found

exec
/bin/bash -lc "git show feat/v2-backend-foundation:src/__tests__/cross-loan.test.ts | nl -ba | sed -n '1,260p'; sed -n '85,130p' src/core/database/loanRepository.ts; sed -n '55,85p' src/core/domain/schedule.ts; cat docs/v2/05-tenant-isolation.md; cat docs/v2/07-financial-invariants.md" in /mnt/f/personal projects/credkeep
 succeeded in 137ms:
     1	import { LoanRepository } from '../core/database/loanRepository';
     2	import { TransactionRepository } from '../core/database/transactionRepository';
     3	import { toPaise } from '../core/domain/money';
     4	
     5	describe('Cross-Loan Isolation', () => {
     6	  let dbState: {
     7	    loans: any[],
     8	    schedules: any[],
     9	    transactions: any[]
    10	  };
    11	  let mockDb: any;
    12	  let txRepo: TransactionRepository;
    13	  
    14	  beforeEach(() => {
    15	    dbState = {
    16	      loans: [
    17	        { id: 'loan-a', product_type: 'instalment', status: 'ACTIVE', principal_paise: toPaise(2000) },
    18	        { id: 'loan-b', product_type: 'bullet', status: 'ACTIVE', principal_paise: toPaise(3000) }
    19	      ],
    20	      schedules: [
    21	        {
    22	          loan_id: 'loan-a',
    23	          installment_number: 1,
    24	          total_due_paise: 260000,
    25	          principal_component_paise: 200000,
    26	          markup_component_paise: 60000,
    27	          principal_paid_paise: 0,
    28	          markup_paid_paise: 0,
    29	          effective_due_date: '2026-01-01',
    30	          status: 'PENDING'
    31	        },
    32	        {
    33	          loan_id: 'loan-b',
    34	          installment_number: 1,
    35	          total_due_paise: 350000,
    36	          principal_component_paise: 300000,
    37	          markup_component_paise: 50000,
    38	          principal_paid_paise: 0,
    39	          markup_paid_paise: 0,
    40	          effective_due_date: '2026-01-01',
    41	          status: 'PENDING'
    42	        }
    43	      ],
    44	      transactions: []
    45	    };
    46	
    47	    const createDbMock = (state: any, shouldThrowOnUpdate: boolean = false) => {
    48	      return {
    49	        withExclusiveTransactionAsync: jest.fn(async (cb) => {
    50	          // Clone state for transaction
    51	          const txState = {
    52	            loans: JSON.parse(JSON.stringify(state.loans)),
    53	            schedules: JSON.parse(JSON.stringify(state.schedules)),
    54	            transactions: JSON.parse(JSON.stringify(state.transactions))
    55	          };
    56	          const tx = createDbMock(txState, shouldThrowOnUpdate);
    57	          
    58	          try {
    59	            await cb(tx);
    60	            // Commit
    61	            state.loans = txState.loans;
    62	            state.schedules = txState.schedules;
    63	            state.transactions = txState.transactions;
    64	          } catch (e) {
    65	            // Rollback (do nothing)
    66	            throw e;
    67	          }
    68	        }),
    69	        getFirstAsync: jest.fn(async (query: string, params: any[] = []) => {
    70	          if (query.includes('FROM loans WHERE id = ?')) {
    71	            return state.loans.find(l => l.id === params[0]) || null;
    72	          }
    73	          if (query.includes('operation_id = ?')) {
    74	            return state.transactions.find(t => t.operation_id === params[0]) || null;
    75	          }
    76	          if (query.includes('SUM(amount_paise)')) {
    77	            const sum = state.transactions
    78	              .filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT')
    79	              .reduce((acc, t) => acc + t.amount_paise, 0);
    80	            return { total: sum };
    81	          }
    82	          if (query.includes('SUM(allocated_penalty_paise)')) {
    83	            const sum = state.transactions
    84	              .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
    85	              .reduce((acc, t) => acc + t.allocated_penalty_paise, 0);
    86	            return { total: sum };
    87	          }
    88	          if (query.includes('SUM(allocated_principal_paise)')) {
    89	            const sum = state.transactions
    90	              .filter(t => t.loan_id === params[0] && t.transaction_type === 'COLLECTION')
    91	              .reduce((acc, t) => acc + (t.allocated_principal_paise || 0), 0);
    92	            return { total: sum };
    93	          }
    94	          return null;
    95	        }),
    96	        getAllAsync: jest.fn(async (query: string, params: any[] = []) => {
    97	          if (query.includes('FROM repayment_schedules WHERE loan_id = ?')) {
    98	            return state.schedules.filter(s => s.loan_id === params[0]);
    99	          }
   100	          if (query.includes('PENALTY_ASSESSMENT')) {
   101	            return state.transactions.filter(t => t.loan_id === params[0] && t.transaction_type === 'PENALTY_ASSESSMENT');
   102	          }
   103	          return [];
   104	        }),
   105	        runAsync: jest.fn(async (query: string, params: any[] = []) => {
   106	          if (query.includes('INSERT INTO transactions')) {
   107	            state.transactions.push({
   108	              id: params[0],
   109	              operation_id: params[1],
   110	              loan_id: params[2],
   111	              transaction_type: params[3],
   112	              is_cash: params[4],
   113	              payment_method: params[5],
   114	              amount_paise: params[6],
   115	              allocated_principal_paise: params[7],
   116	              allocated_markup_paise: params[8],
   117	              allocated_penalty_paise: params[9],
   118	              unallocated_surplus_paise: params[10],
   119	              effective_date: params[11],
   120	              created_at: params[12]
   121	            });
   122	          }
   123	          if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
   124	            const loan = state.loans.find(l => l.id === params[0]);
   125	            if (loan) loan.status = 'SETTLED';
   126	          }
   127	        }),
   128	        prepareAsync: jest.fn(async (query: string) => {
   129	          return {
   130	            executeAsync: jest.fn(async (params: any[]) => {
   131	              if (shouldThrowOnUpdate && query.includes('UPDATE repayment_schedules')) {
   132	                throw new Error('DB failure during update');
   133	              }
   134	              if (query.includes('UPDATE repayment_schedules')) {
   135	                const schedule = state.schedules.find(s => s.loan_id === params[3] && s.installment_number === params[4]);
   136	                if (schedule) {
   137	                  schedule.principal_paid_paise = params[0];
   138	                  schedule.markup_paid_paise = params[1];
   139	                  schedule.status = params[2];
   140	                }
   141	              }
   142	            }),
   143	            finalizeAsync: jest.fn(async () => {})
   144	          };
   145	        })
   146	      };
   147	    };
   148	
   149	    mockDb = createDbMock(dbState, false);
   150	    txRepo = new TransactionRepository(mockDb);
   151	  });
   152	
   153	  it('Payment against Loan B should only update Loan B and satisfy conservation', async () => {
   154	    // Perform partial payment on Loan B (1500)
   155	    await txRepo.recordCashPayment('loan-b', toPaise(1500), 'op-b-1', '2026-01-02');
   156	    
   157	    // Verify Loan A is unchanged
   158	    const loanASchedule = dbState.schedules.find(s => s.loan_id === 'loan-a');
   159	    expect(loanASchedule.principal_paid_paise).toBe(0);
   160	    expect(loanASchedule.markup_paid_paise).toBe(0);
   161	    
   162	    // Verify Loan B updated
   163	    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
   164	    expect(loanBSchedule.markup_paid_paise).toBeGreaterThan(0);
   165	    expect(loanBSchedule.status).toBe('PARTIALLY_PAID'); // partial payment
   166	    
   167	    // Conservation assertion
   168	    const collections = dbState.transactions.filter(t => t.transaction_type === 'COLLECTION');
   169	    expect(collections.length).toBe(1);
   170	    
   171	    const amountPaid = collections[0].amount_paise;
   172	    const allocatedPrincipal = collections[0].allocated_principal_paise;
   173	    const allocatedMarkup = collections[0].allocated_markup_paise;
   174	    const allocatedPenalty = collections[0].allocated_penalty_paise;
   175	    const surplus = collections[0].unallocated_surplus_paise;
   176	    
   177	    expect(amountPaid).toBe(allocatedPrincipal + allocatedMarkup + allocatedPenalty + surplus);
   178	    expect(amountPaid).toBe(toPaise(1500));
   179	  });
   180	
   181	  it('Payment idempotency: skips execution if operation_id exists', async () => {
   182	    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
   183	    const txCount = dbState.transactions.length;
   184	    
   185	    // Repeat same operation ID
   186	    await txRepo.recordCashPayment('loan-b', toPaise(2600), 'existing-op', '2026-01-02');
   187	    expect(dbState.transactions.length).toBe(txCount);
   188	  });
   189	  
   190	  it('Bullet Principal test: fully pays bullet loan and settles it', async () => {
   191	    // Pay on due date so there's no penalty
   192	    await txRepo.recordCashPayment('loan-b', toPaise(3500), 'op-b-full', '2026-01-01');
   193	    
   194	    const loanBSchedule = dbState.schedules.find(s => s.loan_id === 'loan-b');
   195	    expect(loanBSchedule.status).toBe('PAID');
   196	    
   197	    const loanB = dbState.loans.find(l => l.id === 'loan-b');
   198	    expect(loanB.status).toBe('SETTLED');
   199	  });
   200	
   201	  it('Rollback: throws and propagates if an error occurs during transaction after successful writes', async () => {
   202	    // Inject mock that throws on update
   203	    const errorMockDb = mockDb = { ...mockDb, withExclusiveTransactionAsync: jest.fn(async (cb) => {
   204	      // Clone state
   205	      const txState = {
   206	        loans: JSON.parse(JSON.stringify(dbState.loans)),
   207	        schedules: JSON.parse(JSON.stringify(dbState.schedules)),
   208	        transactions: JSON.parse(JSON.stringify(dbState.transactions))
   209	      };
   210	      
   211	      // Override prepareAsync to throw
   212	      const tx = { ...mockDb, 
   213	        getFirstAsync: async (q: string, p: any[]) => {
   214	          if (q.includes('FROM loans WHERE id = ?')) return txState.loans.find((l:any) => l.id === p[0]);
   215	          return null;
   216	        },
   217	        getAllAsync: async (q: string, p: any[]) => {
   218	          if (q.includes('FROM repayment_schedules')) return txState.schedules.filter((s:any) => s.loan_id === p[0]);
   219	          return [];
   220	        },
   221	        runAsync: async (q: string, p: any[]) => {
   222	          if (q.includes('INSERT INTO transactions')) txState.transactions.push({ id: p[0], transaction_type: p[3] });
   223	        },
   224	        prepareAsync: async (q: string) => ({
   225	          executeAsync: async () => { throw new Error('DB failure during update'); },
   226	          finalizeAsync: async () => {}
   227	        })
   228	      };
   229	      
   230	      try {
   231	        await cb(tx);
   232	        // Will not reach here due to error
   233	      } catch(e) {
   234	        throw e;
   235	      }
   236	    })};
   237	    
   238	    txRepo = new TransactionRepository(errorMockDb);
   239	
   240	    await expect(txRepo.recordCashPayment('loan-a', toPaise(2600), 'fail-op', '2026-01-02'))
   241	      .rejects.toThrow('DB failure during update');
   242	      
   243	    // Verify that the global dbState remains completely unchanged
   244	    expect(dbState.transactions.length).toBe(0);
   245	    const loanA = dbState.loans.find(l => l.id === 'loan-a');
   246	    expect(loanA.status).toBe('ACTIVE');
   247	    const scheduleA = dbState.schedules.find(s => s.loan_id === 'loan-a');
   248	    expect(scheduleA.principal_paid_paise).toBe(0);
   249	  });
   250	});
  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE') return;

    const kists = await tx.getAllAsync(`
      SELECT * FROM repayment_schedules 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loanId]);
    
    if (kists.length === 0) return;
    const lastKist = kists[kists.length - 1];
    const currentDate = new Date().toISOString().split('T')[0];
    
    // If the last kist's due date is in the past, generate new ones until we pass currentDate
    if (lastKist.effective_due_date < currentDate) {
      // dynamic import for schedule util if needed, but it's not exported yet? Wait, I exported it.
      const { calculateNextDueDate } = require('../domain/schedule');
      const { toPaise } = require('../domain/money');
      
      const totalMarkup = loan.principal_paise * loan.markup_factor;
      const markupDuePerMonth = Math.floor(totalMarkup / loan.term_months);
      
      let nextInstalmentNumber = lastKist.installment_number + 1;
      let monthsToAddFromStart = nextInstalmentNumber;
      
      let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
      
      const statement = await tx.prepareAsync(`
        INSERT INTO repayment_schedules 
        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1 /* always add at least one if we entered */) {
          await statement.executeAsync([
            crypto.randomUUID(),
            loanId,
            nextInstalmentNumber,
            nextDueDate,
            nextDueDate,
            0,
            markupDuePerMonth,
            markupDuePerMonth
          ]);
        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
        principalDue: principalInstalments[i],
        markupDue: markupInstalments[i]
      });
    }
  } else if (productType === 'bullet') {
    const markupInstalments = dividePaise(totalMarkup, termMonths);
    
    for (let i = 0; i < termMonths; i++) {
      const principalDue = 0 as Paise;
      const markupDue = markupInstalments[i];
      const amountDue = addPaise(principalDue, markupDue);
      
      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue,
        principalDue,
        markupDue
      });
    }
  }
  
  return schedule;
}
# Tenant Isolation

CredKeep V2 is a multi-tenant application where each registered Lender acts as a unique tenant. Data isolation between tenants is the most critical security requirement.

## Application-Layer Isolation
1. **Implicit Scoping:** Every authenticated request is tied to a user, and thus a `tenant_id`. API endpoints do not accept `tenant_id` as a parameter; it is injected from the session.
2. **Foreign Key Integrity:** Every top-level model (Borrower, Loan, Transaction, Device) must include a `tenant_id` foreign key.
3. **Composite Relationships:** Relationships across models implicitly validate tenancy (e.g., `LoanAccount(tenant_id, id)`).

## Database-Layer Isolation (PostgreSQL RLS)
To guard against accidental application-level query bugs, PostgreSQL Row-Level Security (RLS) will be employed.

1. **Policies:** Tables will have policies enforcing `tenant_id = current_setting('credkeep.current_tenant')`.
2. **Transaction Context:** Django middleware or a custom database router will execute `SET LOCAL credkeep.current_tenant = X` at the beginning of every request transaction.
3. **Restricted DB Role:** The Django application connects using a PostgreSQL role that is not a superuser and does not own the tables (thereby preventing it from bypassing RLS by default).

## Testing Tenant Isolation
Automated test suites MUST include scenarios where:
- Lender A attempts to fetch Borrower B using a direct URL.
- Lender A attempts to submit a `record_collection` operation against Loan B.
- Global queries (e.g., aggregate reports) are executed, proving they only sum data within the active `tenant_id` scope.
# Financial Invariants

The backend must enforce the following financial constraints independently of the mobile app to ensure integrity.

## 1. Immutability
- **Transactions:** The `transactions` table is append-only. No UPDATE or DELETE operations are permitted on existing collections or assessments.
- **Reversals:** Mistakes must be corrected by issuing a new compensating transaction (e.g., `transaction_type = 'REVERSAL'`) rather than deleting the original record.

## 2. Integer Math (Paise)
- All financial fields (`principal_paise`, `amount_paise`) are stored and computed as exact integers.
- Floating-point calculations are strictly prohibited in the Python backend ledger logic.

## 3. Allocation Constraints
For any given collection transaction:
- `allocated_principal_paise + allocated_markup_paise + allocated_penalty_paise + unallocated_surplus_paise` MUST EXACTLY EQUAL `amount_paise`.
- The total `principal_paid_paise` across all kists for a loan must never exceed the loan's `principal_paise`.

## 4. Penalty Rules (Preserved from V1)
- Late penalty is ₹100 per calendar day per overdue loan, starting the day after the due date.
- Penalties do not compound.
- A penalty assessment is represented as a distinct `PENALTY_ASSESSMENT` transaction record, increasing the total outstanding balance.

## 5. Settlement
- A loan transitions to `SETTLED` state only when:
  - All scheduled kists are `PAID`.
  - The outstanding principal is zero (for bullet loans).
  - All assessed penalties have been cleared (allocated to collections or explicitly waived).

 exited 7 in 5289ms:
/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/utils/errors.js:130
    throw error;
    ^

Error: ENOENT: no such file or directory, mkdir '/home/sagar/.expo'
    at Object.mkdirSync (node:fs:1410:26)
    at write (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:228:27)
    at setSync (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:276:12)
    at JsonFile.set (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:108:16)
    at getAnonymousId (/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/api/user/UserSettings.js:191:18)
    at new Telemetry (/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/utils/telemetry/Telemetry.js:32:66)
    at getTelemetry (/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/utils/telemetry/index.js:43:21)
    at record (/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/utils/telemetry/index.js:59:29)
    at recordCommand (/mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/src/utils/telemetry/index.js:66:12)
    at /mnt/f/personal projects/credkeep/node_modules/expo/node_modules/@expo/cli/build/bin/cli:274:9 {
  errno: -2,
  code: 'ENOENT',
  syscall: 'mkdir',
  path: '/home/sagar/.expo'
}

Node.js v24.21.0

 exited 1 in 5329ms:
Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

 exited 2 in 12868ms:
src/__tests__/cross-loan.test.ts(71,37): error TS7006: Parameter 'l' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(74,44): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(78,23): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(79,24): error TS7006: Parameter 'acc' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(79,29): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(84,23): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(85,24): error TS7006: Parameter 'acc' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(85,29): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(90,23): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(91,24): error TS7006: Parameter 'acc' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(91,29): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(98,43): error TS7006: Parameter 's' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(101,46): error TS7006: Parameter 't' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(124,43): error TS7006: Parameter 'l' implicitly has an 'any' type.
src/__tests__/cross-loan.test.ts(135,55): error TS7006: Parameter 's' implicitly has an 'any' type.

exec
/bin/bash -lc "python3 -m pytest --version; python3 -c 'import django; print(django.get_version())'; git diff --ignore-space-at-eol HEAD -- src/core/domain/money.ts src/core/domain/schedule.ts jest.config.js tsconfig.json backend/tenants/views.py; git show feat/v2-backend-foundation:backend/tenants/middleware.py | nl -ba; git show feat/v2-backend-foundation:backend/tenants/tests.py | nl -ba | tail -50" in /mnt/f/personal projects/credkeep
 succeeded in 565ms:
/usr/bin/python3: No module named pytest
Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'django'
     1	from django.db import connection, DatabaseError
     2	from django.core.exceptions import PermissionDenied, ObjectDoesNotExist
     3	
     4	class TenantMiddleware:
     5	    """
     6	    Middleware to extract the tenant from the authenticated user and set it in the database context.
     7	    Sets a session-level configuration for PostgreSQL RLS and resets it after the request.
     8	    """
     9	    def __init__(self, get_response):
    10	        self.get_response = get_response
    11	
    12	    def __call__(self, request):
    13	        if not request.user.is_authenticated:
    14	            request.tenant = None
    15	            return self.get_response(request)
    16	
    17	        try:
    18	            tenant = request.user.owned_tenant
    19	            request.tenant = tenant
    20	        except ObjectDoesNotExist as e:
    21	            raise PermissionDenied("User does not have an active tenant.") from e
    22	
    23	        db_context_set = False
    24	        if connection.vendor == 'postgresql':
    25	            with connection.cursor() as cursor:
    26	                cursor.execute("SET credkeep.current_tenant = %s", [str(tenant.id)])
    27	                db_context_set = True
    28	
    29	        try:
    30	            response = self.get_response(request)
    31	            return response
    32	        finally:
    33	            if db_context_set and connection.vendor == 'postgresql':
    34	                try:
    35	                    with connection.cursor() as cursor:
    36	                        cursor.execute("RESET credkeep.current_tenant")
    37	                except DatabaseError:
    38	                    pass
    90	    
    91	    if connection.vendor == 'postgresql':
    92	        with connection.cursor() as cursor:
    93	            # Set to tenant1
    94	            cursor.execute("SET credkeep.current_tenant = %s", [str(tenant1.id)])
    95	            
    96	            # Tenant 1 should see the device
    97	            cursor.execute("SELECT id FROM tenants_device")
    98	            result = cursor.fetchall()
    99	            assert len(result) == 1
   100	            
   101	            # Reset and try as user_without_tenant (simulated with random uuid)
   102	            cursor.execute("SET credkeep.current_tenant = '00000000-0000-0000-0000-000000000000'")
   103	            cursor.execute("SELECT id FROM tenants_device")
   104	            result2 = cursor.fetchall()
   105	            assert len(result2) == 0
   106	            
   107	            cursor.execute("RESET credkeep.current_tenant")
   108	    else:
   109	        pytest.skip("Skipping RLS validation on SQLite backend.")
   110	
   111	@pytest.mark.django_db
   112	@pytest.mark.skipif(connection.vendor != 'postgresql', reason="Requires PostgreSQL RLS")
   113	def test_postgresql_restricted_role_isolation(user_with_tenant, device_for_tenant1):
   114	    user, tenant = user_with_tenant
   115	    other_tenant = Tenant.objects.create(name="Other Tenant", owner=User.objects.create_user(username='other_user', password='password'))
   116	    
   117	    with connection.cursor() as cursor:
   118	        try:
   119	            # We must be able to switch to the restricted app role.
   120	            # If the role doesn't exist, this will throw, failing the test if run on a real pg instance.
   121	            cursor.execute("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'credkeep_app') THEN CREATE ROLE credkeep_app; END IF; END $$;")
   122	            cursor.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO credkeep_app;")
   123	            cursor.execute("SET ROLE credkeep_app")
   124	            
   125	            # Set context to other_tenant
   126	            cursor.execute("SET credkeep.current_tenant = %s", [str(other_tenant.id)])
   127	            
   128	            # Cross-tenant reads should fail / return 0
   129	            devices = Device.objects.all()
   130	            assert devices.count() == 0, "Role failed to isolate reads"
   131	            
   132	            # Rejected writes
   133	            with pytest.raises(Exception):
   134	                # RLS should reject this insert under credkeep_app
   135	                Device.objects.create(tenant=tenant, push_token="hack")
   136	                
   137	        finally:
   138	            cursor.execute("RESET ROLE")
   139	            cursor.execute("RESET credkeep.current_tenant")

codex
The typecheck fails with 15 implicit-`any` errors in the new regression test. I also found that its bullet fixture differs from production schedules and its rollback mock never commits, even on success. The PostgreSQL rejection test lacks a savepoint, which would leave its transaction aborted before cleanup. Jest and Expo lint hit filesystem write restrictions; I’m trying the configured linter directly.

exec
/bin/bash -lc './node_modules/.bin/eslint . --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git diff --ignore-space-at-eol HEAD -- src/__tests__/cross-loan.test.ts src/core/database/transactionRepository.ts backend/tenants/tests.py backend/tenants/middleware.py; cat tsconfig.json; cat backend/pytest.ini; rg -n 'CONN_MAX_AGE|pool|psycopg|pytest' backend/credkeep_backend/settings.py backend/requirements.txt; git show feat/v2-backend-foundation:src/core/database/transactionRepository.ts | nl -ba | sed -n '78,153p'" in /mnt/f/personal projects/credkeep
 succeeded in 374ms:
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  }
}
[pytest]
DJANGO_SETTINGS_MODULE = credkeep_backend.settings
python_files = tests.py test_*.py *_tests.py
backend/requirements.txt:14:psycopg==3.3.6
backend/requirements.txt:15:psycopg-binary==3.3.6
backend/requirements.txt:17:pytest==9.1.1
backend/requirements.txt:18:pytest-django==4.14.0
    78	        for (const a of result.allocations) {
    79	          allocatedPrincipal += a.allocatedToPrincipal;
    80	          allocatedMarkup += a.allocatedToMarkup;
    81	          allocatedPenalty += a.allocatedToPenalty;
    82	        }
    83	
    84	        let pastPrincipalPaid = 0;
    85	        if (loan.product_type === 'bullet') {
    86	          const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
    87	            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
    88	            [loanId]
    89	          );
    90	          pastPrincipalPaid = pastPrincipalPaidRes?.total || 0;
    91	          const remainingPrincipal = loan.principal_paise - pastPrincipalPaid;
    92	          
    93	          if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
    94	            const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
    95	            allocatedPrincipal += payPrincipal;
    96	            result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
    97	          }
    98	        }
    99	        
   100	        await tx.runAsync(`
   101	          INSERT INTO transactions (
   102	            id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
   103	            amount_paise, allocated_principal_paise, allocated_markup_paise, 
   104	            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
   105	          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   106	        `, [
   107	          transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
   108	          paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
   109	          result.unallocatedFunds, effectiveDate, createdAt
   110	        ]);
   111	        
   112	        // Update repayment schedules
   113	        const updateStmt = await tx.prepareAsync(`
   114	          UPDATE repayment_schedules
   115	          SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
   116	          WHERE loan_id = ? AND installment_number = ?
   117	        `);
   118	        
   119	        try {
   120	          for (const k of result.updatedKists) {
   121	            // Only update if changed
   122	            const orig = kists.find(o => o.kistNumber === k.kistNumber)!;
   123	            if (k.amountPaid !== orig.amountPaid || k.status !== orig.status) {
   124	               await updateStmt.executeAsync([
   125	                 k.principalPaid, k.markupPaid, k.status || 'PENDING', loanId, k.kistNumber
   126	               ]);
   127	            }
   128	          }
   129	        } finally {
   130	          await updateStmt.finalizeAsync();
   131	        }
   132	        // Check if loan should be closed
   133	        let allKistsPaid = true;
   134	        for (const k of result.updatedKists) {
   135	          if (k.status !== 'PAID') {
   136	            allKistsPaid = false;
   137	            break;
   138	          }
   139	        }
   140	        
   141	        if (loan.product_type === 'instalment') {
   142	          if (allKistsPaid && result.remainingPenalty <= 0) {
   143	             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
   144	          }
   145	        } else if (loan.product_type === 'bullet') {
   146	          if ((pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
   147	             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
   148	          }
   149	        }
   150	        
   151	        returnResult = { success: true, transactionId, result };
   152	      });
   153	      

 exited 130 in 37770ms:
exec
/bin/bash -lc './node_modules/.bin/eslint src/__tests__/cross-loan.test.ts src/core/database/transactionRepository.ts --no-cache' in /mnt/f/personal projects/credkeep
codex
The review supports REWORK: the typecheck fails, the financial regression has two coverage defects, and the backend has RLS cleanup and test issues. Static inspection found no new cross-loan or conservation defect in the payment code change. Runtime verification remains incomplete because Jest cannot create its cache and Python lacks Django and pytest.

 exited 130 in 33189ms:
codex
**REWORK**

Reviewed committed changes from `8a3be8d` to `a455ede`.

### Standards and regression findings

- **P1 — Typecheck fails.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:71>) introduces 15 TS7006 implicit-`any` errors. Type the mock state and callbacks before approval.
- **P2 — Bullet regression uses unrealistic data.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:33>) includes principal in bullet schedules; production schedules contain only markup. The mock at line 97 also misses the multiline schedule query, silently bypassing extension. Test realistic schedules, partial principal payments, final settlement, and conservation.
- **P2 — Rollback assertions are insufficient.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:203>) discards transaction state even when the callback succeeds. Reuse the commit-capable mock with injected failure, assert writes occurred before failure, and verify a successful retry.

### Spec findings

- **P1 — PostgreSQL rejection test leaves its transaction aborted.** [tenants/tests.py](</mnt/f/personal projects/credkeep/backend/tenants/tests.py:133>) catches the denied insert without a savepoint; subsequent `RESET ROLE` fails. Wrap the insertion in nested `transaction.atomic()` and assert the specific database exception.
- **P1 — Tenant cleanup failure is suppressed.** [middleware.py](</mnt/f/personal projects/credkeep/backend/tenants/middleware.py:33>) uses session-scoped tenant context and ignores reset errors. Connection reuse could retain that context. Implement the specified transaction-local context, or discard the connection when cleanup fails.

Static inspection confirms loan-scoped payment queries and an exclusive transaction around financial mutations. No new conservation defect was identified. Identical payment replay is handled; conflicting operation-ID reuse across loans or amounts remains an existing weakness that the regression does not cover.

Validation: **typecheck failed**; Jest and Expo lint were blocked by filesystem writes; direct ESLint did not complete; backend tests require unavailable Django/pytest dependencies. Runtime invariants remain unverified.

**Findings: Standards/regression 3; Spec 2. Both axes require rework.**
tokens used
45,236
**REWORK**

Reviewed committed changes from `8a3be8d` to `a455ede`.

### Standards and regression findings

- **P1 — Typecheck fails.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:71>) introduces 15 TS7006 implicit-`any` errors. Type the mock state and callbacks before approval.
- **P2 — Bullet regression uses unrealistic data.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:33>) includes principal in bullet schedules; production schedules contain only markup. The mock at line 97 also misses the multiline schedule query, silently bypassing extension. Test realistic schedules, partial principal payments, final settlement, and conservation.
- **P2 — Rollback assertions are insufficient.** [cross-loan.test.ts](</mnt/f/personal projects/credkeep/src/__tests__/cross-loan.test.ts:203>) discards transaction state even when the callback succeeds. Reuse the commit-capable mock with injected failure, assert writes occurred before failure, and verify a successful retry.

### Spec findings

- **P1 — PostgreSQL rejection test leaves its transaction aborted.** [tenants/tests.py](</mnt/f/personal projects/credkeep/backend/tenants/tests.py:133>) catches the denied insert without a savepoint; subsequent `RESET ROLE` fails. Wrap the insertion in nested `transaction.atomic()` and assert the specific database exception.
- **P1 — Tenant cleanup failure is suppressed.** [middleware.py](</mnt/f/personal projects/credkeep/backend/tenants/middleware.py:33>) uses session-scoped tenant context and ignores reset errors. Connection reuse could retain that context. Implement the specified transaction-local context, or discard the connection when cleanup fails.

Static inspection confirms loan-scoped payment queries and an exclusive transaction around financial mutations. No new conservation defect was identified. Identical payment replay is handled; conflicting operation-ID reuse across loans or amounts remains an existing weakness that the regression does not cover.

Validation: **typecheck failed**; Jest and Expo lint were blocked by filesystem writes; direct ESLint did not complete; backend tests require unavailable Django/pytest dependencies. Runtime invariants remain unverified.

**Findings: Standards/regression 3; Spec 2. Both axes require rework.**

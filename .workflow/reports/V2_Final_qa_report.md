OpenAI Codex v0.163.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a14891-88c1-7851-bf81-8d1727a1020f
--------
user
Perform focused, read-only QA review on milestone V2_Final.
Review ONLY the git diff between 62ee653 and 31d05db and directly impacted dependencies.
Scope: Verify financial calculation correctness, payment idempotency, tenant isolation, SQLCipher/database mutations, migrations, or sync integrity.

Token-Optimization & Review Invariants:
1. Review only the changed files in the commit range (62ee653...31d05db). Do not perform broad repository indexing.
2. Limit your findings to at most 5 actionable issues, ordered strictly by severity (P0 Critical first, down to P2 Minor).
3. If no critical or high severity defects are found, return: APPROVED.
4. If blocking defects exist, provide concise file/line references and return: REWORK.
5. Do NOT suggest broad architectural rewrites or stylistic nitpicks.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the specified diff and directly impacted dependencies, focusing on financial correctness, database safety, isolation, and sync integrity. I’ll use the code-review skill and keep the review read-only.
exec
/bin/bash -lc 'cat .agents/skills/code-review/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 36ms:
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

exec
/bin/bash -lc 'git status --short; git diff --stat 62ee653...31d05db; git diff --name-only 62ee653...31d05db' in /mnt/f/personal projects/credkeep
 succeeded in 3056ms:
 M .agents/rules/graphify.md
 M .agents/skills/code-review/SKILL.md
 M .agents/skills/code-review/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/SKILL.md
 M .agents/skills/diagnosing-bugs/agents/openai.yaml
 M .agents/skills/financial-invariant-verification/SKILL.md
 M .agents/skills/react-native-testing/SKILL.md
 M .agents/skills/security-review/SKILL.md
 M .agents/skills/sqlite-integration-testing/SKILL.md
 M .agents/skills/tdd/SKILL.md
 M .agents/skills/tdd/agents/openai.yaml
 M .agents/skills/tdd/mocking.md
 M .agents/skills/tdd/tests.md
 M .agents/workflows/graphify.md
 M .codex/hooks.json.disabled
 M .gitattributes
 M .gitignore
 M .graphifyignore
 M .npmrc
 M .scratch/screens/CredKeep_Borrowers.html
 M .scratch/screens/CredKeep_Collections.html
 M .scratch/screens/CredKeep_Home.html
 M .scratch/screens/CredKeep_Loans.html
 M .scratch/screens/CredKeep_More_Settings.html
 M .scratch/screens/New_Loan_Borrower_&_Product.html
 M .scratch/screens/New_Loan_Review_&_Create.html
 M .scratch/screens/New_Loan_Security.html
 M .scratch/screens/New_Loan_Terms_&_Calculation.html
 M .scratch/screens/Payment_Recorded.html
 M .scratch/screens/Record_Payment.html
 M .scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
 M .workflow/AGENT_ROLES.md
 M .workflow/DECISIONS.md
 M .workflow/MODEL_POLICY.md
 M .workflow/QA_GATE.md
 M .workflow/SESSION_LOG.md
 M .workflow/TASKS.md
 M .workflow/V2_TASKS.md
 M .workflow/handoff.ps1
 M .workflow/handoffs/.gitkeep
 M .workflow/mock-cmd.bat
 M .workflow/plans/.gitkeep
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
 M .workflow/qa-codex.ps1
 M .workflow/reports/.gitkeep
 M .workflow/reports/CK-P0-002_QA.md
 M .workflow/reports/CODEX_EXECUTION_STATUS.md
 M .workflow/reports/CODEX_QA_DIAGNOSTIC.md
 M .workflow/reports/QA_REPAIR_SUMMARY.md
 M .workflow/reports/Stale_Home_earnings_qa_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_report.md
 M .workflow/reports/V2_Milestone_qa_guard.json
 M .workflow/reports/V2_Milestone_qa_prompt.txt
 M .workflow/reports/V2_Milestone_qa_report.md
 M .workflow/reports/V2_Phase1_qa_prompt.txt
 M .workflow/reports/V2_Phase1_qa_report.md
 M .workflow/reports/V2_RENDER_STAGING_DEPLOYMENT.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/reports/mock-task_qa_prompt.txt
 M .workflow/run-codex.ps1
 M .workflow/status.ps1
 M .workflow/test-qa-orchestrator.ps1
 M .workflow/tests/.gitkeep
 M AGENTS.md
 M app.json
 M backend/.gitignore
 M backend/Dockerfile
 M backend/README.md
 M backend/api/admin.py
 M backend/api/apps.py
 M backend/api/authentication.py
 M backend/api/models.py
 M backend/api/tests.py
 M backend/api/urls.py
 M backend/api/views.py
 M backend/api/views_auth.py
 M backend/credkeep_backend/asgi.py
 M backend/credkeep_backend/settings.py
 M backend/credkeep_backend/urls.py
 M backend/credkeep_backend/wsgi.py
 M backend/ledger/__init__.py
 M backend/ledger/admin.py
 M backend/ledger/apps.py
 M backend/ledger/engine/__init__.py
 M backend/ledger/engine/allocation.py
 M backend/ledger/engine/penalty.py
 M backend/ledger/engine/schedule.py
 M backend/ledger/migrations/0001_initial.py
 M backend/ledger/migrations/0002_rls.py
 M backend/ledger/migrations/0003_syncoutbox_unique_tenant_outbox_sequence.py
 M backend/ledger/migrations/0004_loanaccount_check_loan_markup_factor_non_negative_and_more.py
 M backend/ledger/migrations/0005_transaction_unique_tenant_transaction_sequence.py
 M backend/ledger/migrations/0006_synclog_operation_type_synclog_request_payload.py
 M backend/ledger/migrations/0007_loanaccount_annual_rate_loanaccount_collateral_and_more.py
 M backend/ledger/models.py
 M backend/ledger/tests.py
 M backend/manage.py
 M backend/pytest.ini
 M backend/tenants/admin.py
 M backend/tenants/apps.py
 M backend/tenants/management/commands/verify_database_role.py
 M backend/tenants/management/commands/verify_rls.py
 M backend/tenants/middleware.py
 M backend/tenants/migrations/0001_initial.py
 M backend/tenants/migrations/0002_device.py
 M backend/tenants/migrations/0003_rls.py
 M backend/tenants/migrations/0004_tenant_outbox_sequence_counter.py
 M backend/tenants/migrations/0005_tenant_transaction_sequence_counter.py
 M backend/tenants/models.py
 M backend/tenants/test_deployment_checks.py
 M backend/tenants/tests.py
 M backend/tenants/views.py
 M design/credkeep_design_pack/03_workflow/COMPLETION_TRACKER.csv
 M design/credkeep_design_pack/03_workflow/STITCH_GENERATION_RESULTS.ndjson
 M design/credkeep_design_pack/04_audit/DESIGN_GAP_MATRIX.csv
 M docs/FINANCIAL_RULES.md
 M docs/v2/01-v1-audit.md
 M docs/v2/02-system-architecture.md
 M docs/v2/03-backend-design.md
 M docs/v2/04-threat-model.md
 M docs/v2/05-tenant-isolation.md
 M docs/v2/06-data-model.md
 M docs/v2/07-financial-invariants.md
 M docs/v2/08-migrations.md
 M docs/v2/09-sync-protocol.md
 M docs/v2/10-sync-failure-matrix.md
 M docs/v2/11-v1-migration.md
 M docs/v2/12-api-contract.md
 M docs/v2/13-hosting.md
 M docs/v2/14-operations.md
 M docs/v2/15-test-strategy.md
 M docs/v2/16-release-roadmap.md
 M docs/v2/17-risk-register.md
 M docs/v2/18-open-decisions.md
 M docs/v2/README.md
 M eas.json
 M fetch_screens.js
 M package-lock.json
 M package.json
 M render.yaml
 M src/__tests__/bullet-loan.test.ts
 M src/__tests__/cross-loan.test.ts
 M src/__tests__/loans.test.tsx
 M src/app/(tabs)/_layout.tsx
 M src/app/settings/security.tsx
 M src/core/database/borrowerRepository.ts
 M src/core/database/loanRepository.test.ts
 M src/core/database/loanRepository.ts
 M src/core/database/transactionRepository.ts
 M src/core/domain/allocation.test.ts
 M src/core/domain/allocation.ts
 M src/core/domain/backupUtil.test.ts
 M src/core/domain/backupUtil.ts
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/penalty.test.ts
 M src/core/domain/penalty.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M src/core/sync/syncService.test.ts
 M src/core/sync/syncService.ts
 M src/ui/Keypad.tsx
 M tsconfig.json
?? .agents/skills/graphify/
?? .codex/hooks.json
?? .codex/skills/
?? .workflow/reports/V2_Final_qa_prompt.txt
?? .workflow/reports/V2_Final_qa_report.md
 .workflow/reports/V2_Milestone_qa_guard.json       |    9 +
 .workflow/reports/V2_Milestone_qa_prompt.txt       |   10 +
 .workflow/reports/V2_Milestone_qa_report.md        | 5616 ++++++++++++++++++++
 .../IMPLEMENTATION_PROGRESS.md                     |    6 +-
 src/core/database/loanRepository.ts                |   45 +-
 src/core/sync/syncService.ts                       |  150 +-
 6 files changed, 5767 insertions(+), 69 deletions(-)
.workflow/reports/V2_Milestone_qa_guard.json
.workflow/reports/V2_Milestone_qa_prompt.txt
.workflow/reports/V2_Milestone_qa_report.md
design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md
src/core/database/loanRepository.ts
src/core/sync/syncService.ts

exec
/bin/bash -lc 'git log --oneline 62ee653..31d05db; git diff 62ee653...31d05db -- src/core/database/loanRepository.ts src/core/sync/syncService.ts design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md; git show 31d05db:package.json' in /mnt/f/personal projects/credkeep
 succeeded in 347ms:
31d05db fix(sync): remediate Codex QA findings for attachment ordering and pull constraint reconciliation
diff --git a/design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md b/design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md
index 6647215..ca855f7 100644
--- a/design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md
+++ b/design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md
@@ -120,7 +120,11 @@
     - 151 / 151 Tests passed
   - Django / Python Backend Test Suite (`backend\.venv\Scripts\pytest backend`):
     - 87 passed, 3 skipped, 0 failed in 106s
-  - Offline Safety: Fully verified with encrypted SQLite and append-only ledger transactions.
+  - Independent Codex Milestone QA: Audited via `qa-codex.ps1` (`gpt-6.1-sol`, medium reasoning). Remediated 4 P1 edge cases:
+    1. Reconciled acknowledged transactions in pull to prevent payment replay over server snapshots.
+    2. Added `operation_id` reconciliation for `loan_terms` during pull to prevent UNIQUE constraint collisions.
+    3. Added `operation_id` reconciliation for `payment_corrections` during pull to prevent UNIQUE constraint collisions.
+    4. Enqueued `create_loan` before attachments and replaced `att-${id}` prefix with valid UUIDs for Django backend validation.
   - Release Gate Status: Ready for Product Owner review before triggering EAS release build.
 
 
diff --git a/src/core/database/loanRepository.ts b/src/core/database/loanRepository.ts
index 7183abf..c5bfb01 100644
--- a/src/core/database/loanRepository.ts
+++ b/src/core/database/loanRepository.ts
@@ -222,11 +222,33 @@ export class LoanRepository {
         }
       }
 
+      await OutboxManager.enqueue(txHandle, {
+        operationId: clientOpId,
+        operationType: 'create_loan',
+        payload: {
+          id: loanId,
+          borrower_id: borrowerId,
+          principal_paise: options.principal,
+          markup_factor: options.markupFactor || 0,
+          annual_rate: annualRate,
+          rate_basis: rateBasis,
+          interest_paise: interestPaise,
+          total_paise: totalPaise,
+          maturity_date: maturityDate,
+          term_months: options.termMonths,
+          start_date: options.startDate,
+          due_day: options.dueDay,
+          product_type: options.productType,
+          collateral: options.collateral || null,
+        },
+      });
+
       if (options.attachments && options.attachments.length > 0) {
         for (const att of options.attachments) {
           const attPath = att.file_path || att.uri || '';
           const fileName = attPath.split('/').pop()?.split('\\').pop() || 'attachment';
           const attId = generateUuid();
+          const attOpId = generateUuid();
           await txHandle.runAsync(
             `INSERT INTO loan_attachments (
               id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
@@ -244,7 +266,7 @@ export class LoanRepository {
           );
 
           await OutboxManager.enqueue(txHandle, {
-            operationId: `att-${attId}`,
+            operationId: attOpId,
             operationType: 'upload_attachment_metadata',
             payload: {
               id: attId,
@@ -258,27 +280,6 @@ export class LoanRepository {
           });
         }
       }
-
-      await OutboxManager.enqueue(txHandle, {
-        operationId: clientOpId,
-        operationType: 'create_loan',
-        payload: {
-          id: loanId,
-          borrower_id: borrowerId,
-          principal_paise: options.principal,
-          markup_factor: options.markupFactor || 0,
-          annual_rate: annualRate,
-          rate_basis: rateBasis,
-          interest_paise: interestPaise,
-          total_paise: totalPaise,
-          maturity_date: maturityDate,
-          term_months: options.termMonths,
-          start_date: options.startDate,
-          due_day: options.dueDay,
-          product_type: options.productType,
-          collateral: options.collateral || null,
-        },
-      });
     });
 
     SyncCoordinator.notifyMutation();
diff --git a/src/core/sync/syncService.ts b/src/core/sync/syncService.ts
index ecdf7f8..191aafd 100644
--- a/src/core/sync/syncService.ts
+++ b/src/core/sync/syncService.ts
@@ -247,29 +247,64 @@ export class SyncService {
     } else if (record_type === 'LOAN_TERM') {
       const isSettled = (payload.interest_settled !== undefined ? payload.interest_settled : (payload.settled ? 1 : 0)) ? 1 : 0;
       if (operation_type === 'INSERT') {
-        await tx.runAsync(
-          `INSERT INTO loan_terms (
-             id, loan_id, term_number, duration_months, annual_rate, interest_paise,
-             start_date, maturity_date, interest_settled, settled, operation_id, created_at
-           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
-           ON CONFLICT(id) DO UPDATE SET
-             interest_settled = excluded.interest_settled,
-             settled = excluded.settled`,
-          [
-            payload.id,
-            payload.loan_id,
-            payload.term_number,
-            payload.duration_months,
-            payload.annual_rate,
-            payload.interest_paise,
-            payload.start_date,
-            payload.maturity_date,
-            isSettled,
-            isSettled,
-            payload.operation_id || null,
-            payload.created_at || new Date().toISOString(),
-          ]
-        );
+        let existingTerm: any = null;
+        if (payload.operation_id) {
+          existingTerm = await tx.getFirstAsync<{ id: string }>(
+            `SELECT id FROM loan_terms WHERE operation_id = ? OR id = ?`,
+            [payload.operation_id, payload.id]
+          );
+        } else {
+          existingTerm = await tx.getFirstAsync<{ id: string }>(
+            `SELECT id FROM loan_terms WHERE id = ?`,
+            [payload.id]
+          );
+        }
+
+        if (existingTerm) {
+          await tx.runAsync(
+            `UPDATE loan_terms SET 
+               id = ?,
+               interest_settled = ?,
+               settled = ?,
+               annual_rate = ?,
+               interest_paise = ?,
+               maturity_date = ?
+             WHERE id = ?`,
+            [
+              payload.id,
+              isSettled,
+              isSettled,
+              payload.annual_rate,
+              payload.interest_paise,
+              payload.maturity_date,
+              existingTerm.id,
+            ]
+          );
+        } else {
+          await tx.runAsync(
+            `INSERT INTO loan_terms (
+               id, loan_id, term_number, duration_months, annual_rate, interest_paise,
+               start_date, maturity_date, interest_settled, settled, operation_id, created_at
+             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+             ON CONFLICT(id) DO UPDATE SET
+               interest_settled = excluded.interest_settled,
+               settled = excluded.settled`,
+            [
+              payload.id,
+              payload.loan_id,
+              payload.term_number,
+              payload.duration_months,
+              payload.annual_rate,
+              payload.interest_paise,
+              payload.start_date,
+              payload.maturity_date,
+              isSettled,
+              isSettled,
+              payload.operation_id || null,
+              payload.created_at || new Date().toISOString(),
+            ]
+          );
+        }
       } else if (operation_type === 'UPDATE') {
         await tx.runAsync(
           `UPDATE loan_terms SET interest_settled = ?, settled = ? WHERE id = ?`,
@@ -308,28 +343,48 @@ export class SyncService {
     } else if (record_type === 'PAYMENT_CORRECTION') {
       if (operation_type === 'INSERT') {
         const origAmt = payload.original_amount_paise ?? payload.previous_amount_paise ?? 0;
-        await tx.runAsync(
-          `INSERT INTO payment_corrections (
-             id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
-             replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
-             reason, operation_id, created_at
-           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
-           ON CONFLICT(id) DO NOTHING`,
-          [
-            payload.id,
-            payload.loan_id,
-            payload.original_transaction_id,
-            payload.original_operation_id || null,
-            payload.reversal_transaction_id,
-            payload.replacement_transaction_id || null,
-            origAmt,
-            origAmt,
-            payload.corrected_amount_paise,
-            payload.reason,
-            payload.operation_id || null,
-            payload.created_at || new Date().toISOString(),
-          ]
-        );
+        let existingCorr: any = null;
+        if (payload.operation_id) {
+          existingCorr = await tx.getFirstAsync<{ id: string }>(
+            `SELECT id FROM payment_corrections WHERE operation_id = ? OR id = ?`,
+            [payload.operation_id, payload.id]
+          );
+        } else {
+          existingCorr = await tx.getFirstAsync<{ id: string }>(
+            `SELECT id FROM payment_corrections WHERE id = ?`,
+            [payload.id]
+          );
+        }
+
+        if (existingCorr) {
+          await tx.runAsync(
+            `UPDATE payment_corrections SET id = ? WHERE id = ?`,
+            [payload.id, existingCorr.id]
+          );
+        } else {
+          await tx.runAsync(
+            `INSERT INTO payment_corrections (
+               id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
+               replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
+               reason, operation_id, created_at
+             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+             ON CONFLICT(id) DO NOTHING`,
+            [
+              payload.id,
+              payload.loan_id,
+              payload.original_transaction_id,
+              payload.original_operation_id || null,
+              payload.reversal_transaction_id,
+              payload.replacement_transaction_id || null,
+              origAmt,
+              origAmt,
+              payload.corrected_amount_paise,
+              payload.reason,
+              payload.operation_id || null,
+              payload.created_at || new Date().toISOString(),
+            ]
+          );
+        }
       }
     } else if (record_type === 'KIST') {
       if (operation_type === 'INSERT') {
@@ -457,9 +512,12 @@ export class SyncService {
                 break;
               }
             }
-
           }
         }
+
+        if (payload.operation_id) {
+          await OutboxManager.markSynced(tx, [payload.operation_id]);
+        }
         if (!existing) {
           await tx.runAsync(
             `INSERT INTO transactions (
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
    "expo-image-picker": "~57.0.20",
    "expo-linking": "~57.0.12",
    "expo-local-authentication": "~57.0.3",
    "expo-network": "~57.0.2",
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

exec
/bin/bash -lc 'git show 31d05db:src/core/sync/syncService.ts' in /mnt/f/personal projects/credkeep
 succeeded in 81ms:
import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ApiClient } from '../api/client';
import { AuthStore } from '../auth/authStore';
import { OutboxManager, registerOutboxRevertHandler } from './outbox';
import { allocatePayment } from '../domain/allocation';
import { Paise } from '../domain/money';
import { getMigratedTransactionOpId } from '../migration/uuidUtils';
import { withDbTransaction } from '../database/transaction';


export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  needsReviewCount?: number;
  success: boolean;
  errors?: string[];
}

export class SyncService {
  /**
   * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/
   */
  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {
    const token = await AuthStore.getToken();
    if (!token) return { pushed: 0, failed: 0 };

    let totalPushed = 0;
    let totalFailed = 0;

    while (true) {
      const pending = await OutboxManager.getPending(db, 50);
      if (pending.length === 0) break;

      const deviceId = await AuthStore.getDeviceId();
      const operations = pending.map((record) => ({
        operation_id: record.operation_id,
        type: record.operation_type,
        timestamp: record.created_at,
        payload: JSON.parse(record.payload),
      }));

      try {
        const response = await ApiClient.post('/sync/push/', {
          device_id: deviceId,
          operations,
        });

        let batchFailed = 0;
        const results = response?.results || [];
        const acknowledgedOpIds = new Set<string>();

        for (const res of results) {
          if (!res?.operation_id) continue;
          acknowledgedOpIds.add(res.operation_id);

          if (res.status === 'ACCEPTED' || res.status === 'ALREADY_EXISTS') {
            await OutboxManager.markSynced(db, [res.operation_id]);
            totalPushed++;
          } else if (res.status === 'REJECTED') {
            await this.revertRejectedPayment(db, res.operation_id, res.error);
            batchFailed++;
          } else if (res.status === 'FAILED') {
            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error);
            batchFailed++;
          } else {
            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error || res.status);
            batchFailed++;
          }
        }

        // Validate that every submitted operation received an acknowledgment result
        for (const op of operations) {
          if (!acknowledgedOpIds.has(op.operation_id)) {
            await OutboxManager.markStatus(db, op.operation_id, 'NEEDS_REVIEW', 'Missing server result in push response');
            batchFailed++;
          }
        }

        totalFailed += batchFailed;
        if (batchFailed > 0) {
          // Stop further batch execution on failure to preserve sequential dependency
          break;
        }
      } catch {
        totalFailed += pending.length;
        break;
      }
    }

    return { pushed: totalPushed, failed: totalFailed };
  }

  /**
   * PULL Protocol: Queries /api/v2/sync/pull/?cursor={cursor} and merges state changes
   */
  static async pullChanges(db: SQLiteDatabase): Promise<{ pulled: number }> {
    const token = await AuthStore.getToken();
    if (!token) return { pulled: 0 };

    const cursorStr = await OutboxManager.getMeta(db, 'last_pull_cursor');
    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
    if (isNaN(cursor)) cursor = 0;

    let hasMore = true;
    let totalPulled = 0;

    while (hasMore) {
      const response = await ApiClient.get(`/sync/pull/?cursor=${cursor}&limit=100`);
      const changes = response.changes || [];

      if (changes.length > 0) {
        cursor = response.next_cursor;
        hasMore = Boolean(response.has_more);
        await withDbTransaction(db, async (tx) => {
          const modifiedScheduleLoanIds = new Set<string>();
          for (const change of changes) {
            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);
          }
          for (const loanId of modifiedScheduleLoanIds) {
            await this.reapplyPendingCollections(tx, loanId);
          }
          await OutboxManager.setMeta(tx, 'last_pull_cursor', String(cursor));
        });
        totalPulled += changes.length;
      } else {
        cursor = response.next_cursor;
        hasMore = Boolean(response.has_more);
        await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));
      }
    }

    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());
    return { pulled: totalPulled };
  }

  /**
   * Applies an authoritative server delta event into the local SQLite database
   */
  static async applyServerChange(tx: SQLiteDatabase, change: any, modifiedLoanIds?: Set<string>): Promise<void> {
    const { record_type, operation_type, payload } = change;
    if (!payload) return;

    if (
      (record_type === 'KIST' ||
        (record_type === 'TRANSACTION' &&
          (payload.transaction_type === 'WAIVER' ||
            payload.transaction_type === 'PENALTY_ASSESSMENT' ||
            (payload.transaction_type === 'REVERSAL' && (payload.forgiven_penalty_paise || 0) > 0)))) &&
      payload.loan_id &&
      modifiedLoanIds
    ) {
      modifiedLoanIds.add(payload.loan_id);
    }

    if (record_type === 'BORROWER') {
      if (operation_type === 'INSERT') {
        await tx.runAsync(
          `INSERT INTO borrowers (id, name, phone, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,
          [payload.id, payload.name, payload.phone, payload.created_at || new Date().toISOString()]
        );
      } else if (operation_type === 'UPDATE') {
        await tx.runAsync(
          `UPDATE borrowers SET name = ?, phone = ? WHERE id = ?`,
          [payload.name, payload.phone, payload.id]
        );
      }
    } else if (record_type === 'LOAN') {
      if (operation_type === 'INSERT') {
        await tx.runAsync(
          `INSERT INTO loans (
             id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,
             interest_paise, total_paise, maturity_date, term_months, start_date, due_day,
             product_type, collateral, status, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             annual_rate = excluded.annual_rate,
             rate_basis = excluded.rate_basis,
             interest_paise = excluded.interest_paise,
             total_paise = excluded.total_paise,
             maturity_date = excluded.maturity_date,
             term_months = excluded.term_months,
             collateral = excluded.collateral`,
          [
            payload.id,
            payload.borrower_id,
            payload.principal_paise,
            parseFloat(payload.markup_factor) || 0,
            payload.annual_rate || 0,
            payload.rate_basis || 'ANNUAL_SIMPLE_FLAT',
            payload.interest_paise || 0,
            payload.total_paise || payload.principal_paise,
            payload.maturity_date || null,
            payload.term_months,
            payload.start_date,
            payload.due_day,
            payload.product_type,
            payload.collateral || null,
            payload.status || 'ACTIVE',
            payload.created_at || new Date().toISOString(),
          ]
        );
      } else if (operation_type === 'UPDATE') {
        const updateFields: string[] = [];
        const updateParams: any[] = [];
        if (payload.status !== undefined) {
          updateFields.push('status = ?');
          updateParams.push(payload.status);
        }
        if (payload.annual_rate !== undefined) {
          updateFields.push('annual_rate = ?');
          updateParams.push(payload.annual_rate);
        }
        if (payload.rate_basis !== undefined) {
          updateFields.push('rate_basis = ?');
          updateParams.push(payload.rate_basis);
        }
        if (payload.interest_paise !== undefined) {
          updateFields.push('interest_paise = ?');
          updateParams.push(payload.interest_paise);
        }
        if (payload.total_paise !== undefined) {
          updateFields.push('total_paise = ?');
          updateParams.push(payload.total_paise);
        }
        if (payload.maturity_date !== undefined) {
          updateFields.push('maturity_date = ?');
          updateParams.push(payload.maturity_date);
        }
        if (payload.term_months !== undefined) {
          updateFields.push('term_months = ?');
          updateParams.push(payload.term_months);
        }
        if (payload.collateral !== undefined) {
          updateFields.push('collateral = ?');
          updateParams.push(payload.collateral);
        }
        if (updateFields.length > 0) {
          updateParams.push(payload.id);
          await tx.runAsync(`UPDATE loans SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
        }
      }
    } else if (record_type === 'LOAN_TERM') {
      const isSettled = (payload.interest_settled !== undefined ? payload.interest_settled : (payload.settled ? 1 : 0)) ? 1 : 0;
      if (operation_type === 'INSERT') {
        let existingTerm: any = null;
        if (payload.operation_id) {
          existingTerm = await tx.getFirstAsync<{ id: string }>(
            `SELECT id FROM loan_terms WHERE operation_id = ? OR id = ?`,
            [payload.operation_id, payload.id]
          );
        } else {
          existingTerm = await tx.getFirstAsync<{ id: string }>(
            `SELECT id FROM loan_terms WHERE id = ?`,
            [payload.id]
          );
        }

        if (existingTerm) {
          await tx.runAsync(
            `UPDATE loan_terms SET 
               id = ?,
               interest_settled = ?,
               settled = ?,
               annual_rate = ?,
               interest_paise = ?,
               maturity_date = ?
             WHERE id = ?`,
            [
              payload.id,
              isSettled,
              isSettled,
              payload.annual_rate,
              payload.interest_paise,
              payload.maturity_date,
              existingTerm.id,
            ]
          );
        } else {
          await tx.runAsync(
            `INSERT INTO loan_terms (
               id, loan_id, term_number, duration_months, annual_rate, interest_paise,
               start_date, maturity_date, interest_settled, settled, operation_id, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               interest_settled = excluded.interest_settled,
               settled = excluded.settled`,
            [
              payload.id,
              payload.loan_id,
              payload.term_number,
              payload.duration_months,
              payload.annual_rate,
              payload.interest_paise,
              payload.start_date,
              payload.maturity_date,
              isSettled,
              isSettled,
              payload.operation_id || null,
              payload.created_at || new Date().toISOString(),
            ]
          );
        }
      } else if (operation_type === 'UPDATE') {
        await tx.runAsync(
          `UPDATE loan_terms SET interest_settled = ?, settled = ? WHERE id = ?`,
          [isSettled, isSettled, payload.id]
        );
      }
    } else if (record_type === 'LOAN_ATTACHMENT') {
      if (operation_type === 'INSERT') {
        const docType = payload.doc_type || payload.document_type || 'OTHER';
        const filePath = payload.file_path || payload.file_name || payload.storage_key || '';
        const fileName = payload.file_name || (filePath ? filePath.split('/').pop()?.split('\\').pop() : 'attachment') || 'attachment';
        await tx.runAsync(
          `INSERT INTO loan_attachments (
             id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'SYNCED', ?)
           ON CONFLICT(id) DO UPDATE SET
             file_path = excluded.file_path,
             file_name = excluded.file_name,
             doc_type = excluded.doc_type,
             document_type = excluded.document_type,
             notes = excluded.notes,
             synced = 1,
             sync_status = 'SYNCED'`,
          [
            payload.id,
            payload.loan_id,
            filePath,
            fileName,
            docType,
            docType,
            payload.notes || null,
            payload.created_at || new Date().toISOString(),
          ]
        );
      }
    } else if (record_type === 'PAYMENT_CORRECTION') {
      if (operation_type === 'INSERT') {
        const origAmt = payload.original_amount_paise ?? payload.previous_amount_paise ?? 0;
        let existingCorr: any = null;
        if (payload.operation_id) {
          existingCorr = await tx.getFirstAsync<{ id: string }>(
            `SELECT id FROM payment_corrections WHERE operation_id = ? OR id = ?`,
            [payload.operation_id, payload.id]
          );
        } else {
          existingCorr = await tx.getFirstAsync<{ id: string }>(
            `SELECT id FROM payment_corrections WHERE id = ?`,
            [payload.id]
          );
        }

        if (existingCorr) {
          await tx.runAsync(
            `UPDATE payment_corrections SET id = ? WHERE id = ?`,
            [payload.id, existingCorr.id]
          );
        } else {
          await tx.runAsync(
            `INSERT INTO payment_corrections (
               id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
               replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
               reason, operation_id, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO NOTHING`,
            [
              payload.id,
              payload.loan_id,
              payload.original_transaction_id,
              payload.original_operation_id || null,
              payload.reversal_transaction_id,
              payload.replacement_transaction_id || null,
              origAmt,
              origAmt,
              payload.corrected_amount_paise,
              payload.reason,
              payload.operation_id || null,
              payload.created_at || new Date().toISOString(),
            ]
          );
        }
      }
    } else if (record_type === 'KIST') {
      if (operation_type === 'INSERT') {
        const existingKist = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
          [payload.id, payload.loan_id, payload.installment_number]
        );
        if (existingKist) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_component_paise = ?,
               markup_component_paise = ?,
               total_due_paise = ?,
               effective_due_date = ?,
               principal_paid_paise = ?,
               markup_paid_paise = ?,
               status = ?,
               server_principal_paid_paise = ?,
               server_markup_paid_paise = ?,
               server_status = ?
             WHERE id = ?`,
            [
              payload.principal_component_paise || 0,
              payload.markup_component_paise || 0,
              payload.total_due_paise,
              payload.effective_due_date,
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
              existingKist.id,
            ]
          );
        } else {
          await tx.runAsync(
            `INSERT INTO repayment_schedules (
               id, loan_id, installment_number, original_due_date, effective_due_date,
               principal_component_paise, markup_component_paise, total_due_paise,
               principal_paid_paise, markup_paid_paise, status,
               server_principal_paid_paise, server_markup_paid_paise, server_status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.id,
              payload.loan_id,
              payload.installment_number,
              payload.original_due_date,
              payload.effective_due_date,
              payload.principal_component_paise || 0,
              payload.markup_component_paise || 0,
              payload.total_due_paise,
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
              payload.principal_paid_paise || 0,
              payload.markup_paid_paise || 0,
              payload.status || 'PENDING',
            ]
          );
        }
      } else if (operation_type === 'UPDATE') {
        const existingKist = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
          [payload.id, payload.loan_id, payload.installment_number]
        );
        const kistId = existingKist ? existingKist.id : payload.id;
        if (payload.principal_component_paise !== undefined || payload.markup_component_paise !== undefined || payload.total_due_paise !== undefined) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_component_paise = COALESCE(?, principal_component_paise),
               markup_component_paise = COALESCE(?, markup_component_paise),
               total_due_paise = COALESCE(?, total_due_paise)
             WHERE id = ?`,
            [payload.principal_component_paise, payload.markup_component_paise, payload.total_due_paise, kistId]
          );
        }
        if (payload.effective_due_date) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET effective_due_date = ? WHERE id = ?`,
            [payload.effective_due_date, kistId]
          );
        }
        if (payload.status !== undefined || payload.principal_paid_paise !== undefined) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_paid_paise = COALESCE(?, principal_paid_paise),
               markup_paid_paise = COALESCE(?, markup_paid_paise),
               status = COALESCE(?, status),
               server_principal_paid_paise = COALESCE(?, server_principal_paid_paise),
               server_markup_paid_paise = COALESCE(?, server_markup_paid_paise),
               server_status = COALESCE(?, server_status)
             WHERE id = ?`,
            [
              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
              kistId
            ]
          );
        }
      }
    } else if (record_type === 'TRANSACTION') {
      if (operation_type === 'INSERT') {
        const isCash = payload.is_cash !== undefined ? (payload.is_cash ? 1 : 0) : 1;
        const paymentMethod = payload.payment_method || (isCash ? 'CASH' : 'ONLINE');
        let existing: any = null;
        if (payload.transaction_type === 'PENALTY_ASSESSMENT') {
          existing = await tx.getFirstAsync<any>(
            `SELECT * FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
            [payload.operation_id, payload.loan_id, payload.effective_date]
          );
        } else {
          existing = await tx.getFirstAsync<any>(
            `SELECT * FROM transactions WHERE operation_id = ? OR id = ?`,
            [payload.operation_id, payload.id || payload.operation_id]
          );
          if (!existing) {
            const allLocalTx = await tx.getAllAsync<any>(
              `SELECT id, operation_id, loan_id, effective_date, amount_paise, transaction_type, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise FROM transactions WHERE transaction_type IN ('COLLECTION', 'WAIVER', 'REVERSAL')`
            );
            for (const ltx of allLocalTx || []) {
              const expectedMigOpId = getMigratedTransactionOpId(ltx);
              if (expectedMigOpId === payload.operation_id || ltx.id === payload.id || ltx.operation_id === payload.operation_id) {
                existing = ltx;
                break;
              }
            }
          }
        }

        if (payload.operation_id) {
          await OutboxManager.markSynced(tx, [payload.operation_id]);
        }
        if (!existing) {
          await tx.runAsync(
            `INSERT INTO transactions (
               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
               unallocated_surplus_paise, forgiven_penalty_paise, effective_date,
               reversal_of_id, correction_reason, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.id,
              payload.operation_id,
              payload.loan_id,
              payload.transaction_type,
              isCash,
              paymentMethod,
              payload.amount_paise || 0,
              payload.allocated_principal_paise || 0,
              payload.allocated_markup_paise || 0,
              payload.allocated_penalty_paise || 0,
              payload.unallocated_surplus_paise || 0,
              payload.forgiven_penalty_paise || 0,
              payload.effective_date,
              payload.reversal_of_id || null,
              payload.correction_reason || null,
              payload.created_at || new Date().toISOString(),
            ]
          );
        } else if (existing.transaction_type === 'COLLECTION' && payload.transaction_type === 'COLLECTION') {
          // Reconcile authoritative server allocations via append-only adjustment transaction, respecting trigger
          const matchingOpIds = Array.from(
            new Set([payload.operation_id, existing.operation_id, existing.id].filter(Boolean))
          );
          const opConditions = matchingOpIds.map(() => `(
            operation_id = ?
            OR id = ?
            OR instr(operation_id, 'realloc::' || ? || '::') = 1
            OR instr(operation_id, 'reconcile::' || ? || '::') = 1
          )`).join(' OR ');

          const queryParams: any[] = [payload.loan_id];
          for (const opId of matchingOpIds) {
            queryParams.push(opId, opId, opId, opId);
          }

          const netAllocRow = await tx.getFirstAsync<{
            netPrincipal: number;
            netMarkup: number;
            netPenalty: number;
            netSurplus: number;
          }>(
            `SELECT
               COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
               COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
               COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
               COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
             FROM transactions
             WHERE loan_id = ?
               AND (${opConditions})`,
            queryParams
          );

          const currentPrincipal = netAllocRow?.netPrincipal ?? (existing.allocated_principal_paise || 0);
          const currentMarkup = netAllocRow?.netMarkup ?? (existing.allocated_markup_paise || 0);
          const currentPenalty = netAllocRow?.netPenalty ?? (existing.allocated_penalty_paise || 0);
          const currentSurplus = netAllocRow?.netSurplus ?? (existing.unallocated_surplus_paise || 0);

          const deltaPrincipal = (payload.allocated_principal_paise || 0) - currentPrincipal;
          const deltaMarkup = (payload.allocated_markup_paise || 0) - currentMarkup;
          const deltaPenalty = (payload.allocated_penalty_paise || 0) - currentPenalty;
          const deltaSurplus = (payload.unallocated_surplus_paise || 0) - currentSurplus;

          if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
            const reconId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('recon-' + Date.now() + '-' + Math.random().toString(36).substring(2));
            const reconOpId = `reconcile::${payload.operation_id}::${reconId.substring(0, 8)}`;
            await tx.runAsync(
              `INSERT INTO transactions (
                 id, operation_id, loan_id, transaction_type, is_cash, payment_method,
                 amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
                 unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                reconId,
                reconOpId,
                payload.loan_id,
                'REVERSAL',
                0,
                'SYSTEM',
                0,
                deltaPrincipal,
                deltaMarkup,
                deltaPenalty,
                deltaSurplus,
                0,
                payload.effective_date,
                new Date().toISOString(),
              ]
            );
          }
        }
      }
    }
  }

  /**
   * Reapplies unacknowledged local collection allocations after server schedule snapshots
   * to ensure local pending payments are never erased.
   */
  static async reapplyPendingCollections(tx: SQLiteDatabase, loanId: string): Promise<void> {
    if (!loanId) return;

    // Reset kists to authoritative server baseline before replaying pending collections
    await tx.runAsync(
      `UPDATE repayment_schedules SET
         principal_paid_paise = COALESCE(server_principal_paid_paise, 0),
         markup_paid_paise = COALESCE(server_markup_paid_paise, 0),
         status = COALESCE(server_status, 'PENDING')
       WHERE loan_id = ?`,
      [loanId]
    );

    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
    );

    const relevant = pendingOutbox.filter((item) => {
      try {
        const p = JSON.parse(item.payload);
        return p.loan_id === loanId;
      } catch {
        return false;
      }
    });

    relevant.sort((a, b) => {
      try {
        const pa = JSON.parse(a.payload);
        const pb = JSON.parse(b.payload);
        const dateA = pa.effective_date || '';
        const dateB = pb.effective_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
      } catch {}
      return 0;
    });

    const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);

    let replayedBulletPrincipalPaid = 0;
    if (loan?.product_type === 'bullet') {
      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )`,
        [loanId]
      );
      replayedBulletPrincipalPaid = bulletPrincipalRow?.total || 0;
    }

    if (relevant.length > 0) {
      let replayedPendingPenaltyPaid = 0;
      for (const item of relevant) {
        const p = JSON.parse(item.payload);
        const paymentAmount = (p.amount_paise || 0) as Paise;
        const effectiveDate = p.effective_date || new Date().toISOString().split('T')[0];

        // Calculate actual outstanding penalties dynamically bounded by payment effective_date
        const penaltyRow = await tx.getFirstAsync<{ assessed: number; paid: number; forgiven: number }>(
          `SELECT
             COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ? THEN amount_paise ELSE 0 END), 0) as assessed,
             COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECTION', 'REVERSAL')
               AND effective_date <= ?
               AND NOT EXISTS (
                 SELECT 1 FROM sync_outbox so
                 WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
                   AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
                   AND (
                     transactions.operation_id = so.operation_id
                     OR transactions.operation_id = 'reversal-' || so.operation_id
                     OR transactions.operation_id = 'reversal::' || so.operation_id

                     OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                     OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
                   )
               )
               THEN allocated_penalty_paise ELSE 0 END), 0) as paid,
             COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') AND effective_date <= ? THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
           FROM transactions WHERE loan_id = ?`,
          [effectiveDate, effectiveDate, effectiveDate, loanId]
        );
        const outstandingPenalty = Math.max(
          0,
          (penaltyRow?.assessed || 0) - ((penaltyRow?.paid || 0) + replayedPendingPenaltyPaid) - (penaltyRow?.forgiven || 0)
        ) as Paise;

        const kists = await tx.getAllAsync<any>(
          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
          [loanId]
        );
        if (!kists || kists.length === 0) continue;

        const allocInput = {
          paymentAmount,
          kists: kists.map((k) => ({
            kistNumber: k.installment_number,
            amountDue: k.total_due_paise as Paise,
            principalDue: k.principal_component_paise as Paise,
            markupDue: k.markup_component_paise as Paise,
            amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
            principalPaid: k.principal_paid_paise as Paise,
            markupPaid: k.markup_paid_paise as Paise,
            isDue: k.effective_due_date <= effectiveDate,
            status: k.status,
          })),
          outstandingPenalty,
        };

        const result = allocatePayment(allocInput);

        let newAllocPrincipal = 0;
        let newAllocMarkup = 0;
        let newAllocPenalty = 0;
        for (const a of result.allocations) {
          newAllocPrincipal += a.allocatedToPrincipal;
          newAllocMarkup += a.allocatedToMarkup;
          newAllocPenalty += a.allocatedToPenalty;
        }
        replayedPendingPenaltyPaid += newAllocPenalty;

        let newAllocSurplus = result.unallocatedFunds || 0;
        if (loan?.product_type === 'bullet' && newAllocSurplus > 0) {
          const remainingPrincipal = Math.max(0, loan.principal_paise - replayedBulletPrincipalPaid);
          const payPrincipal = Math.min(newAllocSurplus, remainingPrincipal);
          newAllocPrincipal += payPrincipal;
          newAllocSurplus -= payPrincipal;
          replayedBulletPrincipalPaid += payPrincipal;
        }

        // Reconcile pending collection ledger entry with replayed allocations
        const currentColNet = await tx.getFirstAsync<{
          currentPrincipal: number;
          currentMarkup: number;
          currentPenalty: number;
          currentSurplus: number;
        }>(
          `SELECT
             COALESCE(SUM(allocated_principal_paise), 0) as currentPrincipal,
             COALESCE(SUM(allocated_markup_paise), 0) as currentMarkup,
             COALESCE(SUM(allocated_penalty_paise), 0) as currentPenalty,
             COALESCE(SUM(unallocated_surplus_paise), 0) as currentSurplus
           FROM transactions
           WHERE loan_id = ?
             AND (
               operation_id = ?

               OR instr(operation_id, 'realloc::' || ? || '::') = 1

               OR instr(operation_id, 'reconcile::' || ? || '::') = 1
             )`,
          [loanId, item.operation_id, item.operation_id, item.operation_id]
        );

        const currentPrincipal = currentColNet?.currentPrincipal ?? 0;
        const currentMarkup = currentColNet?.currentMarkup ?? 0;
        const currentPenalty = currentColNet?.currentPenalty ?? 0;
        const currentSurplus = currentColNet?.currentSurplus ?? 0;

        const deltaPrincipal = newAllocPrincipal - currentPrincipal;
        const deltaMarkup = newAllocMarkup - currentMarkup;
        const deltaPenalty = newAllocPenalty - currentPenalty;
        const deltaSurplus = newAllocSurplus - currentSurplus;

        if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
          const reallocId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('realloc-' + Date.now() + '-' + Math.random().toString(36).substring(2));
          const reallocOpId = `realloc::${item.operation_id}::${reallocId.substring(0, 8)}`;
          await tx.runAsync(
            `INSERT INTO transactions (
               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
               unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reallocId,
              reallocOpId,
              loanId,
              'REVERSAL',
              0,
              'SYSTEM',
              0,
              deltaPrincipal,
              deltaMarkup,
              deltaPenalty,
              deltaSurplus,
              0,
              effectiveDate,
              new Date().toISOString(),
            ]
          );
        }

        for (const uk of result.updatedKists) {
          await tx.runAsync(
            `UPDATE repayment_schedules SET
               principal_paid_paise = ?,
               markup_paid_paise = ?,
               status = ?
             WHERE loan_id = ? AND installment_number = ?`,
            [uk.principalPaid, uk.markupPaid, uk.status || 'PENDING', loanId, uk.kistNumber]
          );
        }
      }
    }

    // Reconcile loan status with authoritative server state and outstanding penalties
    const finalKists = await tx.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ?`,
      [loanId]
    );
    const allPaid = finalKists.length > 0 && finalKists.every((k) => k.status === 'PAID');
    if (loan) {
      if (loan.status === 'WRITTEN_OFF') {
        // Authoritative WRITTEN_OFF terminal status must be preserved
      } else {
        const finalPenaltyRow = await tx.getFirstAsync<{ assessed: number; paid: number; forgiven: number }>(
          `SELECT
             COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' THEN amount_paise ELSE 0 END), 0) as assessed,
             COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECTION', 'REVERSAL')
               AND NOT EXISTS (
                 SELECT 1 FROM sync_outbox so
                 WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
                   AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
                   AND (
                     transactions.operation_id = so.operation_id
                     OR transactions.operation_id = 'reversal-' || so.operation_id
                     OR transactions.operation_id = 'reversal::' || so.operation_id
                     OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1
                     OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
                   )
               )
               THEN allocated_penalty_paise ELSE 0 END), 0) as paid,
             COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
           FROM transactions WHERE loan_id = ?`,
          [loanId]
        );
        const finalOutstandingPenalty = Math.max(
          0,
          (finalPenaltyRow?.assessed || 0) - (finalPenaltyRow?.paid || 0) - (finalPenaltyRow?.forgiven || 0)
        );

        let isSettled = false;
        if (loan.product_type === 'instalment') {
          const totalPrincipalPaid = finalKists.reduce((acc, k) => acc + (k.principal_paid_paise || 0), 0);
          isSettled = allPaid && totalPrincipalPaid >= loan.principal_paise && finalOutstandingPenalty <= 0;
        } else if (loan.product_type === 'bullet') {
          isSettled = allPaid && replayedBulletPrincipalPaid >= loan.principal_paise && finalOutstandingPenalty <= 0;
        }
        await tx.runAsync(`UPDATE loans SET status = ? WHERE id = ?`, [isSettled ? 'SETTLED' : 'ACTIVE', loanId]);
      }
    }
  }

  /**
   * Compensates and reverts rejected payment mutations locally.
   * Inserts an append-only compensating REVERSAL ledger entry,
   * reverses affected kist paid amounts, and restores loan status.
   */
  static async revertRejectedPayment(db: SQLiteDatabase, operationId: string, errorReason?: string): Promise<void> {
    await withDbTransaction(db, async (tx) => {
      await OutboxManager.markStatus(tx, operationId, 'REJECTED', errorReason);

      const origTx = await tx.getFirstAsync<any>(
        `SELECT * FROM transactions WHERE operation_id = ? AND transaction_type = 'COLLECTION'`,
        [operationId]
      );
      if (!origTx) return;

      const reversalOpId = `reversal-${operationId}`;
      const existingReversal = await tx.getFirstAsync<any>(
        `SELECT id FROM transactions WHERE operation_id = ?`,
        [reversalOpId]
      );
      if (existingReversal) return;

      // Query current net allocations across the original collection and any realloc adjustments
      const netAllocRow = await tx.getFirstAsync<{
        netAmount: number;
        netPrincipal: number;
        netMarkup: number;
        netPenalty: number;
        netSurplus: number;
      }>(
        `SELECT
           COALESCE(SUM(amount_paise), 0) as netAmount,
           COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
           COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
           COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
           COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
         FROM transactions
         WHERE loan_id = ?
           AND (
             operation_id = ?

             OR instr(operation_id, 'realloc::' || ? || '::') = 1

             OR instr(operation_id, 'reconcile::' || ? || '::') = 1
           )`,
        [origTx.loan_id, operationId, operationId, operationId]
      );

      const revId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2));
      await tx.runAsync(
        `INSERT INTO transactions (
           id, operation_id, loan_id, transaction_type, is_cash, payment_method,
           amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
           unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          revId,
          reversalOpId,
          origTx.loan_id,
          'REVERSAL',
          0,
          'SYSTEM',
          -(netAllocRow?.netAmount ?? origTx.amount_paise),
          -(netAllocRow?.netPrincipal ?? origTx.allocated_principal_paise),
          -(netAllocRow?.netMarkup ?? origTx.allocated_markup_paise),
          -(netAllocRow?.netPenalty ?? origTx.allocated_penalty_paise),
          -(netAllocRow?.netSurplus ?? origTx.unallocated_surplus_paise),
          0,
          origTx.effective_date || new Date().toISOString().split('T')[0],
          new Date().toISOString(),
        ]
      );

      await SyncService.recalculateLoanSchedule(tx, origTx.loan_id);
    });
  }

  /**
   * Recalculates repayment schedules and loan status by replaying
   * all valid non-rejected collections for the loan.
   */
  static async recalculateLoanSchedule(tx: SQLiteDatabase, loanId: string): Promise<void> {
    const loan = await tx.getFirstAsync<any>(
      `SELECT * FROM loans WHERE id = ?`,
      [loanId]
    );
    if (!loan) return;

    // Reset all kists to 0 paid
    await tx.runAsync(
      `UPDATE repayment_schedules
       SET principal_paid_paise = 0, markup_paid_paise = 0, status = 'PENDING'
       WHERE loan_id = ?`,
      [loanId]
    );

    // Get all valid non-rejected collections in chronological sequence
    const collections = await tx.getAllAsync<any>(
      `SELECT t.* FROM transactions t
       WHERE t.loan_id = ? AND t.transaction_type = 'COLLECTION'
         AND t.operation_id NOT IN (
           SELECT operation_id FROM sync_outbox WHERE status = 'REJECTED'
         )
       ORDER BY t.sequence_number ASC`,
      [loanId]
    );

    let replayedPenaltyPaid = 0;
    let replayedBulletPrincipalPaid = 0;

    for (const col of collections) {
      const penaltyRow = await tx.getFirstAsync<{ assessed: number; forgiven: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ? THEN amount_paise ELSE 0 END), 0) as assessed,
           COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') AND effective_date <= ? THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
         FROM transactions WHERE loan_id = ?`,
        [col.effective_date, col.effective_date, loanId]
      );
       const reconRow = await tx.getFirstAsync<{ deltaPenalty: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_type = 'REVERSAL'
             AND NOT EXISTS (
               SELECT 1 FROM sync_outbox so
               WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
                 AND so.status = 'REJECTED'
                 AND (
                   transactions.operation_id = so.operation_id
                   OR transactions.operation_id = 'reversal-' || so.operation_id
                   OR transactions.operation_id = 'reversal::' || so.operation_id

                   OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                   OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
                 )
             )
             AND operation_id NOT LIKE 'realloc::%'
             AND operation_id NOT LIKE 'reconcile::%'
             AND effective_date <= ?
             THEN allocated_penalty_paise ELSE 0 END), 0) as deltaPenalty
         FROM transactions WHERE loan_id = ?`,
        [col.effective_date, loanId]
      );

      const assessed = penaltyRow?.assessed || 0;
      const forgiven = penaltyRow?.forgiven || 0;
      const reconPenalty = reconRow?.deltaPenalty || 0;
      const totalPaidPrior = replayedPenaltyPaid + reconPenalty;

      const outstandingPenalty = Math.max(0, assessed - totalPaidPrior - forgiven) as Paise;

      const kists = await tx.getAllAsync<any>(
        `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
        [loanId]
      );

      const allocInput = {
        paymentAmount: col.amount_paise as Paise,
        kists: kists.map((k) => ({
          kistNumber: k.installment_number,
          amountDue: k.total_due_paise as Paise,
          principalDue: k.principal_component_paise as Paise,
          markupDue: k.markup_component_paise as Paise,
          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
          principalPaid: k.principal_paid_paise as Paise,
          markupPaid: k.markup_paid_paise as Paise,
          isDue: k.effective_due_date <= col.effective_date,
          status: k.status,
        })),
        outstandingPenalty,
      };

      const result = allocatePayment(allocInput);
      let newAllocPrincipal = 0;
      let newAllocMarkup = 0;
      let newAllocPenalty = 0;
      for (const a of result.allocations) {
        newAllocPrincipal += a.allocatedToPrincipal;
        newAllocMarkup += a.allocatedToMarkup;
        newAllocPenalty += a.allocatedToPenalty;
      }
      replayedPenaltyPaid += newAllocPenalty;

      let newAllocSurplus = result.unallocatedFunds || 0;
      if (loan.product_type === 'bullet' && newAllocSurplus > 0) {
        const remainingPrincipal = Math.max(0, loan.principal_paise - replayedBulletPrincipalPaid);
        const payPrincipal = Math.min(newAllocSurplus, remainingPrincipal);
        newAllocPrincipal += payPrincipal;
        newAllocSurplus -= payPrincipal;
        replayedBulletPrincipalPaid += payPrincipal;
      }

      const currentColNet = await tx.getFirstAsync<{
        currentPrincipal: number;
        currentMarkup: number;
        currentPenalty: number;
        currentSurplus: number;
      }>(
        `SELECT
           COALESCE(SUM(allocated_principal_paise), 0) as currentPrincipal,
           COALESCE(SUM(allocated_markup_paise), 0) as currentMarkup,
           COALESCE(SUM(allocated_penalty_paise), 0) as currentPenalty,
           COALESCE(SUM(unallocated_surplus_paise), 0) as currentSurplus
         FROM transactions
         WHERE loan_id = ?
           AND (
             operation_id = ?

             OR instr(operation_id, 'realloc::' || ? || '::') = 1

             OR instr(operation_id, 'reconcile::' || ? || '::') = 1
           )`,
        [loanId, col.operation_id, col.operation_id, col.operation_id]
      );

      const currentPrincipal = currentColNet?.currentPrincipal ?? (col.allocated_principal_paise || 0);
      const currentMarkup = currentColNet?.currentMarkup ?? (col.allocated_markup_paise || 0);
      const currentPenalty = currentColNet?.currentPenalty ?? (col.allocated_penalty_paise || 0);
      const currentSurplus = currentColNet?.currentSurplus ?? (col.unallocated_surplus_paise || 0);

      const deltaPrincipal = newAllocPrincipal - currentPrincipal;
      const deltaMarkup = newAllocMarkup - currentMarkup;
      const deltaPenalty = newAllocPenalty - currentPenalty;
      const deltaSurplus = newAllocSurplus - currentSurplus;

      if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
        const reallocId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('realloc-' + Date.now() + '-' + Math.random().toString(36).substring(2));
        const reallocOpId = `realloc::${col.operation_id}::${reallocId.substring(0, 8)}`;
        await tx.runAsync(
          `INSERT INTO transactions (
             id, operation_id, loan_id, transaction_type, is_cash, payment_method,
             amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
             unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reallocId,
            reallocOpId,
            col.loan_id,
            'REVERSAL',
            0,
            'SYSTEM',
            0,
            deltaPrincipal,
            deltaMarkup,
            deltaPenalty,
            deltaSurplus,
            0,
            col.effective_date || new Date().toISOString().split('T')[0],
            new Date().toISOString(),
          ]
        );
      }

      for (const uk of result.updatedKists) {
        await tx.runAsync(
          `UPDATE repayment_schedules SET
             principal_paid_paise = ?,
             markup_paid_paise = ?,
             status = ?
           WHERE loan_id = ? AND installment_number = ?`,
          [uk.principalPaid, uk.markupPaid, uk.status || 'PENDING', loanId, uk.kistNumber]
        );
      }
    }

    // Compute final remaining penalty across whole loan history
    const finalPenaltyRow = await tx.getFirstAsync<{ assessed: number; forgiven: number; reconPenalty: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' THEN amount_paise ELSE 0 END), 0) as assessed,
         COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven,
         COALESCE(SUM(CASE WHEN transaction_type = 'REVERSAL'
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status = 'REJECTED'
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )
           AND operation_id NOT LIKE 'realloc::%'
           AND operation_id NOT LIKE 'reconcile::%'
           THEN allocated_penalty_paise ELSE 0 END), 0) as reconPenalty
       FROM transactions WHERE loan_id = ?`,
      [loanId]
    );
    const finalRemainingPenalty = Math.max(
      0,
      (finalPenaltyRow?.assessed || 0) - (replayedPenaltyPaid + (finalPenaltyRow?.reconPenalty || 0)) - (finalPenaltyRow?.forgiven || 0)
    );

    // Check final settlement status of loan
    const finalKists = await tx.getAllAsync<any>(
      `SELECT * FROM repayment_schedules WHERE loan_id = ?`,
      [loanId]
    );
    const allPaid = finalKists.length > 0 && finalKists.every((k) => k.status === 'PAID');

    let isSettled = false;
    if (loan.product_type === 'instalment') {
      const totalPrincipalPaid = finalKists.reduce((acc, k) => acc + (k.principal_paid_paise || 0), 0);
      isSettled = allPaid && totalPrincipalPaid >= loan.principal_paise && finalRemainingPenalty <= 0;
    } else if (loan.product_type === 'bullet') {
      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
           AND NOT EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
               AND so.status = 'REJECTED'
               AND (
                 transactions.operation_id = so.operation_id
                 OR transactions.operation_id = 'reversal-' || so.operation_id
                 OR transactions.operation_id = 'reversal::' || so.operation_id

                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1

                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
               )
           )`,
        [loanId]
      );
      const bulletPrincipalPaid = bulletPrincipalRow?.total || 0;
      isSettled = allPaid && bulletPrincipalPaid >= loan.principal_paise && finalRemainingPenalty <= 0;
    }

    if (loan && loan.status !== 'WRITTEN_OFF') {
      const newStatus = isSettled ? 'SETTLED' : 'ACTIVE';
      await tx.runAsync(`UPDATE loans SET status = ? WHERE id = ?`, [newStatus, loanId]);
    }
  }

  /**
   * Full Sync: Pushes pending operations then pulls authoritative state
   */
  static async syncAll(db: SQLiteDatabase): Promise<SyncResult> {
    try {
      const pushRes = await this.pushPending(db);
      const pullRes = await this.pullChanges(db);
      const needsReviewItems = await OutboxManager.getNeedsReview(db);
      if (needsReviewItems.length > 0 || pushRes.failed > 0) {
        return {
          pushedCount: pushRes.pushed,
          pulledCount: pullRes.pulled,
          needsReviewCount: needsReviewItems.length,
          success: false,
          errors: [
            ...(pushRes.failed > 0 ? [`${pushRes.failed} operation(s) failed during push and require review.`] : []),
            ...(needsReviewItems.length > 0 ? [`${needsReviewItems.length} operation(s) require review due to server conflicts.`] : []),
          ],
        };
      }
      return {
        pushedCount: pushRes.pushed,
        pulledCount: pullRes.pulled,
        needsReviewCount: 0,
        success: true,
      };
    } catch (err: any) {
      return {
        pushedCount: 0,
        pulledCount: 0,
        success: false,
        errors: [err?.message || 'Sync failed'],
      };
    }
  }
}

registerOutboxRevertHandler((db, opId, reason) => SyncService.revertRejectedPayment(db, opId, reason));

exec
/bin/bash -lc "git ls-tree -r --name-only 31d05db src/core/database src/core/sync backend/api | rg '(schema|migration|outbox|Outbox|sync|views)'" in /mnt/f/personal projects/credkeep
 succeeded in 70ms:
backend/api/migrations/__init__.py
backend/api/tests_sync.py
backend/api/views.py
backend/api/views_auth.py
backend/api/views_sync.py
src/core/database/schema.ts
src/core/sync/outbox.ts
src/core/sync/syncCoordinator.ts
src/core/sync/syncService.test.ts
src/core/sync/syncService.ts

exec
/bin/bash -lc "git show 31d05db:src/core/sync/outbox.ts | sed -n '1,240p'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:src/core/database/schema.ts | rg -n -C 8 'loan_terms|payment_corrections|REFERENCES|TRIGGER'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:src/core/sync/syncService.ts | nl -ba | sed -n '470,740p'" in /mnt/f/personal projects/credkeep
 succeeded in 62ms:
import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';

export type OutboxStatus = 'PENDING' | 'SYNCED' | 'NEEDS_REVIEW' | 'REJECTED' | 'FAILED';

export interface OutboxRecord {
  id: string;
  operation_id: string;
  operation_type: string;
  payload: string; // JSON string
  status: OutboxStatus;
  error_message: string | null;
  created_at: string;
}

export interface EnqueueParams {
  operationId?: string;
  operationType: string;
  payload: Record<string, any>;
}

export type DatabaseHandle = {
  runAsync: (sql: string, ...params: any[]) => Promise<any>;
};

export type OutboxRevertHandler = (db: SQLiteDatabase, operationId: string, errorReason?: string) => Promise<void>;
let _revertHandler: OutboxRevertHandler | null = null;

export function registerOutboxRevertHandler(handler: OutboxRevertHandler): void {
  _revertHandler = handler;
}

export class OutboxManager {
  static async enqueue(
    db: SQLiteDatabase | DatabaseHandle,
    params: EnqueueParams
  ): Promise<OutboxRecord> {
    const operationId = params.operationId || (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('op-' + Date.now() + '-' + Math.random().toString(36).substring(2));

    const existing = typeof (db as any).getFirstAsync === 'function'
      ? await (db as any).getFirstAsync(
          `SELECT * FROM sync_outbox WHERE operation_id = ?`,
          [operationId]
        )
      : null;
    if (existing) {
      return existing;
    }

    const id = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('outbox-' + Date.now() + '-' + Math.random().toString(36).substring(2));
    const createdAt = new Date().toISOString();
    const payloadStr = JSON.stringify(params.payload);

    await db.runAsync(
      `INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, error_message, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', NULL, ?)
       ON CONFLICT(operation_id) DO NOTHING`,
      [id, operationId, params.operationType, payloadStr, createdAt]
    );

    return {
      id,
      operation_id: operationId,
      operation_type: params.operationType,
      payload: payloadStr,
      status: 'PENDING',
      error_message: null,
      created_at: createdAt,
    };
  }

  static async getPending(db: SQLiteDatabase, limit: number = 50): Promise<OutboxRecord[]> {
    return await db.getAllAsync<OutboxRecord>(
      `SELECT * FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
  }

  static async markSynced(db: SQLiteDatabase, operationIds: string[]): Promise<void> {
    if (operationIds.length === 0) return;
    const placeholders = operationIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'SYNCED', error_message = NULL WHERE operation_id IN (${placeholders})`,
      operationIds
    );
  }

  static async markStatus(
    db: SQLiteDatabase,
    operationId: string,
    status: OutboxStatus,
    errorMessage?: string
  ): Promise<void> {
    await db.runAsync(
      `UPDATE sync_outbox SET status = ?, error_message = ? WHERE operation_id = ?`,
      [status, errorMessage || null, operationId]
    );
  }

  static async getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key]
    );
    return row ? row.value : null;
  }

  static async getNeedsReview(db: SQLiteDatabase): Promise<OutboxRecord[]> {
    return await db.getAllAsync<OutboxRecord>(
      `SELECT * FROM sync_outbox WHERE status = 'NEEDS_REVIEW' ORDER BY created_at ASC`
    );
  }

  static async resolveNeedsReview(
    db: SQLiteDatabase,
    operationId: string,
    action: 'DISCARD' | 'RETRY_PENDING'
  ): Promise<void> {
    if (action === 'DISCARD') {
      if (_revertHandler) {
        await _revertHandler(db, operationId, 'Resolved: discarded by user');
      } else {
        await OutboxManager.markStatus(db, operationId, 'REJECTED', 'Resolved: discarded by user');
      }
    } else if (action === 'RETRY_PENDING') {
      await db.runAsync(
        `UPDATE sync_outbox SET status = 'PENDING', error_message = NULL WHERE operation_id = ?`,
        [operationId]
      );
    }
  }

  static async setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }
}

 succeeded in 62ms:
23-        markup_factor REAL NOT NULL,
24-        term_months INTEGER NOT NULL,
25-        start_date TEXT NOT NULL,
26-        due_day INTEGER NOT NULL,
27-        product_type TEXT NOT NULL,
28-        status TEXT NOT NULL DEFAULT 'ACTIVE',
29-        collateral TEXT,
30-        created_at TEXT NOT NULL,
31:        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
32-      );
33-    `);
34-
35-    const loanColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loans);`);
36-    const loanColNames = new Set((loanColumns || []).map((c: any) => c.name));
37-    if (!loanColNames.has('collateral')) {
38-      await tx.execAsync(`ALTER TABLE loans ADD COLUMN collateral TEXT;`);
39-    }
--
66-        total_due_paise INTEGER NOT NULL,
67-        principal_paid_paise INTEGER NOT NULL DEFAULT 0,
68-        markup_paid_paise INTEGER NOT NULL DEFAULT 0,
69-        status TEXT NOT NULL DEFAULT 'PENDING',
70-        server_principal_paid_paise INTEGER NOT NULL DEFAULT 0,
71-        server_markup_paid_paise INTEGER NOT NULL DEFAULT 0,
72-        server_status TEXT NOT NULL DEFAULT 'PENDING',
73-        UNIQUE (loan_id, installment_number),
74:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
75-      );
76-    `);
77-
78-    const columns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(repayment_schedules);`);
79-    const colNames = new Set((columns || []).map((c: any) => c.name));
80-    if (!colNames.has('server_principal_paid_paise')) {
81-      await tx.execAsync(`ALTER TABLE repayment_schedules ADD COLUMN server_principal_paid_paise INTEGER NOT NULL DEFAULT 0;`);
82-    }
--
103-        allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
104-        allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
105-        unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
106-        forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
107-        forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
108-        forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
109-        effective_date TEXT NOT NULL,
110-        created_at TEXT NOT NULL,
111:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
112-      );
113-    `);
114-
115-    const txColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(transactions);`);
116-    const txColNames = new Set((txColumns || []).map((c: any) => c.name));
117-    if (!txColNames.has('reversal_of_id')) {
118-      await tx.execAsync(`ALTER TABLE transactions ADD COLUMN reversal_of_id TEXT;`);
119-    }
120-    if (!txColNames.has('correction_reason')) {
121-      await tx.execAsync(`ALTER TABLE transactions ADD COLUMN correction_reason TEXT;`);
122-    }
123-
124-    // Prevent transactions update/delete
125-    await tx.execAsync(`
126:      CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
127-      BEFORE UPDATE ON transactions
128-      BEGIN
129-        SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
130-      END;
131-    `);
132-
133-    await tx.execAsync(`
134:      CREATE TRIGGER IF NOT EXISTS prevent_transactions_delete
135-      BEFORE DELETE ON transactions
136-      BEGIN
137-        SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
138-      END;
139-    `);
140-
141-    // 5. Schedule Modifications
142-    await tx.execAsync(`
--
147-        original_due_date TEXT NOT NULL,
148-        prior_effective_due_date TEXT NOT NULL,
149-        revised_effective_due_date TEXT NOT NULL,
150-        changed_at TEXT NOT NULL,
151-        reason TEXT,
152-        accrued_penalty_action TEXT NOT NULL,
153-        waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
154-        operation_id TEXT NOT NULL UNIQUE,
155:        FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
156-      );
157-    `);
158-
159-    // 6. Loan Terms (One-Time Repayment terms and historical extensions)
160-    await tx.execAsync(`
161:      CREATE TABLE IF NOT EXISTS loan_terms (
162-        id TEXT PRIMARY KEY NOT NULL,
163-        loan_id TEXT NOT NULL,
164-        term_number INTEGER NOT NULL,
165-        duration_months INTEGER NOT NULL,
166-        annual_rate REAL NOT NULL,
167-        interest_paise INTEGER NOT NULL,
168-        start_date TEXT NOT NULL,
169-        maturity_date TEXT NOT NULL,
170-        interest_paid_paise INTEGER NOT NULL DEFAULT 0,
171-        settled INTEGER NOT NULL DEFAULT 0,
172-        interest_settled INTEGER NOT NULL DEFAULT 0,
173-        operation_id TEXT UNIQUE,
174-        created_at TEXT NOT NULL,
175:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
176-      );
177:      CREATE INDEX IF NOT EXISTS idx_loan_terms_loan ON loan_terms(loan_id, term_number);
178-    `);
179-
180:    const termColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_terms);`);
181-    const termColNames = new Set((termColumns || []).map((c: any) => c.name));
182-    if (!termColNames.has('interest_settled')) {
183:      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN interest_settled INTEGER NOT NULL DEFAULT 0;`);
184:      await tx.execAsync(`UPDATE loan_terms SET interest_settled = settled WHERE interest_settled IS NULL OR interest_settled = 0;`);
185-    }
186-    if (!termColNames.has('settled')) {
187:      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0;`);
188:      await tx.execAsync(`UPDATE loan_terms SET settled = interest_settled WHERE settled IS NULL OR settled = 0;`);
189-    }
190-    if (!termColNames.has('operation_id')) {
191:      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN operation_id TEXT;`);
192-    }
193-
194-    // 7. Payment Corrections (Auditable correction history linking reversal and replacement)
195-    await tx.execAsync(`
196:      CREATE TABLE IF NOT EXISTS payment_corrections (
197-        id TEXT PRIMARY KEY NOT NULL,
198-        loan_id TEXT NOT NULL,
199-        original_transaction_id TEXT NOT NULL,
200-        original_operation_id TEXT,
201-        reversal_transaction_id TEXT NOT NULL,
202-        replacement_transaction_id TEXT,
203-        original_amount_paise INTEGER NOT NULL DEFAULT 0,
204-        previous_amount_paise INTEGER NOT NULL DEFAULT 0,
205-        corrected_amount_paise INTEGER NOT NULL DEFAULT 0,
206-        reason TEXT NOT NULL,
207-        operation_id TEXT UNIQUE,
208-        created_at TEXT NOT NULL,
209:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
210-      );
211:      CREATE INDEX IF NOT EXISTS idx_payment_corrections_loan ON payment_corrections(loan_id);
212-    `);
213-
214:    const corrColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(payment_corrections);`);
215-    const corrColNames = new Set((corrColumns || []).map((c: any) => c.name));
216-    if (!corrColNames.has('previous_amount_paise')) {
217:      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN previous_amount_paise INTEGER NOT NULL DEFAULT 0;`);
218:      await tx.execAsync(`UPDATE payment_corrections SET previous_amount_paise = original_amount_paise WHERE previous_amount_paise IS NULL OR previous_amount_paise = 0;`);
219-    }
220-    if (!corrColNames.has('original_amount_paise')) {
221:      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_amount_paise INTEGER NOT NULL DEFAULT 0;`);
222:      await tx.execAsync(`UPDATE payment_corrections SET original_amount_paise = previous_amount_paise WHERE original_amount_paise IS NULL OR original_amount_paise = 0;`);
223-    }
224-    if (!corrColNames.has('original_operation_id')) {
225:      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_operation_id TEXT;`);
226-    }
227-    if (!corrColNames.has('operation_id')) {
228:      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN operation_id TEXT;`);
229-    }
230-
231-    // 8. Loan Attachments (Security cheques, affidavits, collateral documents)
232-    await tx.execAsync(`
233-      CREATE TABLE IF NOT EXISTS loan_attachments (
234-        id TEXT PRIMARY KEY NOT NULL,
235-        loan_id TEXT NOT NULL,
236-        document_type TEXT,
--
238-        file_path TEXT NOT NULL,
239-        file_name TEXT,
240-        file_size INTEGER NOT NULL DEFAULT 0,
241-        mime_type TEXT,
242-        notes TEXT,
243-        synced INTEGER NOT NULL DEFAULT 0,
244-        sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
245-        created_at TEXT NOT NULL,
246:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
247-      );
248-      CREATE INDEX IF NOT EXISTS idx_loan_attachments_loan ON loan_attachments(loan_id);
249-    `);
250-
251-    const attColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_attachments);`);
252-    const attColNames = new Set((attColumns || []).map((c: any) => c.name));
253-    if (!attColNames.has('doc_type')) {
254-      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN doc_type TEXT;`);

exec
/bin/bash -lc "git show 31d05db:backend/api/views_sync.py | rg -n 'LOAN_TERM|PAYMENT_CORRECTION|TRANSACTION|KIST|operation_id|correct_payment'" in /mnt/f/personal projects/credkeep
 succeeded in 81ms:
   470	        }
   471	        if (payload.status !== undefined || payload.principal_paid_paise !== undefined) {
   472	          await tx.runAsync(
   473	            `UPDATE repayment_schedules SET
   474	               principal_paid_paise = COALESCE(?, principal_paid_paise),
   475	               markup_paid_paise = COALESCE(?, markup_paid_paise),
   476	               status = COALESCE(?, status),
   477	               server_principal_paid_paise = COALESCE(?, server_principal_paid_paise),
   478	               server_markup_paid_paise = COALESCE(?, server_markup_paid_paise),
   479	               server_status = COALESCE(?, server_status)
   480	             WHERE id = ?`,
   481	            [
   482	              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
   483	              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
   484	              kistId
   485	            ]
   486	          );
   487	        }
   488	      }
   489	    } else if (record_type === 'TRANSACTION') {
   490	      if (operation_type === 'INSERT') {
   491	        const isCash = payload.is_cash !== undefined ? (payload.is_cash ? 1 : 0) : 1;
   492	        const paymentMethod = payload.payment_method || (isCash ? 'CASH' : 'ONLINE');
   493	        let existing: any = null;
   494	        if (payload.transaction_type === 'PENALTY_ASSESSMENT') {
   495	          existing = await tx.getFirstAsync<any>(
   496	            `SELECT * FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
   497	            [payload.operation_id, payload.loan_id, payload.effective_date]
   498	          );
   499	        } else {
   500	          existing = await tx.getFirstAsync<any>(
   501	            `SELECT * FROM transactions WHERE operation_id = ? OR id = ?`,
   502	            [payload.operation_id, payload.id || payload.operation_id]
   503	          );
   504	          if (!existing) {
   505	            const allLocalTx = await tx.getAllAsync<any>(
   506	              `SELECT id, operation_id, loan_id, effective_date, amount_paise, transaction_type, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise FROM transactions WHERE transaction_type IN ('COLLECTION', 'WAIVER', 'REVERSAL')`
   507	            );
   508	            for (const ltx of allLocalTx || []) {
   509	              const expectedMigOpId = getMigratedTransactionOpId(ltx);
   510	              if (expectedMigOpId === payload.operation_id || ltx.id === payload.id || ltx.operation_id === payload.operation_id) {
   511	                existing = ltx;
   512	                break;
   513	              }
   514	            }
   515	          }
   516	        }
   517	
   518	        if (payload.operation_id) {
   519	          await OutboxManager.markSynced(tx, [payload.operation_id]);
   520	        }
   521	        if (!existing) {
   522	          await tx.runAsync(
   523	            `INSERT INTO transactions (
   524	               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
   525	               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
   526	               unallocated_surplus_paise, forgiven_penalty_paise, effective_date,
   527	               reversal_of_id, correction_reason, created_at
   528	             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   529	            [
   530	              payload.id,
   531	              payload.operation_id,
   532	              payload.loan_id,
   533	              payload.transaction_type,
   534	              isCash,
   535	              paymentMethod,
   536	              payload.amount_paise || 0,
   537	              payload.allocated_principal_paise || 0,
   538	              payload.allocated_markup_paise || 0,
   539	              payload.allocated_penalty_paise || 0,
   540	              payload.unallocated_surplus_paise || 0,
   541	              payload.forgiven_penalty_paise || 0,
   542	              payload.effective_date,
   543	              payload.reversal_of_id || null,
   544	              payload.correction_reason || null,
   545	              payload.created_at || new Date().toISOString(),
   546	            ]
   547	          );
   548	        } else if (existing.transaction_type === 'COLLECTION' && payload.transaction_type === 'COLLECTION') {
   549	          // Reconcile authoritative server allocations via append-only adjustment transaction, respecting trigger
   550	          const matchingOpIds = Array.from(
   551	            new Set([payload.operation_id, existing.operation_id, existing.id].filter(Boolean))
   552	          );
   553	          const opConditions = matchingOpIds.map(() => `(
   554	            operation_id = ?
   555	            OR id = ?
   556	            OR instr(operation_id, 'realloc::' || ? || '::') = 1
   557	            OR instr(operation_id, 'reconcile::' || ? || '::') = 1
   558	          )`).join(' OR ');
   559	
   560	          const queryParams: any[] = [payload.loan_id];
   561	          for (const opId of matchingOpIds) {
   562	            queryParams.push(opId, opId, opId, opId);
   563	          }
   564	
   565	          const netAllocRow = await tx.getFirstAsync<{
   566	            netPrincipal: number;
   567	            netMarkup: number;
   568	            netPenalty: number;
   569	            netSurplus: number;
   570	          }>(
   571	            `SELECT
   572	               COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
   573	               COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
   574	               COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
   575	               COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
   576	             FROM transactions
   577	             WHERE loan_id = ?
   578	               AND (${opConditions})`,
   579	            queryParams
   580	          );
   581	
   582	          const currentPrincipal = netAllocRow?.netPrincipal ?? (existing.allocated_principal_paise || 0);
   583	          const currentMarkup = netAllocRow?.netMarkup ?? (existing.allocated_markup_paise || 0);
   584	          const currentPenalty = netAllocRow?.netPenalty ?? (existing.allocated_penalty_paise || 0);
   585	          const currentSurplus = netAllocRow?.netSurplus ?? (existing.unallocated_surplus_paise || 0);
   586	
   587	          const deltaPrincipal = (payload.allocated_principal_paise || 0) - currentPrincipal;
   588	          const deltaMarkup = (payload.allocated_markup_paise || 0) - currentMarkup;
   589	          const deltaPenalty = (payload.allocated_penalty_paise || 0) - currentPenalty;
   590	          const deltaSurplus = (payload.unallocated_surplus_paise || 0) - currentSurplus;
   591	
   592	          if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
   593	            const reconId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('recon-' + Date.now() + '-' + Math.random().toString(36).substring(2));
   594	            const reconOpId = `reconcile::${payload.operation_id}::${reconId.substring(0, 8)}`;
   595	            await tx.runAsync(
   596	              `INSERT INTO transactions (
   597	                 id, operation_id, loan_id, transaction_type, is_cash, payment_method,
   598	                 amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
   599	                 unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
   600	               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   601	              [
   602	                reconId,
   603	                reconOpId,
   604	                payload.loan_id,
   605	                'REVERSAL',
   606	                0,
   607	                'SYSTEM',
   608	                0,
   609	                deltaPrincipal,
   610	                deltaMarkup,
   611	                deltaPenalty,
   612	                deltaSurplus,
   613	                0,
   614	                payload.effective_date,
   615	                new Date().toISOString(),
   616	              ]
   617	            );
   618	          }
   619	        }
   620	      }
   621	    }
   622	  }
   623	
   624	  /**
   625	   * Reapplies unacknowledged local collection allocations after server schedule snapshots
   626	   * to ensure local pending payments are never erased.
   627	   */
   628	  static async reapplyPendingCollections(tx: SQLiteDatabase, loanId: string): Promise<void> {
   629	    if (!loanId) return;
   630	
   631	    // Reset kists to authoritative server baseline before replaying pending collections
   632	    await tx.runAsync(
   633	      `UPDATE repayment_schedules SET
   634	         principal_paid_paise = COALESCE(server_principal_paid_paise, 0),
   635	         markup_paid_paise = COALESCE(server_markup_paid_paise, 0),
   636	         status = COALESCE(server_status, 'PENDING')
   637	       WHERE loan_id = ?`,
   638	      [loanId]
   639	    );
   640	
   641	    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
   642	      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
   643	    );
   644	
   645	    const relevant = pendingOutbox.filter((item) => {
   646	      try {
   647	        const p = JSON.parse(item.payload);
   648	        return p.loan_id === loanId;
   649	      } catch {
   650	        return false;
   651	      }
   652	    });
   653	
   654	    relevant.sort((a, b) => {
   655	      try {
   656	        const pa = JSON.parse(a.payload);
   657	        const pb = JSON.parse(b.payload);
   658	        const dateA = pa.effective_date || '';
   659	        const dateB = pb.effective_date || '';
   660	        if (dateA !== dateB) return dateA.localeCompare(dateB);
   661	      } catch {}
   662	      return 0;
   663	    });
   664	
   665	    const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   666	
   667	    let replayedBulletPrincipalPaid = 0;
   668	    if (loan?.product_type === 'bullet') {
   669	      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
   670	        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
   671	         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
   672	           AND NOT EXISTS (
   673	             SELECT 1 FROM sync_outbox so
   674	             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
   675	               AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
   676	               AND (
   677	                 transactions.operation_id = so.operation_id
   678	                 OR transactions.operation_id = 'reversal-' || so.operation_id
   679	                 OR transactions.operation_id = 'reversal::' || so.operation_id
   680	
   681	                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1
   682	
   683	                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
   684	               )
   685	           )`,
   686	        [loanId]
   687	      );
   688	      replayedBulletPrincipalPaid = bulletPrincipalRow?.total || 0;
   689	    }
   690	
   691	    if (relevant.length > 0) {
   692	      let replayedPendingPenaltyPaid = 0;
   693	      for (const item of relevant) {
   694	        const p = JSON.parse(item.payload);
   695	        const paymentAmount = (p.amount_paise || 0) as Paise;
   696	        const effectiveDate = p.effective_date || new Date().toISOString().split('T')[0];
   697	
   698	        // Calculate actual outstanding penalties dynamically bounded by payment effective_date
   699	        const penaltyRow = await tx.getFirstAsync<{ assessed: number; paid: number; forgiven: number }>(
   700	          `SELECT
   701	             COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ? THEN amount_paise ELSE 0 END), 0) as assessed,
   702	             COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECTION', 'REVERSAL')
   703	               AND effective_date <= ?
   704	               AND NOT EXISTS (
   705	                 SELECT 1 FROM sync_outbox so
   706	                 WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
   707	                   AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
   708	                   AND (
   709	                     transactions.operation_id = so.operation_id
   710	                     OR transactions.operation_id = 'reversal-' || so.operation_id
   711	                     OR transactions.operation_id = 'reversal::' || so.operation_id
   712	
   713	                     OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1
   714	
   715	                     OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
   716	                   )
   717	               )
   718	               THEN allocated_penalty_paise ELSE 0 END), 0) as paid,
   719	             COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') AND effective_date <= ? THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
   720	           FROM transactions WHERE loan_id = ?`,
   721	          [effectiveDate, effectiveDate, effectiveDate, loanId]
   722	        );
   723	        const outstandingPenalty = Math.max(
   724	          0,
   725	          (penaltyRow?.assessed || 0) - ((penaltyRow?.paid || 0) + replayedPendingPenaltyPaid) - (penaltyRow?.forgiven || 0)
   726	        ) as Paise;
   727	
   728	        const kists = await tx.getAllAsync<any>(
   729	          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
   730	          [loanId]
   731	        );
   732	        if (!kists || kists.length === 0) continue;
   733	
   734	        const allocInput = {
   735	          paymentAmount,
   736	          kists: kists.map((k) => ({
   737	            kistNumber: k.installment_number,
   738	            amountDue: k.total_due_paise as Paise,
   739	            principalDue: k.principal_component_paise as Paise,
   740	            markupDue: k.markup_component_paise as Paise,

 succeeded in 136ms:
32:    and returns status per operation_id (ACCEPTED, REJECTED, NEEDS_REVIEW).
102:                    "operation_id": None,
108:            op_id_raw = op.get('operation_id')
111:                    "operation_id": None,
113:                    "error": "Missing operation_id."
118:                operation_id = uuid.UUID(str(op_id_raw))
121:                    "operation_id": str(op_id_raw),
123:                    "error": "Invalid UUID format for operation_id."
134:                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
137:                        tenant, operation_id, op_type, op, payload, existing_log=existing_log
141:                            "operation_id": str(operation_id),
143:                            "error": conflict_reason or f"Idempotency conflict: operation_id {operation_id} was already processed with different attributes."
148:                        "operation_id": str(operation_id),
160:                        operation_id=operation_id,
173:                            operation_id=operation_id,
180:                        existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
181:                        existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
184:                                tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
194:                        "operation_id": str(operation_id),
205:                        "operation_id": str(operation_id),
211:                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
212:                existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
215:                        tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
219:                            "operation_id": str(operation_id),
225:                            "operation_id": str(operation_id),
231:                            "operation_id": str(operation_id),
240:                            operation_id=operation_id,
249:                        "operation_id": str(operation_id),
259:                        "operation_id": str(operation_id),
268:                    existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
269:                    existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
274:                        tenant, operation_id, op_type, op, payload, existing_log=existing_log, existing_tx=existing_tx
278:                            "operation_id": str(operation_id),
284:                            "operation_id": str(operation_id),
290:                            "operation_id": str(operation_id),
296:                        "operation_id": str(operation_id),
303:    def _check_idempotency_conflict(self, tenant, operation_id, op_type, op, payload, existing_log=None, existing_tx=None):
309:            return True, f"Idempotency conflict: operation_id {operation_id} was already processed with operation_type '{existing_log.operation_type}', cannot replay as '{op_type}'."
312:            existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
317:                    return True, f"Idempotency conflict: operation_id {operation_id} was already processed without creating a collection transaction."
319:                return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a {existing_tx.transaction_type} transaction, cannot replay as record_collection."
323:                    return True, f"Idempotency conflict: operation_id {operation_id} was already processed without creating a penalty waiver transaction."
325:                return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a {existing_tx.transaction_type} transaction, cannot replay as waive_penalty."
327:            return True, f"Idempotency conflict: operation_id {operation_id} was already processed as a transaction, cannot replay as '{op_type}'."
427:            existing_mod = ScheduleModification.objects.filter(tenant=tenant, operation_id=operation_id).first()
446:    def _process_operation(self, tenant, device, operation_id, op_type, op, payload):
626:                    operation_id=operation_id
630:                    record_type='LOAN_TERM',
643:                        'operation_id': str(operation_id)
673:                        record_type='KIST',
728:                existing_tx = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
738:                        return 'REJECTED', f"Idempotency conflict: operation_id {operation_id} already exists with different payment attributes."
743:                    operation_id=operation_id,
757:                    record_type='TRANSACTION',
762:                        'operation_id': str(surplus_tx.operation_id),
790:                    operation_id=operation_id,
887:                        operation_id=recon_op_id,
896:                        record_type='TRANSACTION',
901:                            'operation_id': str(tx.operation_id),
913:                operation_id=operation_id,
927:                record_type='KIST',
1011:                operation_id=operation_id,
1021:                record_type='TRANSACTION',
1026:                    'operation_id': str(tx.operation_id),
1087:            if payload.get('payment_operation_id'):
1089:                    pay_op_id = uuid.UUID(str(payload['payment_operation_id']))
1091:                    return 'REJECTED', 'Invalid payment_operation_id format.'
1098:                    operation_id=operation_id,
1100:                    payment_operation_id=pay_op_id
1106:        elif op_type == 'correct_payment':
1116:            orig_op_raw = payload.get('original_operation_id') or payload.get('original_transaction_id')
1118:                return 'REJECTED', 'Missing original_operation_id or original_transaction_id.'
1122:                return 'REJECTED', f'Invalid original_operation_id format: {orig_op_raw}'
1137:                ledger_service.correct_payment(
1139:                    original_operation_id=orig_op_id,
1142:                    operation_id=operation_id,
1173:                    operation_id=operation_id,

codex
The diff changes two code paths: loan creation ordering and pull reconciliation. I’m checking how the new acknowledgement handling interacts with paginated schedule snapshots, and whether reconciled records retain the links needed for later corrections.
exec
/bin/bash -lc "git show 31d05db:backend/api/views_sync.py | sed -n '900,950p;1100,1160p'; git ls-tree -r --name-only 31d05db backend/ledger | rg service" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:src/core/database/transactionRepository.ts | rg -n -C 6 'correct|original_transaction_id|replacement_transaction_id|reversal_transaction_id|loan_terms|term_id'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:src/core/sync/syncService.test.ts | rg -n 'markSynced|acknowledg|pag|LOAN_TERM|PAYMENT_CORRECTION|replay'; command -v node; test -d node_modules && echo node_modules-present; test -f bun.lock && echo bun-lock-present" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:src/core/database/loanRepository.ts | rg -n -C 5 'loan_terms|extend|term_id|settled'" in /mnt/f/personal projects/credkeep
 succeeded in 39ms:
74-          let unallocated = paymentAmount;
75-          const allocatedPenalty = Math.min(unallocated, outstandingPenalty) as Paise;
76-          unallocated = (unallocated - allocatedPenalty) as Paise;
77-
78-          // Contracted interest across all terms
79-          const terms = await tx.getAllAsync<any>(
80:            `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
81-            [loanId]
82-          );
83-          const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
84-
85-          const markupPaidRes = await tx.getFirstAsync<any>(
86-            `SELECT SUM(allocated_markup_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
--
118-            paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
119-            surplus, effectiveDate, createdAt
120-          ]);
121-
122-          // Update terms settled if interest paid
123-          if ((pastMarkupPaid + allocatedMarkup) >= totalContractInterest) {
124:            await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE loan_id = ?`, [loanId]);
125-          }
126-
127-          // Check if loan should be marked settled
128-          if (
129-            (pastPrincipalPaid + allocatedPrincipal) >= loan.principal_paise &&
130-            (pastMarkupPaid + allocatedMarkup) >= totalContractInterest &&
--
339-      });
340-      
341-      SyncCoordinator.notifyMutation();
342-      return returnResult;
343-  }
344-
345:  async correctPayment(
346-    originalTransactionId: string,
347:    correctedPaise: Paise,
348-    reason: string,
349-    clientOpId?: string
350-  ): Promise<{ reversalTransactionId: string; replacementTransactionId: string | null }> {
351-    const opId = clientOpId || ((crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-' + Date.now() + '-' + Math.random().toString(36).substring(2)));
352-
353-    // Idempotency pre-check
--
381-      const orig = await tx.getFirstAsync<any>(
382-        `SELECT * FROM transactions WHERE id = ?`,
383-        [originalTransactionId]
384-      );
385-      if (!orig) throw new Error('Original transaction not found');
386-      if (orig.transaction_type !== 'COLLECTION') {
387:        throw new Error('Only COLLECTION transactions can be corrected');
388-      }
389-
390-      // Check if already reversed
391-      const existingReversal = await tx.getFirstAsync<any>(
392-        `SELECT id FROM transactions WHERE reversal_of_id = ? AND transaction_type = 'REVERSAL'`,
393-        [originalTransactionId]
394-      );
395-      if (existingReversal) {
396:        throw new Error('Transaction has already been reversed or corrected');
397-      }
398-
399-      const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [orig.loan_id]);
400-      if (!loan) throw new Error('Loan not found');
401-
402-      reversalTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2));
--
405-      // 1. Insert REVERSAL transaction with negative allocations
406-      await tx.runAsync(`
407-        INSERT INTO transactions (
408-          id, operation_id, loan_id, transaction_type, is_cash, payment_method,
409-          amount_paise, allocated_principal_paise, allocated_markup_paise,
410-          allocated_penalty_paise, unallocated_surplus_paise, effective_date,
411:          reversal_of_id, correction_reason, created_at
412-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
413-      `, [
414-        reversalTxId,
415-        `reversal-${opId}`,
416-        orig.loan_id,
417-        'REVERSAL',
--
446-            AND id != ?
447-            AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
448-          ORDER BY effective_date ASC, created_at ASC
449-        `, [orig.loan_id, orig.id, orig.loan_id]);
450-
451-        const allCollectionsToReplay = [...pastCollections];
452:        if (correctedPaise > 0) {
453-          allCollectionsToReplay.push({
454-            id: '__replacement__',
455:            amount_paise: correctedPaise,
456-            effective_date: orig.effective_date,
457-            created_at: now,
458-          });
459-          allCollectionsToReplay.sort((a, b) => (a.effective_date < b.effective_date ? -1 : a.effective_date > b.effective_date ? 1 : 0));
460-        }
461-
--
525-            AND id != ?
526-            AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
527-          ORDER BY effective_date ASC, created_at ASC
528-        `, [orig.loan_id, orig.id, orig.loan_id]);
529-
530-        const allCollectionsToReplay = [...pastCollections];
531:        if (correctedPaise > 0) {
532-          allCollectionsToReplay.push({
533-            id: '__replacement__',
534:            amount_paise: correctedPaise,
535-            effective_date: orig.effective_date,
536-            created_at: now,
537-          });
538-          allCollectionsToReplay.sort((a, b) => (a.effective_date < b.effective_date ? -1 : a.effective_date > b.effective_date ? 1 : 0));
539-        }
540-
541-        const terms = await tx.getAllAsync<any>(
542:          `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
543-          [orig.loan_id]
544-        );
545-        const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
546-
547-        let cumulativeMkpPaid = 0;
548-        let cumulativePrinPaid = 0;
--
565-            replPen = 0;
566-            replSurplus = unallocated;
567-          }
568-        }
569-
570-        if (cumulativeMkpPaid >= totalContractInterest) {
571:          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE loan_id = ?`, [orig.loan_id]);
572-        } else {
573:          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 0, settled = 0 WHERE loan_id = ?`, [orig.loan_id]);
574-        }
575-
576-        if (cumulativePrinPaid >= loan.principal_paise && cumulativeMkpPaid >= totalContractInterest) {
577-          await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [orig.loan_id]);
578-        } else {
579-          await tx.runAsync(`UPDATE loans SET status = 'ACTIVE' WHERE id = ?`, [orig.loan_id]);
580-        }
581-      }
582-
583-      // 3. Insert replacement COLLECTION transaction ONCE with final allocations (append-only)
584:      if (correctedPaise > 0) {
585-        replacementTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('repl-' + Date.now() + '-' + Math.random().toString(36).substring(2));
586-        await tx.runAsync(`
587-          INSERT INTO transactions (
588-            id, operation_id, loan_id, transaction_type, is_cash, payment_method,
589-            amount_paise, allocated_principal_paise, allocated_markup_paise,
590-            allocated_penalty_paise, unallocated_surplus_paise, effective_date,
591:            reversal_of_id, correction_reason, created_at
592-          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
593-        `, [
594-          replacementTxId,
595-          opId,
596-          orig.loan_id,
597-          'COLLECTION',
598-          orig.is_cash,
599-          orig.payment_method,
600:          correctedPaise,
601-          replPrin,
602-          replMkp,
603-          replPen,
604-          replSurplus,
605-          orig.effective_date,
606-          orig.id,
607-          reason,
608-          now
609-        ]);
610-      }
611-
612:      // 4. Record in payment_corrections
613:      const correctionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-rec-' + Date.now());
614-      await tx.runAsync(`
615:        INSERT INTO payment_corrections (
616:          id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
617:          replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
618-          reason, operation_id, created_at
619-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
620-      `, [
621:        correctionId,
622-        orig.loan_id,
623-        orig.id,
624-        orig.operation_id,
625-        reversalTxId,
626-        replacementTxId,
627-        orig.amount_paise,
628-        orig.amount_paise,
629:        correctedPaise,
630-        reason,
631-        opId,
632-        now
633-      ]);
634-
635-      // 5. Enqueue outbox operation for sync
636-      await OutboxManager.enqueue(tx, {
637-        operationId: opId,
638:        operationType: 'correct_payment',
639-        payload: {
640-          loan_id: orig.loan_id,
641:          original_transaction_id: orig.id,
642:          corrected_amount_paise: correctedPaise,
643-          reason,
644-          effective_date: orig.effective_date,
645-        },
646-      });
647-    });
648-
--
656-
657-    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
658-      const maturityDate = loan.maturity_date;
659-      if (!maturityDate || maturityDate >= currentDate) return 0;
660-
661-      const terms = await this.db.getAllAsync<any>(
662:        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
663-      );
664-      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
665-      const paidRes = await this.db.getFirstAsync<any>(
666-        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
667-        [loanId]
668-      );
--
727-
728-    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
729-      const maturityDate = loan.maturity_date;
730-      if (!maturityDate || maturityDate >= currentDate) return 0;
731-
732-      const terms = await tx.getAllAsync(
733:        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
734-      );
735-      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
736-      const paidRes = await tx.getFirstAsync(
737-        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
738-        [loanId]
739-      );

 succeeded in 34ms:
32-  duration_months: number;
33-  annual_rate: number;
34-  interest_paise: number;
35-  start_date: string;
36-  maturity_date: string;
37:  interest_settled: number;
38:  settled?: number;
39-  operation_id?: string | null;
40-  created_at: string;
41-};
42-
43-export type LoanAttachmentInput = {
--
45-  file_path?: string;
46-  doc_type: string;
47-  notes?: string;
48-};
49-
50:export interface CreateLoanOptions extends ScheduleOptions {
51-  attachments?: LoanAttachmentInput[];
52-}
53-
54-export type LoanAttachment = {
55-  id: string;
--
171-          options.collateral || null,
172-          created_at,
173-        ]
174-      );
175-
176:      // If bullet with ANNUAL_SIMPLE_FLAT, insert term 1 into loan_terms
177-      if (options.productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
178-        await txHandle.runAsync(
179:          `INSERT INTO loan_terms (
180-            id, loan_id, term_number, duration_months, annual_rate, interest_paise,
181:            start_date, maturity_date, interest_settled, settled, operation_id, created_at
182-          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
183-          [
184-            generateUuid(),
185-            loanId,
186-            1,
--
302-  async getById(id: string): Promise<Loan | null> {
303-    return await this.db.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [id]);
304-  }
305-  
306-  async getSchedule(loanId: string) {
307:    await this.extendScheduleIfNeeded(loanId);
308-    return await this.db.getAllAsync(`
309-      SELECT * FROM repayment_schedules 
310-      WHERE loan_id = ? 
311-      ORDER BY installment_number ASC
312-    `, [loanId]);
313-  }
314-
315:  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
316-    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
317-    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE' || loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') return;
318-
319-    const kists = await tx.getAllAsync(`
320-      SELECT * FROM repayment_schedules 
--
368-    }
369-  }
370-
371-  async getLoanTerms(loanId: string): Promise<LoanTerm[]> {
372-    return await this.db.getAllAsync<LoanTerm>(
373:      `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
374-      [loanId]
375-    );
376-  }
377-
378:  async extendBulletLoan(
379-    loanId: string,
380-    additionalMonths: number,
381-    interestCollectedPaise: number,
382-    clientOpId?: string
383-  ): Promise<{ loan: Loan; term: LoanTerm }> {
--
390-        [clientOpId]
391-      );
392-      if (existingOutbox) {
393-        const existingLoan = await this.getById(loanId);
394-        const existingTerm = await this.db.getFirstAsync<LoanTerm>(
395:          `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number DESC LIMIT 1`,
396-          [loanId]
397-        );
398-        if (existingLoan && existingTerm) {
399-          return { loan: existingLoan, term: existingTerm };
400-        }
--
406-
407-    await withDbTransaction(this.db, async (tx) => {
408-      const txHandle = tx || this.db;
409-      const loan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
410-      if (!loan) throw new Error('Loan not found');
411:      if (loan.product_type !== 'bullet') throw new Error('Only One-Time Repayment (bullet) loans can be extended');
412:      if (loan.status !== 'ACTIVE') throw new Error('Only active loans can be extended');
413-
414-      const terms = await txHandle.getAllAsync<LoanTerm>(
415:        `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
416-        [loanId]
417-      );
418-
419-      const lastTerm = terms.length > 0 ? terms[terms.length - 1] : null;
420:      if (lastTerm && !lastTerm.interest_settled && !lastTerm.settled) {
421-        if (interestCollectedPaise < lastTerm.interest_paise) {
422-          throw new Error(
423:            `Prior term's contractual interest must be fully settled before extending the loan. Required: ${lastTerm.interest_paise} paise, collected: ${interestCollectedPaise} paise.`
424-          );
425-        }
426-      }
427-      const termNumber = (lastTerm ? lastTerm.term_number : 0) + 1;
428-      const startDate = lastTerm ? lastTerm.maturity_date : (loan.maturity_date || loan.start_date);
--
460-          ]
461-        );
462-
463-        if (lastTerm) {
464-          await txHandle.runAsync(
465:            `UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE id = ?`,
466-            [lastTerm.id]
467-          );
468-        }
469-      }
470-
471-      await txHandle.runAsync(
472:        `INSERT INTO loan_terms (
473-          id, loan_id, term_number, duration_months, annual_rate, interest_paise,
474:          start_date, maturity_date, interest_settled, settled, operation_id, created_at
475-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
476-        [
477-          termId,
478-          loanId,
479-          termNumber,
--
503-        [newCumulativeDuration, newCumulativeInterest, newTotalPaise, maturityDate, loanId]
504-      );
505-
506-      await OutboxManager.enqueue(txHandle, {
507-        operationId: opId,
508:        operationType: 'extend_loan',
509-        payload: {
510-          loan_id: loanId,
511-          additional_months: additionalMonths,
512-          interest_collected_paise: interestCollectedPaise,
513-          effective_date: todayStr,
514-        },
515-      });
516-
517-      updatedLoan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
518:      createdTerm = await txHandle.getFirstAsync<LoanTerm>(`SELECT * FROM loan_terms WHERE id = ?`, [termId]);
519-    });
520-
521-    SyncCoordinator.notifyMutation();
522-    return { loan: updatedLoan!, term: createdTerm! };
523-  }

 exited 1 in 36ms:
109:      await OutboxManager.markSynced(mockDb, ['op-2']);
/home/sagar/.nvm/versions/node/v24.21.0/bin/node
node_modules-present

 succeeded in 109ms:
                            'id': str(tx.id),
                            'operation_id': str(tx.operation_id),
                            'loan_id': str(loan.id),
                            'transaction_type': tx.transaction_type,
                            'forgiven_penalty_paise': tx.forgiven_penalty_paise,
                            'effective_date': str(tx.effective_date)
                        }
                    )

            ScheduleModification.objects.create(
                tenant=tenant,
                loan=loan,
                kist=kist,
                operation_id=operation_id,
                original_due_date=kist.original_due_date,
                prior_effective_due_date=kist.effective_due_date,
                revised_effective_due_date=revised_date,
                reason=payload.get('reason', ''),
                accrued_penalty_action=accrued_penalty_action,
                waived_penalty_paise=actual_waived
            )

            kist.effective_due_date = revised_date
            kist.save(update_fields=['effective_due_date'])

            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='KIST',
                record_id=kist.id,
                operation_type='UPDATE',
                payload={
                    'id': str(kist.id),
                    'loan_id': str(loan.id),
                    'installment_number': kist.installment_number,
                    'effective_due_date': str(kist.effective_due_date)
                }
            )

            # Check if loan settles as a result of penalty waiver
            if actual_waived > 0:
                all_kists_paid = not loan.schedules.exclude(status='PAID').exists()
                past_p = (
                    LedgerTx.objects
                    .filter(loan=loan, transaction_type__in=('COLLECTION', 'REVERSAL'))
                    .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                )
                remaining_pen = max(0, outstanding_pen - actual_waived)
                if all_kists_paid and remaining_pen <= 0 and past_p >= loan.principal_paise:
                    loan.status = 'SETTLED'
                    loan.save(update_fields=['status'])
                    SyncOutbox.objects.create(
                    payment_operation_id=pay_op_id
                )
            except (ValidationError, ValueError) as err:
                return 'REJECTED', str(err)
            return 'ACCEPTED', None

        elif op_type == 'correct_payment':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            orig_op_raw = payload.get('original_operation_id') or payload.get('original_transaction_id')
            if not orig_op_raw:
                return 'REJECTED', 'Missing original_operation_id or original_transaction_id.'
            try:
                orig_op_id = uuid.UUID(str(orig_op_raw))
            except ValueError:
                return 'REJECTED', f'Invalid original_operation_id format: {orig_op_raw}'

            raw_corrected = payload.get('corrected_amount_paise')
            if raw_corrected is None or isinstance(raw_corrected, bool) or not isinstance(raw_corrected, int) or raw_corrected < 0:
                return 'REJECTED', 'corrected_amount_paise must be an exact non-negative integer.'

            reason = str(payload.get('reason', '') or '').strip()
            if not reason:
                return 'REJECTED', 'Correction reason is required.'

            eff_date = payload.get('effective_date')
            if eff_date and 'T' in str(eff_date):
                eff_date = str(eff_date).split('T')[0]

            try:
                ledger_service.correct_payment(
                    loan=loan,
                    original_operation_id=orig_op_id,
                    corrected_amount_paise=raw_corrected,
                    reason=reason,
                    operation_id=operation_id,
                    effective_date_str=str(eff_date) if eff_date else None
                )
            except (ValidationError, ValueError) as err:
                return 'REJECTED', str(err)
            return 'ACCEPTED', None

        elif op_type == 'close_loan':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            raw_settlement = payload.get('settlement_amount_paise', 0)
            if raw_settlement is not None and (isinstance(raw_settlement, bool) or not isinstance(raw_settlement, int) or raw_settlement < 0):
backend/ledger/engine/ledger_service.py

exec
/bin/bash -lc "git show 31d05db:src/core/sync/syncService.test.ts | sed -n '1,260p'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:backend/ledger/engine/ledger_service.py | rg -n 'record_type|def record|def correct|operation_id=|outbox|SyncOutbox'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'git diff --quiet 31d05db -- src/core/sync/syncService.ts src/core/database/loanRepository.ts; git show 31d05db:src/core/database/transaction.ts' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:backend/api/views_sync.py | sed -n '950,1055p'; git show 31d05db:backend/ledger/engine/ledger_service.py | sed -n '1,100p'" in /mnt/f/personal projects/credkeep
 succeeded in 66ms:
import { OutboxManager } from './outbox';
import { SyncService } from './syncService';
import { ApiClient } from '../api/client';

jest.mock('../auth/authStore', () => ({
  AuthStore: {
    getToken: jest.fn(async () => 'fake-jwt-token'),
    getDeviceId: jest.fn(async () => 'device-uuid-999'),
  },
}));

jest.mock('../api/client', () => ({
  ApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('SyncService & OutboxManager', () => {
  let mockDb: any;
  let outboxRows: any[] = [];
  let metaRows: Record<string, string> = {};

  beforeEach(() => {
    outboxRows = [];
    metaRows = {};
    jest.clearAllMocks();

    mockDb = {
      runAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO sync_outbox')) {
          outboxRows.push({
            id: params[0],
            operation_id: params[1],
            operation_type: params[2],
            payload: params[3],
            status: 'PENDING',
            error_message: null,
            created_at: params[4],
          });
        } else if (sql.includes('UPDATE sync_outbox SET status = ?')) {
          const opId = params[2];
          const row = outboxRows.find((r) => r.operation_id === opId);
          if (row) {
            row.status = params[0];
            row.error_message = params[1];
          }
        } else if (sql.includes('UPDATE sync_outbox SET status = \'SYNCED\'')) {
          const opIds = params;
          for (const opId of opIds) {
            const row = outboxRows.find((r) => r.operation_id === opId);
            if (row) row.status = 'SYNCED';
          }
        } else if (sql.includes('INSERT INTO sync_meta')) {
          metaRows[params[0]] = params[1];
        }
        return { changes: 1 };
      }),

      getAllAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM sync_outbox')) {
          const limit = params && typeof params[0] === 'number' ? params[0] : undefined;
          const filtered = outboxRows.filter((r) => r.status === 'PENDING' || r.status === 'FAILED');
          return limit !== undefined ? filtered.slice(0, limit) : filtered;
        }
        return [];
      }),

      getFirstAsync: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM sync_meta WHERE key = ?')) {
          const val = metaRows[params[0]];
          return val ? { value: val } : null;
        }
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          return null;
        }
        return null;
      }),

      withExclusiveTransactionAsync: jest.fn(async (callback: any) => {
        return await callback(mockDb);
      }),
    };
  });

  describe('OutboxManager', () => {
    it('enqueues a mutation operation and retrieves pending', async () => {
      const rec = await OutboxManager.enqueue(mockDb, {
        operationId: 'op-1',
        operationType: 'create_borrower',
        payload: { name: 'Ramesh', phone: '9988776655' },
      });

      expect(rec.operation_id).toBe('op-1');
      expect(rec.status).toBe('PENDING');

      const pending = await OutboxManager.getPending(mockDb);
      expect(pending.length).toBe(1);
      expect(pending[0].operation_id).toBe('op-1');
    });

    it('marks operation as synced', async () => {
      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-2',
        operationType: 'record_collection',
        payload: { amount_paise: 50000 },
      });

      await OutboxManager.markSynced(mockDb, ['op-2']);
      const pending = await OutboxManager.getPending(mockDb);
      expect(pending.length).toBe(0);
    });

    it('manages sync_meta key value store', async () => {
      expect(await OutboxManager.getMeta(mockDb, 'last_pull_cursor')).toBeNull();

      await OutboxManager.setMeta(mockDb, 'last_pull_cursor', '42');
      expect(await OutboxManager.getMeta(mockDb, 'last_pull_cursor')).toBe('42');
    });
  });

  describe('SyncService Push', () => {
    it('pushes pending outbox records to /sync/push/ and updates status', async () => {
      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-accepted',
        operationType: 'create_borrower',
        payload: { name: 'Kavita', phone: '9123456789' },
      });

      await OutboxManager.enqueue(mockDb, {
        operationId: 'op-rejected',
        operationType: 'create_loan',
        payload: { invalid: true },
      });

      (ApiClient.post as jest.Mock).mockResolvedValueOnce({
        results: [
          { operation_id: 'op-accepted', status: 'ACCEPTED' },
          { operation_id: 'op-rejected', status: 'REJECTED', error: 'Invalid parameters' },
        ],
      });

      const res = await SyncService.pushPending(mockDb);

      expect(res.pushed).toBe(1);
      expect(res.failed).toBe(1);
      expect(ApiClient.post).toHaveBeenCalledWith('/sync/push/', expect.objectContaining({
        device_id: 'device-uuid-999',
        operations: expect.any(Array),
      }));

      const rowAccepted = outboxRows.find((r) => r.operation_id === 'op-accepted');
      expect(rowAccepted?.status).toBe('SYNCED');

      const rowRejected = outboxRows.find((r) => r.operation_id === 'op-rejected');
      expect(rowRejected?.status).toBe('REJECTED');
      expect(rowRejected?.error_message).toBe('Invalid parameters');
    });
  });

  describe('SyncService Pull', () => {
    it('pulls authoritative changes from /sync/pull/ and applies them to local db', async () => {
      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 15,
        has_more: false,
        changes: [
          {
            id: 'change-1',
            record_type: 'BORROWER',
            operation_type: 'INSERT',
            payload: {
              id: 'b-1',
              name: 'Sunita Devi',
              phone: '9876543210',
            },
          },
          {
            id: 'change-2',
            record_type: 'LOAN',
            operation_type: 'UPDATE',
            payload: {
              id: 'loan-1',
              status: 'SETTLED',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);

      expect(pullRes.pulled).toBe(2);
      expect(ApiClient.get).toHaveBeenCalledWith('/sync/pull/?cursor=0&limit=100');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO borrowers'),
        expect.arrayContaining(['b-1', 'Sunita Devi', '9876543210'])
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE loans SET status = ? WHERE id = ?'),
        ['SETTLED', 'loan-1']
      );

      expect(metaRows['last_pull_cursor']).toBe('15');
      expect(metaRows['last_synced_at']).toBeDefined();
    });

    it('respects append-only ledger trigger: does not execute UPDATE on existing transactions', async () => {
      // Mock existing transaction check to return an existing id
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          if (params[0] === 'op-existing-tx') return { id: 'tx-local-1' };
        }
        return null;
      });

      (ApiClient.get as jest.Mock).mockResolvedValueOnce({
        next_cursor: 20,
        has_more: false,
        changes: [
          {
            id: 'change-tx',
            record_type: 'TRANSACTION',
            operation_type: 'INSERT',
            payload: {
              id: 'tx-server-1',
              operation_id: 'op-existing-tx',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              is_cash: false,
              payment_method: 'UPI',
              amount_paise: 50000,
              allocated_principal_paise: 30000,
              allocated_markup_paise: 15000,
              allocated_penalty_paise: 5000,
              unallocated_surplus_paise: 0,
              forgiven_penalty_paise: 0,
              effective_date: '2026-01-05',
            },
          },
        ],
      });

      const pullRes = await SyncService.pullChanges(mockDb);
      expect(pullRes.pulled).toBe(1);
      // Invariant: MUST NOT execute UPDATE on transactions table
      const hasUpdateTx = (mockDb.runAsync as jest.Mock).mock.calls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE transactions')
      );
      expect(hasUpdateTx).toBe(false);
    });

    it('reconciles allocation deltas via append-only adjustment transaction', async () => {
      // Mock existing transaction with optimistic allocations
      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
          if (params[0] === 'op-optimistic-tx') {
            return {
              id: 'tx-local-1',
              loan_id: 'loan-1',
              transaction_type: 'COLLECTION',
              allocated_principal_paise: 20000,

 succeeded in 66ms:
13:    SyncOutbox,
72:            SyncOutbox.objects.create(
74:                record_type='KIST',
165:            operation_id=pen_op_id,
171:        SyncOutbox.objects.create(
173:            record_type='TRANSACTION',
196:def record_collection(
218:        existing = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
239:                existing_locked = LedgerTx.objects.filter(tenant=tenant, operation_id=operation_id).first()
358:                    operation_id=operation_id,
382:                        SyncOutbox.objects.create(
384:                            record_type='KIST',
419:                # Always publish authoritative loan status to SyncOutbox for client delta sync
420:                SyncOutbox.objects.create(
422:                    record_type='LOAN',
431:                # Create SyncOutbox entry for delta-sync
432:                SyncOutbox.objects.create(
434:                    record_type='TRANSACTION',
480:    5. Publishes SyncOutbox records for Loan and LoanTerm.
490:        existing_term = LoanTerm.objects.filter(loan=locked_loan, operation_id=operation_id).first()
513:                operation_id=pay_op_id,
542:            operation_id=operation_id
551:        # Publish to SyncOutbox
552:        SyncOutbox.objects.create(
554:            record_type='LOAN_TERM',
571:        SyncOutbox.objects.create(
573:            record_type='LOAN',
588:def correct_payment(
604:    7. Publish SyncOutbox events.
611:        existing_corr = PaymentCorrection.objects.filter(tenant=tenant, operation_id=operation_id).first()
616:            models.Q(operation_id=original_operation_id) | models.Q(id=original_operation_id),
632:            operation_id=rev_op_id,
697:                operation_id=rep_op_id,
713:            operation_id=operation_id
734:        SyncOutbox.objects.create(
736:            record_type='PAYMENT_CORRECTION',
752:        SyncOutbox.objects.create(
754:            record_type='LOAN',
789:                operation_id=pay_op_id,
816:        SyncOutbox.objects.create(
818:            record_type='LOAN',

 succeeded in 132ms:
import type { SQLiteDatabase } from 'expo-sqlite';

// Async mutex to guarantee strict serialization of all transactions on the shared connection
let transactionMutex: Promise<void> = Promise.resolve();

/**
 * Executes an atomic transaction directly on an existing authenticated/keyed connection.
 * Avoids opening a new unkeyed connection via withExclusiveTransactionAsync on real SQLCipher.
 * Transparently delegates to withExclusiveTransactionAsync in test environments when using mock adapters.
 * Serializes concurrent transaction requests using an in-memory queue to prevent nested transaction errors.
 */
export async function withDbTransaction<T>(
  db: SQLiteDatabase,
  action: (tx: SQLiteDatabase) => Promise<T>
): Promise<T> {
  // If running in a test harness where db is a mock object without nativeDatabase
  if (!(db as any)?.nativeDatabase && typeof (db as any)?.withExclusiveTransactionAsync === 'function') {
    let result: T = undefined as any;
    await (db as any).withExclusiveTransactionAsync(async (tx: any) => {
      result = await action(tx || db);
    });
    return result;
  }

  // Acquire serialization lock on the shared connection
  const previousMutex = transactionMutex;
  let releaseMutex: () => void = () => {};
  transactionMutex = new Promise<void>((resolve) => {
    releaseMutex = resolve;
  });

  try {
    await previousMutex;
  } catch {
    // Ignore previous transaction errors in chain
  }

  try {
    // Real native SQLite / SQLCipher connection: execute transaction on the keyed connection
    if (typeof (db as any).withTransactionAsync === 'function') {
      let result: T = undefined as any;
      await (db as any).withTransactionAsync(async () => {
        result = await action(db);
      });
      return result;
    }

    if (typeof (db as any).execAsync === 'function') {
      await (db as any).execAsync('BEGIN IMMEDIATE;');
      try {
        const result = await action(db);
        await (db as any).execAsync('COMMIT;');
        return result;
      } catch (error) {
        try {
          await (db as any).execAsync('ROLLBACK;');
        } catch {
          // Ignore rollback failure if already rolled back
        }
        throw error;
      }
    }

    if (typeof (db as any).runAsync === 'function') {
      await (db as any).runAsync('BEGIN IMMEDIATE;');
      try {
        const result = await action(db);
        await (db as any).runAsync('COMMIT;');
        return result;
      } catch (error) {
        try {
          await (db as any).runAsync('ROLLBACK;');
        } catch {
          // Ignore rollback failure if already rolled back
        }
        throw error;
      }
    }

    return await action(db);
  } finally {
    releaseMutex();
  }
}

 succeeded in 131ms:
                    SyncOutbox.objects.create(
                        tenant=tenant,
                        record_type='LOAN',
                        record_id=loan.id,
                        operation_type='UPDATE',
                        payload={
                            'id': str(loan.id),
                            'status': 'SETTLED'
                        }
                    )

            return 'ACCEPTED', None

        elif op_type == 'waive_penalty':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.select_for_update().get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            raw_waive = payload.get('amount_paise')
            if raw_waive is None or isinstance(raw_waive, bool) or not isinstance(raw_waive, int) or raw_waive <= 0:
                return 'REJECTED', 'Waiver amount must be an exact positive integer in paise.'
            waive_amount = raw_waive

            server_date_str = str(timezone.now().date())
            raw_eff = str(payload.get('effective_date') or server_date_str)
            if 'T' in raw_eff:
                raw_eff = raw_eff.split('T')[0]
            eff_date = min(raw_eff, server_date_str)

            # Assess penalties due up to eff_date first under the loan lock
            ledger_service.assess_penalties(loan, eff_date)

            total_assessed = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='PENALTY_ASSESSMENT')
                .aggregate(total=models.Sum('amount_paise'))['total'] or 0
            )
            total_penalty_paid = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='COLLECTION')
                .aggregate(total=models.Sum('allocated_penalty_paise'))['total'] or 0
            )
            total_penalty_waived = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type='REVERSAL')
                .aggregate(total=models.Sum('forgiven_penalty_paise'))['total'] or 0
            )
            outstanding_pen = max(0, total_assessed - total_penalty_paid - total_penalty_waived)

            if outstanding_pen <= 0:
                return 'REJECTED', 'No outstanding penalty to waive.'

            actual_waived = min(waive_amount, outstanding_pen)

            tx = LedgerTx.objects.create(
                tenant=tenant,
                operation_id=operation_id,
                loan=loan,
                transaction_type='REVERSAL',
                amount_paise=0,
                forgiven_penalty_paise=actual_waived,
                effective_date=eff_date
            )

            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='TRANSACTION',
                record_id=tx.id,
                operation_type='INSERT',
                payload={
                    'id': str(tx.id),
                    'operation_id': str(tx.operation_id),
                    'loan_id': str(loan.id),
                    'transaction_type': tx.transaction_type,
                    'forgiven_penalty_paise': tx.forgiven_penalty_paise,
                    'requested_amount_paise': waive_amount,
                    'effective_date': str(tx.effective_date)
                }
            )

            # Check if loan settles as a result of penalty waiver
            remaining_pen = outstanding_pen - actual_waived
            all_kists_paid = not loan.schedules.exclude(status='PAID').exists()
            past_p = (
                LedgerTx.objects
                .filter(loan=loan, transaction_type__in=('COLLECTION', 'REVERSAL'))
                .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
            )
            settled = False
            if all_kists_paid and remaining_pen <= 0 and past_p >= loan.principal_paise:
                loan.status = 'SETTLED'
                loan.save(update_fields=['status'])
                settled = True

            if settled:
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='LOAN',
                    record_id=loan.id,
                    operation_type='UPDATE',
                    payload={
import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
from django.db import transaction, models
from django.utils import timezone
from django.db.utils import OperationalError
from django.core.exceptions import ValidationError
from ledger.models import (
    LoanAccount,
    Kist,
    Transaction as LedgerTx,
    SyncOutbox,
    LoanTerm,
    PaymentCorrection,
    LoanAttachment,
)
from .allocation import (
    KistAllocationState,
    AllocationInput,
    allocate_payment,
    AllocationResult,
)
from .penalty import (
    PenaltyRule,
    OverdueKist,
    LoanPenaltyState,
    calculate_new_penalties,
)
from .schedule import calculate_next_due_date, calculate_contract_interest

def extend_bullet_schedule_if_needed(loan: LoanAccount, current_date_str: str) -> None:
    """
    Extends schedule month-by-month for legacy bullet loans whose last installment has passed.
    For new One-Time Repayment loans (rate_basis == 'ANNUAL_SIMPLE_FLAT'), NO monthly kists are generated.
    """
    if loan.product_type != 'bullet' or loan.status != 'ACTIVE' or getattr(loan, 'rate_basis', '') == 'ANNUAL_SIMPLE_FLAT':
        return

    kists = list(loan.schedules.all().order_by('installment_number'))
    if not kists:
        return

    last_kist = kists[-1]
    last_due_date_str = last_kist.effective_due_date.strftime("%Y-%m-%d") if hasattr(last_kist.effective_due_date, 'strftime') else str(last_kist.effective_due_date)

    if last_due_date_str < current_date_str:
        if isinstance(loan.markup_factor, float):
            markup_dec = Decimal(str(loan.markup_factor))
        else:
            markup_dec = Decimal(loan.markup_factor)
        total_markup = int((Decimal(loan.principal_paise) * markup_dec).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        markup_due_per_month = total_markup // loan.term_months

        next_installment_number = last_kist.installment_number + 1
        months_to_add = next_installment_number
        start_date_str = loan.start_date.strftime("%Y-%m-%d") if hasattr(loan.start_date, 'strftime') else str(loan.start_date)
        next_due_date = calculate_next_due_date(start_date_str, months_to_add, loan.due_day)

        while next_due_date <= current_date_str or next_installment_number == last_kist.installment_number + 1:
            new_kist = Kist.objects.create(
                tenant=loan.tenant,
                loan=loan,
                installment_number=next_installment_number,
                original_due_date=next_due_date,
                effective_due_date=next_due_date,
                principal_component_paise=0,
                markup_component_paise=markup_due_per_month,
                total_due_paise=markup_due_per_month,
                status='PENDING'
            )
            SyncOutbox.objects.create(
                tenant=loan.tenant,
                record_type='KIST',
                record_id=new_kist.id,
                operation_type='INSERT',
                payload={
                    'id': str(new_kist.id),
                    'loan_id': str(loan.id),
                    'installment_number': new_kist.installment_number,
                    'original_due_date': str(new_kist.original_due_date),
                    'effective_due_date': str(new_kist.effective_due_date),
                    'principal_component_paise': new_kist.principal_component_paise,
                    'markup_component_paise': new_kist.markup_component_paise,
                    'total_due_paise': new_kist.total_due_paise,
                    'status': new_kist.status,
                }
            )

            if next_due_date > current_date_str:
                break

            next_installment_number += 1
            months_to_add += 1
            next_due_date = calculate_next_due_date(start_date_str, months_to_add, loan.due_day)


def assess_penalties(loan: LoanAccount, current_date_str: str) -> int:
    """
    Assesses late penalties up to current_date_str and writes PENALTY_ASSESSMENT transactions.

exec
/bin/bash -lc 'node node_modules/eslint/bin/eslint.js src/core/database/loanRepository.ts src/core/sync/syncService.ts --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'node node_modules/typescript/bin/tsc --noEmit --incremental false' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 31d05db:backend/ledger/engine/ledger_service.py | sed -n '345,465p;610,765p'" in /mnt/f/personal projects/credkeep
 succeeded in 124ms:
                        .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                    )
                    past_principal_paid = past_paid
                    remaining_principal = max(0, locked_loan.principal_paise - past_principal_paid)

                    if remaining_principal > 0 and alloc_result.unallocated_funds > 0:
                        pay_principal = min(alloc_result.unallocated_funds, remaining_principal)
                        allocated_principal += pay_principal
                        alloc_result.unallocated_funds -= pay_principal

                # Create append-only collection transaction
                tx_obj = LedgerTx.objects.create(
                    tenant=tenant,
                    operation_id=operation_id,
                    loan=locked_loan,
                    transaction_type='COLLECTION',
                    is_cash=is_cash,
                    payment_method=payment_method,
                    amount_paise=payment_amount,
                    allocated_principal_paise=allocated_principal,
                    allocated_markup_paise=allocated_markup,
                    allocated_penalty_paise=allocated_penalty,
                    unallocated_surplus_paise=alloc_result.unallocated_funds,
                    effective_date=effective_date_str
                )

                # Update Kists in database
                for updated_k in alloc_result.updated_kists:
                    orig = next(k for k in db_kists if k.installment_number == updated_k.kist_number)
                    if (orig.principal_paid_paise != updated_k.principal_paid or
                        orig.markup_paid_paise != updated_k.markup_paid or
                        orig.status != updated_k.status):
                        orig.principal_paid_paise = updated_k.principal_paid
                        orig.markup_paid_paise = updated_k.markup_paid
                        orig.status = updated_k.status
                        orig.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

                        SyncOutbox.objects.create(
                            tenant=tenant,
                            record_type='KIST',
                            record_id=orig.id,
                            operation_type='UPDATE',
                            payload={
                                'id': str(orig.id),
                                'loan_id': str(locked_loan.id),
                                'installment_number': orig.installment_number,
                                'principal_paid_paise': orig.principal_paid_paise,
                                'markup_paid_paise': orig.markup_paid_paise,
                                'status': orig.status
                            }
                        )

                # Check for loan settlement
                all_kists_paid = all(k.status == 'PAID' for k in alloc_result.updated_kists)
                settled_now = False
                if locked_loan.product_type == 'instalment':
                    total_principal_paid = sum(k.principal_paid for k in alloc_result.updated_kists)
                    if (total_principal_paid >= locked_loan.principal_paise and
                        all_kists_paid and
                        alloc_result.remaining_penalty <= 0):
                        locked_loan.status = 'SETTLED'
                        locked_loan.save(update_fields=['status'])
                        settled_now = True
                elif locked_loan.product_type == 'bullet':
                    total_principal_paid = past_principal_paid + allocated_principal
                    total_interest_paid = past_interest_paid + allocated_markup
                    if (total_principal_paid >= locked_loan.principal_paise and
                        (getattr(locked_loan, 'rate_basis', '') != 'ANNUAL_SIMPLE_FLAT' or total_interest_paid >= total_contract_interest) and
                        all_kists_paid and
                        alloc_result.remaining_penalty <= 0):
                        locked_loan.status = 'SETTLED'
                        locked_loan.save(update_fields=['status'])
                        settled_now = True

                # Always publish authoritative loan status to SyncOutbox for client delta sync
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='LOAN',
                    record_id=locked_loan.id,
                    operation_type='UPDATE',
                    payload={
                        'id': str(locked_loan.id),
                        'status': locked_loan.status
                    }
                )

                # Create SyncOutbox entry for delta-sync
                SyncOutbox.objects.create(
                    tenant=tenant,
                    record_type='TRANSACTION',
                    record_id=tx_obj.id,
                    operation_type='INSERT',
                    payload={
                        'id': str(tx_obj.id),
                        'operation_id': str(tx_obj.operation_id),
                        'loan_id': str(locked_loan.id),
                        'transaction_type': tx_obj.transaction_type,
                        'is_cash': tx_obj.is_cash,
                        'payment_method': tx_obj.payment_method,
                        'amount_paise': tx_obj.amount_paise,
                        'allocated_principal_paise': tx_obj.allocated_principal_paise,
                        'allocated_markup_paise': tx_obj.allocated_markup_paise,
                        'allocated_penalty_paise': tx_obj.allocated_penalty_paise,
                        'unallocated_surplus_paise': tx_obj.unallocated_surplus_paise,
                        'forgiven_penalty_paise': tx_obj.forgiven_penalty_paise,
                        'effective_date': str(tx_obj.effective_date)
                    }
                )

                return {
                    'status': 'SUCCESS',
                    'transaction': tx_obj,
                    'allocation_result': alloc_result
                }
        except OperationalError as exc:
            if ('locked' in str(exc).lower() or 'busy' in str(exc).lower()) and attempt < 5:
                time.sleep(0.05 * (attempt + 1))
                continue
            raise


        # Idempotency check
        existing_corr = PaymentCorrection.objects.filter(tenant=tenant, operation_id=operation_id).first()
        if existing_corr:
            return {'status': 'ALREADY_EXISTS', 'correction': existing_corr}

        orig_tx = LedgerTx.objects.filter(
            models.Q(operation_id=original_operation_id) | models.Q(id=original_operation_id),
            tenant=tenant,
            loan=locked_loan
        ).first()
        if not orig_tx:
            raise ValidationError(f"Original transaction with ID/operation_id {original_operation_id} not found.")
        if orig_tx.transaction_type != 'COLLECTION':
            raise ValidationError(f"Only collection transactions can be corrected. Found: {orig_tx.transaction_type}")
        if PaymentCorrection.objects.filter(tenant=tenant, original_transaction=orig_tx).exists():
            raise ValidationError("This payment has already been corrected.")

        eff_date = effective_date_str or str(orig_tx.effective_date)
        rev_op_id = uuid.uuid5(operation_id, f"reversal:{orig_tx.id}")

        reversal_tx = LedgerTx.objects.create(
            tenant=tenant,
            operation_id=rev_op_id,
            loan=locked_loan,
            transaction_type='REVERSAL',
            amount_paise=0,
            allocated_principal_paise=0,
            allocated_markup_paise=0,
            allocated_penalty_paise=0,
            unallocated_surplus_paise=0,
            effective_date=eff_date,
            reversal_of_id=orig_tx.id,
            correction_reason=reason
        )

        # Unwind orig_tx allocations before applying replacement
        if locked_loan.product_type == 'instalment':
            for k in locked_loan.schedules.all():
                k.principal_paid_paise = 0
                k.markup_paid_paise = 0
                k.status = 'PENDING'
                k.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

            prior_collections = (
                LedgerTx.objects
                .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                .exclude(id=orig_tx.id)
                .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                .order_by('effective_date', 'sequence_number')
            )
            for col in prior_collections:
                db_kists = list(locked_loan.schedules.all().order_by('installment_number'))
                kist_states = [
                    KistAllocationState(
                        kist_number=k.installment_number,
                        amount_due=k.total_due_paise,
                        principal_due=k.principal_component_paise,
                        markup_due=k.markup_component_paise,
                        amount_paid=k.principal_paid_paise + k.markup_paid_paise,
                        principal_paid=k.principal_paid_paise,
                        markup_paid=k.markup_paid_paise,
                        is_due=True,
                        status=k.status
                    )
                    for k in db_kists
                ]
                alloc_res = allocate_payment(AllocationInput(
                    payment_amount=col.amount_paise,
                    kists=kist_states,
                    outstanding_penalty=0
                ))
                for updated_k in alloc_res.updated_kists:
                    db_k = next(k for k in db_kists if k.installment_number == updated_k.kist_number)
                    if (db_k.principal_paid_paise != updated_k.principal_paid or
                        db_k.markup_paid_paise != updated_k.markup_paid or
                        db_k.status != updated_k.status):
                        db_k.principal_paid_paise = updated_k.principal_paid
                        db_k.markup_paid_paise = updated_k.markup_paid
                        db_k.status = updated_k.status
                        db_k.save(update_fields=['principal_paid_paise', 'markup_paid_paise', 'status'])

        replacement_tx = None
        if corrected_amount_paise > 0:
            rep_op_id = uuid.uuid5(operation_id, f"replacement:{orig_tx.id}")
            res = record_collection(
                loan=locked_loan,
                payment_amount=corrected_amount_paise,
                operation_id=rep_op_id,
                effective_date_str=eff_date,
                payment_method=orig_tx.payment_method,
                is_cash=orig_tx.is_cash
            )
            replacement_tx = res.get('transaction')

        correction_obj = PaymentCorrection.objects.create(
            tenant=tenant,
            loan=locked_loan,
            original_transaction=orig_tx,
            reversal_transaction=reversal_tx,
            replacement_transaction=replacement_tx,
            original_amount_paise=orig_tx.amount_paise,
            corrected_amount_paise=corrected_amount_paise,
            reason=reason,
            operation_id=operation_id
        )

        # Recompute loan settlement status
        if locked_loan.status == 'SETTLED':
            if locked_loan.product_type == 'instalment':
                has_pending = locked_loan.schedules.exclude(status='PAID').exists()
                if has_pending:
                    locked_loan.status = 'ACTIVE'
                    locked_loan.save(update_fields=['status'])
            elif locked_loan.product_type == 'bullet':
                total_prin_paid = (
                    LedgerTx.objects
                    .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                    .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
                    .aggregate(total=models.Sum('allocated_principal_paise'))['total'] or 0
                )
                if total_prin_paid < locked_loan.principal_paise:
                    locked_loan.status = 'ACTIVE'
                    locked_loan.save(update_fields=['status'])

        SyncOutbox.objects.create(
            tenant=tenant,
            record_type='PAYMENT_CORRECTION',
            record_id=correction_obj.id,
            operation_type='INSERT',
            payload={
                'id': str(correction_obj.id),
                'loan_id': str(locked_loan.id),
                'original_transaction_id': str(orig_tx.id),
                'original_operation_id': str(orig_tx.operation_id),
                'reversal_transaction_id': str(reversal_tx.id),
                'replacement_transaction_id': str(replacement_tx.id) if replacement_tx else None,
                'original_amount_paise': correction_obj.original_amount_paise,
                'corrected_amount_paise': correction_obj.corrected_amount_paise,
                'reason': correction_obj.reason,
                'operation_id': str(operation_id)
            }
        )
        SyncOutbox.objects.create(
            tenant=tenant,
            record_type='LOAN',
            record_id=locked_loan.id,
            operation_type='UPDATE',
            payload={
                'id': str(locked_loan.id),
                'status': locked_loan.status
            }
        )

        return {'status': 'SUCCESS', 'correction': correction_obj}



 succeeded in 13542ms:
exec
/bin/bash -lc "git show 31d05db:backend/api/views_sync.py | sed -n '1180,1270p'; git show 31d05db:src/core/database/loanRepository.ts | sed -n '175,225p'; git show 31d05db:src/core/migration/uuidUtils.ts | sed -n '1,140p'" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'node node_modules/jest/bin/jest.js --runInBand --no-cache src/core/sync/syncService.test.ts src/core/database/loanRepository.test.ts' in /mnt/f/personal projects/credkeep
 succeeded in 286ms:

        elif op_type == 'upload_attachment_metadata':
            loan_id_raw = payload.get('loan_id') or op.get('loan_id')
            if not loan_id_raw:
                return 'REJECTED', 'Missing loan_id.'

            try:
                loan = LoanAccount.objects.get(tenant=tenant, id=uuid.UUID(str(loan_id_raw)))
            except (LoanAccount.DoesNotExist, ValueError):
                return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'

            doc_type = payload.get('document_type') or payload.get('doc_type', 'OTHER')
            file_name = payload.get('file_name', 'attachment')
            file_size = payload.get('file_size', 0)
            notes = payload.get('notes', '')

            att_id = uuid.UUID(str(payload['id'])) if payload.get('id') else uuid.uuid4()
            att = LoanAttachment.objects.create(
                id=att_id,
                tenant=tenant,
                loan=loan,
                document_type=doc_type,
                file_name=file_name,
                file_size=file_size,
                notes=notes
            )
            SyncOutbox.objects.create(
                tenant=tenant,
                record_type='LOAN_ATTACHMENT',
                record_id=att.id,
                operation_type='INSERT',
                payload={
                    'id': str(att.id),
                    'loan_id': str(loan.id),
                    'document_type': att.document_type,
                    'doc_type': att.document_type,
                    'file_name': att.file_name,
                    'file_size': att.file_size,
                    'notes': att.notes
                }
            )
            return 'ACCEPTED', None

        else:
            return 'REJECTED', f'Unknown operation type: {op_type}'


class SyncPullView(APIView):
    """
    Returns authoritative state changes for the tenant since the given cursor.
    Uses sequential pagination on SyncOutbox.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        cursor_raw = request.query_params.get('cursor', '0')
        try:
            cursor = int(cursor_raw)
        except (ValueError, TypeError):
            cursor = 0

        limit_raw = request.query_params.get('limit', '100')
        try:
            limit = min(max(1, int(limit_raw)), 500)
        except (ValueError, TypeError):
            limit = 100

        records_qs = (
            SyncOutbox.objects
            .filter(tenant=tenant, sequence_number__gt=cursor)
            .order_by('sequence_number')[:limit + 1]
        )
        records = list(records_qs)

        has_more = len(records) > limit
        if has_more:
            records = records[:limit]

        next_cursor = records[-1].sequence_number if records else cursor

        changes = [
            {
                "id": str(r.id),
                "record_type": r.record_type,

      // If bullet with ANNUAL_SIMPLE_FLAT, insert term 1 into loan_terms
      if (options.productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
        await txHandle.runAsync(
          `INSERT INTO loan_terms (
            id, loan_id, term_number, duration_months, annual_rate, interest_paise,
            start_date, maturity_date, interest_settled, settled, operation_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateUuid(),
            loanId,
            1,
            options.termMonths,
            annualRate,
            interestPaise,
            options.startDate,
            maturityDate,
            0,
            0,
            clientOpId || null,
            created_at,
          ]
        );
      }
      
      if (schedule.length > 0) {
        const statement = await txHandle.prepareAsync(`
          INSERT INTO repayment_schedules 
          (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        try {
          for (const kist of schedule) {
            await statement.executeAsync([
              generateUuid(),
              loanId,
              kist.kistNumber,
              kist.dueDate,
              kist.dueDate,
              kist.principalDue || 0,
              kist.markupDue || 0,
              kist.amountDue
            ]);
          }
        } finally {
          await statement.finalizeAsync();
        }
      }

      await OutboxManager.enqueue(txHandle, {
import CryptoJS from 'crypto-js';

export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function deterministicUuid(seed: string): string {
  const hash = CryptoJS.MD5(seed).toString();
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function getMigratedTransactionOpId(tx: {
  id?: string;
  operation_id?: string;
  loan_id?: string;
  effective_date?: string;
  amount_paise?: number;
  transaction_type?: string;
}): string {
  if (tx.operation_id && isUuid(tx.operation_id)) {
    return tx.operation_id;
  }
  const prefix = tx.transaction_type === 'WAIVER' ? 'mig-waiver' : 'mig-tx';
  return deterministicUuid(`${prefix}-${tx.id || tx.operation_id || `${tx.loan_id}-${tx.effective_date}-${tx.amount_paise}`}`);
}


 exited 1 in 3697ms:
Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

 succeeded in 34796ms:
codex
I found a pagination edge case in payment acknowledgement: if a schedule snapshot and its transaction arrive on different pages, the payment can remain counted twice after pull completes. I’m verifying it with an in-memory reproduction. Typecheck and scoped lint passed; Jest could not run because its temporary directory is unavailable in this read-only environment.
exec
/bin/bash -lc "git show 31d05db:src/core/domain/allocation.ts | sed -n '1,90p'; git show 31d05db:src/core/sync/syncService.ts | nl -ba | sed -n '116,135p;145,159p;514,522p'" in /mnt/f/personal projects/credkeep
 succeeded in 146ms:
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
   116	          const modifiedScheduleLoanIds = new Set<string>();
   117	          for (const change of changes) {
   118	            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);
   119	          }
   120	          for (const loanId of modifiedScheduleLoanIds) {
   121	            await this.reapplyPendingCollections(tx, loanId);
   122	          }
   123	          await OutboxManager.setMeta(tx, 'last_pull_cursor', String(cursor));
   124	        });
   125	        totalPulled += changes.length;
   126	      } else {
   127	        cursor = response.next_cursor;
   128	        hasMore = Boolean(response.has_more);
   129	        await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));
   130	      }
   131	    }
   132	
   133	    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());
   134	    return { pulled: totalPulled };
   135	  }
   145	      (record_type === 'KIST' ||
   146	        (record_type === 'TRANSACTION' &&
   147	          (payload.transaction_type === 'WAIVER' ||
   148	            payload.transaction_type === 'PENALTY_ASSESSMENT' ||
   149	            (payload.transaction_type === 'REVERSAL' && (payload.forgiven_penalty_paise || 0) > 0)))) &&
   150	      payload.loan_id &&
   151	      modifiedLoanIds
   152	    ) {
   153	      modifiedLoanIds.add(payload.loan_id);
   154	    }
   155	
   156	    if (record_type === 'BORROWER') {
   157	      if (operation_type === 'INSERT') {
   158	        await tx.runAsync(
   159	          `INSERT INTO borrowers (id, name, phone, created_at)
   514	            }
   515	          }
   516	        }
   517	
   518	        if (payload.operation_id) {
   519	          await OutboxManager.markSynced(tx, [payload.operation_id]);
   520	        }
   521	        if (!existing) {
   522	          await tx.runAsync(

collab: Wait
codex
**REWORK**

- **P1 — Acknowledgement can leave payments counted twice across pull pages.** [syncService.ts:518–519](/mnt/f/personal%20projects/credkeep/src/core/sync/syncService.ts:518) marks a collection `SYNCED` without scheduling a balance rebuild. If its KIST snapshot arrives on the preceding page, that page replays the pending payment over the server balance; the transaction page never removes it. Verified in memory: authoritative paid **100**, final local paid **200**, outbox `SYNCED`. Rebuild the affected loan when acknowledging the collection and cover this pagination case.

Typecheck and scoped lint passed. Jest was blocked by the read-only environment’s unavailable temporary directory.
tokens used
62,956
**REWORK**

- **P1 — Acknowledgement can leave payments counted twice across pull pages.** [syncService.ts:518–519](/mnt/f/personal%20projects/credkeep/src/core/sync/syncService.ts:518) marks a collection `SYNCED` without scheduling a balance rebuild. If its KIST snapshot arrives on the preceding page, that page replays the pending payment over the server balance; the transaction page never removes it. Verified in memory: authoritative paid **100**, final local paid **200**, outbox `SYNCED`. Rebuild the affected loan when acknowledging the collection and cover this pagination case.

Typecheck and scoped lint passed. Jest was blocked by the read-only environment’s unavailable temporary directory.

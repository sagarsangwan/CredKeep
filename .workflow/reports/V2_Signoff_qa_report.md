OpenAI Codex v0.163.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a14a2a-4404-7be1-9ce6-38653b338001
--------
user
Perform focused, read-only QA review on milestone V2_Signoff.
Review ONLY the git diff between 31d05db and bd3183d and directly impacted dependencies.
Scope: Verify financial calculation correctness, payment idempotency, tenant isolation, SQLCipher/database mutations, migrations, or sync integrity.

Token-Optimization & Review Invariants:
1. Review only the changed files in the commit range (31d05db...bd3183d). Do not perform broad repository indexing.
2. Limit your findings to at most 5 actionable issues, ordered strictly by severity (P0 Critical first, down to P2 Minor).
3. If no critical or high severity defects are found, return: APPROVED.
4. If blocking defects exist, provide concise file/line references and return: REWORK.
5. Do NOT suggest broad architectural rewrites or stylistic nitpicks.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the specified diff and directly impacted dependencies, focusing on the listed integrity risks. I’m using the code-review skill, with your scope limits taking precedence.
exec
/bin/bash -lc 'cat .agents/skills/code-review/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 32ms:
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
/bin/bash -lc 'git status --short; git diff --stat 31d05db...bd3183d; git diff --name-only 31d05db...bd3183d' in /mnt/f/personal projects/credkeep
 succeeded in 3044ms:
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
 M .workflow/reports/V2_Final_qa_guard.json
 M .workflow/reports/V2_Final_qa_prompt.txt
 M .workflow/reports/V2_Final_qa_report.md
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
?? .workflow/reports/V2_Signoff_qa_prompt.txt
?? .workflow/reports/V2_Signoff_qa_report.md
 .workflow/reports/V2_Final_qa_guard.json |    9 +
 .workflow/reports/V2_Final_qa_prompt.txt |   10 +
 .workflow/reports/V2_Final_qa_report.md  | 4380 ++++++++++++++++++++++++++++++
 src/__tests__/cross-loan.test.ts         |    7 +-
 src/core/sync/syncService.test.ts        |  110 +
 src/core/sync/syncService.ts             |   26 +-
 6 files changed, 4536 insertions(+), 6 deletions(-)
.workflow/reports/V2_Final_qa_guard.json
.workflow/reports/V2_Final_qa_prompt.txt
.workflow/reports/V2_Final_qa_report.md
src/__tests__/cross-loan.test.ts
src/core/sync/syncService.test.ts
src/core/sync/syncService.ts

exec
/bin/bash -lc 'git show bd3183d:src/core/sync/syncService.ts' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'git diff 31d05db...bd3183d -- src/core/sync/syncService.ts src/core/sync/syncService.test.ts src/__tests__/cross-loan.test.ts; git log --oneline 31d05db..bd3183d' in /mnt/f/personal projects/credkeep
 succeeded in 29ms:
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
        record_type === 'TRANSACTION' ||
        record_type === 'PAYMENT_CORRECTION') &&
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
          let targetLoanId = payload.loan_id || existing?.loan_id;
          if (!targetLoanId) {
            const outboxRow = await tx.getFirstAsync<{ payload: string }>(
              `SELECT payload FROM sync_outbox WHERE operation_id = ?`,
              [payload.operation_id]
            );
            if (outboxRow?.payload) {
              try {
                const parsed = JSON.parse(outboxRow.payload);
                targetLoanId = parsed.loan_id;
              } catch {}
            }
          }
          if (targetLoanId) {
            if (modifiedLoanIds) {
              modifiedLoanIds.add(targetLoanId);
            } else {
              await this.reapplyPendingCollections(tx, targetLoanId);
            }
          }
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

 succeeded in 219ms:
diff --git a/src/__tests__/cross-loan.test.ts b/src/__tests__/cross-loan.test.ts
index 30d14fa..7e50e07 100644
--- a/src/__tests__/cross-loan.test.ts
+++ b/src/__tests__/cross-loan.test.ts
@@ -922,8 +922,11 @@ describe('Real SQLite Engine Integration Guarantees', () => {
       }
     }, modifiedLoansPage3);
 
-    // Verified: non-KIST change does NOT touch modifiedLoansPage3
-    expect(modifiedLoansPage3.size).toBe(0);
+    // Verified: TRANSACTION change tracks modifiedLoansPage3 so acknowledged collections rebuild correctly
+    expect(modifiedLoansPage3.has('loan-replay')).toBe(true);
+    for (const lid of modifiedLoansPage3) {
+      await SyncService.reapplyPendingCollections(db, lid);
+    }
 
     // CRITICAL INVARIANT: Multi-page replay did NOT credit kist 2 or double-credit kist 1
     const k1Final = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-1'`);
diff --git a/src/core/sync/syncService.test.ts b/src/core/sync/syncService.test.ts
index 7bde40a..47be643 100644
--- a/src/core/sync/syncService.test.ts
+++ b/src/core/sync/syncService.test.ts
@@ -424,6 +424,116 @@ describe('SyncService & OutboxManager', () => {
       );
     });
 
+    it('prevents double-counting across pull pages when KIST snapshot precedes TRANSACTION acknowledgement', async () => {
+      outboxRows.push({
+        id: 'outbox-coll-1',
+        operation_id: 'op-coll-1',
+        operation_type: 'record_collection',
+        payload: JSON.stringify({
+          loan_id: 'loan-1',
+          amount_paise: 10000,
+          effective_date: '2026-01-01',
+        }),
+        status: 'PENDING',
+        error_message: null,
+        created_at: '2026-01-01T10:00:00Z',
+      });
+
+      (ApiClient.get as jest.Mock)
+        .mockResolvedValueOnce({
+          next_cursor: 1,
+          has_more: true,
+          changes: [
+            {
+              id: 'change-kist-1',
+              record_type: 'KIST',
+              operation_type: 'INSERT',
+              payload: {
+                id: 'kist-1',
+                loan_id: 'loan-1',
+                installment_number: 1,
+                original_due_date: '2026-01-01',
+                effective_due_date: '2026-01-01',
+                principal_component_paise: 10000,
+                markup_component_paise: 0,
+                total_due_paise: 10000,
+                principal_paid_paise: 10000,
+                markup_paid_paise: 0,
+                status: 'PAID',
+              },
+            },
+          ],
+        })
+        .mockResolvedValueOnce({
+          next_cursor: 2,
+          has_more: false,
+          changes: [
+            {
+              id: 'change-tx-1',
+              record_type: 'TRANSACTION',
+              operation_type: 'INSERT',
+              payload: {
+                id: 'server-tx-1',
+                operation_id: 'op-coll-1',
+                loan_id: 'loan-1',
+                transaction_type: 'COLLECTION',
+                amount_paise: 10000,
+                allocated_principal_paise: 10000,
+                allocated_markup_paise: 0,
+                allocated_penalty_paise: 0,
+                unallocated_surplus_paise: 0,
+                effective_date: '2026-01-01',
+              },
+            },
+          ],
+        });
+
+      mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
+        if (sql.includes('FROM repayment_schedules WHERE id = ?')) {
+          return null;
+        }
+        if (sql.includes('FROM transactions WHERE operation_id = ?')) {
+          return null;
+        }
+        if (sql.includes('FROM loans WHERE id = ?')) {
+          return { id: 'loan-1', principal_paise: 10000, product_type: 'instalment', status: 'ACTIVE' };
+        }
+        return null;
+      });
+
+      mockDb.getAllAsync.mockImplementation(async (sql: string, params: any[]) => {
+        if (sql.includes('FROM sync_outbox WHERE status IN (\'PENDING\', \'NEEDS_REVIEW\')')) {
+          return outboxRows.filter((r) => r.status === 'PENDING' || r.status === 'NEEDS_REVIEW');
+        }
+        if (sql.includes('FROM repayment_schedules WHERE loan_id = ?')) {
+          return [
+            {
+              id: 'kist-1',
+              loan_id: 'loan-1',
+              installment_number: 1,
+              principal_component_paise: 10000,
+              markup_component_paise: 0,
+              total_due_paise: 10000,
+              principal_paid_paise: 10000,
+              markup_paid_paise: 0,
+              effective_due_date: '2026-01-01',
+              status: 'PAID',
+            },
+          ];
+        }
+        return [];
+      });
+
+      const pullRes = await SyncService.pullChanges(mockDb);
+      expect(pullRes.pulled).toBe(2);
+
+      expect(outboxRows.find((r) => r.operation_id === 'op-coll-1')?.status).toBe('SYNCED');
+      expect(mockDb.runAsync).toHaveBeenCalledWith(
+        expect.stringContaining('UPDATE repayment_schedules SET'),
+        ['loan-1']
+      );
+    });
+
     it('reports failure and review required when push has failed operations while still pulling authoritative server state', async () => {
       const pushSpy = jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 1 });
       const pullSpy = jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 5 });
diff --git a/src/core/sync/syncService.ts b/src/core/sync/syncService.ts
index 191aafd..5dd3bc4 100644
--- a/src/core/sync/syncService.ts
+++ b/src/core/sync/syncService.ts
@@ -143,10 +143,8 @@ export class SyncService {
 
     if (
       (record_type === 'KIST' ||
-        (record_type === 'TRANSACTION' &&
-          (payload.transaction_type === 'WAIVER' ||
-            payload.transaction_type === 'PENALTY_ASSESSMENT' ||
-            (payload.transaction_type === 'REVERSAL' && (payload.forgiven_penalty_paise || 0) > 0)))) &&
+        record_type === 'TRANSACTION' ||
+        record_type === 'PAYMENT_CORRECTION') &&
       payload.loan_id &&
       modifiedLoanIds
     ) {
@@ -517,6 +515,26 @@ export class SyncService {
 
         if (payload.operation_id) {
           await OutboxManager.markSynced(tx, [payload.operation_id]);
+          let targetLoanId = payload.loan_id || existing?.loan_id;
+          if (!targetLoanId) {
+            const outboxRow = await tx.getFirstAsync<{ payload: string }>(
+              `SELECT payload FROM sync_outbox WHERE operation_id = ?`,
+              [payload.operation_id]
+            );
+            if (outboxRow?.payload) {
+              try {
+                const parsed = JSON.parse(outboxRow.payload);
+                targetLoanId = parsed.loan_id;
+              } catch {}
+            }
+          }
+          if (targetLoanId) {
+            if (modifiedLoanIds) {
+              modifiedLoanIds.add(targetLoanId);
+            } else {
+              await this.reapplyPendingCollections(tx, targetLoanId);
+            }
+          }
         }
         if (!existing) {
           await tx.runAsync(
bd3183d fix(sync): eliminate pull pagination double-counting and verify schedule rebuild on collection acknowledgement

exec
/bin/bash -lc "git show bd3183d:src/core/sync/syncService.ts | nl -ba | sed -n '350,820p'" in /mnt/f/personal projects/credkeep
 succeeded in 79ms:
   350	        } else {
   351	          existingCorr = await tx.getFirstAsync<{ id: string }>(
   352	            `SELECT id FROM payment_corrections WHERE id = ?`,
   353	            [payload.id]
   354	          );
   355	        }
   356	
   357	        if (existingCorr) {
   358	          await tx.runAsync(
   359	            `UPDATE payment_corrections SET id = ? WHERE id = ?`,
   360	            [payload.id, existingCorr.id]
   361	          );
   362	        } else {
   363	          await tx.runAsync(
   364	            `INSERT INTO payment_corrections (
   365	               id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
   366	               replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
   367	               reason, operation_id, created_at
   368	             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   369	             ON CONFLICT(id) DO NOTHING`,
   370	            [
   371	              payload.id,
   372	              payload.loan_id,
   373	              payload.original_transaction_id,
   374	              payload.original_operation_id || null,
   375	              payload.reversal_transaction_id,
   376	              payload.replacement_transaction_id || null,
   377	              origAmt,
   378	              origAmt,
   379	              payload.corrected_amount_paise,
   380	              payload.reason,
   381	              payload.operation_id || null,
   382	              payload.created_at || new Date().toISOString(),
   383	            ]
   384	          );
   385	        }
   386	      }
   387	    } else if (record_type === 'KIST') {
   388	      if (operation_type === 'INSERT') {
   389	        const existingKist = await tx.getFirstAsync<{ id: string }>(
   390	          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
   391	          [payload.id, payload.loan_id, payload.installment_number]
   392	        );
   393	        if (existingKist) {
   394	          await tx.runAsync(
   395	            `UPDATE repayment_schedules SET
   396	               principal_component_paise = ?,
   397	               markup_component_paise = ?,
   398	               total_due_paise = ?,
   399	               effective_due_date = ?,
   400	               principal_paid_paise = ?,
   401	               markup_paid_paise = ?,
   402	               status = ?,
   403	               server_principal_paid_paise = ?,
   404	               server_markup_paid_paise = ?,
   405	               server_status = ?
   406	             WHERE id = ?`,
   407	            [
   408	              payload.principal_component_paise || 0,
   409	              payload.markup_component_paise || 0,
   410	              payload.total_due_paise,
   411	              payload.effective_due_date,
   412	              payload.principal_paid_paise || 0,
   413	              payload.markup_paid_paise || 0,
   414	              payload.status || 'PENDING',
   415	              payload.principal_paid_paise || 0,
   416	              payload.markup_paid_paise || 0,
   417	              payload.status || 'PENDING',
   418	              existingKist.id,
   419	            ]
   420	          );
   421	        } else {
   422	          await tx.runAsync(
   423	            `INSERT INTO repayment_schedules (
   424	               id, loan_id, installment_number, original_due_date, effective_due_date,
   425	               principal_component_paise, markup_component_paise, total_due_paise,
   426	               principal_paid_paise, markup_paid_paise, status,
   427	               server_principal_paid_paise, server_markup_paid_paise, server_status
   428	             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   429	            [
   430	              payload.id,
   431	              payload.loan_id,
   432	              payload.installment_number,
   433	              payload.original_due_date,
   434	              payload.effective_due_date,
   435	              payload.principal_component_paise || 0,
   436	              payload.markup_component_paise || 0,
   437	              payload.total_due_paise,
   438	              payload.principal_paid_paise || 0,
   439	              payload.markup_paid_paise || 0,
   440	              payload.status || 'PENDING',
   441	              payload.principal_paid_paise || 0,
   442	              payload.markup_paid_paise || 0,
   443	              payload.status || 'PENDING',
   444	            ]
   445	          );
   446	        }
   447	      } else if (operation_type === 'UPDATE') {
   448	        const existingKist = await tx.getFirstAsync<{ id: string }>(
   449	          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
   450	          [payload.id, payload.loan_id, payload.installment_number]
   451	        );
   452	        const kistId = existingKist ? existingKist.id : payload.id;
   453	        if (payload.principal_component_paise !== undefined || payload.markup_component_paise !== undefined || payload.total_due_paise !== undefined) {
   454	          await tx.runAsync(
   455	            `UPDATE repayment_schedules SET
   456	               principal_component_paise = COALESCE(?, principal_component_paise),
   457	               markup_component_paise = COALESCE(?, markup_component_paise),
   458	               total_due_paise = COALESCE(?, total_due_paise)
   459	             WHERE id = ?`,
   460	            [payload.principal_component_paise, payload.markup_component_paise, payload.total_due_paise, kistId]
   461	          );
   462	        }
   463	        if (payload.effective_due_date) {
   464	          await tx.runAsync(
   465	            `UPDATE repayment_schedules SET effective_due_date = ? WHERE id = ?`,
   466	            [payload.effective_due_date, kistId]
   467	          );
   468	        }
   469	        if (payload.status !== undefined || payload.principal_paid_paise !== undefined) {
   470	          await tx.runAsync(
   471	            `UPDATE repayment_schedules SET
   472	               principal_paid_paise = COALESCE(?, principal_paid_paise),
   473	               markup_paid_paise = COALESCE(?, markup_paid_paise),
   474	               status = COALESCE(?, status),
   475	               server_principal_paid_paise = COALESCE(?, server_principal_paid_paise),
   476	               server_markup_paid_paise = COALESCE(?, server_markup_paid_paise),
   477	               server_status = COALESCE(?, server_status)
   478	             WHERE id = ?`,
   479	            [
   480	              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
   481	              payload.principal_paid_paise, payload.markup_paid_paise, payload.status,
   482	              kistId
   483	            ]
   484	          );
   485	        }
   486	      }
   487	    } else if (record_type === 'TRANSACTION') {
   488	      if (operation_type === 'INSERT') {
   489	        const isCash = payload.is_cash !== undefined ? (payload.is_cash ? 1 : 0) : 1;
   490	        const paymentMethod = payload.payment_method || (isCash ? 'CASH' : 'ONLINE');
   491	        let existing: any = null;
   492	        if (payload.transaction_type === 'PENALTY_ASSESSMENT') {
   493	          existing = await tx.getFirstAsync<any>(
   494	            `SELECT * FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
   495	            [payload.operation_id, payload.loan_id, payload.effective_date]
   496	          );
   497	        } else {
   498	          existing = await tx.getFirstAsync<any>(
   499	            `SELECT * FROM transactions WHERE operation_id = ? OR id = ?`,
   500	            [payload.operation_id, payload.id || payload.operation_id]
   501	          );
   502	          if (!existing) {
   503	            const allLocalTx = await tx.getAllAsync<any>(
   504	              `SELECT id, operation_id, loan_id, effective_date, amount_paise, transaction_type, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise, unallocated_surplus_paise FROM transactions WHERE transaction_type IN ('COLLECTION', 'WAIVER', 'REVERSAL')`
   505	            );
   506	            for (const ltx of allLocalTx || []) {
   507	              const expectedMigOpId = getMigratedTransactionOpId(ltx);
   508	              if (expectedMigOpId === payload.operation_id || ltx.id === payload.id || ltx.operation_id === payload.operation_id) {
   509	                existing = ltx;
   510	                break;
   511	              }
   512	            }
   513	          }
   514	        }
   515	
   516	        if (payload.operation_id) {
   517	          await OutboxManager.markSynced(tx, [payload.operation_id]);
   518	          let targetLoanId = payload.loan_id || existing?.loan_id;
   519	          if (!targetLoanId) {
   520	            const outboxRow = await tx.getFirstAsync<{ payload: string }>(
   521	              `SELECT payload FROM sync_outbox WHERE operation_id = ?`,
   522	              [payload.operation_id]
   523	            );
   524	            if (outboxRow?.payload) {
   525	              try {
   526	                const parsed = JSON.parse(outboxRow.payload);
   527	                targetLoanId = parsed.loan_id;
   528	              } catch {}
   529	            }
   530	          }
   531	          if (targetLoanId) {
   532	            if (modifiedLoanIds) {
   533	              modifiedLoanIds.add(targetLoanId);
   534	            } else {
   535	              await this.reapplyPendingCollections(tx, targetLoanId);
   536	            }
   537	          }
   538	        }
   539	        if (!existing) {
   540	          await tx.runAsync(
   541	            `INSERT INTO transactions (
   542	               id, operation_id, loan_id, transaction_type, is_cash, payment_method,
   543	               amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
   544	               unallocated_surplus_paise, forgiven_penalty_paise, effective_date,
   545	               reversal_of_id, correction_reason, created_at
   546	             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   547	            [
   548	              payload.id,
   549	              payload.operation_id,
   550	              payload.loan_id,
   551	              payload.transaction_type,
   552	              isCash,
   553	              paymentMethod,
   554	              payload.amount_paise || 0,
   555	              payload.allocated_principal_paise || 0,
   556	              payload.allocated_markup_paise || 0,
   557	              payload.allocated_penalty_paise || 0,
   558	              payload.unallocated_surplus_paise || 0,
   559	              payload.forgiven_penalty_paise || 0,
   560	              payload.effective_date,
   561	              payload.reversal_of_id || null,
   562	              payload.correction_reason || null,
   563	              payload.created_at || new Date().toISOString(),
   564	            ]
   565	          );
   566	        } else if (existing.transaction_type === 'COLLECTION' && payload.transaction_type === 'COLLECTION') {
   567	          // Reconcile authoritative server allocations via append-only adjustment transaction, respecting trigger
   568	          const matchingOpIds = Array.from(
   569	            new Set([payload.operation_id, existing.operation_id, existing.id].filter(Boolean))
   570	          );
   571	          const opConditions = matchingOpIds.map(() => `(
   572	            operation_id = ?
   573	            OR id = ?
   574	            OR instr(operation_id, 'realloc::' || ? || '::') = 1
   575	            OR instr(operation_id, 'reconcile::' || ? || '::') = 1
   576	          )`).join(' OR ');
   577	
   578	          const queryParams: any[] = [payload.loan_id];
   579	          for (const opId of matchingOpIds) {
   580	            queryParams.push(opId, opId, opId, opId);
   581	          }
   582	
   583	          const netAllocRow = await tx.getFirstAsync<{
   584	            netPrincipal: number;
   585	            netMarkup: number;
   586	            netPenalty: number;
   587	            netSurplus: number;
   588	          }>(
   589	            `SELECT
   590	               COALESCE(SUM(allocated_principal_paise), 0) as netPrincipal,
   591	               COALESCE(SUM(allocated_markup_paise), 0) as netMarkup,
   592	               COALESCE(SUM(allocated_penalty_paise), 0) as netPenalty,
   593	               COALESCE(SUM(unallocated_surplus_paise), 0) as netSurplus
   594	             FROM transactions
   595	             WHERE loan_id = ?
   596	               AND (${opConditions})`,
   597	            queryParams
   598	          );
   599	
   600	          const currentPrincipal = netAllocRow?.netPrincipal ?? (existing.allocated_principal_paise || 0);
   601	          const currentMarkup = netAllocRow?.netMarkup ?? (existing.allocated_markup_paise || 0);
   602	          const currentPenalty = netAllocRow?.netPenalty ?? (existing.allocated_penalty_paise || 0);
   603	          const currentSurplus = netAllocRow?.netSurplus ?? (existing.unallocated_surplus_paise || 0);
   604	
   605	          const deltaPrincipal = (payload.allocated_principal_paise || 0) - currentPrincipal;
   606	          const deltaMarkup = (payload.allocated_markup_paise || 0) - currentMarkup;
   607	          const deltaPenalty = (payload.allocated_penalty_paise || 0) - currentPenalty;
   608	          const deltaSurplus = (payload.unallocated_surplus_paise || 0) - currentSurplus;
   609	
   610	          if (deltaPrincipal !== 0 || deltaMarkup !== 0 || deltaPenalty !== 0 || deltaSurplus !== 0) {
   611	            const reconId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('recon-' + Date.now() + '-' + Math.random().toString(36).substring(2));
   612	            const reconOpId = `reconcile::${payload.operation_id}::${reconId.substring(0, 8)}`;
   613	            await tx.runAsync(
   614	              `INSERT INTO transactions (
   615	                 id, operation_id, loan_id, transaction_type, is_cash, payment_method,
   616	                 amount_paise, allocated_principal_paise, allocated_markup_paise, allocated_penalty_paise,
   617	                 unallocated_surplus_paise, forgiven_penalty_paise, effective_date, created_at
   618	               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   619	              [
   620	                reconId,
   621	                reconOpId,
   622	                payload.loan_id,
   623	                'REVERSAL',
   624	                0,
   625	                'SYSTEM',
   626	                0,
   627	                deltaPrincipal,
   628	                deltaMarkup,
   629	                deltaPenalty,
   630	                deltaSurplus,
   631	                0,
   632	                payload.effective_date,
   633	                new Date().toISOString(),
   634	              ]
   635	            );
   636	          }
   637	        }
   638	      }
   639	    }
   640	  }
   641	
   642	  /**
   643	   * Reapplies unacknowledged local collection allocations after server schedule snapshots
   644	   * to ensure local pending payments are never erased.
   645	   */
   646	  static async reapplyPendingCollections(tx: SQLiteDatabase, loanId: string): Promise<void> {
   647	    if (!loanId) return;
   648	
   649	    // Reset kists to authoritative server baseline before replaying pending collections
   650	    await tx.runAsync(
   651	      `UPDATE repayment_schedules SET
   652	         principal_paid_paise = COALESCE(server_principal_paid_paise, 0),
   653	         markup_paid_paise = COALESCE(server_markup_paid_paise, 0),
   654	         status = COALESCE(server_status, 'PENDING')
   655	       WHERE loan_id = ?`,
   656	      [loanId]
   657	    );
   658	
   659	    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
   660	      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
   661	    );
   662	
   663	    const relevant = pendingOutbox.filter((item) => {
   664	      try {
   665	        const p = JSON.parse(item.payload);
   666	        return p.loan_id === loanId;
   667	      } catch {
   668	        return false;
   669	      }
   670	    });
   671	
   672	    relevant.sort((a, b) => {
   673	      try {
   674	        const pa = JSON.parse(a.payload);
   675	        const pb = JSON.parse(b.payload);
   676	        const dateA = pa.effective_date || '';
   677	        const dateB = pb.effective_date || '';
   678	        if (dateA !== dateB) return dateA.localeCompare(dateB);
   679	      } catch {}
   680	      return 0;
   681	    });
   682	
   683	    const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   684	
   685	    let replayedBulletPrincipalPaid = 0;
   686	    if (loan?.product_type === 'bullet') {
   687	      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
   688	        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
   689	         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
   690	           AND NOT EXISTS (
   691	             SELECT 1 FROM sync_outbox so
   692	             WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
   693	               AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
   694	               AND (
   695	                 transactions.operation_id = so.operation_id
   696	                 OR transactions.operation_id = 'reversal-' || so.operation_id
   697	                 OR transactions.operation_id = 'reversal::' || so.operation_id
   698	
   699	                 OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1
   700	
   701	                 OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
   702	               )
   703	           )`,
   704	        [loanId]
   705	      );
   706	      replayedBulletPrincipalPaid = bulletPrincipalRow?.total || 0;
   707	    }
   708	
   709	    if (relevant.length > 0) {
   710	      let replayedPendingPenaltyPaid = 0;
   711	      for (const item of relevant) {
   712	        const p = JSON.parse(item.payload);
   713	        const paymentAmount = (p.amount_paise || 0) as Paise;
   714	        const effectiveDate = p.effective_date || new Date().toISOString().split('T')[0];
   715	
   716	        // Calculate actual outstanding penalties dynamically bounded by payment effective_date
   717	        const penaltyRow = await tx.getFirstAsync<{ assessed: number; paid: number; forgiven: number }>(
   718	          `SELECT
   719	             COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ? THEN amount_paise ELSE 0 END), 0) as assessed,
   720	             COALESCE(SUM(CASE WHEN transaction_type IN ('COLLECTION', 'REVERSAL')
   721	               AND effective_date <= ?
   722	               AND NOT EXISTS (
   723	                 SELECT 1 FROM sync_outbox so
   724	                 WHERE json_extract(so.payload, '$.loan_id') = transactions.loan_id
   725	                   AND so.status IN ('PENDING', 'NEEDS_REVIEW', 'REJECTED')
   726	                   AND (
   727	                     transactions.operation_id = so.operation_id
   728	                     OR transactions.operation_id = 'reversal-' || so.operation_id
   729	                     OR transactions.operation_id = 'reversal::' || so.operation_id
   730	
   731	                     OR instr(transactions.operation_id, 'realloc::' || so.operation_id || '::') = 1
   732	
   733	                     OR instr(transactions.operation_id, 'reconcile::' || so.operation_id || '::') = 1
   734	                   )
   735	               )
   736	               THEN allocated_penalty_paise ELSE 0 END), 0) as paid,
   737	             COALESCE(SUM(CASE WHEN transaction_type IN ('WAIVER', 'REVERSAL') AND effective_date <= ? THEN forgiven_penalty_paise ELSE 0 END), 0) as forgiven
   738	           FROM transactions WHERE loan_id = ?`,
   739	          [effectiveDate, effectiveDate, effectiveDate, loanId]
   740	        );
   741	        const outstandingPenalty = Math.max(
   742	          0,
   743	          (penaltyRow?.assessed || 0) - ((penaltyRow?.paid || 0) + replayedPendingPenaltyPaid) - (penaltyRow?.forgiven || 0)
   744	        ) as Paise;
   745	
   746	        const kists = await tx.getAllAsync<any>(
   747	          `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
   748	          [loanId]
   749	        );
   750	        if (!kists || kists.length === 0) continue;
   751	
   752	        const allocInput = {
   753	          paymentAmount,
   754	          kists: kists.map((k) => ({
   755	            kistNumber: k.installment_number,
   756	            amountDue: k.total_due_paise as Paise,
   757	            principalDue: k.principal_component_paise as Paise,
   758	            markupDue: k.markup_component_paise as Paise,
   759	            amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
   760	            principalPaid: k.principal_paid_paise as Paise,
   761	            markupPaid: k.markup_paid_paise as Paise,
   762	            isDue: k.effective_due_date <= effectiveDate,
   763	            status: k.status,
   764	          })),
   765	          outstandingPenalty,
   766	        };
   767	
   768	        const result = allocatePayment(allocInput);
   769	
   770	        let newAllocPrincipal = 0;
   771	        let newAllocMarkup = 0;
   772	        let newAllocPenalty = 0;
   773	        for (const a of result.allocations) {
   774	          newAllocPrincipal += a.allocatedToPrincipal;
   775	          newAllocMarkup += a.allocatedToMarkup;
   776	          newAllocPenalty += a.allocatedToPenalty;
   777	        }
   778	        replayedPendingPenaltyPaid += newAllocPenalty;
   779	
   780	        let newAllocSurplus = result.unallocatedFunds || 0;
   781	        if (loan?.product_type === 'bullet' && newAllocSurplus > 0) {
   782	          const remainingPrincipal = Math.max(0, loan.principal_paise - replayedBulletPrincipalPaid);
   783	          const payPrincipal = Math.min(newAllocSurplus, remainingPrincipal);
   784	          newAllocPrincipal += payPrincipal;
   785	          newAllocSurplus -= payPrincipal;
   786	          replayedBulletPrincipalPaid += payPrincipal;
   787	        }
   788	
   789	        // Reconcile pending collection ledger entry with replayed allocations
   790	        const currentColNet = await tx.getFirstAsync<{
   791	          currentPrincipal: number;
   792	          currentMarkup: number;
   793	          currentPenalty: number;
   794	          currentSurplus: number;
   795	        }>(
   796	          `SELECT
   797	             COALESCE(SUM(allocated_principal_paise), 0) as currentPrincipal,
   798	             COALESCE(SUM(allocated_markup_paise), 0) as currentMarkup,
   799	             COALESCE(SUM(allocated_penalty_paise), 0) as currentPenalty,
   800	             COALESCE(SUM(unallocated_surplus_paise), 0) as currentSurplus
   801	           FROM transactions
   802	           WHERE loan_id = ?
   803	             AND (
   804	               operation_id = ?
   805	
   806	               OR instr(operation_id, 'realloc::' || ? || '::') = 1
   807	
   808	               OR instr(operation_id, 'reconcile::' || ? || '::') = 1
   809	             )`,
   810	          [loanId, item.operation_id, item.operation_id, item.operation_id]
   811	        );
   812	
   813	        const currentPrincipal = currentColNet?.currentPrincipal ?? 0;
   814	        const currentMarkup = currentColNet?.currentMarkup ?? 0;
   815	        const currentPenalty = currentColNet?.currentPenalty ?? 0;
   816	        const currentSurplus = currentColNet?.currentSurplus ?? 0;
   817	
   818	        const deltaPrincipal = newAllocPrincipal - currentPrincipal;
   819	        const deltaMarkup = newAllocMarkup - currentMarkup;
   820	        const deltaPenalty = newAllocPenalty - currentPenalty;

exec
/bin/bash -lc "git grep -n -E 'KIST|TRANSACTION|PAYMENT_CORRECTION' bd3183d -- backend/api/views.py backend/ledger | head -65; git show bd3183d:package.json; git show bd3183d:src/core/sync/outbox.ts | sed -n '1,180p'; git show bd3183d:src/__tests__/cross-loan.test.ts | sed -n '740,950p'" in /mnt/f/personal projects/credkeep
 succeeded in 571ms:
bd3183d:backend/ledger/engine/ledger_service.py:74:                record_type='KIST',
bd3183d:backend/ledger/engine/ledger_service.py:173:            record_type='TRANSACTION',
bd3183d:backend/ledger/engine/ledger_service.py:384:                            record_type='KIST',
bd3183d:backend/ledger/engine/ledger_service.py:434:                    record_type='TRANSACTION',
bd3183d:backend/ledger/engine/ledger_service.py:736:            record_type='PAYMENT_CORRECTION',
bd3183d:backend/ledger/models.py:130:    TRANSACTION_TYPES = [
bd3183d:backend/ledger/models.py:154:    transaction_type = models.CharField(max_length=32, choices=TRANSACTION_TYPES)
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
  it('enforces real SQLite trigger prohibiting update and delete on transactions table', async () => {
    const db = createRealSqliteDb();
    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES ('loan-1', 'b-1', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(
      `INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, effective_date, created_at)
       VALUES ('tx-immutability', 'op-immut', 'loan-1', 'COLLECTION', 50000, '2026-01-01', '2026-01-01')`
    );

    // UPDATE prohibited by trigger
    await expect(
      db.runAsync(`UPDATE transactions SET amount_paise = 99999 WHERE id = 'tx-immutability'`)
    ).rejects.toThrow(/Transactions table is append-only: updates are prohibited/);

    // DELETE prohibited by trigger
    await expect(
      db.runAsync(`DELETE FROM transactions WHERE id = 'tx-immutability'`)
    ).rejects.toThrow(/Transactions table is append-only: deletions are prohibited/);
  });

  it('executes real end-to-end collection in SQLite with sequence counter and conservation', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-1', 'Borrower 1', '9876543210', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES ('loan-e2e', 'b-1', 200000, 0.3, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-e2e', 'loan-e2e', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    const res = await repo.recordCashPayment('loan-e2e', 260000 as Paise, 'op-e2e-1', '2026-01-01');
    expect(res.success).toBe(true);

    const txRow = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'op-e2e-1'`);
    expect(txRow).toBeDefined();
    expect(txRow.sequence_number).toBe(1);
    expect(txRow.amount_paise).toBe(260000);
    expect(txRow.allocated_principal_paise).toBe(200000);
    expect(txRow.allocated_markup_paise).toBe(60000);

    // Conservation check
    expect(txRow.amount_paise).toBe(
      txRow.allocated_principal_paise + txRow.allocated_markup_paise + txRow.allocated_penalty_paise + txRow.unallocated_surplus_paise
    );

    // Loan status transitioned to SETTLED
    const loanRow = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-e2e'`);
    expect(loanRow.status).toBe('SETTLED');

    // Outbox record created
    const outboxRow = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = 'op-e2e-1'`);
    expect(outboxRow).toBeDefined();
    expect(outboxRow.operation_type).toBe('record_collection');
  });

  it('recovers from push rejection atomically in real SQLite (outbox, REVERSAL transaction, schedule rollback, status restoration)', async () => {
    const db = createRealSqliteDb();
    const repo = new TransactionRepository(db);

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-rej', 'Borrower Rej', '9876543211', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES ('loan-rej', 'b-rej', 200000, 0.3, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status) VALUES ('kist-rej', 'loan-rej', 1, '2026-01-01', '2026-01-01', 200000, 60000, 260000, 0, 0, 'PENDING')`);

    // 1. Record cash collection that settles loan
    const res = await repo.recordCashPayment('loan-rej', 260000 as Paise, 'op-rej-1', '2026-01-01');
    expect(res.success).toBe(true);

    const loanAfterPay = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-rej'`);
    expect(loanAfterPay?.status).toBe('SETTLED');

    const kistAfterPay = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rej'`);
    expect(kistAfterPay?.principal_paid_paise).toBe(200000);
    expect(kistAfterPay?.markup_paid_paise).toBe(60000);
    expect(kistAfterPay?.status).toBe('PAID');

    // 2. Trigger atomic rejection recovery
    await SyncService.revertRejectedPayment(db, 'op-rej-1', 'Borrower limit exceeded on server');

    // 3. Verify outbox marked REJECTED with error
    const outboxRow = await db.getFirstAsync<any>(`SELECT * FROM sync_outbox WHERE operation_id = 'op-rej-1'`);
    expect(outboxRow?.status).toBe('REJECTED');
    expect(outboxRow?.error_message).toBe('Borrower limit exceeded on server');

    // 4. Verify compensating REVERSAL transaction was appended
    const revTx = await db.getFirstAsync<any>(`SELECT * FROM transactions WHERE operation_id = 'reversal-op-rej-1'`);
    expect(revTx).toBeDefined();
    expect(revTx.transaction_type).toBe('REVERSAL');
    expect(revTx.amount_paise).toBe(-260000);
    expect(revTx.allocated_principal_paise).toBe(-200000);
    expect(revTx.allocated_markup_paise).toBe(-60000);

    // 5. Verify repayment schedule was rolled back
    const kistAfterRevert = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rej'`);
    expect(kistAfterRevert?.principal_paid_paise).toBe(0);
    expect(kistAfterRevert?.markup_paid_paise).toBe(0);
    expect(kistAfterRevert?.status).toBe('PENDING');

    // 6. Verify loan status restored to ACTIVE
    const loanAfterRevert = await db.getFirstAsync<any>(`SELECT status FROM loans WHERE id = 'loan-rej'`);
    expect(loanAfterRevert?.status).toBe('ACTIVE');
  });

  it('ensures schedule replay across multi-page pulls is strictly idempotent in real SQLite without inflating paid amounts', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-replay', 'Borrower Replay', '9876543212', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES ('loan-replay', 'b-replay', 200000, 0.2, 2, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rep-1', 'loan-replay', 1, '2026-01-01', '2026-01-01', 100000, 20000, 120000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-rep-2', 'loan-replay', 2, '2026-02-01', '2026-02-01', 100000, 20000, 120000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // User made a pending collection of 120000 paise (pays kist 1)
    await db.runAsync(`
      INSERT INTO sync_outbox (id, operation_id, operation_type, payload, status, created_at)
      VALUES ('outbox-rep-1', 'op-rep-1', 'record_collection', '${JSON.stringify({ loan_id: 'loan-replay', amount_paise: 120000, effective_date: '2026-01-01' })}', 'PENDING', '2026-01-01T10:00:00Z')
    `);
    await db.runAsync(`
      INSERT INTO transactions (id, operation_id, loan_id, transaction_type, amount_paise, allocated_principal_paise, allocated_markup_paise, effective_date, created_at)
      VALUES ('tx-rep-1', 'op-rep-1', 'loan-replay', 'COLLECTION', 120000, 100000, 20000, '2026-01-01', '2026-01-01')
    `);

    // Replay pending collection initial run
    await SyncService.reapplyPendingCollections(db, 'loan-replay');

    const k1 = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-1'`);
    const k2 = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-2'`);
    expect(k1?.principal_paid_paise).toBe(100000);
    expect(k1?.markup_paid_paise).toBe(20000);
    expect(k1?.status).toBe('PAID');
    expect(k2?.principal_paid_paise).toBe(0);
    expect(k2?.markup_paid_paise).toBe(0);
    expect(k2?.status).toBe('UNPAID');

    // Page 1 arrives from server with KIST 1 snapshot (server has not acknowledged op-rep-1 yet)
    const modifiedLoansPage1 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'KIST',
      operation_type: 'UPDATE',
      payload: {
        id: 'kist-rep-1',
        loan_id: 'loan-replay',
        installment_number: 1,
        principal_paid_paise: 0,
        markup_paid_paise: 0,
        status: 'PENDING',
      }
    }, modifiedLoansPage1);

    expect(modifiedLoansPage1.has('loan-replay')).toBe(true);
    for (const lid of modifiedLoansPage1) {
      await SyncService.reapplyPendingCollections(db, lid);
    }

    // Page 2 arrives from server with KIST 2 snapshot
    const modifiedLoansPage2 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'KIST',
      operation_type: 'UPDATE',
      payload: {
        id: 'kist-rep-2',
        loan_id: 'loan-replay',
        installment_number: 2,
        principal_paid_paise: 0,
        markup_paid_paise: 0,
        status: 'PENDING',
      }
    }, modifiedLoansPage2);

    expect(modifiedLoansPage2.has('loan-replay')).toBe(true);
    for (const lid of modifiedLoansPage2) {
      await SyncService.reapplyPendingCollections(db, lid);
    }

    // Page 3 arrives with non-KIST TRANSACTION delta
    const modifiedLoansPage3 = new Set<string>();
    await SyncService.applyServerChange(db, {
      record_type: 'TRANSACTION',
      operation_type: 'INSERT',
      payload: {
        id: 'tx-server-some',
        operation_id: 'op-some',
        loan_id: 'loan-replay',
        transaction_type: 'COLLECTION',
        amount_paise: 0,
        effective_date: '2026-01-01'
      }
    }, modifiedLoansPage3);

    // Verified: TRANSACTION change tracks modifiedLoansPage3 so acknowledged collections rebuild correctly
    expect(modifiedLoansPage3.has('loan-replay')).toBe(true);
    for (const lid of modifiedLoansPage3) {
      await SyncService.reapplyPendingCollections(db, lid);
    }

    // CRITICAL INVARIANT: Multi-page replay did NOT credit kist 2 or double-credit kist 1
    const k1Final = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-1'`);
    const k2Final = await db.getFirstAsync<any>(`SELECT * FROM repayment_schedules WHERE id = 'kist-rep-2'`);
    expect(k1Final?.principal_paid_paise).toBe(100000);
    expect(k1Final?.markup_paid_paise).toBe(20000);
    expect(k1Final?.status).toBe('PAID');
    expect(k2Final?.principal_paid_paise).toBe(0);
    expect(k2Final?.markup_paid_paise).toBe(0);
    expect(k2Final?.status).toBe('UNPAID');
  });

  it('preserves penalty money allocations during pending replay without diverting into principal or markup', async () => {
    const db = createRealSqliteDb();

    await db.runAsync(`INSERT INTO borrowers VALUES ('b-pen', 'Borrower Pen', '9876543213', '2026-01-01')`);
    await db.runAsync(`INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, status, created_at) VALUES ('loan-pen', 'b-pen', 100000, 0.1, 1, '2026-01-01', 1, 'instalment', 'ACTIVE', '2026-01-01')`);
    await db.runAsync(`INSERT INTO repayment_schedules (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise, principal_paid_paise, markup_paid_paise, status, server_principal_paid_paise, server_markup_paid_paise, server_status) VALUES ('kist-pen-1', 'loan-pen', 1, '2026-02-01', '2026-02-01', 100000, 10000, 110000, 0, 0, 'PENDING', 0, 0, 'PENDING')`);

    // Penalty assessment of 5000 paise
    await db.runAsync(`

codex
The diff changes when pulled transaction events trigger a schedule rebuild. I’m checking event ordering and pending-payment replay for duplicate credits or incorrect balances across pull pages.
exec
/bin/bash -lc "git show bd3183d:backend/ledger/engine/ledger_service.py | sed -n '320,455p'; git show bd3183d:backend/ledger/engine/ledger_service.py | sed -n '650,760p'; git grep -n 'applyServerChange' bd3183d -- src ':"'!src/core/sync/syncService.test.ts'"' ':"'!src/__tests__/cross-loan.test.ts'"'; test -d node_modules && echo dependencies-present" in /mnt/f/personal projects/credkeep
 succeeded in 581ms:
                            .aggregate(total=models.Sum('allocated_markup_paise'))['total'] or 0
                        )
                        unpaid_interest = max(0, total_contract_interest - past_interest_paid)
                        if unpaid_interest > 0 and alloc_result.unallocated_funds > 0:
                            pay_interest = min(alloc_result.unallocated_funds, unpaid_interest)
                            allocated_markup += pay_interest
                            alloc_result.unallocated_funds -= pay_interest

                            rem_interest = pay_interest
                            for term in locked_loan.terms.filter(settled=False).order_by('term_number'):
                                term_unpaid = term.interest_paise - term.interest_paid_paise
                                if term_unpaid > 0:
                                    t_alloc = min(rem_interest, term_unpaid)
                                    term.interest_paid_paise += t_alloc
                                    if term.interest_paid_paise >= term.interest_paise:
                                        term.settled = True
                                    term.save(update_fields=['interest_paid_paise', 'settled'])
                                    rem_interest -= t_alloc
                                    if rem_interest <= 0:
                                        break

                    past_paid = (
                        LedgerTx.objects
                        .filter(loan=locked_loan, transaction_type='COLLECTION', reversal_of_id__isnull=True)
                        .exclude(id__in=PaymentCorrection.objects.filter(loan=locked_loan).values_list('original_transaction_id', flat=True))
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
bd3183d:src/core/sync/syncService.ts:118:            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);
bd3183d:src/core/sync/syncService.ts:140:  static async applyServerChange(tx: SQLiteDatabase, change: any, modifiedLoanIds?: Set<string>): Promise<void> {
dependencies-present

exec
/bin/bash -lc "git show bd3183d:backend/ledger/engine/ledger_service.py | sed -n '1,95p'; git show bd3183d:src/core/database/loanRepository.ts | rg -n -C 5 'bullet|repayment_schedules'; git show bd3183d:backend/ledger/engine/ledger_service.py | sed -n '455,520p'; git show bd3183d:src/core/sync/syncService.ts | sed -n '860,925p'; git diff --quiet bd3183d -- src/core/sync/syncService.ts; git rev-parse HEAD" in /mnt/f/personal projects/credkeep
 succeeded in 845ms:
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
171-          options.collateral || null,
172-          created_at,
173-        ]
174-      );
175-
176:      // If bullet with ANNUAL_SIMPLE_FLAT, insert term 1 into loan_terms
177:      if (options.productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
178-        await txHandle.runAsync(
179-          `INSERT INTO loan_terms (
180-            id, loan_id, term_number, duration_months, annual_rate, interest_paise,
181-            start_date, maturity_date, interest_settled, settled, operation_id, created_at
182-          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
--
197-        );
198-      }
199-      
200-      if (schedule.length > 0) {
201-        const statement = await txHandle.prepareAsync(`
202:          INSERT INTO repayment_schedules 
203-          (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
204-          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
205-        `);
206-        
207-        try {
--
304-  }
305-  
306-  async getSchedule(loanId: string) {
307-    await this.extendScheduleIfNeeded(loanId);
308-    return await this.db.getAllAsync(`
309:      SELECT * FROM repayment_schedules 
310-      WHERE loan_id = ? 
311-      ORDER BY installment_number ASC
312-    `, [loanId]);
313-  }
314-
315-  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
316-    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
317:    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE' || loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') return;
318-
319-    const kists = await tx.getAllAsync(`
320:      SELECT * FROM repayment_schedules 
321-      WHERE loan_id = ? 
322-      ORDER BY installment_number ASC
323-    `, [loanId]);
324-    
325-    if (kists.length === 0) return;
--
335-      let monthsToAddFromStart = nextInstalmentNumber;
336-      
337-      let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
338-      
339-      const statement = await tx.prepareAsync(`
340:        INSERT INTO repayment_schedules 
341-        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
342-        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
343-      `);
344-      
345-      try {
--
406-
407-    await withDbTransaction(this.db, async (tx) => {
408-      const txHandle = tx || this.db;
409-      const loan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
410-      if (!loan) throw new Error('Loan not found');
411:      if (loan.product_type !== 'bullet') throw new Error('Only One-Time Repayment (bullet) loans can be extended');
412-      if (loan.status !== 'ACTIVE') throw new Error('Only active loans can be extended');
413-
414-      const terms = await txHandle.getAllAsync<LoanTerm>(
415-        `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
416-        [loanId]
                    'status': 'SUCCESS',
                    'transaction': tx_obj,
                    'allocation_result': alloc_result
                }
        except OperationalError as exc:
            if ('locked' in str(exc).lower() or 'busy' in str(exc).lower()) and attempt < 5:
                time.sleep(0.05 * (attempt + 1))
                continue
            raise


def extend_loan(
    loan: LoanAccount,
    additional_months: int,
    interest_collected_paise: int,
    operation_id: uuid.UUID,
    effective_date_str: str,
    payment_operation_id: Optional[uuid.UUID] = None
) -> Dict[str, Any]:
    """
    Extends a One-Time Repayment loan atomically:
    1. Validates loan is active and product_type is bullet.
    2. Collects required term interest if passed.
    3. Appends new immutable LoanTerm.
    4. Updates LoanAccount cumulative term_months, interest_paise, total_paise, maturity_date.
    5. Publishes SyncOutbox records for Loan and LoanTerm.
    """
    with transaction.atomic():
        locked_loan = LoanAccount.objects.select_for_update().get(id=loan.id)
        if locked_loan.product_type != 'bullet':
            raise ValidationError("Only One-Time Repayment (bullet) loans can be extended.")
        if locked_loan.status != 'ACTIVE':
            raise ValidationError(f"Cannot extend loan in status '{locked_loan.status}'.")

        # Idempotency check
        existing_term = LoanTerm.objects.filter(loan=locked_loan, operation_id=operation_id).first()
        if existing_term:
            return {'status': 'ALREADY_EXISTS', 'term': existing_term}

        # Current terms
        terms = list(locked_loan.terms.all().order_by('term_number'))
        last_term = terms[-1] if terms else None
        last_maturity_date = last_term.maturity_date if last_term else (locked_loan.maturity_date or locked_loan.start_date)

        # In the first implementation, require completed term's contractual interest to be settled
        if last_term and not last_term.settled:
            prior_unpaid = last_term.interest_paise - last_term.interest_paid_paise
            if interest_collected_paise < prior_unpaid:
                raise ValidationError(
                    f"Prior term's contractual interest must be fully settled before extending the loan. "
                    f"Required: {prior_unpaid} paise, collected: {interest_collected_paise} paise."
                )

        if interest_collected_paise > 0:
            pay_op_id = payment_operation_id or uuid.uuid5(operation_id, f"extension_payment:{operation_id}")
            record_collection(
                loan=locked_loan,
                payment_amount=interest_collected_paise,
                operation_id=pay_op_id,
                effective_date_str=effective_date_str,
                payment_method='CASH',
                is_cash=True
            )
            if last_term:
                last_term.interest_paid_paise = (last_term.interest_paid_paise or 0) + interest_collected_paise
                if last_term.interest_paid_paise >= last_term.interest_paise:
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
bd3183d38bd7197390b7c3a0b3eac575900915b0

exec
/bin/bash -lc "node <<'NODE'
const cp=require('child_process');
const ts=require('typescript');
const src=cp.execFileSync('git',['show','bd3183d:src/core/sync/syncService.ts'],{encoding:'utf8'});
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};
const customRequire=(id)=>{
 if(id==='./outbox') return {OutboxManager:{markSynced:async()=>{}},registerOutboxRevertHandler:()=>{}};
 if(id==='../migration/uuidUtils') return {getMigratedTransactionOpId:()=>''};
 return {};
};
new Function('require','module','exports',js)(customRequire,m,m.exports);
let status='ACTIVE';
const writes=[];
const db={
 runAsync:async(sql,args)=>{writes.push({sql,args}); if(sql.includes('UPDATE loans SET status'))status=args[0];},
 getFirstAsync:async(sql)=>{
  if(sql.includes('FROM loans WHERE'))return {id:'bullet-1',product_type:'bullet',rate_basis:'ANNUAL_SIMPLE_FLAT',principal_paise:10000,interest_paise:1000,status};
  if(sql.includes('as total FROM transactions'))return {total:10000};
  if(sql.includes('as assessed'))return {assessed:0,paid:0,forgiven:0};
  return null;
 },
 getAllAsync:async()=>[]
};
(async()=>{
 const modified=new Set();
 await m.exports.SyncService.applyServerChange(db,{record_type:'LOAN',operation_type:'UPDATE',payload:{id:'bullet-1',status:'SETTLED'}},modified);
 await m.exports.SyncService.applyServerChange(db,{record_type:'TRANSACTION',operation_type:'INSERT',payload:{id:'tx-1',operation_id:'op-1',loan_id:'bullet-1',transaction_type:'COLLECTION',amount_paise:11000,allocated_principal_paise:10000,allocated_markup_paise:1000,effective_date:'2026-01-01'}},modified);
 for(const id of modified)await m.exports.SyncService.reapplyPendingCollections(db,id);
 console.log(JSON.stringify({authoritativeStatus:'SETTLED',finalLocalStatus:status,modifiedLoans:[...modified]}));
})();
NODE" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/tsc --noEmit --incremental false' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/eslint src/core/sync/syncService.ts src/core/sync/syncService.test.ts src/__tests__/cross-loan.test.ts --no-cache' in /mnt/f/personal projects/credkeep
 exited 1 in 470ms:
<ref *1> node:child_process:981
    throw err;
    ^

Error: spawnSync git EPERM
    at Object.spawnSync (node:internal/child_process:1160:20)
    at spawnSync (node:child_process:928:24)
    at Object.execFileSync (node:child_process:971:15)
    at [stdin]:3:14
    at runScriptInThisContext (node:internal/vm:219:10)
    at node:internal/process/execution:451:12
    at [stdin]-wrapper:6:24
    at runScriptInContext (node:internal/process/execution:449:60)
    at evalFunction (node:internal/process/execution:283:30)
    at evalTypeScript (node:internal/process/execution:295:3) {
  errno: -1,
  code: 'EPERM',
  syscall: 'spawnSync git',
  path: 'git',
  spawnargs: [ 'show', 'bd3183d:src/core/sync/syncService.ts' ],
  error: [Circular *1],
  status: 0,
  signal: null,
  output: [
    null,
    "import { SQLiteDatabase } from 'expo-sqlite';\n" +
      "import * as crypto from 'expo-crypto';\n" +
      "import { ApiClient } from '../api/client';\n" +
      "import { AuthStore } from '../auth/authStore';\n" +
      "import { OutboxManager, registerOutboxRevertHandler } from './outbox';\n" +
      "import { allocatePayment } from '../domain/allocation';\n" +
      "import { Paise } from '../domain/money';\n" +
      "import { getMigratedTransactionOpId } from '../migration/uuidUtils';\n" +
      "import { withDbTransaction } from '../database/transaction';\n" +
      '\n' +
      '\n' +
      'export interface SyncResult {\n' +
      '  pushedCount: number;\n' +
      '  pulledCount: number;\n' +
      '  needsReviewCount?: number;\n' +
      '  success: boolean;\n' +
      '  errors?: string[];\n' +
      '}\n' +
      '\n' +
      'export class SyncService {\n' +
      '  /**\n' +
      '   * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/\n' +
      '   */\n' +
      '  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {\n' +
      '    const token = await AuthStore.getToken();\n' +
      '    if (!token) return { pushed: 0, failed: 0 };\n' +
      '\n' +
      '    let totalPushed = 0;\n' +
      '    let totalFailed = 0;\n' +
      '\n' +
      '    while (true) {\n' +
      '      const pending = await OutboxManager.getPending(db, 50);\n' +
      '      if (pending.length === 0) break;\n' +
      '\n' +
      '      const deviceId = await AuthStore.getDeviceId();\n' +
      '      const operations = pending.map((record) => ({\n' +
      '        operation_id: record.operation_id,\n' +
      '        type: record.operation_type,\n' +
      '        timestamp: record.created_at,\n' +
      '        payload: JSON.parse(record.payload),\n' +
      '      }));\n' +
      '\n' +
      '      try {\n' +
      "        const response = await ApiClient.post('/sync/push/', {\n" +
      '          device_id: deviceId,\n' +
      '          operations,\n' +
      '        });\n' +
      '\n' +
      '        let batchFailed = 0;\n' +
      '        const results = response?.results || [];\n' +
      '        const acknowledgedOpIds = new Set<string>();\n' +
      '\n' +
      '        for (const res of results) {\n' +
      '          if (!res?.operation_id) continue;\n' +
      '          acknowledgedOpIds.add(res.operation_id);\n' +
      '\n' +
      "          if (res.status === 'ACCEPTED' || res.status === 'ALREADY_EXISTS') {\n" +
      '            await OutboxManager.markSynced(db, [res.operation_id]);\n' +
      '            totalPushed++;\n' +
      "          } else if (res.status === 'REJECTED') {\n" +
      '            await this.revertRejectedPayment(db, res.operation_id, res.error);\n' +
      '            batchFailed++;\n' +
      "          } else if (res.status === 'FAILED') {\n" +
      "            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error);\n" +
      '            batchFailed++;\n' +
      '          } else {\n' +
      "            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error || res.status);\n" +
      '            batchFailed++;\n' +
      '          }\n' +
      '        }\n' +
      '\n' +
      '        // Validate that every submitted operation received an acknowledgment result\n' +
      '        for (const op of operations) {\n' +
      '          if (!acknowledgedOpIds.has(op.operation_id)) {\n' +
      "            await OutboxManager.markStatus(db, op.operation_id, 'NEEDS_REVIEW', 'Missing server result in push response');\n" +
      '            batchFailed++;\n' +
      '          }\n' +
      '        }\n' +
      '\n' +
      '        totalFailed += batchFailed;\n' +
      '        if (batchFailed > 0) {\n' +
      '          // Stop further batch execution on failure to preserve sequential dependency\n' +
      '          break;\n' +
      '        }\n' +
      '      } catch {\n' +
      '        totalFailed += pending.length;\n' +
      '        break;\n' +
      '      }\n' +
      '    }\n' +
      '\n' +
      '    return { pushed: totalPushed, failed: totalFailed };\n' +
      '  }\n' +
      '\n' +
      '  /**\n' +
      '   * PULL Protocol: Queries /api/v2/sync/pull/?cursor={cursor} and merges state changes\n' +
      '   */\n' +
      '  static async pullChanges(db: SQLiteDatabase): Promise<{ pulled: number }> {\n' +
      '    const token = await AuthStore.getToken();\n' +
      '    if (!token) return { pulled: 0 };\n' +
      '\n' +
      "    const cursorStr = await OutboxManager.getMeta(db, 'last_pull_cursor');\n" +
      '    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;\n' +
      '    if (isNaN(cursor)) cursor = 0;\n' +
      '\n' +
      '    let hasMore = true;\n' +
      '    let totalPulled = 0;\n' +
      '\n' +
      '    while (hasMore) {\n' +
      '      const response = await ApiClient.get(`/sync/pull/?cursor=${cursor}&limit=100`);\n' +
      '      const changes = response.changes || [];\n' +
      '\n' +
      '      if (changes.length > 0) {\n' +
      '        cursor = response.next_cursor;\n' +
      '        hasMore = Boolean(response.has_more);\n' +
      '        await withDbTransaction(db, async (tx) => {\n' +
      '          const modifiedScheduleLoanIds = new Set<string>();\n' +
      '          for (const change of changes) {\n' +
      '            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);\n' +
      '          }\n' +
      '          for (const loanId of modifiedScheduleLoanIds) {\n' +
      '            await this.reapplyPendingCollections(tx, loanId);\n' +
      '          }\n' +
      "          await OutboxManager.setMeta(tx, 'last_pull_cursor', String(cursor));\n" +
      '        });\n' +
      '        totalPulled += changes.length;\n' +
      '      } else {\n' +
      '        cursor = response.next_cursor;\n' +
      '        hasMore = Boolean(response.has_more);\n' +
      "        await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));\n" +
      '      }\n' +
      '    }\n' +
      '\n' +
      "    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());\n" +
      '    return { pulled: totalPulled };\n' +
      '  }\n' +
      '\n' +
      '  /**\n' +
      '   * Applies an authoritative server delta event into the local SQLite database\n' +
      '   */\n' +
      '  static async applyServerChange(tx: SQLiteDatabase, change: any, modifiedLoanIds?: Set<string>): Promise<void> {\n' +
      '    const { record_type, operation_type, payload } = change;\n' +
      '    if (!payload) return;\n' +
      '\n' +
      '    if (\n' +
      "      (record_type === 'KIST' ||\n" +
      "        record_type === 'TRANSACTION' ||\n" +
      "        record_type === 'PAYMENT_CORRECTION') &&\n" +
      '      payload.loan_id &&\n' +
      '      modifiedLoanIds\n' +
      '    ) {\n' +
      '      modifiedLoanIds.add(payload.loan_id);\n' +
      '    }\n' +
      '\n' +
      "    if (record_type === 'BORROWER') {\n" +
      "      if (operation_type === 'INSERT') {\n" +
      '        await tx.runAsync(\n' +
      '          `INSERT INTO borrowers (id, name, phone, created_at)\n' +
      '           VALUES (?, ?, ?, ?)\n' +
      '           ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,\n' +
      '          [payload.id, payload.name, payload.phone, payload.created_at || new Date().toISOString()]\n' +
      '        );\n' +
      "      } else if (operation_type === 'UPDATE') {\n" +
      '        await tx.runAsync(\n' +
      '          `UPDATE borrowers SET name = ?, phone = ? WHERE id = ?`,\n' +
      '          [payload.name, payload.phone, payload.id]\n' +
      '        );\n' +
      '      }\n' +
      "    } else if (record_type === 'LOAN') {\n" +
      "      if (operation_type === 'INSERT') {\n" +
      '        await tx.runAsync(\n' +
      '          `INSERT INTO loans (\n' +
      '             id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,\n' +
      '             interest_paise, total_paise, maturity_date, term_months, start_date, due_day,\n' +
      '             product_type, collateral, status, created_at\n' +
      '           )\n' +
      '           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n' +
      '           ON CONFLICT(id) DO UPDATE SET\n' +
      '             status = excluded.status,\n' +
      '             annual_rate = excluded.annual_rate,\n' +
      '             rate_basis = excluded.rate_basis,\n' +
      '             interest_paise = excluded.interest_paise,\n' +
      '             total_paise = excluded.total_paise,\n' +
      '             maturity_date = excluded.maturity_date,\n' +
      '             term_months = excluded.term_months,\n' +
      '             collateral = excluded.collateral`,\n' +
      '          [\n' +
      '            payload.id,\n' +
      '            payload.borrower_id,\n' +
      '            payload.principal_paise,\n' +
      '            parseFloat(payload.markup_factor) || 0,\n' +
      '            payload.annual_rate || 0,\n' +
      "            payload.rate_basis || 'ANNUAL_SIMPLE_FLAT',\n" +
      '            payload.interest_paise || 0,\n' +
      '            payload.total_paise || payload.principal_paise,\n' +
      '            payload.maturity_date || null,\n' +
      '            payload.term_months,\n' +
      '            payload.start_date,\n' +
      '            payload.due_day,\n' +
      '            payload.product_type,\n' +
      '            payload.collateral || null,\n' +
      "            payload.status || 'ACTIVE',\n" +
      '            payload.created_at || new Date().toISOString(),\n' +
      '          ]\n' +
      '        );\n' +
      "      } else if (operation_type === 'UPDATE') {\n" +
      '        const updateFields: string[] = [];\n' +
      '        const updateParams: any[] = [];\n' +
      '        if (payload.status !== undefined) {\n' +
      "          updateFields.push('status = ?');\n" +
      '          updateParams.push(payload.status);\n' +
      '        }\n' +
      '        if (payload.annual_rate !== undefined) {\n' +
      "          updateFields.push('annual_rate = ?');\n" +
      '          updateParams.push(payload.annual_rate);\n' +
      '        }\n' +
      '        if (payload.rate_basis !== undefined) {\n' +
      "          updateFields.push('rate_basis = ?');\n" +
      '          updateParams.push(payload.rate_basis);\n' +
      '        }\n' +
      '        if (payload.interest_paise !== undefined) {\n' +
      "          updateFields.push('interest_paise = ?');\n" +
      '          updateParams.push(payload.interest_paise);\n' +
      '        }\n' +
      '        if (payload.total_paise !== undefined) {\n' +
      "          updateFields.push('total_paise = ?');\n" +
      '          updateParams.push(payload.total_paise);\n' +
      '        }\n' +
      '        if (payload.maturity_date !== undefined) {\n' +
      "          updateFields.push('maturity_date = ?');\n" +
      '          updateParams.push(payload.maturity_date);\n' +
      '        }\n' +
      '        if (payload.term_months !== undefined) {\n' +
      "          updateFields.push('term_months = ?');\n" +
      '          updateParams.push(payload.term_months);\n' +
      '        }\n' +
      '        if (payload.collateral !== undefined) {\n' +
      "          updateFields.push('collateral = ?');\n" +
      '          updateParams.push(payload.collateral);\n' +
      '        }\n' +
      '        if (updateFields.length > 0) {\n' +
      '          updateParams.push(payload.id);\n' +
      "          await tx.runAsync(`UPDATE loans SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);\n" +
      '        }\n' +
      '      }\n' +
      "    } else if (record_type === 'LOAN_TERM') {\n" +
      '      const isSettled = (payload.interest_settled !== undefined ? payload.interest_settled : (payload.settled ? 1 : 0)) ? 1 : 0;\n' +
      "      if (operation_type === 'INSERT') {\n" +
      '        let existingTerm: any = null;\n' +
      '        if (payload.operation_id) {\n' +
      '          existingTerm = await tx.getFirstAsync<{ id: string }>(\n' +
      '            `SELECT id FROM loan_terms WHERE operation_id = ? OR id = ?`,\n' +
      '            [payload.operation_id, payload.id]\n' +
      '          );\n' +
      '        } else {\n' +
      '          existingTerm = await tx.getFirstAsync<{ id: string }>(\n' +
      '            `SELECT id FROM loan_terms WHERE id = ?`,\n' +
      '            [payload.id]\n' +
      '          );\n' +
      '        }\n' +
      '\n' +
      '        if (existingTerm) {\n' +
      '          await tx.runAsync(\n' +
      '            `UPDATE loan_terms SET \n' +
      '               id = ?,\n' +
      '               interest_settled = ?,\n' +
      '               settled = ?,\n' +
      '               annual_rate = ?,\n' +
      '               interest_paise = ?,\n' +
      '               maturity_date = ?\n' +
      '             WHERE id = ?`,\n'... 44561 more characters,
    ''
  ],
  pid: 10,
  stdout: "import { SQLiteDatabase } from 'expo-sqlite';\n" +
    "import * as crypto from 'expo-crypto';\n" +
    "import { ApiClient } from '../api/client';\n" +
    "import { AuthStore } from '../auth/authStore';\n" +
    "import { OutboxManager, registerOutboxRevertHandler } from './outbox';\n" +
    "import { allocatePayment } from '../domain/allocation';\n" +
    "import { Paise } from '../domain/money';\n" +
    "import { getMigratedTransactionOpId } from '../migration/uuidUtils';\n" +
    "import { withDbTransaction } from '../database/transaction';\n" +
    '\n' +
    '\n' +
    'export interface SyncResult {\n' +
    '  pushedCount: number;\n' +
    '  pulledCount: number;\n' +
    '  needsReviewCount?: number;\n' +
    '  success: boolean;\n' +
    '  errors?: string[];\n' +
    '}\n' +
    '\n' +
    'export class SyncService {\n' +
    '  /**\n' +
    '   * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/\n' +
    '   */\n' +
    '  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {\n' +
    '    const token = await AuthStore.getToken();\n' +
    '    if (!token) return { pushed: 0, failed: 0 };\n' +
    '\n' +
    '    let totalPushed = 0;\n' +
    '    let totalFailed = 0;\n' +
    '\n' +
    '    while (true) {\n' +
    '      const pending = await OutboxManager.getPending(db, 50);\n' +
    '      if (pending.length === 0) break;\n' +
    '\n' +
    '      const deviceId = await AuthStore.getDeviceId();\n' +
    '      const operations = pending.map((record) => ({\n' +
    '        operation_id: record.operation_id,\n' +
    '        type: record.operation_type,\n' +
    '        timestamp: record.created_at,\n' +
    '        payload: JSON.parse(record.payload),\n' +
    '      }));\n' +
    '\n' +
    '      try {\n' +
    "        const response = await ApiClient.post('/sync/push/', {\n" +
    '          device_id: deviceId,\n' +
    '          operations,\n' +
    '        });\n' +
    '\n' +
    '        let batchFailed = 0;\n' +
    '        const results = response?.results || [];\n' +
    '        const acknowledgedOpIds = new Set<string>();\n' +
    '\n' +
    '        for (const res of results) {\n' +
    '          if (!res?.operation_id) continue;\n' +
    '          acknowledgedOpIds.add(res.operation_id);\n' +
    '\n' +
    "          if (res.status === 'ACCEPTED' || res.status === 'ALREADY_EXISTS') {\n" +
    '            await OutboxManager.markSynced(db, [res.operation_id]);\n' +
    '            totalPushed++;\n' +
    "          } else if (res.status === 'REJECTED') {\n" +
    '            await this.revertRejectedPayment(db, res.operation_id, res.error);\n' +
    '            batchFailed++;\n' +
    "          } else if (res.status === 'FAILED') {\n" +
    "            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error);\n" +
    '            batchFailed++;\n' +
    '          } else {\n' +
    "            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error || res.status);\n" +
    '            batchFailed++;\n' +
    '          }\n' +
    '        }\n' +
    '\n' +
    '        // Validate that every submitted operation received an acknowledgment result\n' +
    '        for (const op of operations) {\n' +
    '          if (!acknowledgedOpIds.has(op.operation_id)) {\n' +
    "            await OutboxManager.markStatus(db, op.operation_id, 'NEEDS_REVIEW', 'Missing server result in push response');\n" +
    '            batchFailed++;\n' +
    '          }\n' +
    '        }\n' +
    '\n' +
    '        totalFailed += batchFailed;\n' +
    '        if (batchFailed > 0) {\n' +
    '          // Stop further batch execution on failure to preserve sequential dependency\n' +
    '          break;\n' +
    '        }\n' +
    '      } catch {\n' +
    '        totalFailed += pending.length;\n' +
    '        break;\n' +
    '      }\n' +
    '    }\n' +
    '\n' +
    '    return { pushed: totalPushed, failed: totalFailed };\n' +
    '  }\n' +
    '\n' +
    '  /**\n' +
    '   * PULL Protocol: Queries /api/v2/sync/pull/?cursor={cursor} and merges state changes\n' +
    '   */\n' +
    '  static async pullChanges(db: SQLiteDatabase): Promise<{ pulled: number }> {\n' +
    '    const token = await AuthStore.getToken();\n' +
    '    if (!token) return { pulled: 0 };\n' +
    '\n' +
    "    const cursorStr = await OutboxManager.getMeta(db, 'last_pull_cursor');\n" +
    '    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;\n' +
    '    if (isNaN(cursor)) cursor = 0;\n' +
    '\n' +
    '    let hasMore = true;\n' +
    '    let totalPulled = 0;\n' +
    '\n' +
    '    while (hasMore) {\n' +
    '      const response = await ApiClient.get(`/sync/pull/?cursor=${cursor}&limit=100`);\n' +
    '      const changes = response.changes || [];\n' +
    '\n' +
    '      if (changes.length > 0) {\n' +
    '        cursor = response.next_cursor;\n' +
    '        hasMore = Boolean(response.has_more);\n' +
    '        await withDbTransaction(db, async (tx) => {\n' +
    '          const modifiedScheduleLoanIds = new Set<string>();\n' +
    '          for (const change of changes) {\n' +
    '            await this.applyServerChange(tx, change, modifiedScheduleLoanIds);\n' +
    '          }\n' +
    '          for (const loanId of modifiedScheduleLoanIds) {\n' +
    '            await this.reapplyPendingCollections(tx, loanId);\n' +
    '          }\n' +
    "          await OutboxManager.setMeta(tx, 'last_pull_cursor', String(cursor));\n" +
    '        });\n' +
    '        totalPulled += changes.length;\n' +
    '      } else {\n' +
    '        cursor = response.next_cursor;\n' +
    '        hasMore = Boolean(response.has_more);\n' +
    "        await OutboxManager.setMeta(db, 'last_pull_cursor', String(cursor));\n" +
    '      }\n' +
    '    }\n' +
    '\n' +
    "    await OutboxManager.setMeta(db, 'last_synced_at', new Date().toISOString());\n" +
    '    return { pulled: totalPulled };\n' +
    '  }\n' +
    '\n' +
    '  /**\n' +
    '   * Applies an authoritative server delta event into the local SQLite database\n' +
    '   */\n' +
    '  static async applyServerChange(tx: SQLiteDatabase, change: any, modifiedLoanIds?: Set<string>): Promise<void> {\n' +
    '    const { record_type, operation_type, payload } = change;\n' +
    '    if (!payload) return;\n' +
    '\n' +
    '    if (\n' +
    "      (record_type === 'KIST' ||\n" +
    "        record_type === 'TRANSACTION' ||\n" +
    "        record_type === 'PAYMENT_CORRECTION') &&\n" +
    '      payload.loan_id &&\n' +
    '      modifiedLoanIds\n' +
    '    ) {\n' +
    '      modifiedLoanIds.add(payload.loan_id);\n' +
    '    }\n' +
    '\n' +
    "    if (record_type === 'BORROWER') {\n" +
    "      if (operation_type === 'INSERT') {\n" +
    '        await tx.runAsync(\n' +
    '          `INSERT INTO borrowers (id, name, phone, created_at)\n' +
    '           VALUES (?, ?, ?, ?)\n' +
    '           ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,\n' +
    '          [payload.id, payload.name, payload.phone, payload.created_at || new Date().toISOString()]\n' +
    '        );\n' +
    "      } else if (operation_type === 'UPDATE') {\n" +
    '        await tx.runAsync(\n' +
    '          `UPDATE borrowers SET name = ?, phone = ? WHERE id = ?`,\n' +
    '          [payload.name, payload.phone, payload.id]\n' +
    '        );\n' +
    '      }\n' +
    "    } else if (record_type === 'LOAN') {\n" +
    "      if (operation_type === 'INSERT') {\n" +
    '        await tx.runAsync(\n' +
    '          `INSERT INTO loans (\n' +
    '             id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,\n' +
    '             interest_paise, total_paise, maturity_date, term_months, start_date, due_day,\n' +
    '             product_type, collateral, status, created_at\n' +
    '           )\n' +
    '           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n' +
    '           ON CONFLICT(id) DO UPDATE SET\n' +
    '             status = excluded.status,\n' +
    '             annual_rate = excluded.annual_rate,\n' +
    '             rate_basis = excluded.rate_basis,\n' +
    '             interest_paise = excluded.interest_paise,\n' +
    '             total_paise = excluded.total_paise,\n' +
    '             maturity_date = excluded.maturity_date,\n' +
    '             term_months = excluded.term_months,\n' +
    '             collateral = excluded.collateral`,\n' +
    '          [\n' +
    '            payload.id,\n' +
    '            payload.borrower_id,\n' +
    '            payload.principal_paise,\n' +
    '            parseFloat(payload.markup_factor) || 0,\n' +
    '            payload.annual_rate || 0,\n' +
    "            payload.rate_basis || 'ANNUAL_SIMPLE_FLAT',\n" +
    '            payload.interest_paise || 0,\n' +
    '            payload.total_paise || payload.principal_paise,\n' +
    '            payload.maturity_date || null,\n' +
    '            payload.term_months,\n' +
    '            payload.start_date,\n' +
    '            payload.due_day,\n' +
    '            payload.product_type,\n' +
    '            payload.collateral || null,\n' +
    "            payload.status || 'ACTIVE',\n" +
    '            payload.created_at || new Date().toISOString(),\n' +
    '          ]\n' +
    '        );\n' +
    "      } else if (operation_type === 'UPDATE') {\n" +
    '        const updateFields: string[] = [];\n' +
    '        const updateParams: any[] = [];\n' +
    '        if (payload.status !== undefined) {\n' +
    "          updateFields.push('status = ?');\n" +
    '          updateParams.push(payload.status);\n' +
    '        }\n' +
    '        if (payload.annual_rate !== undefined) {\n' +
    "          updateFields.push('annual_rate = ?');\n" +
    '          updateParams.push(payload.annual_rate);\n' +
    '        }\n' +
    '        if (payload.rate_basis !== undefined) {\n' +
    "          updateFields.push('rate_basis = ?');\n" +
    '          updateParams.push(payload.rate_basis);\n' +
    '        }\n' +
    '        if (payload.interest_paise !== undefined) {\n' +
    "          updateFields.push('interest_paise = ?');\n" +
    '          updateParams.push(payload.interest_paise);\n' +
    '        }\n' +
    '        if (payload.total_paise !== undefined) {\n' +
    "          updateFields.push('total_paise = ?');\n" +
    '          updateParams.push(payload.total_paise);\n' +
    '        }\n' +
    '        if (payload.maturity_date !== undefined) {\n' +
    "          updateFields.push('maturity_date = ?');\n" +
    '          updateParams.push(payload.maturity_date);\n' +
    '        }\n' +
    '        if (payload.term_months !== undefined) {\n' +
    "          updateFields.push('term_months = ?');\n" +
    '          updateParams.push(payload.term_months);\n' +
    '        }\n' +
    '        if (payload.collateral !== undefined) {\n' +
    "          updateFields.push('collateral = ?');\n" +
    '          updateParams.push(payload.collateral);\n' +
    '        }\n' +
    '        if (updateFields.length > 0) {\n' +
    '          updateParams.push(payload.id);\n' +
    "          await tx.runAsync(`UPDATE loans SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);\n" +
    '        }\n' +
    '      }\n' +
    "    } else if (record_type === 'LOAN_TERM') {\n" +
    '      const isSettled = (payload.interest_settled !== undefined ? payload.interest_settled : (payload.settled ? 1 : 0)) ? 1 : 0;\n' +
    "      if (operation_type === 'INSERT') {\n" +
    '        let existingTerm: any = null;\n' +
    '        if (payload.operation_id) {\n' +
    '          existingTerm = await tx.getFirstAsync<{ id: string }>(\n' +
    '            `SELECT id FROM loan_terms WHERE operation_id = ? OR id = ?`,\n' +
    '            [payload.operation_id, payload.id]\n' +
    '          );\n' +
    '        } else {\n' +
    '          existingTerm = await tx.getFirstAsync<{ id: string }>(\n' +
    '            `SELECT id FROM loan_terms WHERE id = ?`,\n' +
    '            [payload.id]\n' +
    '          );\n' +
    '        }\n' +
    '\n' +
    '        if (existingTerm) {\n' +
    '          await tx.runAsync(\n' +
    '            `UPDATE loan_terms SET \n' +
    '               id = ?,\n' +
    '               interest_settled = ?,\n' +
    '               settled = ?,\n' +
    '               annual_rate = ?,\n' +
    '               interest_paise = ?,\n' +
    '               maturity_date = ?\n' +
    '             WHERE id = ?`,\n'... 44561 more characters,
  stderr: ''
}

Node.js v24.21.0

exec
/bin/bash -lc "git show bd3183d:src/core/sync/syncService.ts | node -e 'const ts=require('\\''typescript'\\'');const src=require('\\''fs'\\'').readFileSync(0,'\\''utf8'\\'');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};new Function('\\''require'\\'','\\''module'\\'','\\''exports'\\'',js)(id=>id==='\\''./outbox'\\''?{OutboxManager:{markSynced:async()=>{}},registerOutboxRevertHandler:()=>{}}:id==='\\''../migration/uuidUtils'\\''?{getMigratedTransactionOpId:()=>'\\'''\\''}:{},m,m.exports);let status='\\''ACTIVE'\\'';const db={runAsync:async(sql,args)=>{if(sql.includes('\\''UPDATE loans SET status'\\''))status=args[0];},getFirstAsync:async(sql)=>sql.includes('\\''FROM loans WHERE'\\'')?{id:'\\''bullet-1'\\'',product_type:'\\''bullet'\\'',rate_basis:'\\''ANNUAL_SIMPLE_FLAT'\\'',principal_paise:10000,interest_paise:1000,status}:sql.includes('\\''as total FROM transactions'\\'')?{total:10000}:sql.includes('\\''as assessed'\\'')?{assessed:0,paid:0,forgiven:0}:null,getAllAsync:async()=>[]};(async()=>{const modified=new Set();await m.exports.SyncService.applyServerChange(db,{record_type:'\\''LOAN'\\'',operation_type:'\\''UPDATE'\\'',payload:{id:'\\''bullet-1'\\'',status:'\\''SETTLED'\\''}},modified);await m.exports.SyncService.applyServerChange(db,{record_type:'\\''TRANSACTION'\\'',operation_type:'\\''INSERT'\\'',payload:{id:'\\''tx-1'\\'',operation_id:'\\''op-1'\\'',loan_id:'\\''bullet-1'\\'',transaction_type:'\\''COLLECTION'\\'',amount_paise:11000,allocated_principal_paise:10000,allocated_markup_paise:1000,effective_date:'\\''2026-01-01'\\''}},modified);for(const id of modified)await m.exports.SyncService.reapplyPendingCollections(db,id);console.log(JSON.stringify({authoritativeStatus:'\\''SETTLED'\\'',finalLocalStatus:status}));})();'" in /mnt/f/personal projects/credkeep
 succeeded in 785ms:
{"authoritativeStatus":"SETTLED","finalLocalStatus":"ACTIVE"}

 succeeded in 18144ms:
codex
I confirmed a blocking regression: the new transaction-triggered rebuild changes a fully repaid one-time bullet loan from the server’s `SETTLED` status back to `ACTIVE`. The replay helper requires a paid installment schedule, but these loans use loan terms and have no installments.
 succeeded in 48032ms:
codex
REWORK

- **P1 — Sync reopens settled one-time bullet loans.** [syncService.ts:533](</mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:533>): The new transaction-triggered replay invokes settlement logic requiring a nonempty paid installment schedule. `ANNUAL_SIMPLE_FLAT` bullet loans have no installments, so pulling their final collection overwrites the server’s `SETTLED` status with `ACTIVE`. Reproduced against `bd3183d` using an in-memory database mock. Handle term-based bullet settlement before enabling this replay, and add a regression test.

Typecheck and lint passed. No files changed.
tokens used
52,546
REWORK

- **P1 — Sync reopens settled one-time bullet loans.** [syncService.ts:533](</mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:533>): The new transaction-triggered replay invokes settlement logic requiring a nonempty paid installment schedule. `ANNUAL_SIMPLE_FLAT` bullet loans have no installments, so pulling their final collection overwrites the server’s `SETTLED` status with `ACTIVE`. Reproduced against `bd3183d` using an in-memory database mock. Handle term-based bullet settlement before enabling this replay, and add a regression test.

Typecheck and lint passed. No files changed.

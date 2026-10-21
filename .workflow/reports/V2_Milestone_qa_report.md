OpenAI Codex v0.163.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a1486a-f9b4-7e92-a3ed-c33a29a210e1
--------
user
Perform focused, read-only QA review on milestone V2_Milestone.
Review ONLY the git diff between 9258311 and 62ee653 and directly impacted dependencies.
Scope: Verify financial calculation correctness, payment idempotency, tenant isolation, SQLCipher/database mutations, migrations, or sync integrity.

Token-Optimization & Review Invariants:
1. Review only the changed files in the commit range (9258311...62ee653). Do not perform broad repository indexing.
2. Limit your findings to at most 5 actionable issues, ordered strictly by severity (P0 Critical first, down to P2 Minor).
3. If no critical or high severity defects are found, return: APPROVED.
4. If blocking defects exist, provide concise file/line references and return: REWORK.
5. Do NOT suggest broad architectural rewrites or stylistic nitpicks.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the specified diff and directly impacted dependencies, focusing on the listed integrity risks. I’ll keep the review read-only and report blocking findings only.
exec
/bin/bash -lc 'cat .agents/skills/code-review/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 72ms:
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
/bin/bash -lc 'git status --short; git diff --stat 9258311 62ee653; git diff --name-only 9258311 62ee653' in /mnt/f/personal projects/credkeep
 succeeded in 4118ms:
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
?? .workflow/reports/V2_Milestone_qa_prompt.txt
?? .workflow/reports/V2_Milestone_qa_report.md
 backend/api/views_sync.py                          |    3 +-
 backend/ledger/engine/ledger_service.py            |    1 +
 .../04_audit/CREDKEEP_DESIGN_READINESS.md          |  397 +++++++
 .../04_audit/DESIGN_GAP_MATRIX.csv                 |   73 ++
 .../IMPLEMENTATION_PROGRESS.md                     |  126 ++
 jest.config.js                                     |    7 +-
 src/__tests__/core-product-remediation.test.ts     |   14 +-
 src/__tests__/financial-safety-regression.test.ts  |  575 +++++++++
 src/__tests__/loan-wizard.test.ts                  |   68 ++
 src/__tests__/ui-components.test.tsx               |   76 ++
 src/app/(tabs)/_layout.tsx                         |   20 +-
 src/app/(tabs)/borrowers.tsx                       |  284 +++--
 src/app/(tabs)/collections.tsx                     |  535 ++++++---
 src/app/(tabs)/index.tsx                           |  381 +++---
 src/app/(tabs)/loans.tsx                           | 1235 ++++----------------
 src/app/(tabs)/more.tsx                            |   55 +-
 src/app/auth/index.tsx                             |    6 +-
 src/app/borrower/[id].tsx                          |  472 +++++---
 src/app/loan/[id].tsx                              | 1070 +++--------------
 src/app/loan/components/MonthlyKistView.tsx        |  390 +++++++
 src/app/loan/components/OneTimeLoanView.tsx        |  493 ++++++++
 src/app/loan/create/LoanWizardContext.tsx          |  217 ++++
 src/app/loan/create/_layout.tsx                    |   23 +
 src/app/loan/create/documents.tsx                  |  158 +++
 src/app/loan/create/index.tsx                      |  469 ++++++++
 src/app/loan/create/review.tsx                     |  253 ++++
 src/app/loan/create/terms.tsx                      |  239 ++++
 src/app/reports/index.tsx                          |  148 ++-
 src/app/settings/backup.tsx                        |    2 +-
 src/core/database/loanRepository.ts                |  110 +-
 src/core/database/schema.ts                        |   70 +-
 src/core/database/transactionRepository.ts         |  197 ++--
 src/core/domain/money.ts                           |    2 +
 src/core/sync/outbox.ts                            |    4 +-
 src/core/sync/syncService.test.ts                  |    8 +-
 src/core/sync/syncService.ts                       |   76 +-
 src/ui/AppButton.tsx                               |    1 +
 src/ui/AppCard.tsx                                 |    1 +
 src/ui/AppInput.tsx                                |    1 +
 src/ui/AttachmentGrid.tsx                          |  405 +++++++
 src/ui/AuditTimeline.tsx                           |  265 +++++
 src/ui/BottomSheet.tsx                             |  143 +++
 src/ui/Button.tsx                                  |  174 ++-
 src/ui/Card.tsx                                    |   57 +-
 src/ui/ConfirmationDialog.tsx                      |  134 +++
 src/ui/Feedback.tsx                                |  251 ++++
 src/ui/FinancialSummaryRow.tsx                     |  120 ++
 src/ui/Input.tsx                                   |  110 +-
 src/ui/MoneyInput.tsx                              |  168 +++
 src/ui/SearchSelect.tsx                            |  254 ++++
 src/ui/StepIndicator.tsx                           |  133 +++
 src/ui/SyncBadge.tsx                               |  106 ++
 src/ui/Typography.tsx                              |    7 +-
 src/ui/index.ts                                    |   15 +
 src/ui/theme.ts                                    |  124 +-
 55 files changed, 7872 insertions(+), 2854 deletions(-)
backend/api/views_sync.py
backend/ledger/engine/ledger_service.py
design/credkeep_design_pack/04_audit/CREDKEEP_DESIGN_READINESS.md
design/credkeep_design_pack/04_audit/DESIGN_GAP_MATRIX.csv
design/credkeep_design_pack/IMPLEMENTATION_PROGRESS.md
jest.config.js
src/__tests__/core-product-remediation.test.ts
src/__tests__/financial-safety-regression.test.ts
src/__tests__/loan-wizard.test.ts
src/__tests__/ui-components.test.tsx
src/app/(tabs)/_layout.tsx
src/app/(tabs)/borrowers.tsx
src/app/(tabs)/collections.tsx
src/app/(tabs)/index.tsx
src/app/(tabs)/loans.tsx
src/app/(tabs)/more.tsx
src/app/auth/index.tsx
src/app/borrower/[id].tsx
src/app/loan/[id].tsx
src/app/loan/components/MonthlyKistView.tsx
src/app/loan/components/OneTimeLoanView.tsx
src/app/loan/create/LoanWizardContext.tsx
src/app/loan/create/_layout.tsx
src/app/loan/create/documents.tsx
src/app/loan/create/index.tsx
src/app/loan/create/review.tsx
src/app/loan/create/terms.tsx
src/app/reports/index.tsx
src/app/settings/backup.tsx
src/core/database/loanRepository.ts
src/core/database/schema.ts
src/core/database/transactionRepository.ts
src/core/domain/money.ts
src/core/sync/outbox.ts
src/core/sync/syncService.test.ts
src/core/sync/syncService.ts
src/ui/AppButton.tsx
src/ui/AppCard.tsx
src/ui/AppInput.tsx
src/ui/AttachmentGrid.tsx
src/ui/AuditTimeline.tsx
src/ui/BottomSheet.tsx
src/ui/Button.tsx
src/ui/Card.tsx
src/ui/ConfirmationDialog.tsx
src/ui/Feedback.tsx
src/ui/FinancialSummaryRow.tsx
src/ui/Input.tsx
src/ui/MoneyInput.tsx
src/ui/SearchSelect.tsx
src/ui/StepIndicator.tsx
src/ui/SyncBadge.tsx
src/ui/Typography.tsx
src/ui/index.ts
src/ui/theme.ts

codex
I’m applying the code-review skill within your narrowed scope. The working tree has many unrelated changes, so I’ll read the committed snapshots at `62ee653` to keep them out of the review.
exec
/bin/bash -lc 'git diff 9258311...62ee653 -- src/app/loan/create/LoanWizardContext.tsx src/app/loan/create/review.tsx src/app/loan/create/terms.tsx src/ui/MoneyInput.tsx' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'git log --oneline 9258311..62ee653; git diff 9258311...62ee653 -- src/app/loan/components/MonthlyKistView.tsx src/app/loan/components/OneTimeLoanView.tsx' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat .agents/skills/financial-invariant-verification/SKILL.md; cat package.json' in /mnt/f/personal projects/credkeep
 succeeded in 0ms:
---
name: financial-invariant-verification
description: Rules for verifying financial math and data invariants
---

# Financial Invariant Verification

1. Double-entry ledger must always balance.
2. Payments must not cross loan boundaries.
3. Calculations must be deterministic.
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

 succeeded in 119ms:
diff --git a/src/app/loan/create/LoanWizardContext.tsx b/src/app/loan/create/LoanWizardContext.tsx
new file mode 100644
index 0000000..9a46617
--- /dev/null
+++ b/src/app/loan/create/LoanWizardContext.tsx
@@ -0,0 +1,217 @@
+import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
+import { Paise, toPaise } from '../../../core/domain/money';
+import { Borrower } from '../../../core/database/borrowerRepository';
+import { AttachmentItem } from '../../../ui/AttachmentGrid';
+import { useDatabase } from '../../../core/database/DatabaseProvider';
+import {
+  generateSchedule,
+  calculateContractInterest,
+  calculateMaturityDate,
+} from '../../../core/domain/schedule';
+
+export interface LoanDraftState {
+  borrowerId: string;
+  borrower: Borrower | null;
+  productType: 'instalment' | 'bullet';
+  rateBasis: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';
+  principalPaise: Paise;
+  annualRate: number;
+  termMonths: number;
+  startDate: string;
+  dueDay: number;
+  collateral: string;
+  attachments: AttachmentItem[];
+}
+
+export interface CalculatedLoanSummary {
+  totalInterestPaise: Paise;
+  totalPayablePaise: Paise;
+  monthlyAmountPaise: Paise;
+  maturityDate: string;
+  schedule: {
+    periodNumber: number;
+    dueDate: string;
+    principalDuePaise: Paise;
+    markupDuePaise: Paise;
+    totalDuePaise: Paise;
+  }[];
+}
+
+export interface LoanWizardContextValue {
+  draft: LoanDraftState;
+  updateDraft: (updates: Partial<LoanDraftState>) => void;
+  resetDraft: () => void;
+  calculated: CalculatedLoanSummary;
+  commitLoan: () => Promise<string>;
+  isSubmitting: boolean;
+  submitError: string | null;
+}
+
+const initialDraft: LoanDraftState = {
+  borrowerId: '',
+  borrower: null,
+  productType: 'instalment',
+  rateBasis: 'ANNUAL_SIMPLE_FLAT',
+  principalPaise: toPaise(50000),
+  annualRate: 24,
+  termMonths: 10,
+  startDate: new Date().toISOString().split('T')[0],
+  dueDay: 5,
+  collateral: '',
+  attachments: [],
+};
+
+const LoanWizardContext = createContext<LoanWizardContextValue | undefined>(undefined);
+
+export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
+  const { loans, triggerRefresh } = useDatabase();
+  const [draft, setDraft] = useState<LoanDraftState>(initialDraft);
+  const [isSubmitting, setIsSubmitting] = useState(false);
+  const [submitError, setSubmitError] = useState<string | null>(null);
+
+  const updateDraft = (updates: Partial<LoanDraftState>) => {
+    setDraft((prev) => ({ ...prev, ...updates }));
+  };
+
+  const resetDraft = () => {
+    setDraft(initialDraft);
+    setSubmitError(null);
+  };
+
+  const calculated = useMemo<CalculatedLoanSummary>(() => {
+    const principal = draft.principalPaise;
+    const rate = draft.annualRate;
+    const months = draft.termMonths;
+    const startDate = draft.startDate;
+    const dueDay = draft.dueDay;
+    const isBullet = draft.productType === 'bullet';
+
+    if (isBullet) {
+      // Bullet loan: Monthly interest only, full principal at maturity
+      const monthlyRate = rate / 12 / 100;
+      const monthlyInterestPaise = Math.round(principal * monthlyRate) as Paise;
+      const totalInterestPaise = Math.round(monthlyInterestPaise * months) as Paise;
+      const totalPayablePaise = (principal + totalInterestPaise) as Paise;
+      const maturityDate = calculateMaturityDate(startDate, months, dueDay);
+
+      return {
+        totalInterestPaise,
+        totalPayablePaise,
+        monthlyAmountPaise: monthlyInterestPaise,
+        maturityDate,
+        schedule: [],
+      };
+    } else {
+      // Instalment loan: Fixed monthly kists
+      const interestPaise = calculateContractInterest(principal, rate, months);
+      const totalPaise = (principal + interestPaise) as Paise;
+      const maturityDate = calculateMaturityDate(startDate, months, dueDay);
+
+      let scheduleItems: any[] = [];
+      try {
+        const gen = generateSchedule({
+          principal,
+          annualRate: rate,
+          rateBasis: 'ANNUAL_SIMPLE_FLAT',
+          termMonths: months,
+          startDate,
+          dueDay,
+          productType: 'instalment',
+        });
+        scheduleItems = gen.map((item) => ({
+          periodNumber: item.kistNumber,
+          dueDate: item.dueDate,
+          principalDuePaise: item.principalDue,
+          markupDuePaise: item.markupDue,
+          totalDuePaise: item.amountDue,
+        }));
+      } catch {
+        // Fallback if dates invalid during typing
+      }
+
+      const monthlyKist = months > 0 ? (Math.round(totalPaise / months) as Paise) : (0 as Paise);
+
+      return {
+        totalInterestPaise: interestPaise,
+        totalPayablePaise: totalPaise,
+        monthlyAmountPaise: monthlyKist,
+        maturityDate,
+        schedule: scheduleItems,
+      };
+    }
+  }, [
+    draft.principalPaise,
+    draft.annualRate,
+    draft.termMonths,
+    draft.startDate,
+    draft.dueDay,
+    draft.productType,
+  ]);
+
+  const commitLoan = async (): Promise<string> => {
+    if (!loans) throw new Error('Database not initialized');
+    if (!draft.borrowerId) throw new Error('Please select a borrower');
+
+    setIsSubmitting(true);
+    setSubmitError(null);
+
+    try {
+      const isBullet = draft.productType === 'bullet';
+
+      // Map attachments to repository input
+      const attachmentInputs = draft.attachments.map((att) => ({
+        file_path: att.filePath,
+        doc_type: att.docType,
+        notes: att.fileName,
+      }));
+
+      const createdLoan = await loans.createLoanWithSchedule(
+        draft.borrowerId,
+        {
+          principal: draft.principalPaise,
+          annualRate: draft.annualRate,
+          rateBasis: isBullet ? 'ANNUAL_SIMPLE_FLAT' : undefined,
+          termMonths: draft.termMonths,
+          startDate: draft.startDate,
+          dueDay: draft.dueDay,
+          productType: draft.productType,
+          collateral: draft.collateral || undefined,
+          attachments: attachmentInputs,
+        }
+      );
+
+      triggerRefresh();
+      resetDraft();
+      return createdLoan.id;
+    } catch (err: any) {
+      setSubmitError(err.message || 'Failed to create loan');
+      throw err;
+    } finally {
+      setIsSubmitting(false);
+    }
+  };
+
+  return (
+    <LoanWizardContext.Provider
+      value={{
+        draft,
+        updateDraft,
+        resetDraft,
+        calculated,
+        commitLoan,
+        isSubmitting,
+        submitError,
+      }}
+    >
+      {children}
+    </LoanWizardContext.Provider>
+  );
+};
+
+export const useLoanWizard = () => {
+  const context = useContext(LoanWizardContext);
+  if (!context) {
+    throw new Error('useLoanWizard must be used within a LoanWizardProvider');
+  }
+  return context;
+};
diff --git a/src/app/loan/create/review.tsx b/src/app/loan/create/review.tsx
new file mode 100644
index 0000000..6e07e19
--- /dev/null
+++ b/src/app/loan/create/review.tsx
@@ -0,0 +1,253 @@
+import React from 'react';
+import { View, StyleSheet, ScrollView, Alert } from 'react-native';
+import { SafeAreaView } from 'react-native-safe-area-context';
+import { useRouter } from 'expo-router';
+import { StepIndicator } from '../../../ui/StepIndicator';
+import { Typography } from '../../../ui/Typography';
+import { Card } from '../../../ui/Card';
+import { Button } from '../../../ui/Button';
+import { FinancialSummaryRow } from '../../../ui/FinancialSummaryRow';
+import { InlineErrorCard } from '../../../ui/Feedback';
+import { theme } from '../../../ui/theme';
+import { formatINR } from '../../../core/domain/money';
+import { useLoanWizard } from './LoanWizardContext';
+
+export default function Step4ReviewScreen() {
+  const router = useRouter();
+  const { draft, calculated, commitLoan, isSubmitting, submitError } = useLoanWizard();
+
+  const isBullet = draft.productType === 'bullet';
+
+  const handleCreate = async () => {
+    try {
+      const loanId = await commitLoan();
+      Alert.alert(
+        'Loan Created Successfully',
+        `Contract committed to local encrypted ledger.`,
+        [
+          {
+            text: 'View Loan Details',
+            onPress: () => router.replace(`/loan/${loanId}` as any),
+          },
+        ]
+      );
+    } catch {
+      // Error handled by submitError state
+    }
+  };
+
+  return (
+    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
+      {/* 4-Step Indicator Header */}
+      <StepIndicator
+        currentStep={4}
+        totalSteps={4}
+        stepTitle="Review & Confirm"
+        onBack={() => router.back()}
+      />
+
+      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+        {/* Borrower Card */}
+        <Card style={styles.sectionCard}>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
+            BORROWER
+          </Typography>
+          <View style={styles.borrowerRow}>
+            <View>
+              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+                {draft.borrower?.name || 'Unknown Borrower'}
+              </Typography>
+              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+                {draft.borrower?.phone}
+              </Typography>
+            </View>
+            <View style={styles.badgePill}>
+              <Typography variant="labelSm" color={theme.colors.textPrimary}>
+                {isBullet ? 'Bullet Loan' : 'Monthly Kist'}
+              </Typography>
+            </View>
+          </View>
+        </Card>
+
+        {/* Financial Terms Breakdown */}
+        <Card style={styles.sectionCard}>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
+            FINANCIAL CONTRACT BREAKDOWN
+          </Typography>
+
+          <FinancialSummaryRow
+            label="Disbursed Principal"
+            value={formatINR(draft.principalPaise)}
+            variant="highlight"
+          />
+          <FinancialSummaryRow
+            label="Interest Rate"
+            value={`${draft.annualRate}% p.a.`}
+          />
+          <FinancialSummaryRow
+            label="Term Duration"
+            value={`${draft.termMonths} Months`}
+          />
+          <FinancialSummaryRow
+            label="First Payment Due"
+            value={calculated.schedule[0]?.dueDate || draft.startDate}
+          />
+          <FinancialSummaryRow
+            label="Maturity Date"
+            value={calculated.maturityDate}
+          />
+          <FinancialSummaryRow
+            label={isBullet ? 'Total Contract Interest' : 'Total Contract Markup'}
+            value={formatINR(calculated.totalInterestPaise)}
+          />
+          <FinancialSummaryRow
+            label={isBullet ? 'Monthly Interest Due' : 'Monthly Instalment (Kist)'}
+            value={formatINR(calculated.monthlyAmountPaise)}
+            variant="highlight"
+          />
+          <FinancialSummaryRow
+            label="Total Amount Payable"
+            value={formatINR(calculated.totalPayablePaise)}
+            variant="highlight"
+          />
+        </Card>
+
+        {/* Collateral & Documents Summary */}
+        <Card style={styles.sectionCard}>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
+            SECURITY & ATTACHMENTS
+          </Typography>
+
+          <FinancialSummaryRow
+            label="Physical Collateral"
+            value={draft.collateral || 'None declared'}
+          />
+          <FinancialSummaryRow
+            label="Verified Documents"
+            value={`${draft.attachments.length} attached`}
+          />
+        </Card>
+
+        {/* Schedule Preview (Instalment) */}
+        {!isBullet && calculated.schedule.length > 0 && (
+          <Card style={styles.sectionCard}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
+              REPAYMENT SCHEDULE PREVIEW ({calculated.schedule.length} KISTS)
+            </Typography>
+
+            {calculated.schedule.slice(0, 5).map((item) => (
+              <View key={item.periodNumber} style={styles.scheduleRow}>
+                <View style={styles.scheduleLeft}>
+                  <View style={styles.scheduleNumber}>
+                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
+                      #{item.periodNumber}
+                    </Typography>
+                  </View>
+                  <Typography variant="bodyMd" color={theme.colors.textPrimary}>
+                    {item.dueDate}
+                  </Typography>
+                </View>
+
+                <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
+                  {formatINR(item.totalDuePaise)}
+                </Typography>
+              </View>
+            ))}
+
+            {calculated.schedule.length > 5 && (
+              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
+                + {calculated.schedule.length - 5} more installments
+              </Typography>
+            )}
+          </Card>
+        )}
+
+        {/* Error Card */}
+        {submitError && (
+          <InlineErrorCard
+            title="Loan Creation Error"
+            message={submitError}
+            retryLabel="Try Again"
+            onRetry={handleCreate}
+          />
+        )}
+      </ScrollView>
+
+      {/* Sticky Bottom Bar */}
+      <View style={styles.bottomBar}>
+        <Button
+          title="Disburse & Create Loan"
+          onPress={handleCreate}
+          loading={isSubmitting}
+          variant="primary"
+        />
+      </View>
+    </SafeAreaView>
+  );
+}
+
+const styles = StyleSheet.create({
+  safeArea: {
+    flex: 1,
+    backgroundColor: theme.colors.background,
+  },
+  container: {
+    flex: 1,
+    backgroundColor: theme.colors.surfaceSoft,
+  },
+  content: {
+    padding: theme.spacing.md,
+    gap: 12,
+    paddingBottom: 24,
+  },
+  sectionCard: {
+    padding: theme.spacing.md,
+    backgroundColor: theme.colors.surface,
+  },
+  cardHeaderLabel: {
+    fontWeight: '600',
+    letterSpacing: 0.5,
+    marginBottom: 8,
+  },
+  borrowerRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    paddingVertical: 4,
+  },
+  badgePill: {
+    backgroundColor: theme.colors.surfaceSoft,
+    paddingHorizontal: 8,
+    paddingVertical: 3,
+    borderRadius: theme.borderRadius.full,
+    borderWidth: 1,
+    borderColor: theme.colors.borderDefault,
+  },
+  scheduleRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    paddingVertical: 8,
+    borderBottomWidth: 1,
+    borderBottomColor: theme.colors.borderDefault,
+  },
+  scheduleLeft: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: 10,
+  },
+  scheduleNumber: {
+    width: 28,
+    height: 28,
+    borderRadius: 14,
+    backgroundColor: theme.colors.surfaceSoft,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  bottomBar: {
+    padding: theme.spacing.md,
+    backgroundColor: theme.colors.background,
+    borderTopWidth: 1,
+    borderTopColor: theme.colors.borderDefault,
+  },
+});
diff --git a/src/app/loan/create/terms.tsx b/src/app/loan/create/terms.tsx
new file mode 100644
index 0000000..e34817a
--- /dev/null
+++ b/src/app/loan/create/terms.tsx
@@ -0,0 +1,239 @@
+import React, { useState } from 'react';
+import { View, StyleSheet, ScrollView, Alert } from 'react-native';
+import { SafeAreaView } from 'react-native-safe-area-context';
+import { useRouter } from 'expo-router';
+import { StepIndicator } from '../../../ui/StepIndicator';
+import { Typography } from '../../../ui/Typography';
+import { Card } from '../../../ui/Card';
+import { Button } from '../../../ui/Button';
+import { Input } from '../../../ui/Input';
+import { MoneyInput } from '../../../ui/MoneyInput';
+import { FinancialSummaryRow } from '../../../ui/FinancialSummaryRow';
+import { theme } from '../../../ui/theme';
+import { formatINR } from '../../../core/domain/money';
+import { useLoanWizard } from './LoanWizardContext';
+
+export default function Step2TermsScreen() {
+  const router = useRouter();
+  const { draft, updateDraft, calculated } = useLoanWizard();
+
+  const [rateText, setRateText] = useState(draft.annualRate.toString());
+  const [termText, setTermText] = useState(draft.termMonths.toString());
+  const [dueDayText, setDueDayText] = useState(draft.dueDay.toString());
+
+  const isBullet = draft.productType === 'bullet';
+
+  const handleRateChange = (text: string) => {
+    setRateText(text);
+    const num = parseFloat(text);
+    if (!isNaN(num) && num >= 0) {
+      updateDraft({ annualRate: num });
+    }
+  };
+
+  const handleTermChange = (text: string) => {
+    setTermText(text);
+    const num = parseInt(text, 10);
+    if (!isNaN(num) && num > 0) {
+      updateDraft({ termMonths: num });
+    }
+  };
+
+  const handleDueDayChange = (text: string) => {
+    setDueDayText(text);
+    const num = parseInt(text, 10);
+    if (!isNaN(num) && num >= 1 && num <= 31) {
+      updateDraft({ dueDay: num });
+    }
+  };
+
+  const handleNext = () => {
+    if (draft.principalPaise <= 0) {
+      Alert.alert('Invalid Principal', 'Principal amount must be greater than zero.');
+      return;
+    }
+    if (draft.annualRate < 0) {
+      Alert.alert('Invalid Rate', 'Interest rate cannot be negative.');
+      return;
+    }
+    if (draft.termMonths <= 0) {
+      Alert.alert('Invalid Duration', 'Duration must be at least 1 month.');
+      return;
+    }
+    router.push('/loan/create/documents');
+  };
+
+  return (
+    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
+      {/* 4-Step Indicator Header */}
+      <StepIndicator
+        currentStep={2}
+        totalSteps={4}
+        stepTitle="Loan Terms"
+        onBack={() => router.back()}
+      />
+
+      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+        {/* Principal Amount via MoneyInput */}
+        <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.inputSectionLabel}>
+          LOAN PRINCIPAL
+        </Typography>
+        <MoneyInput
+          label="Principal Amount *"
+          valuePaise={draft.principalPaise}
+          onChangePaise={(paise) => updateDraft({ principalPaise: paise })}
+          helperText="Enter the cash disbursed to borrower"
+        />
+
+        {/* Term & Rate Inputs */}
+        <Typography variant="labelSm" color={theme.colors.textSecondary} style={[styles.inputSectionLabel, { marginTop: 16 }]}>
+          INTEREST & DURATION
+        </Typography>
+
+        <View style={styles.inputRow}>
+          <View style={{ flex: 1 }}>
+            <Input
+              label="Annual Rate (% p.a.) *"
+              value={rateText}
+              onChangeText={handleRateChange}
+              keyboardType="numeric"
+              placeholder="24"
+            />
+          </View>
+          <View style={{ flex: 1 }}>
+            <Input
+              label="Duration (Months) *"
+              value={termText}
+              onChangeText={handleTermChange}
+              keyboardType="number-pad"
+              placeholder="10"
+            />
+          </View>
+        </View>
+
+        <View style={styles.inputRow}>
+          <View style={{ flex: 1 }}>
+            <Input
+              label="Monthly Due Day (1-31)"
+              value={dueDayText}
+              onChangeText={handleDueDayChange}
+              keyboardType="number-pad"
+              placeholder="5"
+            />
+          </View>
+          <View style={{ flex: 1 }}>
+            <Input
+              label="Start Date (YYYY-MM-DD)"
+              value={draft.startDate}
+              onChangeText={(text) => updateDraft({ startDate: text })}
+              placeholder="YYYY-MM-DD"
+            />
+          </View>
+        </View>
+
+        {/* Live Calculation Card */}
+        <Card style={styles.calculationCard}>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
+            CALCULATED TERMS ({isBullet ? 'BULLET LOAN' : 'MONTHLY KIST'})
+          </Typography>
+
+          {isBullet ? (
+            <>
+              <FinancialSummaryRow
+                label="Monthly Interest Payment"
+                sublabel={`Due on day ${draft.dueDay} each month`}
+                value={formatINR(calculated.monthlyAmountPaise)}
+                variant="highlight"
+              />
+              <FinancialSummaryRow
+                label="Principal Due at Maturity"
+                sublabel={`Due on ${calculated.maturityDate}`}
+                value={formatINR(draft.principalPaise)}
+              />
+              <FinancialSummaryRow
+                label="Total Contract Interest"
+                sublabel={`${draft.termMonths} months @ ${draft.annualRate}% p.a.`}
+                value={formatINR(calculated.totalInterestPaise)}
+              />
+              <FinancialSummaryRow
+                label="Total Contract Value"
+                sublabel="Principal + all monthly interest"
+                value={formatINR(calculated.totalPayablePaise)}
+                variant="highlight"
+              />
+            </>
+          ) : (
+            <>
+              <FinancialSummaryRow
+                label="Monthly Instalment (Kist)"
+                sublabel={`Equal monthly payment across ${draft.termMonths} months`}
+                value={formatINR(calculated.monthlyAmountPaise)}
+                variant="highlight"
+              />
+              <FinancialSummaryRow
+                label="Total Contract Markup / Interest"
+                sublabel={`Flat ${draft.annualRate}% p.a. over ${draft.termMonths} mos`}
+                value={formatINR(calculated.totalInterestPaise)}
+              />
+              <FinancialSummaryRow
+                label="Total Repayment Amount"
+                sublabel="Principal + total markup"
+                value={formatINR(calculated.totalPayablePaise)}
+                variant="highlight"
+              />
+              <FinancialSummaryRow
+                label="Maturity Date"
+                sublabel="Final installment due"
+                value={calculated.maturityDate}
+              />
+            </>
+          )}
+        </Card>
+      </ScrollView>
+
+      {/* Sticky Bottom Bar */}
+      <View style={styles.bottomBar}>
+        <Button
+          title="Continue to Documents"
+          onPress={handleNext}
+          variant="primary"
+        />
+      </View>
+    </SafeAreaView>
+  );
+}
+
+const styles = StyleSheet.create({
+  safeArea: {
+    flex: 1,
+    backgroundColor: theme.colors.background,
+  },
+  container: {
+    flex: 1,
+    backgroundColor: theme.colors.surfaceSoft,
+  },
+  content: {
+    padding: theme.spacing.md,
+    paddingBottom: 24,
+  },
+  inputSectionLabel: {
+    marginBottom: 8,
+    fontWeight: '600',
+    letterSpacing: 0.5,
+  },
+  inputRow: {
+    flexDirection: 'row',
+    gap: 12,
+  },
+  calculationCard: {
+    marginTop: 16,
+    padding: theme.spacing.md,
+    backgroundColor: theme.colors.surface,
+  },
+  bottomBar: {
+    padding: theme.spacing.md,
+    backgroundColor: theme.colors.background,
+    borderTopWidth: 1,
+    borderTopColor: theme.colors.borderDefault,
+  },
+});
diff --git a/src/ui/MoneyInput.tsx b/src/ui/MoneyInput.tsx
new file mode 100644
index 0000000..bfbc3bd
--- /dev/null
+++ b/src/ui/MoneyInput.tsx
@@ -0,0 +1,168 @@
+import React, { useState } from 'react';
+import {
+  View,
+  TextInput,
+  StyleSheet,
+  ViewStyle,
+  StyleProp,
+} from 'react-native';
+import { Typography } from './Typography';
+import { theme } from './theme';
+import { Paise, toPaise } from '../core/domain/money';
+
+export interface MoneyInputProps {
+  label?: string;
+  value?: string; // rupees string like "50000"
+  onChangeValue?: (val: string) => void;
+  valuePaise?: Paise;
+  onChangePaise?: (paise: Paise) => void;
+  error?: string;
+  helperText?: string;
+  placeholder?: string;
+  containerStyle?: StyleProp<ViewStyle>;
+  editable?: boolean;
+}
+
+export function MoneyInput({
+  label,
+  value,
+  onChangeValue,
+  valuePaise,
+  onChangePaise,
+  error,
+  helperText,
+  placeholder = '0',
+  containerStyle,
+  editable = true,
+}: MoneyInputProps) {
+  const [isFocused, setIsFocused] = useState(false);
+
+  const displayValue = valuePaise !== undefined 
+    ? (valuePaise > 0 ? Math.round(valuePaise / 100).toString() : '')
+    : (value || '');
+
+  const handleChangeText = (text: string) => {
+    // Only allow digits
+    const cleaned = text.replace(/[^0-9]/g, '');
+    if (onChangeValue) {
+      onChangeValue(cleaned);
+    }
+    if (onChangePaise) {
+      const rupees = parseInt(cleaned, 10) || 0;
+      onChangePaise(toPaise(rupees));
+    }
+  };
+
+  const getInWords = (numStr: string) => {
+    const val = parseInt(numStr, 10);
+    if (!val || isNaN(val)) return null;
+    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
+    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
+    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
+    return null;
+  };
+
+  const words = getInWords(displayValue);
+
+  return (
+    <View style={[styles.container, containerStyle]}>
+      {label ? (
+        <View style={styles.labelRow}>
+          <Typography variant="labelMd" color={theme.colors.textSecondary}>
+            {label}
+          </Typography>
+          {words ? (
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              {words}
+            </Typography>
+          ) : null}
+        </View>
+      ) : null}
+
+      <View
+        style={[
+          styles.inputContainer,
+          isFocused && styles.inputFocused,
+          error ? styles.inputError : null,
+          !editable && styles.inputDisabled,
+        ]}
+      >
+        <Typography
+          variant="headlineMd"
+          color={value ? theme.colors.textPrimary : theme.colors.textDisabled}
+          style={styles.currencyPrefix}
+        >
+          ₹
+        </Typography>
+        <TextInput
+          style={styles.textInput}
+          value={value}
+          onChangeText={handleChangeText}
+          placeholder={placeholder}
+          placeholderTextColor={theme.colors.textDisabled}
+          keyboardType="number-pad"
+          inputMode="numeric"
+          editable={editable}
+          onFocus={() => setIsFocused(true)}
+          onBlur={() => setIsFocused(false)}
+        />
+      </View>
+
+      {error ? (
+        <Typography variant="bodySm" color={theme.colors.danger} style={styles.message}>
+          {error}
+        </Typography>
+      ) : helperText ? (
+        <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.message}>
+          {helperText}
+        </Typography>
+      ) : null}
+    </View>
+  );
+}
+
+const styles = StyleSheet.create({
+  container: {
+    marginBottom: theme.spacing.md,
+  },
+  labelRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    marginBottom: theme.spacing.xs,
+  },
+  inputContainer: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    backgroundColor: theme.colors.surface,
+    borderWidth: 1,
+    borderColor: theme.colors.borderDefault,
+    borderRadius: theme.borderRadius.md,
+    minHeight: 56,
+    paddingHorizontal: theme.spacing.md,
+  },
+  inputFocused: {
+    borderColor: theme.colors.borderStrong,
+  },
+  inputError: {
+    borderColor: theme.colors.danger,
+  },
+  inputDisabled: {
+    backgroundColor: theme.colors.surfaceSoft,
+  },
+  currencyPrefix: {
+    marginRight: theme.spacing.sm,
+    fontWeight: '600',
+  },
+  textInput: {
+    flex: 1,
+    fontSize: 22,
+    fontWeight: '600',
+    color: theme.colors.textPrimary,
+    fontVariant: ['tabular-nums'],
+    paddingVertical: theme.spacing.sm,
+  },
+  message: {
+    marginTop: theme.spacing.xs,
+  },
+});

 succeeded in 181ms:
62ee653 feat(v2): implement approved neutral precision design system and financial safety remediations
diff --git a/src/app/loan/components/MonthlyKistView.tsx b/src/app/loan/components/MonthlyKistView.tsx
new file mode 100644
index 0000000..21d4486
--- /dev/null
+++ b/src/app/loan/components/MonthlyKistView.tsx
@@ -0,0 +1,390 @@
+import React from 'react';
+import { View, StyleSheet, ScrollView } from 'react-native';
+import { Typography } from '../../../ui/Typography';
+import { Card } from '../../../ui/Card';
+import { Button } from '../../../ui/Button';
+import { AttachmentGrid } from '../../../ui/AttachmentGrid';
+import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
+import { theme } from '../../../ui/theme';
+import { Loan, LoanAttachment } from '../../../core/database/loanRepository';
+import { Borrower } from '../../../core/database/borrowerRepository';
+import { formatINR, Paise } from '../../../core/domain/money';
+
+export interface MonthlyKistViewProps {
+  loan: Loan;
+  borrower: Borrower | null;
+  schedule: any[];
+  earnings: any;
+  history: any[];
+  attachments: LoanAttachment[];
+  onRecordPayment: () => void;
+  onCorrectPayment: (tx: any) => void;
+}
+
+export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
+  loan,
+  borrower,
+  schedule,
+  earnings,
+  history,
+  attachments,
+  onRecordPayment,
+  onCorrectPayment,
+}) => {
+
+  // Financial calculations
+  const totalPrincipal = loan.principal_paise as Paise;
+  const totalInterest = (loan.interest_paise || 0) as Paise;
+  const totalContract = (loan.total_paise || totalPrincipal + totalInterest) as Paise;
+
+  const principalReturned = (earnings?.principalReturned || 0) as Paise;
+  const markupReceived = (earnings?.markupReceived || 0) as Paise;
+  const totalCollected = (principalReturned + markupReceived) as Paise;
+  const remainingTotal = Math.max(0, totalContract - totalCollected) as Paise;
+
+  const paidKistsCount = schedule.filter((s) => s.status === 'PAID').length;
+  const totalKistsCount = schedule.length;
+
+  // Format ledger history events for AuditTimeline
+  const auditEvents: AuditEvent[] = history.map((tx) => {
+    let type: AuditEvent['type'] = 'COLLECTION';
+    if (tx.transaction_type === 'DISBURSEMENT') type = 'DISBURSEMENT';
+    else if (tx.transaction_type === 'PENALTY_ASSESSMENT') type = 'PENALTY_ASSESSMENT';
+    else if (tx.transaction_type === 'REVERSAL') type = 'REVERSAL';
+    else if (tx.transaction_type === 'CORRECTION_REPLACEMENT') type = 'REPLACEMENT';
+
+    return {
+      id: tx.id,
+      type,
+      title: tx.notes || undefined,
+      amountPaise: tx.amount_paise as Paise,
+      effectiveDate: tx.effective_date,
+      principalPaise: tx.allocated_principal_paise !== undefined ? (tx.allocated_principal_paise as Paise) : undefined,
+      interestPaise: tx.allocated_markup_paise !== undefined ? (tx.allocated_markup_paise as Paise) : undefined,
+      penaltyPaise: tx.allocated_penalty_paise !== undefined ? (tx.allocated_penalty_paise as Paise) : undefined,
+      paymentMethod: tx.payment_method || undefined,
+      reason: tx.reason || undefined,
+    };
+  });
+
+  const getStatusBadge = (status: string) => {
+    switch (status) {
+      case 'PAID':
+        return { bg: theme.colors.successContainer, text: theme.colors.successText, label: 'Paid' };
+      case 'PARTIAL':
+        return { bg: theme.colors.warningContainer, text: theme.colors.warningText, label: 'Partial' };
+      case 'OVERDUE':
+        return { bg: theme.colors.dangerContainer, text: theme.colors.dangerText, label: 'Overdue' };
+      case 'DUE':
+      default:
+        return { bg: theme.colors.surfaceSoft, text: theme.colors.textSecondary, label: 'Due' };
+    }
+  };
+
+  return (
+    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+      {/* Borrower Header Row */}
+      <View style={styles.borrowerCard}>
+        <View style={styles.borrowerLeft}>
+          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+            {borrower?.name || 'Borrower'}
+          </Typography>
+          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+            {borrower?.phone} • Monthly Instalment
+          </Typography>
+        </View>
+
+        <View
+          style={[
+            styles.statusPill,
+            loan.status === 'ACTIVE'
+              ? styles.pillActive
+              : loan.status === 'SETTLED'
+              ? styles.pillSettled
+              : styles.pillDefault,
+          ]}
+        >
+          <Typography
+            variant="labelSm"
+            color={
+              loan.status === 'ACTIVE'
+                ? theme.colors.success
+                : loan.status === 'SETTLED'
+                ? theme.colors.textSecondary
+                : theme.colors.danger
+            }
+          >
+            {loan.status}
+          </Typography>
+        </View>
+      </View>
+
+      {/* Hero Financial Summary */}
+      <Card style={styles.heroCard}>
+        <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
+          OUTSTANDING BALANCE
+        </Typography>
+        <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
+          {formatINR(remainingTotal)}
+        </Typography>
+
+        <View style={styles.progressRow}>
+          <View style={styles.progressBarBg}>
+            <View
+              style={[
+                styles.progressBarFill,
+                { width: totalKistsCount > 0 ? `${(paidKistsCount / totalKistsCount) * 100}%` : '0%' },
+              ]}
+            />
+          </View>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ marginLeft: 8 }}>
+            {paidKistsCount} of {totalKistsCount} paid
+          </Typography>
+        </View>
+
+        {/* 3 Metrics Sub-Row */}
+        <View style={styles.metricsRow}>
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Principal
+            </Typography>
+            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
+              {formatINR(totalPrincipal)}
+            </Typography>
+          </View>
+
+          <View style={styles.metricDivider} />
+
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Total Markup
+            </Typography>
+            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
+              {formatINR(totalInterest)}
+            </Typography>
+          </View>
+
+          <View style={styles.metricDivider} />
+
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Collected
+            </Typography>
+            <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '600', marginTop: 2 }}>
+              {formatINR(totalCollected)}
+            </Typography>
+          </View>
+        </View>
+      </Card>
+
+      {/* Action Buttons */}
+      <View style={styles.btnRow}>
+        <View style={{ flex: 1 }}>
+          <Button
+            title="Record Collection"
+            variant="primary"
+            onPress={onRecordPayment}
+          />
+        </View>
+      </View>
+
+      {/* Repayment Schedule Table */}
+      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+        Repayment Schedule ({schedule.length} Kists)
+      </Typography>
+
+      <Card style={styles.scheduleCard}>
+        {schedule.map((item, index) => {
+          const badge = getStatusBadge(item.status);
+          const totalPaid = ((item.principal_paid_paise || 0) + (item.markup_paid_paise || 0)) as Paise;
+
+          return (
+            <View
+              key={item.id || item.period_number}
+              style={[
+                styles.scheduleItem,
+                index === schedule.length - 1 && { borderBottomWidth: 0 },
+              ]}
+            >
+              <View style={styles.scheduleItemLeft}>
+                <View style={styles.kistBadge}>
+                  <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '700' }}>
+                    #{item.period_number}
+                  </Typography>
+                </View>
+                <View>
+                  <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
+                    {formatINR(item.total_due_paise as Paise)}
+                  </Typography>
+                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
+                    Due {item.effective_due_date || item.due_date}
+                  </Typography>
+                </View>
+              </View>
+
+              <View style={styles.scheduleItemRight}>
+                <View style={[styles.kistStatusPill, { backgroundColor: badge.bg }]}>
+                  <Typography variant="labelSm" color={badge.text} style={{ fontWeight: '600' }}>
+                    {badge.label}
+                  </Typography>
+                </View>
+                {totalPaid > 0 && item.status !== 'PAID' && (
+                  <Typography variant="bodySm" tabularNums color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+                    Paid {formatINR(totalPaid)}
+                  </Typography>
+                )}
+              </View>
+            </View>
+          );
+        })}
+      </Card>
+
+      {/* Verified Attachments */}
+      {attachments.length > 0 && (
+        <>
+          <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+            Attached Documents ({attachments.length})
+          </Typography>
+          <AttachmentGrid
+            attachments={attachments.map((a) => ({
+              id: a.id,
+              filePath: a.file_path,
+              docType: (a.doc_type || 'other') as any,
+              fileName: a.file_name,
+            }))}
+            readOnly
+          />
+        </>
+      )}
+
+      {/* Transaction & Audit History */}
+      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+        Financial Audit Trail
+      </Typography>
+
+      <AuditTimeline events={auditEvents} />
+    </ScrollView>
+  );
+};
+
+const styles = StyleSheet.create({
+  container: {
+    flex: 1,
+    backgroundColor: theme.colors.surfaceSoft,
+  },
+  content: {
+    padding: theme.spacing.md,
+    gap: 12,
+    paddingBottom: 40,
+  },
+  borrowerCard: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    paddingVertical: 4,
+  },
+  borrowerLeft: {
+    flex: 1,
+  },
+  statusPill: {
+    paddingHorizontal: 8,
+    paddingVertical: 3,
+    borderRadius: theme.borderRadius.xs,
+    borderWidth: 1,
+  },
+  pillActive: {
+    backgroundColor: theme.colors.successContainer,
+    borderColor: '#86EFAC',
+  },
+  pillSettled: {
+    backgroundColor: theme.colors.surfaceSoft,
+    borderColor: theme.colors.borderDefault,
+  },
+  pillDefault: {
+    backgroundColor: theme.colors.dangerContainer,
+    borderColor: '#FECACA',
+  },
+  heroCard: {
+    padding: theme.spacing.lg,
+    backgroundColor: theme.colors.surface,
+  },
+  progressRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    marginTop: 8,
+    marginBottom: 4,
+  },
+  progressBarBg: {
+    flex: 1,
+    height: 6,
+    borderRadius: 3,
+    backgroundColor: theme.colors.borderDefault,
+    overflow: 'hidden',
+  },
+  progressBarFill: {
+    height: '100%',
+    backgroundColor: theme.colors.actionPrimary,
+    borderRadius: 3,
+  },
+  metricsRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    marginTop: 16,
+    paddingTop: 16,
+    borderTopWidth: 1,
+    borderTopColor: theme.colors.borderDefault,
+  },
+  metricCol: {
+    flex: 1,
+  },
+  metricDivider: {
+    width: 1,
+    height: 32,
+    backgroundColor: theme.colors.borderDefault,
+    marginHorizontal: 8,
+  },
+  btnRow: {
+    flexDirection: 'row',
+    gap: 12,
+    marginVertical: 4,
+  },
+  sectionTitle: {
+    marginTop: 12,
+    fontWeight: '600',
+  },
+  scheduleCard: {
+    padding: 0,
+    overflow: 'hidden',
+    backgroundColor: theme.colors.surface,
+  },
+  scheduleItem: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    padding: 14,
+    borderBottomWidth: 1,
+    borderBottomColor: theme.colors.borderDefault,
+  },
+  scheduleItemLeft: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: 12,
+  },
+  kistBadge: {
+    width: 32,
+    height: 32,
+    borderRadius: 16,
+    backgroundColor: theme.colors.surfaceSoft,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  scheduleItemRight: {
+    alignItems: 'flex-end',
+  },
+  kistStatusPill: {
+    paddingHorizontal: 8,
+    paddingVertical: 2,
+    borderRadius: theme.borderRadius.xs,
+  },
+});
diff --git a/src/app/loan/components/OneTimeLoanView.tsx b/src/app/loan/components/OneTimeLoanView.tsx
new file mode 100644
index 0000000..ce4c688
--- /dev/null
+++ b/src/app/loan/components/OneTimeLoanView.tsx
@@ -0,0 +1,493 @@
+import React, { useState } from 'react';
+import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
+import { SafeAreaView } from 'react-native-safe-area-context';
+import { Typography } from '../../../ui/Typography';
+import { Card } from '../../../ui/Card';
+import { Button } from '../../../ui/Button';
+import { Input } from '../../../ui/Input';
+import { AttachmentGrid } from '../../../ui/AttachmentGrid';
+import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
+import { theme } from '../../../ui/theme';
+import { Loan, LoanTerm, LoanAttachment } from '../../../core/database/loanRepository';
+import { Borrower } from '../../../core/database/borrowerRepository';
+import { formatINR, Paise, toPaise } from '../../../core/domain/money';
+
+export interface OneTimeLoanViewProps {
+  loan: Loan;
+  borrower: Borrower | null;
+  terms: LoanTerm[];
+  earnings: any;
+  history: any[];
+  attachments: LoanAttachment[];
+  previewPenalty: number;
+  onRecordPayment: () => void;
+  onExtendLoan: (months: number, interestCollectedPaise: Paise) => Promise<void>;
+  onCorrectPayment: (tx: any) => void;
+}
+
+export const OneTimeLoanView: React.FC<OneTimeLoanViewProps> = ({
+  loan,
+  borrower,
+  terms,
+  earnings,
+  history,
+  attachments,
+  previewPenalty,
+  onRecordPayment,
+  onExtendLoan,
+  onCorrectPayment,
+}) => {
+  const [extendModalVisible, setExtendModalVisible] = useState(false);
+  const [extendMonths, setExtendMonths] = useState('3');
+  const [interestCollectedInr, setInterestCollectedInr] = useState('');
+  const [isExtending, setIsExtending] = useState(false);
+
+  // Financial figures
+  const principalPaise = loan.principal_paise as Paise;
+  const principalReturned = (earnings?.principalReturned || 0) as Paise;
+  const remainingPrincipal = Math.max(0, principalPaise - principalReturned) as Paise;
+
+  const totalMarkupReceived = (earnings?.markupReceived || 0) as Paise;
+  const outstandingPenalty = ((earnings?.outstandingPenalty || 0) + previewPenalty) as Paise;
+
+  // Active term is the latest term
+  const activeTerm = terms.length > 0 ? terms[terms.length - 1] : null;
+
+  // Calculate monthly interest for active term
+  const activeAnnualRate = activeTerm?.annual_rate ?? loan.annual_rate ?? 24;
+  const monthlyRate = activeAnnualRate / 12 / 100;
+  const monthlyInterestPaise = Math.round(remainingPrincipal * monthlyRate) as Paise;
+
+  const handleConfirmExtend = async () => {
+    const months = parseInt(extendMonths, 10);
+    if (isNaN(months) || months <= 0) {
+      Alert.alert('Invalid Duration', 'Extension duration must be at least 1 month.');
+      return;
+    }
+    const collectedPaise = toPaise(parseFloat(interestCollectedInr) || 0);
+
+    try {
+      setIsExtending(true);
+      await onExtendLoan(months, collectedPaise);
+      setExtendModalVisible(false);
+      setInterestCollectedInr('');
+      Alert.alert('Success', `Bullet loan extended for ${months} additional months.`);
+    } catch (e: any) {
+      Alert.alert('Extension Error', e.message || 'Failed to extend loan');
+    } finally {
+      setIsExtending(false);
+    }
+  };
+
+  // Format ledger history for AuditTimeline
+  const auditEvents: AuditEvent[] = history.map((tx) => {
+    let type: AuditEvent['type'] = 'COLLECTION';
+    if (tx.transaction_type === 'DISBURSEMENT') type = 'DISBURSEMENT';
+    else if (tx.transaction_type === 'PENALTY_ASSESSMENT') type = 'PENALTY_ASSESSMENT';
+    else if (tx.transaction_type === 'REVERSAL') type = 'REVERSAL';
+    else if (tx.transaction_type === 'CORRECTION_REPLACEMENT') type = 'REPLACEMENT';
+
+    return {
+      id: tx.id,
+      type,
+      title: tx.notes || undefined,
+      amountPaise: tx.amount_paise as Paise,
+      effectiveDate: tx.effective_date,
+      principalPaise: tx.allocated_principal_paise !== undefined ? (tx.allocated_principal_paise as Paise) : undefined,
+      interestPaise: tx.allocated_markup_paise !== undefined ? (tx.allocated_markup_paise as Paise) : undefined,
+      penaltyPaise: tx.allocated_penalty_paise !== undefined ? (tx.allocated_penalty_paise as Paise) : undefined,
+      paymentMethod: tx.payment_method || undefined,
+      reason: tx.reason || undefined,
+    };
+  });
+
+  return (
+    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
+      {/* Borrower Header */}
+      <View style={styles.borrowerCard}>
+        <View style={styles.borrowerLeft}>
+          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+            {borrower?.name || 'Borrower'}
+          </Typography>
+          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+            {borrower?.phone} • Bullet Loan (Interest-Only)
+          </Typography>
+        </View>
+
+        <View
+          style={[
+            styles.statusPill,
+            loan.status === 'ACTIVE'
+              ? styles.pillActive
+              : loan.status === 'SETTLED'
+              ? styles.pillSettled
+              : styles.pillDefault,
+          ]}
+        >
+          <Typography
+            variant="labelSm"
+            color={
+              loan.status === 'ACTIVE'
+                ? theme.colors.success
+                : loan.status === 'SETTLED'
+                ? theme.colors.textSecondary
+                : theme.colors.danger
+            }
+          >
+            {loan.status}
+          </Typography>
+        </View>
+      </View>
+
+      {/* Hero Financial Summary */}
+      <Card style={styles.heroCard}>
+        <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
+          PRINCIPAL REPAYABLE AT MATURITY
+        </Typography>
+        <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
+          {formatINR(remainingPrincipal)}
+        </Typography>
+
+        <Typography variant="bodySm" color={theme.colors.textSecondary}>
+          Matures on {activeTerm?.maturity_date || loan.maturity_date || 'N/A'}
+        </Typography>
+
+        {/* 3 Metrics Sub-Row */}
+        <View style={styles.metricsRow}>
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Monthly Interest
+            </Typography>
+            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
+              {formatINR(monthlyInterestPaise)}
+            </Typography>
+          </View>
+
+          <View style={styles.metricDivider} />
+
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Interest Collected
+            </Typography>
+            <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '600', marginTop: 2 }}>
+              {formatINR(totalMarkupReceived)}
+            </Typography>
+          </View>
+
+          <View style={styles.metricDivider} />
+
+          <View style={styles.metricCol}>
+            <Typography variant="labelSm" color={theme.colors.textSecondary}>
+              Penalties Due
+            </Typography>
+            <Typography
+              variant="titleMd"
+              tabularNums
+              color={outstandingPenalty > 0 ? theme.colors.danger : theme.colors.textSecondary}
+              style={{ fontWeight: '600', marginTop: 2 }}
+            >
+              {formatINR(outstandingPenalty)}
+            </Typography>
+          </View>
+        </View>
+      </Card>
+
+      {/* Action Buttons: Record Payment & Extend Loan */}
+      <View style={styles.btnRow}>
+        <View style={{ flex: 1 }}>
+          <Button
+            title="Record Collection"
+            variant="primary"
+            onPress={onRecordPayment}
+          />
+        </View>
+        {loan.status === 'ACTIVE' && (
+          <View style={{ flex: 1 }}>
+            <Button
+              title="Extend Loan"
+              variant="outline"
+              onPress={() => setExtendModalVisible(true)}
+            />
+          </View>
+        )}
+      </View>
+
+      {/* Contract Terms History */}
+      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+        Terms History ({terms.length} {terms.length === 1 ? 'Term' : 'Terms'})
+      </Typography>
+
+      <Card style={styles.termsCard}>
+        {terms.map((term, index) => {
+          const isSettled = term.interest_settled === 1 || term.settled === 1;
+
+          return (
+            <View
+              key={term.id}
+              style={[
+                styles.termRow,
+                index === terms.length - 1 && { borderBottomWidth: 0 },
+              ]}
+            >
+              <View style={styles.termLeft}>
+                <View style={styles.termBadge}>
+                  <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '700' }}>
+                    T{term.term_number}
+                  </Typography>
+                </View>
+                <View>
+                  <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
+                    {term.duration_months} Months @ {term.annual_rate}% p.a.
+                  </Typography>
+                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
+                    {term.start_date} to {term.maturity_date}
+                  </Typography>
+                </View>
+              </View>
+
+              <View style={styles.termRight}>
+                <View style={[styles.settledBadge, isSettled ? styles.settledTrue : styles.settledFalse]}>
+                  <Typography
+                    variant="labelSm"
+                    color={isSettled ? theme.colors.successText : theme.colors.warningText}
+                    style={{ fontWeight: '600' }}
+                  >
+                    {isSettled ? 'Settled' : 'Active'}
+                  </Typography>
+                </View>
+                <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
+                  {formatINR(term.interest_paise as Paise)}
+                </Typography>
+              </View>
+            </View>
+          );
+        })}
+      </Card>
+
+      {/* Physical Collateral Card */}
+      {loan.collateral ? (
+        <Card style={styles.collateralCard}>
+          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 4 }}>
+            COLLATERAL / SECURITY HELD
+          </Typography>
+          <Typography variant="bodyMd" color={theme.colors.textPrimary}>
+            {loan.collateral}
+          </Typography>
+        </Card>
+      ) : null}
+
+      {/* Verified Attachments */}
+      {attachments.length > 0 && (
+        <>
+          <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+            Attached Documents ({attachments.length})
+          </Typography>
+          <AttachmentGrid
+            attachments={attachments.map((a) => ({
+              id: a.id,
+              filePath: a.file_path,
+              docType: (a.doc_type || 'other') as any,
+              fileName: a.file_name,
+            }))}
+            readOnly
+          />
+        </>
+      )}
+
+      {/* Financial Audit Trail */}
+      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
+        Financial Audit Trail
+      </Typography>
+
+      <AuditTimeline events={auditEvents} />
+
+      {/* Extend Loan Modal */}
+      <Modal
+        visible={extendModalVisible}
+        animationType="slide"
+        presentationStyle="pageSheet"
+        onRequestClose={() => setExtendModalVisible(false)}
+      >
+        <SafeAreaView style={styles.modalSafeArea}>
+          <KeyboardAvoidingView
+            style={{ flex: 1 }}
+            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
+          >
+            <View style={styles.modalHeader}>
+              <TouchableOpacity onPress={() => setExtendModalVisible(false)}>
+                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
+                  Cancel
+                </Typography>
+              </TouchableOpacity>
+              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
+                Extend Bullet Loan
+              </Typography>
+              <View style={{ width: 44 }} />
+            </View>
+
+            <View style={{ padding: theme.spacing.lg }}>
+              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700', marginBottom: 6 }}>
+                New Term Extension
+              </Typography>
+              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginBottom: 20 }}>
+                Extending creates a new consecutive contract term and marks previous interest as settled.
+              </Typography>
+
+              <Input
+                label="Extension Duration (Months) *"
+                placeholder="e.g. 3"
+                value={extendMonths}
+                onChangeText={setExtendMonths}
+                keyboardType="number-pad"
+              />
+
+              <Input
+                label="Interest Collected to Settle Current Term (₹)"
+                placeholder="0"
+                value={interestCollectedInr}
+                onChangeText={setInterestCollectedInr}
+                keyboardType="numeric"
+              />
+
+              <View style={{ marginTop: 24 }}>
+                <Button
+                  title="Confirm Extension"
+                  onPress={handleConfirmExtend}
+                  loading={isExtending}
+                  variant="primary"
+                />
+              </View>
+            </View>
+          </KeyboardAvoidingView>
+        </SafeAreaView>
+      </Modal>
+    </ScrollView>
+  );
+};
+
+const styles = StyleSheet.create({
+  container: {
+    flex: 1,
+    backgroundColor: theme.colors.surfaceSoft,
+  },
+  content: {
+    padding: theme.spacing.md,
+    gap: 12,
+    paddingBottom: 40,
+  },
+  borrowerCard: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    paddingVertical: 4,
+  },
+  borrowerLeft: {
+    flex: 1,
+  },
+  statusPill: {
+    paddingHorizontal: 8,
+    paddingVertical: 3,
+    borderRadius: theme.borderRadius.xs,
+    borderWidth: 1,
+  },
+  pillActive: {
+    backgroundColor: theme.colors.successContainer,
+    borderColor: '#86EFAC',
+  },
+  pillSettled: {
+    backgroundColor: theme.colors.surfaceSoft,
+    borderColor: theme.colors.borderDefault,
+  },
+  pillDefault: {
+    backgroundColor: theme.colors.dangerContainer,
+    borderColor: '#FECACA',
+  },
+  heroCard: {
+    padding: theme.spacing.lg,
+    backgroundColor: theme.colors.surface,
+  },
+  metricsRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    marginTop: 16,
+    paddingTop: 16,
+    borderTopWidth: 1,
+    borderTopColor: theme.colors.borderDefault,
+  },
+  metricCol: {
+    flex: 1,
+  },
+  metricDivider: {
+    width: 1,
+    height: 32,
+    backgroundColor: theme.colors.borderDefault,
+    marginHorizontal: 8,
+  },
+  btnRow: {
+    flexDirection: 'row',
+    gap: 12,
+    marginVertical: 4,
+  },
+  sectionTitle: {
+    marginTop: 12,
+    fontWeight: '600',
+  },
+  termsCard: {
+    padding: 0,
+    overflow: 'hidden',
+    backgroundColor: theme.colors.surface,
+  },
+  termRow: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    padding: 14,
+    borderBottomWidth: 1,
+    borderBottomColor: theme.colors.borderDefault,
+  },
+  termLeft: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: 12,
+  },
+  termBadge: {
+    width: 32,
+    height: 32,
+    borderRadius: 16,
+    backgroundColor: theme.colors.surfaceSoft,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  termRight: {
+    alignItems: 'flex-end',
+  },
+  settledBadge: {
+    paddingHorizontal: 8,
+    paddingVertical: 2,
+    borderRadius: theme.borderRadius.xs,
+  },
+  settledTrue: {
+    backgroundColor: theme.colors.successContainer,
+  },
+  settledFalse: {
+    backgroundColor: theme.colors.warningContainer,
+  },
+  collateralCard: {
+    padding: 14,
+    backgroundColor: theme.colors.surface,
+  },
+  modalSafeArea: {
+    flex: 1,
+    backgroundColor: theme.colors.background,
+  },
+  modalHeader: {
+    flexDirection: 'row',
+    justifyContent: 'space-between',
+    alignItems: 'center',
+    paddingHorizontal: theme.spacing.md,
+    paddingVertical: 14,
+    borderBottomWidth: 1,
+    borderBottomColor: theme.colors.borderDefault,
+  },
+});

exec
/bin/bash -lc "git show 62ee653:src/app/loan/\\[id\\].tsx | nl -ba | head -330" in /mnt/f/personal projects/credkeep
 succeeded in 174ms:
     1	import React, { useState, useCallback } from 'react';
     2	import { View, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
     3	import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
     4	import { SafeAreaView } from 'react-native-safe-area-context';
     5	import { Typography } from '../../ui/Typography';
     6	import { Button } from '../../ui/Button';
     7	import { Input } from '../../ui/Input';
     8	import { theme } from '../../ui/theme';
     9	import { useDatabase } from '../../core/database/DatabaseProvider';
    10	import { Loan, LoanTerm, LoanAttachment } from '../../core/database/loanRepository';
    11	import { Borrower } from '../../core/database/borrowerRepository';
    12	import { Paise, toPaise, formatINR } from '../../core/domain/money';
    13	import { MonthlyKistView } from './components/MonthlyKistView';
    14	import { OneTimeLoanView } from './components/OneTimeLoanView';
    15	
    16	export default function LoanDetailsScreen() {
    17	  const router = useRouter();
    18	  const { id } = useLocalSearchParams();
    19	  const { loans, transactions, borrowers, refreshVersion, triggerRefresh } = useDatabase();
    20	
    21	  const [loan, setLoan] = useState<Loan | null>(null);
    22	  const [borrower, setBorrower] = useState<Borrower | null>(null);
    23	  const [schedule, setSchedule] = useState<any[]>([]);
    24	  const [terms, setTerms] = useState<LoanTerm[]>([]);
    25	  const [attachments, setAttachments] = useState<LoanAttachment[]>([]);
    26	  const [history, setHistory] = useState<any[]>([]);
    27	  const [earnings, setEarnings] = useState<any>(null);
    28	  const [previewPenalty, setPreviewPenalty] = useState(0);
    29	
    30	  // Payment correction modal state
    31	  const [correctModalVisible, setCorrectModalVisible] = useState(false);
    32	  const [targetTx, setTargetTx] = useState<any | null>(null);
    33	  const [correctedAmountInr, setCorrectedAmountInr] = useState('');
    34	  const [correctionReason, setCorrectionReason] = useState('Data Entry Error');
    35	  const [isCorrecting, setIsCorrecting] = useState(false);
    36	
    37	  const loadData = useCallback(async () => {
    38	    if (!loans || typeof id !== 'string') return;
    39	    const l = await loans.getById(id);
    40	    setLoan(l);
    41	    if (!l) return;
    42	
    43	    if (borrowers) {
    44	      const b = await borrowers.getById(l.borrower_id);
    45	      setBorrower(b);
    46	    }
    47	
    48	    const atts = await loans.getAttachments(l.id);
    49	    setAttachments(atts);
    50	
    51	    if (l.product_type === 'bullet') {
    52	      const t = await loans.getLoanTerms(l.id);
    53	      setTerms(t);
    54	    } else {
    55	      const s = await loans.getSchedule(l.id);
    56	      setSchedule(s);
    57	    }
    58	
    59	    if (transactions) {
    60	      const summary = await transactions.getEarningsSummary({ loanId: l.id });
    61	      setEarnings(summary);
    62	
    63	      const today = new Date().toISOString().split('T')[0];
    64	      const pen = await transactions.previewPenalties(l.id, today);
    65	      setPreviewPenalty(pen);
    66	
    67	      const allTx = await (loans as any).db.getAllAsync(
    68	        `SELECT * FROM transactions WHERE loan_id = ? ORDER BY effective_date DESC, created_at DESC`,
    69	        [l.id]
    70	      );
    71	      setHistory(allTx || []);
    72	    }
    73	  }, [id, loans, borrowers, transactions, refreshVersion]);
    74	
    75	  useFocusEffect(
    76	    useCallback(() => {
    77	      loadData();
    78	    }, [loadData])
    79	  );
    80	
    81	  if (!loan) {
    82	    return (
    83	      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
    84	        <Stack.Screen options={{ title: 'Loan Details', headerShown: true }} />
    85	        <View style={styles.loadingContainer}>
    86	          <Typography variant="bodyMd" color={theme.colors.textSecondary}>Loading contract details...</Typography>
    87	        </View>
    88	      </SafeAreaView>
    89	    );
    90	  }
    91	
    92	  const handleRecordPayment = () => {
    93	    router.push({
    94	      pathname: '/collections',
    95	      params: { borrowerId: loan.borrower_id, loanId: loan.id },
    96	    } as any);
    97	  };
    98	
    99	  const handleExtendLoan = async (months: number, interestCollectedPaise: Paise) => {
   100	    if (!loans) return;
   101	    await loans.extendBulletLoan(loan.id, months, interestCollectedPaise);
   102	    triggerRefresh();
   103	    await loadData();
   104	  };
   105	
   106	  const handleOpenCorrect = (tx: any) => {
   107	    setTargetTx(tx);
   108	    setCorrectedAmountInr((tx.amount_paise / 100).toString());
   109	    setCorrectModalVisible(true);
   110	  };
   111	
   112	  const handleConfirmCorrect = async () => {
   113	    if (!targetTx || !transactions) return;
   114	    const newPaise = toPaise(parseFloat(correctedAmountInr) || 0);
   115	    if (newPaise <= 0) {
   116	      Alert.alert('Invalid Amount', 'Corrected amount must be greater than zero.');
   117	      return;
   118	    }
   119	
   120	    try {
   121	      setIsCorrecting(true);
   122	      await transactions.correctPayment(
   123	        targetTx.id,
   124	        newPaise,
   125	        correctionReason
   126	      );
   127	      setCorrectModalVisible(false);
   128	      triggerRefresh();
   129	      await loadData();
   130	      Alert.alert('Payment Corrected', 'Transaction safely reversed and re-allocated in append-only ledger.');
   131	    } catch (e: any) {
   132	      Alert.alert('Correction Error', e.message || 'Failed to correct payment');
   133	    } finally {
   134	      setIsCorrecting(false);
   135	    }
   136	  };
   137	
   138	  const productTitle = loan.product_type === 'bullet' ? 'Bullet Loan' : 'Monthly Kist';
   139	
   140	  return (
   141	    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
   142	      <Stack.Screen
   143	        options={{
   144	          title: `${productTitle} • ${borrower?.name || ''}`,
   145	          headerShown: true,
   146	          headerTintColor: theme.colors.textPrimary,
   147	          headerStyle: { backgroundColor: theme.colors.background },
   148	        }}
   149	      />
   150	
   151	      {loan.product_type === 'bullet' ? (
   152	        <OneTimeLoanView
   153	          loan={loan}
   154	          borrower={borrower}
   155	          terms={terms}
   156	          earnings={earnings}
   157	          history={history}
   158	          attachments={attachments}
   159	          previewPenalty={previewPenalty}
   160	          onRecordPayment={handleRecordPayment}
   161	          onExtendLoan={handleExtendLoan}
   162	          onCorrectPayment={handleOpenCorrect}
   163	        />
   164	      ) : (
   165	        <MonthlyKistView
   166	          loan={loan}
   167	          borrower={borrower}
   168	          schedule={schedule}
   169	          earnings={earnings}
   170	          history={history}
   171	          attachments={attachments}
   172	          onRecordPayment={handleRecordPayment}
   173	          onCorrectPayment={handleOpenCorrect}
   174	        />
   175	      )}
   176	
   177	      {/* Payment Correction Modal */}
   178	      <Modal
   179	        visible={correctModalVisible}
   180	        animationType="slide"
   181	        presentationStyle="pageSheet"
   182	        onRequestClose={() => setCorrectModalVisible(false)}
   183	      >
   184	        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
   185	          <KeyboardAvoidingView
   186	            style={{ flex: 1 }}
   187	            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
   188	          >
   189	            <View style={styles.modalHeader}>
   190	              <TouchableOpacity onPress={() => setCorrectModalVisible(false)}>
   191	                <Typography variant="bodyMd" color={theme.colors.textSecondary}>
   192	                  Cancel
   193	                </Typography>
   194	              </TouchableOpacity>
   195	              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
   196	                Payment Correction
   197	              </Typography>
   198	              <View style={{ width: 44 }} />
   199	            </View>
   200	
   201	            <View style={{ padding: theme.spacing.lg }}>
   202	              <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700', marginBottom: 6 }}>
   203	                Append-Only Correction
   204	              </Typography>
   205	              <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginBottom: 20 }}>
   206	                This will append a reversal transaction for the original amount ({targetTx ? formatINR(targetTx.amount_paise) : ''}) and post a corrected payment with recalculated waterfall allocations.
   207	              </Typography>
   208	
   209	              <Input
   210	                label="Corrected Amount (₹) *"
   211	                placeholder="Enter exact amount"
   212	                value={correctedAmountInr}
   213	                onChangeText={setCorrectedAmountInr}
   214	                keyboardType="numeric"
   215	              />
   216	
   217	              <Input
   218	                label="Audit Reason *"
   219	                placeholder="e.g. Data entry error, miscalculated cash"
   220	                value={correctionReason}
   221	                onChangeText={setCorrectionReason}
   222	              />
   223	
   224	              <View style={{ marginTop: 24 }}>
   225	                <Button
   226	                  title="Confirm & Append Correction"
   227	                  onPress={handleConfirmCorrect}
   228	                  loading={isCorrecting}
   229	                  variant="primary"
   230	                />
   231	              </View>
   232	            </View>
   233	          </KeyboardAvoidingView>
   234	        </SafeAreaView>
   235	      </Modal>
   236	    </SafeAreaView>
   237	  );
   238	}
   239	
   240	const styles = StyleSheet.create({
   241	  safeArea: {
   242	    flex: 1,
   243	    backgroundColor: theme.colors.background,
   244	  },
   245	  loadingContainer: {
   246	    flex: 1,
   247	    alignItems: 'center',
   248	    justifyContent: 'center',
   249	  },
   250	  modalHeader: {
   251	    flexDirection: 'row',
   252	    justifyContent: 'space-between',
   253	    alignItems: 'center',
   254	    padding: theme.spacing.md,
   255	    borderBottomWidth: 1,
   256	    borderBottomColor: theme.colors.borderDefault,
   257	  },
   258	});

exec
/bin/bash -lc "git diff 9258311...62ee653 -- 'src/app/(tabs)/collections.tsx' | head -300" in /mnt/f/personal projects/credkeep
 succeeded in 233ms:
diff --git a/src/app/(tabs)/collections.tsx b/src/app/(tabs)/collections.tsx
index f552ef3..39f7f9b 100644
--- a/src/app/(tabs)/collections.tsx
+++ b/src/app/(tabs)/collections.tsx
@@ -1,9 +1,14 @@
-import React, { useState, useEffect, useCallback, useMemo } from 'react';
-import { View, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
+import React, { useState, useCallback, useMemo } from 'react';
+import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
-import { useRouter } from 'expo-router';
+import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
+import { ChevronRight, Phone } from 'lucide-react-native';
 import { Typography } from '../../ui/Typography';
 import { Card } from '../../ui/Card';
+import { Button } from '../../ui/Button';
+import { Input } from '../../ui/Input';
+import { MoneyInput } from '../../ui/MoneyInput';
+import { EmptyState } from '../../ui/Feedback';
 import { theme } from '../../ui/theme';
 import { useDatabase } from '../../core/database/DatabaseProvider';
 import { Loan } from '../../core/database/loanRepository';
@@ -23,21 +28,36 @@ interface CollectionLoanItem {
 
 export default function CollectionsScreen() {
   const router = useRouter();
-  const { loans, borrowers, transactions, refreshVersion } = useDatabase();
+  const params = useLocalSearchParams();
+  const { loans, borrowers, transactions, refreshVersion, triggerRefresh } = useDatabase();
+
   const [collectionItems, setCollectionItems] = useState<CollectionLoanItem[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
-  const [loading, setLoading] = useState(true);
+  const [filterType, setFilterType] = useState<'ALL' | 'OVERDUE' | 'TODAY'>('ALL');
+  const [refreshing, setRefreshing] = useState(false);
+
+  // Quick Payment Modal
+  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
+  const [activeItem, setActiveItem] = useState<CollectionLoanItem | null>(null);
+  const [collectAmountPaise, setCollectAmountPaise] = useState<Paise>(0 as Paise);
+  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK'>('CASH');
+  const [isRecording, setIsRecording] = useState(false);
+
+  const openPaymentModal = useCallback((item: CollectionLoanItem) => {
+    setActiveItem(item);
+    setCollectAmountPaise((item.amountCurrentlyDuePaise || item.remainingBalancePaise) as Paise);
+    setPaymentModalVisible(true);
+  }, []);
 
   const loadCollections = useCallback(async () => {
     if (!loans || !borrowers || !transactions) return;
     try {
-      setLoading(true);
       const allLoans = await loans.getAll();
       const allBorrowers = await borrowers.getAll();
       const borrowerMap = new Map<string, Borrower>();
-      allBorrowers.forEach(b => borrowerMap.set(b.id, b));
+      allBorrowers.forEach((b) => borrowerMap.set(b.id, b));
 
-      const activeLoans = allLoans.filter(l => l.status === 'ACTIVE');
+      const activeLoans = allLoans.filter((l) => l.status === 'ACTIVE');
       const today = new Date().toISOString().split('T')[0];
 
       const items: CollectionLoanItem[] = [];
@@ -48,7 +68,7 @@ export default function CollectionsScreen() {
         const borrowerPhone = borrower?.phone || '';
 
         const isBullet = loan.product_type === 'bullet';
-        const productLabel = isBullet ? 'One-Time Repayment' : 'Monthly Kist';
+        const productLabel = isBullet ? 'Bullet Loan' : 'Monthly Kist';
 
         let remainingBalancePaise = loan.principal_paise;
         let amountCurrentlyDuePaise = 0;
@@ -72,8 +92,9 @@ export default function CollectionsScreen() {
           if (isOverdue) {
             amountCurrentlyDuePaise = unpaidPrincipal + unpaidInterest + penalties;
           } else {
-            // Due on maturity
-            amountCurrentlyDuePaise = unpaidInterest;
+            // Due monthly interest
+            const activeRate = (terms.length > 0 ? terms[terms.length - 1].annual_rate : loan.annual_rate) || 24;
+            amountCurrentlyDuePaise = Math.round(unpaidPrincipal * (activeRate / 12 / 100));
           }
         } else {
           // Monthly Kist
@@ -82,25 +103,27 @@ export default function CollectionsScreen() {
           const unpaidPrincipal = Math.max(0, loan.principal_paise - earnings.principalReturned);
           remainingBalancePaise = unpaidPrincipal;
 
-          // Find earliest unpaid kist
           const unpaidKists = (schedule as any[]).filter((k: any) => k.status !== 'PAID');
           if (unpaidKists.length > 0) {
             nextDueOrMaturityDate = unpaidKists[0].effective_due_date;
             isOverdue = unpaidKists.some((k: any) => k.effective_due_date < today);
 
-            // Amount currently due = all due kists past or on today + penalties
             const dueKists = unpaidKists.filter((k: any) => k.effective_due_date <= today);
             if (dueKists.length > 0) {
-              const duePaise = dueKists.reduce((acc: number, k: any) => acc + ((k.total_due_paise || 0) - ((k.principal_paid_paise || 0) + (k.markup_paid_paise || 0))), 0);
+              const duePaise = dueKists.reduce(
+                (acc: number, k: any) =>
+                  acc +
+                  ((k.total_due_paise || 0) -
+                    ((k.principal_paid_paise || 0) + (k.markup_paid_paise || 0))),
+                0
+              );
               amountCurrentlyDuePaise = duePaise + earnings.outstandingPenalty;
             } else {
-              // Next upcoming kist amount
               const nextKist = unpaidKists[0];
-              amountCurrentlyDuePaise = ((nextKist.total_due_paise || 0) - ((nextKist.principal_paid_paise || 0) + (nextKist.markup_paid_paise || 0)));
+              amountCurrentlyDuePaise =
+                (nextKist.total_due_paise || 0) -
+                ((nextKist.principal_paid_paise || 0) + (nextKist.markup_paid_paise || 0));
             }
-          } else {
-            nextDueOrMaturityDate = '-';
-            amountCurrentlyDuePaise = 0;
           }
         }
 
@@ -117,179 +140,427 @@ export default function CollectionsScreen() {
       }
 
       setCollectionItems(items);
-    } finally {
-      setLoading(false);
+
+      // Auto-open modal if loanId / borrowerId passed in params
+      if (params.loanId) {
+        const target = items.find((it) => it.loan.id === params.loanId);
+        if (target) {
+          openPaymentModal(target);
+        }
+      }
+    } catch {
+      // Suppress read errors
     }
-  }, [loans, borrowers, transactions]);
+  }, [loans, borrowers, transactions, params.loanId, openPaymentModal, refreshVersion]);
 
-  useEffect(() => {
-    loadCollections();
-  }, [loadCollections, refreshVersion]);
+  useFocusEffect(
+    useCallback(() => {
+      loadCollections();
+    }, [loadCollections])
+  );
+
+  const onRefresh = async () => {
+    setRefreshing(true);
+    await loadCollections();
+    setRefreshing(false);
+  };
+
+  const handleRecordPayment = async () => {
+    if (!activeItem || !transactions) return;
+    if (collectAmountPaise <= 0) {
+      Alert.alert('Invalid Amount', 'Payment amount must be greater than zero.');
+      return;
+    }
+
+    try {
+      setIsRecording(true);
+      const opId = 'col_' + Date.now();
+      const today = new Date().toISOString().split('T')[0];
+
+      await transactions.recordCashPayment(
+        activeItem.loan.id,
+        collectAmountPaise,
+        opId,
+        today
+      );
+
+      setPaymentModalVisible(false);
+      triggerRefresh();
+      await loadCollections();
+      Alert.alert('Payment Recorded', `Successfully recorded ${formatINR(collectAmountPaise)} collection.`);
+    } catch (e: any) {
+      Alert.alert('Payment Failed', e.message || 'Failed to record collection');
+    } finally {
+      setIsRecording(false);
+    }
+  };
 
   const filteredItems = useMemo(() => {
-    if (!searchQuery.trim()) return collectionItems;
-    const q = searchQuery.toLowerCase().trim();
-    return collectionItems.filter(item =>
-      item.borrowerName.toLowerCase().includes(q) ||
-      item.borrowerPhone.includes(q) ||
-      item.productLabel.toLowerCase().includes(q) ||
-      item.loan.id.toLowerCase().includes(q)
-    );
-  }, [collectionItems, searchQuery]);
+    const today = new Date().toISOString().split('T')[0];
+    return collectionItems.filter((item) => {
+      // Filter tab
+      if (filterType === 'OVERDUE' && !item.isOverdue) return false;
+      if (filterType === 'TODAY' && item.nextDueOrMaturityDate !== today) return false;
+
+      // Search query
+      if (searchQuery.trim()) {
+        const q = searchQuery.toLowerCase().trim();
+        return (
+          item.borrowerName.toLowerCase().includes(q) ||
+          item.borrowerPhone.includes(q) ||
+          item.productLabel.toLowerCase().includes(q)
+        );
+      }
+      return true;
+    });
+  }, [collectionItems, filterType, searchQuery]);
 
   return (
     <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
+      {/* Header */}
       <View style={styles.header}>
-        <Typography variant="headlineMd" color={theme.colors.onPrimary}>
-          Collections
-        </Typography>
-        <Typography variant="bodySm" color={theme.colors.onPrimaryContainer} style={{ marginTop: 2 }}>
-          {filteredItems.length} active loans for collection
-        </Typography>
+        <View>
+          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+            Collections
+          </Typography>
+          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+            {collectionItems.length} active loans • Passbook collection
+          </Typography>
+        </View>
       </View>
 
+      {/* Search & Filter Tabs */}
       <View style={styles.searchContainer}>
-        <TextInput
-          style={styles.searchInput}
-          placeholder="Search borrower by name or phone..."
-          placeholderTextColor={theme.colors.textSecondary}
+        <Input
+          placeholder="Search by borrower name or phone..."
           value={searchQuery}
           onChangeText={setSearchQuery}
+          autoCapitalize="none"
         />
+
+        <View style={styles.filterRow}>
+          {(['ALL', 'OVERDUE', 'TODAY'] as const).map((filter) => {
+            const isSelected = filterType === filter;
+            return (
+              <TouchableOpacity
+                key={filter}
+                style={[styles.filterChip, isSelected && styles.filterChipActive]}
+                onPress={() => setFilterType(filter)}
+                activeOpacity={0.7}
+              >
+                <Typography
+                  variant="labelSm"
+                  color={isSelected ? theme.colors.actionPrimary : theme.colors.textSecondary}
+                  style={{ fontWeight: isSelected ? '700' : '500' }}
+                >
+                  {filter === 'ALL' ? 'All Loans' : filter === 'OVERDUE' ? 'Overdue' : 'Due Today'}
+                </Typography>
+              </TouchableOpacity>
+            );
+          })}
+        </View>
       </View>
 
+      {/* Collection Cards List */}
       <FlatList
         data={filteredItems}
-        keyExtractor={item => item.loan.id}
+        keyExtractor={(item) => item.loan.id}
         contentContainerStyle={styles.listContent}
+        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
         renderItem={({ item }) => (
-          <TouchableOpacity
-            activeOpacity={0.7}
-            onPress={() => router.push(`/loan/${item.loan.id}`)}
-          >
-            <Card elevated style={[styles.loanCard, item.isOverdue && styles.overdueCard]}>
-              <View style={styles.cardHeader}>
-                <View style={{ flex: 1 }}>
-                  <Typography variant="headlineSm">{item.borrowerName}</Typography>
-                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
-                    {item.borrowerPhone}
-                  </Typography>
-                </View>
-                <View style={[styles.badge, item.isOverdue ? styles.badgeOverdue : styles.badgeActive]}>
-                  <Typography variant="labelSm" color={item.isOverdue ? '#fff' : theme.colors.primary}>
-                    {item.isOverdue ? 'OVERDUE' : 'CURRENT'}
+          <Card style={[styles.loanCard, item.isOverdue && styles.cardOverdue]}>
+            <View style={styles.cardTopRow}>
+              <View style={{ flex: 1 }}>
+                <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+                  {item.borrowerName}
+                </Typography>

exec
/bin/bash -lc "git show 62ee653:src/core/database/loanRepository.ts | nl -ba | sed -n '1,390p'" in /mnt/f/personal projects/credkeep
 succeeded in 156ms:
     1	import { SQLiteDatabase } from 'expo-sqlite';
     2	import * as crypto from 'expo-crypto';
     3	import { ScheduleOptions, generateSchedule, calculateNextDueDate, calculateContractInterest, calculateMaturityDate } from '../domain/schedule';
     4	import { multiplyPaise, Paise } from '../domain/money';
     5	import { OutboxManager } from '../sync/outbox';
     6	import { SyncCoordinator } from '../sync/syncCoordinator';
     7	import { withDbTransaction } from './transaction';
     8	
     9	export type Loan = {
    10	  id: string;
    11	  borrower_id: string;
    12	  principal_paise: number;
    13	  markup_factor: number;
    14	  annual_rate?: number | null;
    15	  rate_basis?: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM' | null;
    16	  interest_paise?: number | null;
    17	  total_paise?: number | null;
    18	  maturity_date?: string | null;
    19	  term_months: number;
    20	  start_date: string;
    21	  due_day: number;
    22	  product_type: string;
    23	  status: string;
    24	  collateral?: string | null;
    25	  created_at: string;
    26	};
    27	
    28	export type LoanTerm = {
    29	  id: string;
    30	  loan_id: string;
    31	  term_number: number;
    32	  duration_months: number;
    33	  annual_rate: number;
    34	  interest_paise: number;
    35	  start_date: string;
    36	  maturity_date: string;
    37	  interest_settled: number;
    38	  settled?: number;
    39	  operation_id?: string | null;
    40	  created_at: string;
    41	};
    42	
    43	export type LoanAttachmentInput = {
    44	  uri?: string;
    45	  file_path?: string;
    46	  doc_type: string;
    47	  notes?: string;
    48	};
    49	
    50	export interface CreateLoanOptions extends ScheduleOptions {
    51	  attachments?: LoanAttachmentInput[];
    52	}
    53	
    54	export type LoanAttachment = {
    55	  id: string;
    56	  loan_id: string;
    57	  file_path: string;
    58	  file_name?: string;
    59	  doc_type: string;
    60	  document_type?: string;
    61	  notes?: string | null;
    62	  synced: number;
    63	  sync_status?: string;
    64	  created_at: string;
    65	};
    66	
    67	function generateUuid(): string {
    68	  try {
    69	    if (crypto && typeof crypto.randomUUID === 'function') {
    70	      const id = crypto.randomUUID();
    71	      if (id) return id;
    72	    }
    73	  } catch {}
    74	  try {
    75	    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    76	      const id = globalThis.crypto.randomUUID();
    77	      if (id) return id;
    78	    }
    79	  } catch {}
    80	  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    81	    const r = (Math.random() * 16) | 0;
    82	    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    83	    return v.toString(16);
    84	  });
    85	}
    86	
    87	export class LoanRepository {
    88	  constructor(private db: SQLiteDatabase) {}
    89	
    90	  async createLoanWithSchedule(
    91	    borrowerId: string, 
    92	    options: CreateLoanOptions,
    93	    clientOpId?: string
    94	  ): Promise<Loan> {
    95	    let resolvedLoan: Loan | null = null;
    96	    const loanId = generateUuid();
    97	    const created_at = new Date().toISOString();
    98	    
    99	    const annualRate = options.annualRate ?? (options.markupFactor ? Math.round(options.markupFactor * 100 * 12 / (options.termMonths || 1)) : 0);
   100	    const rateBasis = options.rateBasis || (options.annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM');
   101	    const interestPaise = (rateBasis === 'ANNUAL_SIMPLE_FLAT' || options.annualRate !== undefined)
   102	      ? calculateContractInterest(options.principal, annualRate, options.termMonths)
   103	      : multiplyPaise(options.principal as Paise, options.markupFactor || 0);
   104	    const totalPaise = options.principal + interestPaise;
   105	    const maturityDate = calculateMaturityDate(options.startDate, options.termMonths, options.dueDay);
   106	
   107	    const schedule = generateSchedule({
   108	      ...options,
   109	      annualRate,
   110	      rateBasis,
   111	    });
   112	
   113	    await withDbTransaction(this.db, async (tx) => {
   114	      const txHandle = tx || this.db;
   115	
   116	      if (clientOpId) {
   117	        const existingOutbox = await txHandle.getFirstAsync<any>(
   118	          `SELECT status, error_message, payload FROM sync_outbox WHERE operation_id = ?`,
   119	          [clientOpId]
   120	        );
   121	        if (existingOutbox) {
   122	          if (existingOutbox.status === 'REJECTED') {
   123	            throw new Error(
   124	              `Loan creation operation ${clientOpId} was rejected: ${existingOutbox.error_message || 'Terminal rejection'}`
   125	            );
   126	          }
   127	          let parsed: any;
   128	          try {
   129	            parsed = JSON.parse(existingOutbox.payload);
   130	          } catch {
   131	            parsed = {};
   132	          }
   133	          if (
   134	            parsed.borrower_id !== borrowerId ||
   135	            parsed.principal_paise !== options.principal ||
   136	            parsed.term_months !== options.termMonths ||
   137	            parsed.start_date !== options.startDate ||
   138	            parsed.due_day !== options.dueDay ||
   139	            parsed.product_type !== options.productType
   140	          ) {
   141	            throw new Error(`Idempotency conflict: operation_id ${clientOpId} already exists with different loan attributes.`);
   142	          }
   143	          const existingLoan = await txHandle.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [parsed.id]);
   144	          if (existingLoan) {
   145	            resolvedLoan = existingLoan;
   146	            return;
   147	          }
   148	        }
   149	      }
   150	
   151	      await txHandle.runAsync(
   152	        `INSERT INTO loans (
   153	          id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,
   154	          interest_paise, total_paise, maturity_date, term_months, start_date, due_day,
   155	          product_type, collateral, created_at
   156	        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   157	        [
   158	          loanId,
   159	          borrowerId,
   160	          options.principal,
   161	          options.markupFactor || 0,
   162	          annualRate,
   163	          rateBasis,
   164	          interestPaise,
   165	          totalPaise,
   166	          maturityDate,
   167	          options.termMonths,
   168	          options.startDate,
   169	          options.dueDay,
   170	          options.productType,
   171	          options.collateral || null,
   172	          created_at,
   173	        ]
   174	      );
   175	
   176	      // If bullet with ANNUAL_SIMPLE_FLAT, insert term 1 into loan_terms
   177	      if (options.productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
   178	        await txHandle.runAsync(
   179	          `INSERT INTO loan_terms (
   180	            id, loan_id, term_number, duration_months, annual_rate, interest_paise,
   181	            start_date, maturity_date, interest_settled, settled, operation_id, created_at
   182	          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   183	          [
   184	            generateUuid(),
   185	            loanId,
   186	            1,
   187	            options.termMonths,
   188	            annualRate,
   189	            interestPaise,
   190	            options.startDate,
   191	            maturityDate,
   192	            0,
   193	            0,
   194	            clientOpId || null,
   195	            created_at,
   196	          ]
   197	        );
   198	      }
   199	      
   200	      if (schedule.length > 0) {
   201	        const statement = await txHandle.prepareAsync(`
   202	          INSERT INTO repayment_schedules 
   203	          (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
   204	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   205	        `);
   206	        
   207	        try {
   208	          for (const kist of schedule) {
   209	            await statement.executeAsync([
   210	              generateUuid(),
   211	              loanId,
   212	              kist.kistNumber,
   213	              kist.dueDate,
   214	              kist.dueDate,
   215	              kist.principalDue || 0,
   216	              kist.markupDue || 0,
   217	              kist.amountDue
   218	            ]);
   219	          }
   220	        } finally {
   221	          await statement.finalizeAsync();
   222	        }
   223	      }
   224	
   225	      if (options.attachments && options.attachments.length > 0) {
   226	        for (const att of options.attachments) {
   227	          const attPath = att.file_path || att.uri || '';
   228	          const fileName = attPath.split('/').pop()?.split('\\').pop() || 'attachment';
   229	          const attId = generateUuid();
   230	          await txHandle.runAsync(
   231	            `INSERT INTO loan_attachments (
   232	              id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
   233	            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'LOCAL_ONLY', ?)`,
   234	            [
   235	              attId,
   236	              loanId,
   237	              attPath,
   238	              fileName,
   239	              att.doc_type,
   240	              att.doc_type,
   241	              att.notes || null,
   242	              created_at,
   243	            ]
   244	          );
   245	
   246	          await OutboxManager.enqueue(txHandle, {
   247	            operationId: `att-${attId}`,
   248	            operationType: 'upload_attachment_metadata',
   249	            payload: {
   250	              id: attId,
   251	              loan_id: loanId,
   252	              file_path: attPath,
   253	              file_name: fileName,
   254	              doc_type: att.doc_type,
   255	              document_type: att.doc_type,
   256	              notes: att.notes || null,
   257	            },
   258	          });
   259	        }
   260	      }
   261	
   262	      await OutboxManager.enqueue(txHandle, {
   263	        operationId: clientOpId,
   264	        operationType: 'create_loan',
   265	        payload: {
   266	          id: loanId,
   267	          borrower_id: borrowerId,
   268	          principal_paise: options.principal,
   269	          markup_factor: options.markupFactor || 0,
   270	          annual_rate: annualRate,
   271	          rate_basis: rateBasis,
   272	          interest_paise: interestPaise,
   273	          total_paise: totalPaise,
   274	          maturity_date: maturityDate,
   275	          term_months: options.termMonths,
   276	          start_date: options.startDate,
   277	          due_day: options.dueDay,
   278	          product_type: options.productType,
   279	          collateral: options.collateral || null,
   280	        },
   281	      });
   282	    });
   283	
   284	    SyncCoordinator.notifyMutation();
   285	
   286	    if (resolvedLoan) {
   287	      return resolvedLoan;
   288	    }
   289	
   290	    return (await this.getById(loanId))!;
   291	  }
   292	
   293	  async getAll(): Promise<Loan[]> {
   294	    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans ORDER BY created_at DESC`);
   295	  }
   296	  
   297	  async getByBorrowerId(borrowerId: string): Promise<Loan[]> {
   298	    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans WHERE borrower_id = ? ORDER BY created_at DESC`, [borrowerId]);
   299	  }
   300	
   301	  async getById(id: string): Promise<Loan | null> {
   302	    return await this.db.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [id]);
   303	  }
   304	  
   305	  async getSchedule(loanId: string) {
   306	    await this.extendScheduleIfNeeded(loanId);
   307	    return await this.db.getAllAsync(`
   308	      SELECT * FROM repayment_schedules 
   309	      WHERE loan_id = ? 
   310	      ORDER BY installment_number ASC
   311	    `, [loanId]);
   312	  }
   313	
   314	  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
   315	    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   316	    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE' || loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') return;
   317	
   318	    const kists = await tx.getAllAsync(`
   319	      SELECT * FROM repayment_schedules 
   320	      WHERE loan_id = ? 
   321	      ORDER BY installment_number ASC
   322	    `, [loanId]);
   323	    
   324	    if (kists.length === 0) return;
   325	    const lastKist = kists[kists.length - 1];
   326	    const currentDate = new Date().toISOString().split('T')[0];
   327	    
   328	    // If the last kist's due date is in the past, generate new ones until we pass currentDate
   329	    if (lastKist.effective_due_date < currentDate) {
   330	      const totalMarkup = multiplyPaise(loan.principal_paise as Paise, loan.markup_factor);
   331	      const markupDuePerMonth = Math.floor(totalMarkup / loan.term_months);
   332	      
   333	      let nextInstalmentNumber = lastKist.installment_number + 1;
   334	      let monthsToAddFromStart = nextInstalmentNumber;
   335	      
   336	      let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
   337	      
   338	      const statement = await tx.prepareAsync(`
   339	        INSERT INTO repayment_schedules 
   340	        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
   341	        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   342	      `);
   343	      
   344	      try {
   345	        while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1) {
   346	          const kistId = generateUuid();
   347	          await statement.executeAsync([
   348	            kistId,
   349	            loanId,
   350	            nextInstalmentNumber,
   351	            nextDueDate,
   352	            nextDueDate,
   353	            0,
   354	            markupDuePerMonth,
   355	            markupDuePerMonth
   356	          ]);
   357	          
   358	          if (nextDueDate > currentDate) break;
   359	          
   360	          nextInstalmentNumber++;
   361	          monthsToAddFromStart++;
   362	          nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
   363	        }
   364	      } finally {
   365	        await statement.finalizeAsync();
   366	      }
   367	    }
   368	  }
   369	
   370	  async getLoanTerms(loanId: string): Promise<LoanTerm[]> {
   371	    return await this.db.getAllAsync<LoanTerm>(
   372	      `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
   373	      [loanId]
   374	    );
   375	  }
   376	
   377	  async extendBulletLoan(
   378	    loanId: string,
   379	    additionalMonths: number,
   380	    interestCollectedPaise: number,
   381	    clientOpId?: string
   382	  ): Promise<{ loan: Loan; term: LoanTerm }> {
   383	    const opId = clientOpId || generateUuid();
   384	
   385	    // Idempotency pre-check
   386	    if (clientOpId) {
   387	      const existingOutbox = await this.db.getFirstAsync<any>(
   388	        `SELECT * FROM sync_outbox WHERE operation_id = ?`,
   389	        [clientOpId]
   390	      );

exec
/bin/bash -lc 'git show 62ee653:src/core/domain/schedule.ts | nl -ba | head -260; git show 62ee653:src/ui/MoneyInput.tsx | head -115; git log --oneline 9258311..62ee653' in /mnt/f/personal projects/credkeep
 succeeded in 334ms:
     1	import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
     2	import { ScheduledKist } from './models';
     3	
     4	export type RateBasis = 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';
     5	
     6	export type ScheduleOptions = {
     7	  principal: Paise;
     8	  annualRate?: number;
     9	  rateBasis?: RateBasis;
    10	  markupFactor?: number;
    11	  termMonths: number;
    12	  startDate: string; // YYYY-MM-DD
    13	  dueDay: number; // 1-31
    14	  productType: 'instalment' | 'bullet';
    15	  collateral?: string | null;
    16	};
    17	
    18	function getDaysInMonth(year: number, month: number): number {
    19	  return new Date(year, month, 0).getDate();
    20	}
    21	
    22	export function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
    23	  const [yearStr, monthStr] = startDateStr.split('-');
    24	  let year = parseInt(yearStr, 10);
    25	  let month = parseInt(monthStr, 10);
    26	  
    27	  month += monthsToAdd;
    28	  
    29	  while (month > 12) {
    30	    month -= 12;
    31	    year += 1;
    32	  }
    33	  
    34	  const daysInMonth = getDaysInMonth(year, month);
    35	  const finalDay = Math.min(targetDueDay, daysInMonth);
    36	  
    37	  const yyyy = year.toString();
    38	  const mm = month.toString().padStart(2, '0');
    39	  const dd = finalDay.toString().padStart(2, '0');
    40	  
    41	  return `${yyyy}-${mm}-${dd}`;
    42	}
    43	
    44	export function calculateMaturityDate(startDateStr: string, termMonths: number, targetDueDay: number): string {
    45	  return calculateNextDueDate(startDateStr, termMonths, targetDueDay);
    46	}
    47	
    48	export function calculateContractInterest(
    49	  principal: Paise,
    50	  annualRate: number,
    51	  termMonths: number
    52	): Paise {
    53	  if (annualRate < 0 || termMonths <= 0) {
    54	    throw new Error('annualRate and termMonths must be non-negative');
    55	  }
    56	  // Formula: Interest = Principal × AnnualRate × DurationMonths / 1200
    57	  return Math.round((principal * annualRate * termMonths) / 1200) as Paise;
    58	}
    59	
    60	export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
    61	  const {
    62	    principal,
    63	    annualRate,
    64	    rateBasis = (annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM'),
    65	    markupFactor = 0,
    66	    termMonths,
    67	    startDate,
    68	    dueDay,
    69	    productType
    70	  } = options;
    71	
    72	  if (termMonths <= 0) {
    73	    throw new Error('termMonths must be a positive integer');
    74	  }
    75	
    76	  // ONE-TIME REPAYMENT (Bullet): NO monthly kists are generated.
    77	  if (productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
    78	    return [];
    79	  }
    80	
    81	  let totalMarkup: Paise;
    82	  if (rateBasis === 'ANNUAL_SIMPLE_FLAT' && annualRate !== undefined) {
    83	    totalMarkup = calculateContractInterest(principal, annualRate, termMonths);
    84	  } else {
    85	    if (!Number.isFinite(markupFactor) || markupFactor < 0) {
    86	      throw new Error('markupFactor must be a finite non-negative number');
    87	    }
    88	    totalMarkup = multiplyPaise(principal, markupFactor);
    89	  }
    90	
    91	  const schedule: ScheduledKist[] = [];
    92	
    93	  if (productType === 'instalment') {
    94	    const principalInstalments = dividePaise(principal, termMonths);
    95	    const markupInstalments = dividePaise(totalMarkup, termMonths);
    96	
    97	    for (let i = 0; i < termMonths; i++) {
    98	      schedule.push({
    99	        kistNumber: i + 1,
   100	        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
   101	        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
   102	        principalDue: principalInstalments[i],
   103	        markupDue: markupInstalments[i]
   104	      });
   105	    }
   106	  } else if (productType === 'bullet') {
   107	    // Legacy fixed-term markup bullet
   108	    const markupInstalments = dividePaise(totalMarkup, termMonths);
   109	
   110	    for (let i = 0; i < termMonths; i++) {
   111	      const principalDue = 0 as Paise;
   112	      const markupDue = markupInstalments[i];
   113	      const amountDue = addPaise(principalDue, markupDue);
   114	
   115	      schedule.push({
   116	        kistNumber: i + 1,
   117	        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
   118	        amountDue,
   119	        principalDue,
   120	        markupDue
   121	      });
   122	    }
   123	  }
   124	
   125	  return schedule;
   126	}
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';
import { Paise, toPaise } from '../core/domain/money';

export interface MoneyInputProps {
  label?: string;
  value?: string; // rupees string like "50000"
  onChangeValue?: (val: string) => void;
  valuePaise?: Paise;
  onChangePaise?: (paise: Paise) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  editable?: boolean;
}

export function MoneyInput({
  label,
  value,
  onChangeValue,
  valuePaise,
  onChangePaise,
  error,
  helperText,
  placeholder = '0',
  containerStyle,
  editable = true,
}: MoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = valuePaise !== undefined 
    ? (valuePaise > 0 ? Math.round(valuePaise / 100).toString() : '')
    : (value || '');

  const handleChangeText = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/[^0-9]/g, '');
    if (onChangeValue) {
      onChangeValue(cleaned);
    }
    if (onChangePaise) {
      const rupees = parseInt(cleaned, 10) || 0;
      onChangePaise(toPaise(rupees));
    }
  };

  const getInWords = (numStr: string) => {
    const val = parseInt(numStr, 10);
    if (!val || isNaN(val)) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return null;
  };

  const words = getInWords(displayValue);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Typography variant="labelMd" color={theme.colors.textSecondary}>
            {label}
          </Typography>
          {words ? (
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              {words}
            </Typography>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
          !editable && styles.inputDisabled,
        ]}
      >
        <Typography
          variant="headlineMd"
          color={value ? theme.colors.textPrimary : theme.colors.textDisabled}
          style={styles.currencyPrefix}
        >
          ₹
        </Typography>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="number-pad"
          inputMode="numeric"
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {error ? (
        <Typography variant="bodySm" color={theme.colors.danger} style={styles.message}>
          {error}
        </Typography>
      ) : helperText ? (
62ee653 feat(v2): implement approved neutral precision design system and financial safety remediations

exec
/bin/bash -lc 'git diff 9258311...62ee653 -- src/core/database/schema.ts src/core/database/transactionRepository.ts' in /mnt/f/personal projects/credkeep
 succeeded in 206ms:
diff --git a/src/core/database/schema.ts b/src/core/database/schema.ts
index d584ebc..9e9a226 100644
--- a/src/core/database/schema.ts
+++ b/src/core/database/schema.ts
@@ -169,6 +169,7 @@ export async function runMigrations(db: SQLiteDatabase) {
         maturity_date TEXT NOT NULL,
         interest_paid_paise INTEGER NOT NULL DEFAULT 0,
         settled INTEGER NOT NULL DEFAULT 0,
+        interest_settled INTEGER NOT NULL DEFAULT 0,
         operation_id TEXT UNIQUE,
         created_at TEXT NOT NULL,
         FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
@@ -176,36 +177,70 @@ export async function runMigrations(db: SQLiteDatabase) {
       CREATE INDEX IF NOT EXISTS idx_loan_terms_loan ON loan_terms(loan_id, term_number);
     `);
 
+    const termColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_terms);`);
+    const termColNames = new Set((termColumns || []).map((c: any) => c.name));
+    if (!termColNames.has('interest_settled')) {
+      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN interest_settled INTEGER NOT NULL DEFAULT 0;`);
+      await tx.execAsync(`UPDATE loan_terms SET interest_settled = settled WHERE interest_settled IS NULL OR interest_settled = 0;`);
+    }
+    if (!termColNames.has('settled')) {
+      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0;`);
+      await tx.execAsync(`UPDATE loan_terms SET settled = interest_settled WHERE settled IS NULL OR settled = 0;`);
+    }
+    if (!termColNames.has('operation_id')) {
+      await tx.execAsync(`ALTER TABLE loan_terms ADD COLUMN operation_id TEXT;`);
+    }
+
     // 7. Payment Corrections (Auditable correction history linking reversal and replacement)
     await tx.execAsync(`
       CREATE TABLE IF NOT EXISTS payment_corrections (
         id TEXT PRIMARY KEY NOT NULL,
         loan_id TEXT NOT NULL,
         original_transaction_id TEXT NOT NULL,
-        original_operation_id TEXT NOT NULL,
+        original_operation_id TEXT,
         reversal_transaction_id TEXT NOT NULL,
         replacement_transaction_id TEXT,
-        original_amount_paise INTEGER NOT NULL,
-        corrected_amount_paise INTEGER NOT NULL,
+        original_amount_paise INTEGER NOT NULL DEFAULT 0,
+        previous_amount_paise INTEGER NOT NULL DEFAULT 0,
+        corrected_amount_paise INTEGER NOT NULL DEFAULT 0,
         reason TEXT NOT NULL,
-        operation_id TEXT UNIQUE NOT NULL,
+        operation_id TEXT UNIQUE,
         created_at TEXT NOT NULL,
         FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
       );
       CREATE INDEX IF NOT EXISTS idx_payment_corrections_loan ON payment_corrections(loan_id);
     `);
 
+    const corrColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(payment_corrections);`);
+    const corrColNames = new Set((corrColumns || []).map((c: any) => c.name));
+    if (!corrColNames.has('previous_amount_paise')) {
+      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN previous_amount_paise INTEGER NOT NULL DEFAULT 0;`);
+      await tx.execAsync(`UPDATE payment_corrections SET previous_amount_paise = original_amount_paise WHERE previous_amount_paise IS NULL OR previous_amount_paise = 0;`);
+    }
+    if (!corrColNames.has('original_amount_paise')) {
+      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_amount_paise INTEGER NOT NULL DEFAULT 0;`);
+      await tx.execAsync(`UPDATE payment_corrections SET original_amount_paise = previous_amount_paise WHERE original_amount_paise IS NULL OR original_amount_paise = 0;`);
+    }
+    if (!corrColNames.has('original_operation_id')) {
+      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN original_operation_id TEXT;`);
+    }
+    if (!corrColNames.has('operation_id')) {
+      await tx.execAsync(`ALTER TABLE payment_corrections ADD COLUMN operation_id TEXT;`);
+    }
+
     // 8. Loan Attachments (Security cheques, affidavits, collateral documents)
     await tx.execAsync(`
       CREATE TABLE IF NOT EXISTS loan_attachments (
         id TEXT PRIMARY KEY NOT NULL,
         loan_id TEXT NOT NULL,
-        document_type TEXT NOT NULL,
+        document_type TEXT,
+        doc_type TEXT,
         file_path TEXT NOT NULL,
-        file_name TEXT NOT NULL,
+        file_name TEXT,
         file_size INTEGER NOT NULL DEFAULT 0,
         mime_type TEXT,
         notes TEXT,
+        synced INTEGER NOT NULL DEFAULT 0,
         sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
         created_at TEXT NOT NULL,
         FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
@@ -213,6 +248,29 @@ export async function runMigrations(db: SQLiteDatabase) {
       CREATE INDEX IF NOT EXISTS idx_loan_attachments_loan ON loan_attachments(loan_id);
     `);
 
+    const attColumns: any[] = await (tx as any).getAllAsync(`PRAGMA table_info(loan_attachments);`);
+    const attColNames = new Set((attColumns || []).map((c: any) => c.name));
+    if (!attColNames.has('doc_type')) {
+      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN doc_type TEXT;`);
+      await tx.execAsync(`UPDATE loan_attachments SET doc_type = document_type WHERE doc_type IS NULL AND document_type IS NOT NULL;`);
+    }
+    if (!attColNames.has('document_type')) {
+      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN document_type TEXT;`);
+      await tx.execAsync(`UPDATE loan_attachments SET document_type = doc_type WHERE document_type IS NULL AND doc_type IS NOT NULL;`);
+    }
+    if (!attColNames.has('synced')) {
+      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;`);
+      await tx.execAsync(`UPDATE loan_attachments SET synced = CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END WHERE synced IS NULL;`);
+    }
+    if (!attColNames.has('sync_status')) {
+      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY';`);
+      await tx.execAsync(`UPDATE loan_attachments SET sync_status = CASE WHEN synced = 1 THEN 'SYNCED' ELSE 'LOCAL_ONLY' END WHERE sync_status IS NULL;`);
+    }
+    if (!attColNames.has('file_name')) {
+      await tx.execAsync(`ALTER TABLE loan_attachments ADD COLUMN file_name TEXT;`);
+      await tx.execAsync(`UPDATE loan_attachments SET file_name = file_path WHERE file_name IS NULL AND file_path IS NOT NULL;`);
+    }
+
     // 9. Sync Outbox (Offline-first client mutations queue)
     await tx.execAsync(`
       CREATE TABLE IF NOT EXISTS sync_outbox (
diff --git a/src/core/database/transactionRepository.ts b/src/core/database/transactionRepository.ts
index 7b5eb21..5069818 100644
--- a/src/core/database/transactionRepository.ts
+++ b/src/core/database/transactionRepository.ts
@@ -121,7 +121,7 @@ export class TransactionRepository {
 
           // Update terms settled if interest paid
           if ((pastMarkupPaid + allocatedMarkup) >= totalContractInterest) {
-            await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1 WHERE loan_id = ?`, [loanId]);
+            await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE loan_id = ?`, [loanId]);
           }
 
           // Check if loan should be marked settled
@@ -349,6 +349,31 @@ export class TransactionRepository {
     clientOpId?: string
   ): Promise<{ reversalTransactionId: string; replacementTransactionId: string | null }> {
     const opId = clientOpId || ((crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-' + Date.now() + '-' + Math.random().toString(36).substring(2)));
+
+    // Idempotency pre-check
+    if (clientOpId) {
+      const existingOutbox = await this.db.getFirstAsync<any>(
+        `SELECT * FROM sync_outbox WHERE operation_id = ?`,
+        [clientOpId]
+      );
+      if (existingOutbox) {
+        const existingReversal = await this.db.getFirstAsync<any>(
+          `SELECT id FROM transactions WHERE operation_id = ?`,
+          [`reversal-${clientOpId}`]
+        );
+        const existingRepl = await this.db.getFirstAsync<any>(
+          `SELECT id FROM transactions WHERE operation_id = ?`,
+          [clientOpId]
+        );
+        if (existingReversal) {
+          return {
+            reversalTransactionId: existingReversal.id,
+            replacementTransactionId: existingRepl ? existingRepl.id : null,
+          };
+        }
+      }
+    }
+
     let reversalTxId = '';
     let replacementTxId: string | null = null;
 
@@ -403,53 +428,9 @@ export class TransactionRepository {
         now
       ]);
 
-      // 2. Insert replacement COLLECTION transaction if correctedPaise > 0
-      if (correctedPaise > 0) {
-        replacementTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('repl-' + Date.now() + '-' + Math.random().toString(36).substring(2));
-        await tx.runAsync(`
-          INSERT INTO transactions (
-            id, operation_id, loan_id, transaction_type, is_cash, payment_method,
-            amount_paise, allocated_principal_paise, allocated_markup_paise,
-            allocated_penalty_paise, unallocated_surplus_paise, effective_date,
-            reversal_of_id, correction_reason, created_at
-          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
-        `, [
-          replacementTxId,
-          opId,
-          orig.loan_id,
-          'COLLECTION',
-          orig.is_cash,
-          orig.payment_method,
-          correctedPaise,
-          0, 0, 0, 0,
-          orig.effective_date,
-          orig.id,
-          reason,
-          now
-        ]);
-      }
+      // 2. Recompute allocations for active collections and replacement transaction
+      let replPrin = 0, replMkp = 0, replPen = 0, replSurplus = 0;
 
-      // 3. Record in payment_corrections
-      const correctionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-rec-' + Date.now());
-      await tx.runAsync(`
-        INSERT INTO payment_corrections (
-          id, loan_id, original_transaction_id, reversal_transaction_id,
-          replacement_transaction_id, previous_amount_paise, corrected_amount_paise,
-          reason, created_at
-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
-      `, [
-        correctionId,
-        orig.loan_id,
-        orig.id,
-        reversalTxId,
-        replacementTxId,
-        orig.amount_paise,
-        correctedPaise,
-        reason,
-        now
-      ]);
-
-      // 4. Recompute loan state
       if (loan.product_type === 'instalment' || loan.rate_basis === 'LEGACY_FIXED_TERM') {
         // Reset kists
         await tx.runAsync(`
@@ -458,13 +439,25 @@ export class TransactionRepository {
           WHERE loan_id = ?
         `, [orig.loan_id]);
 
-        // Fetch all active non-reversed collections ordered by effective_date, created_at
-        const activeCollections = await tx.getAllAsync<any>(`
+        // Fetch past non-reversed collections excluding the one being reversed
+        const pastCollections = await tx.getAllAsync<any>(`
           SELECT * FROM transactions
           WHERE loan_id = ? AND transaction_type = 'COLLECTION'
+            AND id != ?
             AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
           ORDER BY effective_date ASC, created_at ASC
-        `, [orig.loan_id, orig.loan_id]);
+        `, [orig.loan_id, orig.id, orig.loan_id]);
+
+        const allCollectionsToReplay = [...pastCollections];
+        if (correctedPaise > 0) {
+          allCollectionsToReplay.push({
+            id: '__replacement__',
+            amount_paise: correctedPaise,
+            effective_date: orig.effective_date,
+            created_at: now,
+          });
+          allCollectionsToReplay.sort((a, b) => (a.effective_date < b.effective_date ? -1 : a.effective_date > b.effective_date ? 1 : 0));
+        }
 
         const dbKists = await tx.getAllAsync<any>(
           `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
@@ -483,7 +476,7 @@ export class TransactionRepository {
           isDue: true
         }));
 
-        for (const col of activeCollections) {
+        for (const col of allCollectionsToReplay) {
           const penaltyAssessments = await tx.getFirstAsync<any>(
             `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date <= ?`,
             [orig.loan_id, col.effective_date]
@@ -496,15 +489,11 @@ export class TransactionRepository {
             pMkp += a.allocatedToMarkup;
             pPen += a.allocatedToPenalty;
           }
-          if (col.id === replacementTxId) {
-            await tx.runAsync(`
-              UPDATE transactions SET
-                allocated_principal_paise = ?,
-                allocated_markup_paise = ?,
-                allocated_penalty_paise = ?,
-                unallocated_surplus_paise = ?
-              WHERE id = ?
-            `, [pPrin, pMkp, pPen, res.unallocatedFunds, replacementTxId]);
+          if (col.id === '__replacement__') {
+            replPrin = pPrin;
+            replMkp = pMkp;
+            replPen = pPen;
+            replSurplus = res.unallocatedFunds;
           }
           kists = res.updatedKists;
         }
@@ -530,12 +519,24 @@ export class TransactionRepository {
         }
       } else {
         // Bullet with ANNUAL_SIMPLE_FLAT
-        const activeCollections = await tx.getAllAsync<any>(`
+        const pastCollections = await tx.getAllAsync<any>(`
           SELECT * FROM transactions
           WHERE loan_id = ? AND transaction_type = 'COLLECTION'
+            AND id != ?
             AND id NOT IN (SELECT reversal_of_id FROM transactions WHERE loan_id = ? AND transaction_type = 'REVERSAL' AND reversal_of_id IS NOT NULL)
           ORDER BY effective_date ASC, created_at ASC
-        `, [orig.loan_id, orig.loan_id]);
+        `, [orig.loan_id, orig.id, orig.loan_id]);
+
+        const allCollectionsToReplay = [...pastCollections];
+        if (correctedPaise > 0) {
+          allCollectionsToReplay.push({
+            id: '__replacement__',
+            amount_paise: correctedPaise,
+            effective_date: orig.effective_date,
+            created_at: now,
+          });
+          allCollectionsToReplay.sort((a, b) => (a.effective_date < b.effective_date ? -1 : a.effective_date > b.effective_date ? 1 : 0));
+        }
 
         const terms = await tx.getAllAsync<any>(
           `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number ASC`,
@@ -546,7 +547,7 @@ export class TransactionRepository {
         let cumulativeMkpPaid = 0;
         let cumulativePrinPaid = 0;
 
-        for (const col of activeCollections) {
+        for (const col of allCollectionsToReplay) {
           let unallocated = col.amount_paise;
           const unpaidInterest = Math.max(0, totalContractInterest - cumulativeMkpPaid);
           const aMkp = Math.min(unallocated, unpaidInterest);
@@ -558,22 +559,18 @@ export class TransactionRepository {
           unallocated -= aPrin;
           cumulativePrinPaid += aPrin;
 
-          if (col.id === replacementTxId) {
-            await tx.runAsync(`
-              UPDATE transactions SET
-                allocated_principal_paise = ?,
-                allocated_markup_paise = ?,
-                allocated_penalty_paise = 0,
-                unallocated_surplus_paise = ?
-              WHERE id = ?
-            `, [aPrin, aMkp, unallocated, replacementTxId]);
+          if (col.id === '__replacement__') {
+            replPrin = aPrin;
+            replMkp = aMkp;
+            replPen = 0;
+            replSurplus = unallocated;
           }
         }
 
         if (cumulativeMkpPaid >= totalContractInterest) {
-          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1 WHERE loan_id = ?`, [orig.loan_id]);
+          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE loan_id = ?`, [orig.loan_id]);
         } else {
-          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 0 WHERE loan_id = ?`, [orig.loan_id]);
+          await tx.runAsync(`UPDATE loan_terms SET interest_settled = 0, settled = 0 WHERE loan_id = ?`, [orig.loan_id]);
         }
 
         if (cumulativePrinPaid >= loan.principal_paise && cumulativeMkpPaid >= totalContractInterest) {
@@ -583,6 +580,58 @@ export class TransactionRepository {
         }
       }
 
+      // 3. Insert replacement COLLECTION transaction ONCE with final allocations (append-only)
+      if (correctedPaise > 0) {
+        replacementTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('repl-' + Date.now() + '-' + Math.random().toString(36).substring(2));
+        await tx.runAsync(`
+          INSERT INTO transactions (
+            id, operation_id, loan_id, transaction_type, is_cash, payment_method,
+            amount_paise, allocated_principal_paise, allocated_markup_paise,
+            allocated_penalty_paise, unallocated_surplus_paise, effective_date,
+            reversal_of_id, correction_reason, created_at
+          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+        `, [
+          replacementTxId,
+          opId,
+          orig.loan_id,
+          'COLLECTION',
+          orig.is_cash,
+          orig.payment_method,
+          correctedPaise,
+          replPrin,
+          replMkp,
+          replPen,
+          replSurplus,
+          orig.effective_date,
+          orig.id,
+          reason,
+          now
+        ]);
+      }
+
+      // 4. Record in payment_corrections
+      const correctionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-rec-' + Date.now());
+      await tx.runAsync(`
+        INSERT INTO payment_corrections (
+          id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
+          replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
+          reason, operation_id, created_at
+        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+      `, [
+        correctionId,
+        orig.loan_id,
+        orig.id,
+        orig.operation_id,
+        reversalTxId,
+        replacementTxId,
+        orig.amount_paise,
+        orig.amount_paise,
+        correctedPaise,
+        reason,
+        opId,
+        now
+      ]);
+
       // 5. Enqueue outbox operation for sync
       await OutboxManager.enqueue(tx, {
         operationId: opId,

exec
/bin/bash -lc "git show 9258311:src/app/loan/\\[id\\].tsx | rg -n -C 5 'clientOp|recordCash|correctPayment|extendBullet'; git show '9258311:src/app/(tabs)/loans.tsx' | rg -n -C 5 'clientOp|createLoanWithSchedule'; git show 62ee653:src/app/loan/create/terms.tsx | nl -ba | sed -n '125,200p'" in /mnt/f/personal projects/credkeep
 succeeded in 343ms:
145-    }
146-    try {
147-      setIsSubmitting(true);
148-      const effectiveDate = new Date().toISOString().split('T')[0];
149-      const opId = 'col-' + Date.now() + '-' + Math.random().toString(36).substring(2);
150:      await transactions!.recordCashPayment(loan!.id, toPaise(val), opId, effectiveDate);
151-      setPaymentModalVisible(false);
152-      setPaymentAmountInr('');
153-      triggerRefresh();
154-      Alert.alert('Success', `Payment of ₹${val.toLocaleString()} recorded successfully!`);
155-    } catch (err: any) {
--
185-      return;
186-    }
187-    try {
188-      setIsSubmitting(true);
189-      const opId = 'ext-' + Date.now() + '-' + Math.random().toString(36).substring(2);
190:      await loans!.extendBulletLoan(loan!.id, extendMonths, toPaise(collectedInr), opId);
191-      setExtendModalVisible(false);
192-      triggerRefresh();
193-      Alert.alert('Loan Extended', `Loan term extended by ${extendMonths} months to ${extensionPreview.newMaturityDate}!`);
194-    } catch (err: any) {
195-      Alert.alert('Extension Error', err.message || 'Failed to extend loan');
--
249-      return;
250-    }
251-    try {
252-      setIsSubmitting(true);
253-      const opId = 'corr-' + Date.now() + '-' + Math.random().toString(36).substring(2);
254:      await transactions!.correctPayment(targetTx.id, correctedPaise as Paise, finalReason, opId);
255-      setCorrectModalVisible(false);
256-      setTargetTx(null);
257-      triggerRefresh();
258-      Alert.alert('Correction Recorded', 'Payment corrected and balances recomputed cleanly.');
259-    } catch (err: any) {
--
616-
617-                  {/* Correct Payment Button: only active collections that have not been reversed */}
618-                  {isCollection && !hasBeenReversed && loan.status !== 'WRITTEN_OFF' && (
619-                    <View style={{ marginTop: 10, alignItems: 'flex-end' }}>
620-                      <TouchableOpacity
621:                        style={styles.correctPaymentBtn}
622-                        onPress={() => openCorrectionModal(txItem)}
623-                      >
624-                        <Typography variant="labelSm" color={theme.colors.primary}>
625-                          Correct Payment
626-                        </Typography>
--
972-    alignItems: 'flex-start',
973-  },
974-  txDetailsRow: {
975-    marginTop: 4,
976-  },
977:  correctPaymentBtn: {
978-    paddingHorizontal: 10,
979-    paddingVertical: 4,
980-    borderWidth: 1,
981-    borderColor: theme.colors.primary,
982-    borderRadius: 6,
271-      const principalPaise = liveCalculation.principalPaise;
272-      const rate = parseFloat(annualRatePercent);
273-      const months = parseInt(termMonths, 10);
274-      const dDay = parseInt(dueDay, 10);
275-
276:      const createdLoan = await loans.createLoanWithSchedule(selectedBorrowerId, {
277-        principal: principalPaise,
278-        annualRate: rate,
279-        rateBasis: 'ANNUAL_SIMPLE_FLAT',
280-        termMonths: months,
281-        startDate,
   125	            <Input
   126	              label="Start Date (YYYY-MM-DD)"
   127	              value={draft.startDate}
   128	              onChangeText={(text) => updateDraft({ startDate: text })}
   129	              placeholder="YYYY-MM-DD"
   130	            />
   131	          </View>
   132	        </View>
   133	
   134	        {/* Live Calculation Card */}
   135	        <Card style={styles.calculationCard}>
   136	          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
   137	            CALCULATED TERMS ({isBullet ? 'BULLET LOAN' : 'MONTHLY KIST'})
   138	          </Typography>
   139	
   140	          {isBullet ? (
   141	            <>
   142	              <FinancialSummaryRow
   143	                label="Monthly Interest Payment"
   144	                sublabel={`Due on day ${draft.dueDay} each month`}
   145	                value={formatINR(calculated.monthlyAmountPaise)}
   146	                variant="highlight"
   147	              />
   148	              <FinancialSummaryRow
   149	                label="Principal Due at Maturity"
   150	                sublabel={`Due on ${calculated.maturityDate}`}
   151	                value={formatINR(draft.principalPaise)}
   152	              />
   153	              <FinancialSummaryRow
   154	                label="Total Contract Interest"
   155	                sublabel={`${draft.termMonths} months @ ${draft.annualRate}% p.a.`}
   156	                value={formatINR(calculated.totalInterestPaise)}
   157	              />
   158	              <FinancialSummaryRow
   159	                label="Total Contract Value"
   160	                sublabel="Principal + all monthly interest"
   161	                value={formatINR(calculated.totalPayablePaise)}
   162	                variant="highlight"
   163	              />
   164	            </>
   165	          ) : (
   166	            <>
   167	              <FinancialSummaryRow
   168	                label="Monthly Instalment (Kist)"
   169	                sublabel={`Equal monthly payment across ${draft.termMonths} months`}
   170	                value={formatINR(calculated.monthlyAmountPaise)}
   171	                variant="highlight"
   172	              />
   173	              <FinancialSummaryRow
   174	                label="Total Contract Markup / Interest"
   175	                sublabel={`Flat ${draft.annualRate}% p.a. over ${draft.termMonths} mos`}
   176	                value={formatINR(calculated.totalInterestPaise)}
   177	              />
   178	              <FinancialSummaryRow
   179	                label="Total Repayment Amount"
   180	                sublabel="Principal + total markup"
   181	                value={formatINR(calculated.totalPayablePaise)}
   182	                variant="highlight"
   183	              />
   184	              <FinancialSummaryRow
   185	                label="Maturity Date"
   186	                sublabel="Final installment due"
   187	                value={calculated.maturityDate}
   188	              />
   189	            </>
   190	          )}
   191	        </Card>
   192	      </ScrollView>
   193	
   194	      {/* Sticky Bottom Bar */}
   195	      <View style={styles.bottomBar}>
   196	        <Button
   197	          title="Continue to Documents"
   198	          onPress={handleNext}
   199	          variant="primary"
   200	        />

codex
I’m checking whether failed-push recovery can apply a payment twice, and whether newly queued attachment metadata can reach the server before its loan. I’m also tracing payment entry to confirm that the displayed amount matches the ledger amount.
exec
/bin/bash -lc "git diff 9258311...62ee653 -- src/core/sync/syncService.ts; git show 62ee653:src/ui/Button.tsx | head -125; git show 62ee653:src/__tests__/financial-safety-regression.test.ts | rg -n '"'^describe|''^  (it|test)|''^    (it|test)'"'" in /mnt/f/personal projects/credkeep
 succeeded in 470ms:
diff --git a/src/core/sync/syncService.ts b/src/core/sync/syncService.ts
index 6f54062..ecdf7f8 100644
--- a/src/core/sync/syncService.ts
+++ b/src/core/sync/syncService.ts
@@ -61,10 +61,10 @@ export class SyncService {
             await this.revertRejectedPayment(db, res.operation_id, res.error);
             batchFailed++;
           } else if (res.status === 'FAILED') {
-            await OutboxManager.markStatus(db, res.operation_id, 'PENDING', res.error);
+            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error);
             batchFailed++;
           } else {
-            await OutboxManager.markStatus(db, res.operation_id, res.status, res.error);
+            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error || res.status);
             batchFailed++;
           }
         }
@@ -72,7 +72,7 @@ export class SyncService {
         // Validate that every submitted operation received an acknowledgment result
         for (const op of operations) {
           if (!acknowledgedOpIds.has(op.operation_id)) {
-            await OutboxManager.markStatus(db, op.operation_id, 'PENDING', 'Missing server result in push response');
+            await OutboxManager.markStatus(db, op.operation_id, 'NEEDS_REVIEW', 'Missing server result in push response');
             batchFailed++;
           }
         }
@@ -245,14 +245,16 @@ export class SyncService {
         }
       }
     } else if (record_type === 'LOAN_TERM') {
+      const isSettled = (payload.interest_settled !== undefined ? payload.interest_settled : (payload.settled ? 1 : 0)) ? 1 : 0;
       if (operation_type === 'INSERT') {
         await tx.runAsync(
           `INSERT INTO loan_terms (
              id, loan_id, term_number, duration_months, annual_rate, interest_paise,
-             start_date, maturity_date, interest_settled, created_at
-           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+             start_date, maturity_date, interest_settled, settled, operation_id, created_at
+           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
-             interest_settled = excluded.interest_settled`,
+             interest_settled = excluded.interest_settled,
+             settled = excluded.settled`,
           [
             payload.id,
             payload.loan_id,
@@ -262,27 +264,42 @@ export class SyncService {
             payload.interest_paise,
             payload.start_date,
             payload.maturity_date,
-            payload.interest_settled ? 1 : 0,
+            isSettled,
+            isSettled,
+            payload.operation_id || null,
             payload.created_at || new Date().toISOString(),
           ]
         );
       } else if (operation_type === 'UPDATE') {
         await tx.runAsync(
-          `UPDATE loan_terms SET interest_settled = ? WHERE id = ?`,
-          [payload.interest_settled ? 1 : 0, payload.id]
+          `UPDATE loan_terms SET interest_settled = ?, settled = ? WHERE id = ?`,
+          [isSettled, isSettled, payload.id]
         );
       }
     } else if (record_type === 'LOAN_ATTACHMENT') {
       if (operation_type === 'INSERT') {
+        const docType = payload.doc_type || payload.document_type || 'OTHER';
+        const filePath = payload.file_path || payload.file_name || payload.storage_key || '';
+        const fileName = payload.file_name || (filePath ? filePath.split('/').pop()?.split('\\').pop() : 'attachment') || 'attachment';
         await tx.runAsync(
-          `INSERT INTO loan_attachments (id, loan_id, file_path, doc_type, notes, synced, created_at)
-           VALUES (?, ?, ?, ?, ?, 1, ?)
-           ON CONFLICT(id) DO UPDATE SET notes = excluded.notes, synced = 1`,
+          `INSERT INTO loan_attachments (
+             id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
+           ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'SYNCED', ?)
+           ON CONFLICT(id) DO UPDATE SET
+             file_path = excluded.file_path,
+             file_name = excluded.file_name,
+             doc_type = excluded.doc_type,
+             document_type = excluded.document_type,
+             notes = excluded.notes,
+             synced = 1,
+             sync_status = 'SYNCED'`,
           [
             payload.id,
             payload.loan_id,
-            payload.file_path,
-            payload.doc_type,
+            filePath,
+            fileName,
+            docType,
+            docType,
             payload.notes || null,
             payload.created_at || new Date().toISOString(),
           ]
@@ -290,22 +307,26 @@ export class SyncService {
       }
     } else if (record_type === 'PAYMENT_CORRECTION') {
       if (operation_type === 'INSERT') {
+        const origAmt = payload.original_amount_paise ?? payload.previous_amount_paise ?? 0;
         await tx.runAsync(
           `INSERT INTO payment_corrections (
-             id, loan_id, original_transaction_id, reversal_transaction_id,
-             replacement_transaction_id, previous_amount_paise, corrected_amount_paise,
-             reason, created_at
-           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
+             id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
+             replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
+             reason, operation_id, created_at
+           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`,
           [
             payload.id,
             payload.loan_id,
             payload.original_transaction_id,
+            payload.original_operation_id || null,
             payload.reversal_transaction_id,
-            payload.replacement_transaction_id,
-            payload.previous_amount_paise,
+            payload.replacement_transaction_id || null,
+            origAmt,
+            origAmt,
             payload.corrected_amount_paise,
             payload.reason,
+            payload.operation_id || null,
             payload.created_at || new Date().toISOString(),
           ]
         );
@@ -1154,23 +1175,18 @@ export class SyncService {
   static async syncAll(db: SQLiteDatabase): Promise<SyncResult> {
     try {
       const pushRes = await this.pushPending(db);
-      if (pushRes.failed > 0) {
-        return {
-          pushedCount: pushRes.pushed,
-          pulledCount: 0,
-          success: false,
-          errors: [`${pushRes.failed} operations failed to push to server; pull halted to protect local state`],
-        };
-      }
       const pullRes = await this.pullChanges(db);
       const needsReviewItems = await OutboxManager.getNeedsReview(db);
-      if (needsReviewItems.length > 0) {
+      if (needsReviewItems.length > 0 || pushRes.failed > 0) {
         return {
           pushedCount: pushRes.pushed,
           pulledCount: pullRes.pulled,
           needsReviewCount: needsReviewItems.length,
           success: false,
-          errors: [`${needsReviewItems.length} operation(s) require review due to server conflicts`],
+          errors: [
+            ...(pushRes.failed > 0 ? [`${pushRes.failed} operation(s) failed during push and require review.`] : []),
+            ...(needsReviewItems.length > 0 ? [`${needsReviewItems.length} operation(s) require review due to server conflicts.`] : []),
+          ],
         };
       }
       return {
import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  title: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  title,
  loading = false,
  disabled = false,
  style,
  icon,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getVariantStyles = (pressed: boolean) => {
    switch (variant) {
      case 'primary':
        return {
          container: [
            styles.base,
            styles.primary,
            pressed && styles.primaryPressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.actionOnPrimary,
          spinnerColor: theme.colors.actionOnPrimary,
        };
      case 'secondary':
        return {
          container: [
            styles.base,
            styles.secondary,
            pressed && styles.secondaryPressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textPrimary,
          spinnerColor: theme.colors.textPrimary,
        };
      case 'destructive':
        return {
          container: [
            styles.base,
            styles.destructive,
            pressed && styles.destructivePressed,
            isDisabled && styles.disabled,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : '#FFFFFF',
          spinnerColor: '#FFFFFF',
        };
      case 'ghost':
        return {
          container: [
            styles.base,
            styles.ghost,
            pressed && styles.ghostPressed,
            isDisabled && styles.disabledGhost,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textSecondary,
          spinnerColor: theme.colors.textSecondary,
        };
      case 'outline':
      default:
        return {
          container: [
            styles.base,
            styles.outline,
            pressed && styles.outlinePressed,
            isDisabled && styles.disabledOutline,
          ],
          textColor: isDisabled ? theme.colors.textDisabled : theme.colors.textPrimary,
          spinnerColor: theme.colors.textPrimary,
        };
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [getVariantStyles(pressed).container, style]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {({ pressed }) => {
        const { textColor, spinnerColor } = getVariantStyles(pressed);
        return loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : (
          <>
            {icon ? <>{icon}</> : null}
            <Typography
              variant="labelLg"
              color={textColor}
              style={icon ? { marginLeft: theme.spacing.sm } : undefined}
            >
              {title}
            </Typography>
          </>
        );
      }}
    </Pressable>
  );
}

83:describe('Financial Safety & Schema Invariant Regressions', () => {
85:    it('migrates legacy database tables missing doc_type, interest_settled, and payment_corrections columns', async () => {
247:    it('rolls back loan creation completely if attachment processing fails', async () => {
298:    it('commits loan, schedule, terms, and attachments atomically on success', async () => {
343:    it('transitions FAILED push operations to NEEDS_REVIEW and does not cycle infinitely', async () => {
370:    it('ingests LOAN_ATTACHMENT and LOAN_TERM pull payloads in both legacy and modern formats without error', async () => {
434:    it('executes bullet loan extension and guarantees idempotency on duplicate submission', async () => {
490:    it('executes payment correction and guarantees idempotency on duplicate submission', async () => {

exec
/bin/bash -lc "git show 62ee653:src/app/loan/components/MonthlyKistView.tsx | nl -ba | head -100; git show 62ee653:src/ui/AuditTimeline.tsx | rg -n -C 2 'Correct|onPress|onCorrect'; git show 62ee653:src/core/database/transactionRepository.ts | nl -ba | sed -n '640,780p'" in /mnt/f/personal projects/credkeep
 succeeded in 378ms:
     1	import React from 'react';
     2	import { View, StyleSheet, ScrollView } from 'react-native';
     3	import { Typography } from '../../../ui/Typography';
     4	import { Card } from '../../../ui/Card';
     5	import { Button } from '../../../ui/Button';
     6	import { AttachmentGrid } from '../../../ui/AttachmentGrid';
     7	import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
     8	import { theme } from '../../../ui/theme';
     9	import { Loan, LoanAttachment } from '../../../core/database/loanRepository';
    10	import { Borrower } from '../../../core/database/borrowerRepository';
    11	import { formatINR, Paise } from '../../../core/domain/money';
    12	
    13	export interface MonthlyKistViewProps {
    14	  loan: Loan;
    15	  borrower: Borrower | null;
    16	  schedule: any[];
    17	  earnings: any;
    18	  history: any[];
    19	  attachments: LoanAttachment[];
    20	  onRecordPayment: () => void;
    21	  onCorrectPayment: (tx: any) => void;
    22	}
    23	
    24	export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
    25	  loan,
    26	  borrower,
    27	  schedule,
    28	  earnings,
    29	  history,
    30	  attachments,
    31	  onRecordPayment,
    32	  onCorrectPayment,
    33	}) => {
    34	
    35	  // Financial calculations
    36	  const totalPrincipal = loan.principal_paise as Paise;
    37	  const totalInterest = (loan.interest_paise || 0) as Paise;
    38	  const totalContract = (loan.total_paise || totalPrincipal + totalInterest) as Paise;
    39	
    40	  const principalReturned = (earnings?.principalReturned || 0) as Paise;
    41	  const markupReceived = (earnings?.markupReceived || 0) as Paise;
    42	  const totalCollected = (principalReturned + markupReceived) as Paise;
    43	  const remainingTotal = Math.max(0, totalContract - totalCollected) as Paise;
    44	
    45	  const paidKistsCount = schedule.filter((s) => s.status === 'PAID').length;
    46	  const totalKistsCount = schedule.length;
    47	
    48	  // Format ledger history events for AuditTimeline
    49	  const auditEvents: AuditEvent[] = history.map((tx) => {
    50	    let type: AuditEvent['type'] = 'COLLECTION';
    51	    if (tx.transaction_type === 'DISBURSEMENT') type = 'DISBURSEMENT';
    52	    else if (tx.transaction_type === 'PENALTY_ASSESSMENT') type = 'PENALTY_ASSESSMENT';
    53	    else if (tx.transaction_type === 'REVERSAL') type = 'REVERSAL';
    54	    else if (tx.transaction_type === 'CORRECTION_REPLACEMENT') type = 'REPLACEMENT';
    55	
    56	    return {
    57	      id: tx.id,
    58	      type,
    59	      title: tx.notes || undefined,
    60	      amountPaise: tx.amount_paise as Paise,
    61	      effectiveDate: tx.effective_date,
    62	      principalPaise: tx.allocated_principal_paise !== undefined ? (tx.allocated_principal_paise as Paise) : undefined,
    63	      interestPaise: tx.allocated_markup_paise !== undefined ? (tx.allocated_markup_paise as Paise) : undefined,
    64	      penaltyPaise: tx.allocated_penalty_paise !== undefined ? (tx.allocated_penalty_paise as Paise) : undefined,
    65	      paymentMethod: tx.payment_method || undefined,
    66	      reason: tx.reason || undefined,
    67	    };
    68	  });
    69	
    70	  const getStatusBadge = (status: string) => {
    71	    switch (status) {
    72	      case 'PAID':
    73	        return { bg: theme.colors.successContainer, text: theme.colors.successText, label: 'Paid' };
    74	      case 'PARTIAL':
    75	        return { bg: theme.colors.warningContainer, text: theme.colors.warningText, label: 'Partial' };
    76	      case 'OVERDUE':
    77	        return { bg: theme.colors.dangerContainer, text: theme.colors.dangerText, label: 'Overdue' };
    78	      case 'DUE':
    79	      default:
    80	        return { bg: theme.colors.surfaceSoft, text: theme.colors.textSecondary, label: 'Due' };
    81	    }
    82	  };
    83	
    84	  return (
    85	    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    86	      {/* Borrower Header Row */}
    87	      <View style={styles.borrowerCard}>
    88	        <View style={styles.borrowerLeft}>
    89	          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
    90	            {borrower?.name || 'Borrower'}
    91	          </Typography>
    92	          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
    93	            {borrower?.phone} • Monthly Instalment
    94	          </Typography>
    95	        </View>
    96	
    97	        <View
    98	          style={[
    99	            styles.statusPill,
   100	            loan.status === 'ACTIVE'
nl: write error: Broken pipe
25-  reason?: string;
26-  paymentMethod?: string;
27:  isCorrection?: boolean;
28-  notes?: string;
29-}
--
73-        iconColor: theme.colors.warning,
74-        badgeBg: theme.colors.warningContainer,
75:        defaultTitle: 'Corrected Payment',
76-        isNegative: false,
77-      };
--
177-              )}
178-
179:              {/* Reason / Correction Details */}
180-              {event.reason ? (
181-                <View style={styles.reasonBox}>
   640	          loan_id: orig.loan_id,
   641	          original_transaction_id: orig.id,
   642	          corrected_amount_paise: correctedPaise,
   643	          reason,
   644	          effective_date: orig.effective_date,
   645	        },
   646	      });
   647	    });
   648	
   649	    SyncCoordinator.notifyMutation();
   650	    return { reversalTransactionId: reversalTxId, replacementTransactionId: replacementTxId };
   651	  }
   652	
   653	  async previewPenalties(loanId: string, currentDate: string): Promise<number> {
   654	    const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   655	    if (!loan || loan.status !== 'ACTIVE') return 0;
   656	
   657	    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
   658	      const maturityDate = loan.maturity_date;
   659	      if (!maturityDate || maturityDate >= currentDate) return 0;
   660	
   661	      const terms = await this.db.getAllAsync<any>(
   662	        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
   663	      );
   664	      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
   665	      const paidRes = await this.db.getFirstAsync<any>(
   666	        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
   667	        [loanId]
   668	      );
   669	      const remainingTotal = (loan.principal_paise - (paidRes?.prin || 0)) + (totalContractInterest - (paidRes?.mkp || 0));
   670	      if (remainingTotal <= 0) return 0;
   671	
   672	      const matDateObj = new Date(maturityDate + 'T00:00:00Z');
   673	      const curDateObj = new Date(currentDate + 'T00:00:00Z');
   674	      let curr = new Date(matDateObj.getTime() + 86400000);
   675	      let assessed = 0;
   676	
   677	      while (curr <= curDateObj) {
   678	        const dateStr = curr.toISOString().split('T')[0];
   679	        const operationId = `penalty-${loanId}-${dateStr}`;
   680	        const existing = await this.db.getFirstAsync(
   681	          `SELECT id FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
   682	          [operationId, loanId, dateStr]
   683	        );
   684	        if (!existing) {
   685	          assessed += toPaise(100);
   686	        }
   687	        curr = new Date(curr.getTime() + 86400000);
   688	      }
   689	      return assessed;
   690	    }
   691	
   692	    const loanRepo = new LoanRepository(this.db);
   693	    await loanRepo.extendScheduleIfNeeded(loanId);
   694	
   695	    const dbKists = await this.db.getAllAsync<any>(
   696	      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
   697	      [loanId]
   698	    );
   699	
   700	    const assessments = await this.db.getAllAsync<any>(
   701	      `SELECT effective_date FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
   702	      [loanId]
   703	    );
   704	
   705	    const assessedDates = new Set<string>(assessments.map(a => a.effective_date));
   706	
   707	    const state = {
   708	      loanId,
   709	      rule: { dailyRatePaise: toPaise(100) },
   710	      kists: dbKists.map(k => ({
   711	        kistNumber: k.installment_number,
   712	        dueDate: k.effective_due_date,
   713	        amountDue: k.total_due_paise,
   714	        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
   715	        isFullyPaid: k.status === 'PAID' || (k.total_due_paise <= (k.principal_paid_paise + k.markup_paid_paise))
   716	      })),
   717	      assessedDates
   718	    };
   719	
   720	    const { newPenaltyAmount } = calculateNewPenalties(state, currentDate);
   721	    return newPenaltyAmount;
   722	  }
   723	
   724	  async assessPenalties(loanId: string, currentDate: string, tx: any = this.db): Promise<number> {
   725	    const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   726	    if (!loan || loan.status !== 'ACTIVE') return 0;
   727	
   728	    if (loan.rate_basis === 'ANNUAL_SIMPLE_FLAT') {
   729	      const maturityDate = loan.maturity_date;
   730	      if (!maturityDate || maturityDate >= currentDate) return 0;
   731	
   732	      const terms = await tx.getAllAsync(
   733	        `SELECT * FROM loan_terms WHERE loan_id = ?`, [loanId]
   734	      );
   735	      const totalContractInterest = terms.reduce((acc: number, t: any) => acc + (t.interest_paise || 0), 0) || (loan.interest_paise || 0);
   736	      const paidRes = await tx.getFirstAsync(
   737	        `SELECT SUM(allocated_principal_paise) as prin, SUM(allocated_markup_paise) as mkp FROM transactions WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')`,
   738	        [loanId]
   739	      );
   740	      const remainingTotal = (loan.principal_paise - (paidRes?.prin || 0)) + (totalContractInterest - (paidRes?.mkp || 0));
   741	      if (remainingTotal <= 0) return 0;
   742	
   743	      const matDateObj = new Date(maturityDate + 'T00:00:00Z');
   744	      const curDateObj = new Date(currentDate + 'T00:00:00Z');
   745	      let curr = new Date(matDateObj.getTime() + 86400000);
   746	      let assessed = 0;
   747	
   748	      while (curr <= curDateObj) {
   749	        const dateStr = curr.toISOString().split('T')[0];
   750	        const operationId = `penalty-${loanId}-${dateStr}`;
   751	        const existing = await tx.getFirstAsync(
   752	          `SELECT id FROM transactions WHERE operation_id = ? OR (loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT' AND effective_date = ?)`,
   753	          [operationId, loanId, dateStr]
   754	        );
   755	        if (!existing) {
   756	          assessed += toPaise(100);
   757	          const transactionId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('penalty-' + Date.now() + '-' + Math.random().toString(36).substring(2));
   758	          await tx.runAsync(`
   759	            INSERT INTO transactions (
   760	              id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
   761	              amount_paise, allocated_principal_paise, allocated_markup_paise, 
   762	              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
   763	            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   764	          `, [
   765	            transactionId, operationId, loanId, 'PENALTY_ASSESSMENT', 0, 'SYSTEM',
   766	            toPaise(100), 0, 0, 0, 0, dateStr, new Date().toISOString()
   767	          ]);
   768	        }
   769	        curr = new Date(curr.getTime() + 86400000);
   770	      }
   771	      return assessed;
   772	    }
   773	
   774	    const loanRepo = new LoanRepository(tx);
   775	    await loanRepo.extendScheduleIfNeeded(loanId, tx);
   776	
   777	    const dbKists = await tx.getAllAsync(
   778	      `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
   779	      [loanId]
   780	    );

exec
/bin/bash -lc "git diff 9258311...62ee653 -- backend/api/views_sync.py backend/ledger/engine/ledger_service.py src/core/sync/outbox.ts; git show 62ee653:backend/api/views_sync.py | nl -ba | sed -n '85,145p'; git show 62ee653:src/core/sync/outbox.ts | head -125; git show 62ee653:src/core/sync/syncService.ts | nl -ba | head -115" in /mnt/f/personal projects/credkeep
 succeeded in 534ms:
diff --git a/backend/api/views_sync.py b/backend/api/views_sync.py
index 15fecfe..514578a 100644
--- a/backend/api/views_sync.py
+++ b/backend/api/views_sync.py
@@ -1188,7 +1188,7 @@ class SyncPushView(APIView):
             except (LoanAccount.DoesNotExist, ValueError):
                 return 'REJECTED', f'Loan {loan_id_raw} not found for this tenant.'
 
-            doc_type = payload.get('document_type', 'OTHER')
+            doc_type = payload.get('document_type') or payload.get('doc_type', 'OTHER')
             file_name = payload.get('file_name', 'attachment')
             file_size = payload.get('file_size', 0)
             notes = payload.get('notes', '')
@@ -1212,6 +1212,7 @@ class SyncPushView(APIView):
                     'id': str(att.id),
                     'loan_id': str(loan.id),
                     'document_type': att.document_type,
+                    'doc_type': att.document_type,
                     'file_name': att.file_name,
                     'file_size': att.file_size,
                     'notes': att.notes
diff --git a/backend/ledger/engine/ledger_service.py b/backend/ledger/engine/ledger_service.py
index 03b8cc2..7e9bb21 100644
--- a/backend/ledger/engine/ledger_service.py
+++ b/backend/ledger/engine/ledger_service.py
@@ -564,6 +564,7 @@ def extend_loan(
                 'start_date': str(term_obj.start_date),
                 'maturity_date': str(term_obj.maturity_date),
                 'settled': term_obj.settled,
+                'interest_settled': term_obj.settled,
                 'operation_id': str(operation_id)
             }
         )
diff --git a/src/core/sync/outbox.ts b/src/core/sync/outbox.ts
index e525f70..4a0d16b 100644
--- a/src/core/sync/outbox.ts
+++ b/src/core/sync/outbox.ts
@@ -1,7 +1,7 @@
 import { SQLiteDatabase } from 'expo-sqlite';
 import * as crypto from 'expo-crypto';
 
-export type OutboxStatus = 'PENDING' | 'SYNCED' | 'NEEDS_REVIEW' | 'REJECTED';
+export type OutboxStatus = 'PENDING' | 'SYNCED' | 'NEEDS_REVIEW' | 'REJECTED' | 'FAILED';
 
 export interface OutboxRecord {
   id: string;
@@ -71,7 +71,7 @@ export class OutboxManager {
 
   static async getPending(db: SQLiteDatabase, limit: number = 50): Promise<OutboxRecord[]> {
     return await db.getAllAsync<OutboxRecord>(
-      `SELECT * FROM sync_outbox WHERE status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?`,
+      `SELECT * FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`,
       [limit]
     );
   }
    85	
    86	        if not device:
    87	            try:
    88	                device = Device.objects.filter(tenant=tenant).first()
    89	                if not device:
    90	                    device = Device.objects.create(tenant=tenant, last_sync=timezone.now())
    91	                else:
    92	                    device.last_sync = timezone.now()
    93	                    device.save(update_fields=['last_sync'])
    94	            except Exception:
    95	                device = Device.objects.filter(tenant=tenant).first()
    96	
    97	        results = []
    98	
    99	        for op in operations:
   100	            if not isinstance(op, dict):
   101	                results.append({
   102	                    "operation_id": None,
   103	                    "status": "REJECTED",
   104	                    "error": "Operation item must be an object."
   105	                })
   106	                continue
   107	
   108	            op_id_raw = op.get('operation_id')
   109	            if not op_id_raw:
   110	                results.append({
   111	                    "operation_id": None,
   112	                    "status": "REJECTED",
   113	                    "error": "Missing operation_id."
   114	                })
   115	                continue
   116	
   117	            try:
   118	                operation_id = uuid.UUID(str(op_id_raw))
   119	            except (ValueError, TypeError):
   120	                results.append({
   121	                    "operation_id": str(op_id_raw),
   122	                    "status": "REJECTED",
   123	                    "error": "Invalid UUID format for operation_id."
   124	                })
   125	                continue
   126	
   127	            try:
   128	                op_type = op.get('type') or op.get('operation_type')
   129	                payload = op.get('payload', {})
   130	                if not isinstance(payload, dict):
   131	                    payload = {}
   132	
   133	                # Idempotency check against SyncLog
   134	                existing_log = SyncLog.objects.filter(tenant=tenant, operation_id=operation_id).first()
   135	                if existing_log:
   136	                    has_conflict, conflict_reason = self._check_idempotency_conflict(
   137	                        tenant, operation_id, op_type, op, payload, existing_log=existing_log
   138	                    )
   139	                    if has_conflict:
   140	                        results.append({
   141	                            "operation_id": str(operation_id),
   142	                            "status": "REJECTED",
   143	                            "error": conflict_reason or f"Idempotency conflict: operation_id {operation_id} was already processed with different attributes."
   144	                        })
   145	                        continue
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
     1	import { SQLiteDatabase } from 'expo-sqlite';
     2	import * as crypto from 'expo-crypto';
     3	import { ApiClient } from '../api/client';
     4	import { AuthStore } from '../auth/authStore';
     5	import { OutboxManager, registerOutboxRevertHandler } from './outbox';
     6	import { allocatePayment } from '../domain/allocation';
     7	import { Paise } from '../domain/money';
     8	import { getMigratedTransactionOpId } from '../migration/uuidUtils';
     9	import { withDbTransaction } from '../database/transaction';
    10	
    11	
    12	export interface SyncResult {
    13	  pushedCount: number;
    14	  pulledCount: number;
    15	  needsReviewCount?: number;
    16	  success: boolean;
    17	  errors?: string[];
    18	}
    19	
    20	export class SyncService {
    21	  /**
    22	   * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/
    23	   */
    24	  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {
    25	    const token = await AuthStore.getToken();
    26	    if (!token) return { pushed: 0, failed: 0 };
    27	
    28	    let totalPushed = 0;
    29	    let totalFailed = 0;
    30	
    31	    while (true) {
    32	      const pending = await OutboxManager.getPending(db, 50);
    33	      if (pending.length === 0) break;
    34	
    35	      const deviceId = await AuthStore.getDeviceId();
    36	      const operations = pending.map((record) => ({
    37	        operation_id: record.operation_id,
    38	        type: record.operation_type,
    39	        timestamp: record.created_at,
    40	        payload: JSON.parse(record.payload),
    41	      }));
    42	
    43	      try {
    44	        const response = await ApiClient.post('/sync/push/', {
    45	          device_id: deviceId,
    46	          operations,
    47	        });
    48	
    49	        let batchFailed = 0;
    50	        const results = response?.results || [];
    51	        const acknowledgedOpIds = new Set<string>();
    52	
    53	        for (const res of results) {
    54	          if (!res?.operation_id) continue;
    55	          acknowledgedOpIds.add(res.operation_id);
    56	
    57	          if (res.status === 'ACCEPTED' || res.status === 'ALREADY_EXISTS') {
    58	            await OutboxManager.markSynced(db, [res.operation_id]);
    59	            totalPushed++;
    60	          } else if (res.status === 'REJECTED') {
    61	            await this.revertRejectedPayment(db, res.operation_id, res.error);
    62	            batchFailed++;
    63	          } else if (res.status === 'FAILED') {
    64	            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error);
    65	            batchFailed++;
    66	          } else {
    67	            await OutboxManager.markStatus(db, res.operation_id, 'NEEDS_REVIEW', res.error || res.status);
    68	            batchFailed++;
    69	          }
    70	        }
    71	
    72	        // Validate that every submitted operation received an acknowledgment result
    73	        for (const op of operations) {
    74	          if (!acknowledgedOpIds.has(op.operation_id)) {
    75	            await OutboxManager.markStatus(db, op.operation_id, 'NEEDS_REVIEW', 'Missing server result in push response');
    76	            batchFailed++;
    77	          }
    78	        }
    79	
    80	        totalFailed += batchFailed;
    81	        if (batchFailed > 0) {
    82	          // Stop further batch execution on failure to preserve sequential dependency
    83	          break;
    84	        }
    85	      } catch {
    86	        totalFailed += pending.length;
    87	        break;
    88	      }
    89	    }
    90	
    91	    return { pushed: totalPushed, failed: totalFailed };
    92	  }
    93	
    94	  /**
    95	   * PULL Protocol: Queries /api/v2/sync/pull/?cursor={cursor} and merges state changes
    96	   */
    97	  static async pullChanges(db: SQLiteDatabase): Promise<{ pulled: number }> {
    98	    const token = await AuthStore.getToken();
    99	    if (!token) return { pulled: 0 };
   100	
   101	    const cursorStr = await OutboxManager.getMeta(db, 'last_pull_cursor');
   102	    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
   103	    if (isNaN(cursor)) cursor = 0;
   104	
   105	    let hasMore = true;
   106	    let totalPulled = 0;
   107	
   108	    while (hasMore) {
   109	      const response = await ApiClient.get(`/sync/pull/?cursor=${cursor}&limit=100`);
   110	      const changes = response.changes || [];
   111	
   112	      if (changes.length > 0) {
   113	        cursor = response.next_cursor;
   114	        hasMore = Boolean(response.has_more);
   115	        await withDbTransaction(db, async (tx) => {
nl: write error: Broken pipe

exec
/bin/bash -lc 'git rev-parse HEAD; test -d node_modules && echo node_modules-present; command -v npm; command -v bun; git show 62ee653:src/core/database/transaction.ts; git show 62ee653:src/__tests__/loan-wizard.test.ts | head -100' in /mnt/f/personal projects/credkeep
 succeeded in 430ms:
62ee65381e83297f9d2df5b68045af5ab7316218
node_modules-present
/home/sagar/.nvm/versions/node/v24.21.0/bin/npm
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
import { calculateContractInterest, calculateMaturityDate, generateSchedule } from '../core/domain/schedule';
import { toPaise } from '../core/domain/money';

describe('Phase 4 - Loan Creation Wizard Logic', () => {
  it('calculates monthly kist contract interest and schedule correctly', () => {
    const principal = toPaise(50000);
    const annualRate = 24;
    const termMonths = 10;
    const startDate = '2026-03-01';
    const dueDay = 5;

    const interest = calculateContractInterest(principal, annualRate, termMonths);
    // 50,000 * 24 * 10 / 1200 = 10,000 rupees -> 1,000,000 paise
    expect(interest).toBe(toPaise(10000));

    const total = principal + interest;
    expect(total).toBe(toPaise(60000));

    const maturity = calculateMaturityDate(startDate, termMonths, dueDay);
    expect(maturity).toBe('2027-01-05');

    const schedule = generateSchedule({
      principal,
      annualRate,
      rateBasis: 'ANNUAL_SIMPLE_FLAT',
      termMonths,
      startDate,
      dueDay,
      productType: 'instalment',
    });

    expect(schedule.length).toBe(10);
    const totalScheduled = schedule.reduce((sum, s) => sum + s.amountDue, 0);
    expect(totalScheduled).toBe(toPaise(60000));
  });

  it('calculates bullet loan monthly interest and maturity correctly', () => {
    const principal = toPaise(100000); // 1 Lakh
    const annualRate = 24;
    const termMonths = 6;
    const startDate = '2026-01-10';
    const dueDay = 10;

    // Monthly interest = 100,000 * (24 / 12 / 100) = 2,000 rupees -> 200,000 paise
    const monthlyRate = annualRate / 12 / 100;
    const monthlyInterestPaise = Math.round(principal * monthlyRate);
    expect(monthlyInterestPaise).toBe(toPaise(2000));

    const totalInterestPaise = Math.round(monthlyInterestPaise * termMonths);
    expect(totalInterestPaise).toBe(toPaise(12000));

    const maturity = calculateMaturityDate(startDate, termMonths, dueDay);
    expect(maturity).toBe('2026-07-10');
  });

  it('validates high-value loan document threshold (> ₹30,000)', () => {
    const HIGH_VALUE_THRESHOLD = toPaise(30000);
    const loanSmall = toPaise(25000);
    const loanLarge = toPaise(50000);

    expect(loanSmall > HIGH_VALUE_THRESHOLD).toBe(false);
    expect(loanLarge > HIGH_VALUE_THRESHOLD).toBe(true);

    const compliantTypes = ['promissory_note', 'property_paper', 'aadhaar'];
    expect(compliantTypes.includes('promissory_note')).toBe(true);
    expect(compliantTypes.includes('other')).toBe(false);
  });
});

exec
/bin/bash -lc 'CI=1 npm run lint -- --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'npm test -- --runInBand --no-cache src/__tests__/financial-safety-regression.test.ts src/core/sync/syncService.test.ts src/__tests__/loan-wizard.test.ts' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/tsc --noEmit --incremental false' in /mnt/f/personal projects/credkeep
 exited 7 in 4329ms:

> credkeep@1.0.0 lint
> expo lint --no-cache

env: load .env
env: export ALLOWED_HOSTS APP_DB_PASSWORD APP_DB_USER DATABASE_URL DB_PORT DEBUG POSTGRES_DB POSTGRES_PASSWORD POSTGRES_USER SECRET_KEY
/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/utils/errors.js:130
    throw error;
    ^

Error: ENOENT: no such file or directory, mkdir '/home/sagar/.expo'
    at Object.mkdirSync (node:fs:1410:26)
    at write (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:228:27)
    at setSync (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:276:12)
    at JsonFile.set (/mnt/f/personal projects/credkeep/node_modules/@expo/json-file/build/JsonFile.js:108:16)
    at getAnonymousId (/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/api/user/UserSettings.js:191:18)
    at new Telemetry (/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/utils/telemetry/Telemetry.js:32:66)
    at getTelemetry (/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/utils/telemetry/index.js:43:21)
    at record (/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/utils/telemetry/index.js:59:29)
    at recordCommand (/mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/src/utils/telemetry/index.js:66:12)
    at /mnt/f/personal projects/credkeep/node_modules/@expo/cli/build/bin/cli:274:9 {
  errno: -2,
  code: 'ENOENT',
  syscall: 'mkdir',
  path: '/home/sagar/.expo'
}

Node.js v24.21.0

 exited 1 in 6190ms:

> credkeep@1.0.0 test
> jest --runInBand --no-cache src/__tests__/financial-safety-regression.test.ts src/core/sync/syncService.test.ts src/__tests__/loan-wizard.test.ts

Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

exec
/bin/bash -lc "git diff 9258311...62ee653 -- src/core/database/loanRepository.ts | tail -130; git show 62ee653:src/core/sync/syncService.ts | nl -ba | sed -n '305,340p'; git show 62ee653:backend/ledger/engine/ledger_service.py | nl -ba | sed -n '525,575p'; git show 62ee653:src/core/database/transactionRepository.ts | nl -ba | sed -n '345,405p'" in /mnt/f/personal projects/credkeep
 succeeded in 824ms:
+
+          await OutboxManager.enqueue(txHandle, {
+            operationId: `att-${attId}`,
+            operationType: 'upload_attachment_metadata',
+            payload: {
+              id: attId,
+              loan_id: loanId,
+              file_path: attPath,
+              file_name: fileName,
+              doc_type: att.doc_type,
+              document_type: att.doc_type,
+              notes: att.notes || null,
+            },
+          });
+        }
+      }
+
       await OutboxManager.enqueue(txHandle, {
         operationId: clientOpId,
         operationType: 'create_loan',
@@ -326,6 +381,25 @@ export class LoanRepository {
     clientOpId?: string
   ): Promise<{ loan: Loan; term: LoanTerm }> {
     const opId = clientOpId || generateUuid();
+
+    // Idempotency pre-check
+    if (clientOpId) {
+      const existingOutbox = await this.db.getFirstAsync<any>(
+        `SELECT * FROM sync_outbox WHERE operation_id = ?`,
+        [clientOpId]
+      );
+      if (existingOutbox) {
+        const existingLoan = await this.getById(loanId);
+        const existingTerm = await this.db.getFirstAsync<LoanTerm>(
+          `SELECT * FROM loan_terms WHERE loan_id = ? ORDER BY term_number DESC LIMIT 1`,
+          [loanId]
+        );
+        if (existingLoan && existingTerm) {
+          return { loan: existingLoan, term: existingTerm };
+        }
+      }
+    }
+
     let updatedLoan: Loan | null = null;
     let createdTerm: LoanTerm | null = null;
 
@@ -342,7 +416,7 @@ export class LoanRepository {
       );
 
       const lastTerm = terms.length > 0 ? terms[terms.length - 1] : null;
-      if (lastTerm && !lastTerm.interest_settled) {
+      if (lastTerm && !lastTerm.interest_settled && !lastTerm.settled) {
         if (interestCollectedPaise < lastTerm.interest_paise) {
           throw new Error(
             `Prior term's contractual interest must be fully settled before extending the loan. Required: ${lastTerm.interest_paise} paise, collected: ${interestCollectedPaise} paise.`
@@ -387,7 +461,7 @@ export class LoanRepository {
 
         if (lastTerm) {
           await txHandle.runAsync(
-            `UPDATE loan_terms SET interest_settled = 1 WHERE id = ?`,
+            `UPDATE loan_terms SET interest_settled = 1, settled = 1 WHERE id = ?`,
             [lastTerm.id]
           );
         }
@@ -396,8 +470,8 @@ export class LoanRepository {
       await txHandle.runAsync(
         `INSERT INTO loan_terms (
           id, loan_id, term_number, duration_months, annual_rate, interest_paise,
-          start_date, maturity_date, interest_settled, created_at
-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
+          start_date, maturity_date, interest_settled, settled, operation_id, created_at
+        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
           termId,
           loanId,
@@ -408,6 +482,8 @@ export class LoanRepository {
           startDate,
           maturityDate,
           0,
+          0,
+          opId,
           createdAt,
         ]
       );
@@ -433,6 +509,7 @@ export class LoanRepository {
           loan_id: loanId,
           additional_months: additionalMonths,
           interest_collected_paise: interestCollectedPaise,
+          effective_date: todayStr,
         },
       });
 
@@ -488,13 +565,24 @@ export class LoanRepository {
     const opId = clientOpId || generateUuid();
     const id = generateUuid();
     const createdAt = new Date().toISOString();
+    const fileName = attachment.file_path ? attachment.file_path.split('/').pop()?.split('\\').pop() || 'attachment' : 'attachment';
 
     await withDbTransaction(this.db, async (tx) => {
       const txHandle = tx || this.db;
       await txHandle.runAsync(
-        `INSERT INTO loan_attachments (id, loan_id, file_path, doc_type, notes, synced, created_at)
-         VALUES (?, ?, ?, ?, ?, ?, ?)`,
-        [id, attachment.loan_id, attachment.file_path, attachment.doc_type, attachment.notes || null, 0, createdAt]
+        `INSERT INTO loan_attachments (
+          id, loan_id, file_path, file_name, doc_type, document_type, notes, synced, sync_status, created_at
+        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'LOCAL_ONLY', ?)`,
+        [
+          id,
+          attachment.loan_id,
+          attachment.file_path,
+          fileName,
+          attachment.doc_type,
+          attachment.doc_type,
+          attachment.notes || null,
+          createdAt,
+        ]
       );
 
       await OutboxManager.enqueue(txHandle, {
@@ -504,7 +592,9 @@ export class LoanRepository {
           id,
           loan_id: attachment.loan_id,
           file_path: attachment.file_path,
+          file_name: fileName,
           doc_type: attachment.doc_type,
+          document_type: attachment.doc_type,
           notes: attachment.notes || null,
         },
       });
   305	          ]
   306	        );
   307	      }
   308	    } else if (record_type === 'PAYMENT_CORRECTION') {
   309	      if (operation_type === 'INSERT') {
   310	        const origAmt = payload.original_amount_paise ?? payload.previous_amount_paise ?? 0;
   311	        await tx.runAsync(
   312	          `INSERT INTO payment_corrections (
   313	             id, loan_id, original_transaction_id, original_operation_id, reversal_transaction_id,
   314	             replacement_transaction_id, original_amount_paise, previous_amount_paise, corrected_amount_paise,
   315	             reason, operation_id, created_at
   316	           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   317	           ON CONFLICT(id) DO NOTHING`,
   318	          [
   319	            payload.id,
   320	            payload.loan_id,
   321	            payload.original_transaction_id,
   322	            payload.original_operation_id || null,
   323	            payload.reversal_transaction_id,
   324	            payload.replacement_transaction_id || null,
   325	            origAmt,
   326	            origAmt,
   327	            payload.corrected_amount_paise,
   328	            payload.reason,
   329	            payload.operation_id || null,
   330	            payload.created_at || new Date().toISOString(),
   331	          ]
   332	        );
   333	      }
   334	    } else if (record_type === 'KIST') {
   335	      if (operation_type === 'INSERT') {
   336	        const existingKist = await tx.getFirstAsync<{ id: string }>(
   337	          `SELECT id FROM repayment_schedules WHERE id = ? OR (loan_id = ? AND installment_number = ?)`,
   338	          [payload.id, payload.loan_id, payload.installment_number]
   339	        );
   340	        if (existingKist) {
   525	        new_start_date = last_maturity_date
   526	        start_date_str = new_start_date.strftime("%Y-%m-%d") if hasattr(new_start_date, 'strftime') else str(new_start_date)
   527	        new_maturity_date = calculate_next_due_date(start_date_str, additional_months, locked_loan.due_day)
   528	        rate_val = locked_loan.annual_rate or (Decimal(str(locked_loan.markup_factor)) * Decimal(100))
   529	        new_interest = calculate_contract_interest(locked_loan.principal_paise, rate_val, additional_months)
   530	
   531	        term_obj = LoanTerm.objects.create(
   532	            tenant=locked_loan.tenant,
   533	            loan=locked_loan,
   534	            term_number=new_term_number,
   535	            duration_months=additional_months,
   536	            annual_rate=rate_val,
   537	            interest_paise=new_interest,
   538	            start_date=start_date_str,
   539	            maturity_date=new_maturity_date,
   540	            interest_paid_paise=0,
   541	            settled=False,
   542	            operation_id=operation_id
   543	        )
   544	
   545	        locked_loan.term_months += additional_months
   546	        locked_loan.interest_paise = (locked_loan.interest_paise or 0) + new_interest
   547	        locked_loan.total_paise = locked_loan.principal_paise + locked_loan.interest_paise
   548	        locked_loan.maturity_date = new_maturity_date
   549	        locked_loan.save(update_fields=['term_months', 'interest_paise', 'total_paise', 'maturity_date'])
   550	
   551	        # Publish to SyncOutbox
   552	        SyncOutbox.objects.create(
   553	            tenant=locked_loan.tenant,
   554	            record_type='LOAN_TERM',
   555	            record_id=term_obj.id,
   556	            operation_type='INSERT',
   557	            payload={
   558	                'id': str(term_obj.id),
   559	                'loan_id': str(locked_loan.id),
   560	                'term_number': term_obj.term_number,
   561	                'duration_months': term_obj.duration_months,
   562	                'annual_rate': str(term_obj.annual_rate),
   563	                'interest_paise': term_obj.interest_paise,
   564	                'start_date': str(term_obj.start_date),
   565	                'maturity_date': str(term_obj.maturity_date),
   566	                'settled': term_obj.settled,
   567	                'interest_settled': term_obj.settled,
   568	                'operation_id': str(operation_id)
   569	            }
   570	        )
   571	        SyncOutbox.objects.create(
   572	            tenant=locked_loan.tenant,
   573	            record_type='LOAN',
   574	            record_id=locked_loan.id,
   575	            operation_type='UPDATE',
   345	  async correctPayment(
   346	    originalTransactionId: string,
   347	    correctedPaise: Paise,
   348	    reason: string,
   349	    clientOpId?: string
   350	  ): Promise<{ reversalTransactionId: string; replacementTransactionId: string | null }> {
   351	    const opId = clientOpId || ((crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('corr-' + Date.now() + '-' + Math.random().toString(36).substring(2)));
   352	
   353	    // Idempotency pre-check
   354	    if (clientOpId) {
   355	      const existingOutbox = await this.db.getFirstAsync<any>(
   356	        `SELECT * FROM sync_outbox WHERE operation_id = ?`,
   357	        [clientOpId]
   358	      );
   359	      if (existingOutbox) {
   360	        const existingReversal = await this.db.getFirstAsync<any>(
   361	          `SELECT id FROM transactions WHERE operation_id = ?`,
   362	          [`reversal-${clientOpId}`]
   363	        );
   364	        const existingRepl = await this.db.getFirstAsync<any>(
   365	          `SELECT id FROM transactions WHERE operation_id = ?`,
   366	          [clientOpId]
   367	        );
   368	        if (existingReversal) {
   369	          return {
   370	            reversalTransactionId: existingReversal.id,
   371	            replacementTransactionId: existingRepl ? existingRepl.id : null,
   372	          };
   373	        }
   374	      }
   375	    }
   376	
   377	    let reversalTxId = '';
   378	    let replacementTxId: string | null = null;
   379	
   380	    await withDbTransaction(this.db, async (tx) => {
   381	      const orig = await tx.getFirstAsync<any>(
   382	        `SELECT * FROM transactions WHERE id = ?`,
   383	        [originalTransactionId]
   384	      );
   385	      if (!orig) throw new Error('Original transaction not found');
   386	      if (orig.transaction_type !== 'COLLECTION') {
   387	        throw new Error('Only COLLECTION transactions can be corrected');
   388	      }
   389	
   390	      // Check if already reversed
   391	      const existingReversal = await tx.getFirstAsync<any>(
   392	        `SELECT id FROM transactions WHERE reversal_of_id = ? AND transaction_type = 'REVERSAL'`,
   393	        [originalTransactionId]
   394	      );
   395	      if (existingReversal) {
   396	        throw new Error('Transaction has already been reversed or corrected');
   397	      }
   398	
   399	      const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [orig.loan_id]);
   400	      if (!loan) throw new Error('Loan not found');
   401	
   402	      reversalTxId = (crypto?.randomUUID ? crypto.randomUUID() : '') || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '') || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2));
   403	      const now = new Date().toISOString();
   404	
   405	      // 1. Insert REVERSAL transaction with negative allocations

 succeeded in 16919ms:
exec
/bin/bash -lc './node_modules/.bin/eslint --no-cache src/core/database/loanRepository.ts src/core/database/transactionRepository.ts src/core/database/schema.ts src/core/sync/syncService.ts src/core/sync/outbox.ts src/core/domain/money.ts src/ui/MoneyInput.tsx' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 62ee653:src/core/sync/syncService.ts | nl -ba | sed -n '575,615p'; git show 62ee653:src/ui/MoneyInput.tsx | nl -ba | sed -n '37,59p'; git show 62ee653:backend/ledger/engine/ledger_service.py | rg -n -C 3 'PaymentCorrection.objects.create|correction_obj|PAYMENT_CORRECTION'" in /mnt/f/personal projects/credkeep
 succeeded in 460ms:
   575	      `UPDATE repayment_schedules SET
   576	         principal_paid_paise = COALESCE(server_principal_paid_paise, 0),
   577	         markup_paid_paise = COALESCE(server_markup_paid_paise, 0),
   578	         status = COALESCE(server_status, 'PENDING')
   579	       WHERE loan_id = ?`,
   580	      [loanId]
   581	    );
   582	
   583	    const pendingOutbox = await tx.getAllAsync<{ operation_id: string; payload: string }>(
   584	      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
   585	    );
   586	
   587	    const relevant = pendingOutbox.filter((item) => {
   588	      try {
   589	        const p = JSON.parse(item.payload);
   590	        return p.loan_id === loanId;
   591	      } catch {
   592	        return false;
   593	      }
   594	    });
   595	
   596	    relevant.sort((a, b) => {
   597	      try {
   598	        const pa = JSON.parse(a.payload);
   599	        const pb = JSON.parse(b.payload);
   600	        const dateA = pa.effective_date || '';
   601	        const dateB = pb.effective_date || '';
   602	        if (dateA !== dateB) return dateA.localeCompare(dateB);
   603	      } catch {}
   604	      return 0;
   605	    });
   606	
   607	    const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
   608	
   609	    let replayedBulletPrincipalPaid = 0;
   610	    if (loan?.product_type === 'bullet') {
   611	      const bulletPrincipalRow = await tx.getFirstAsync<{ total: number }>(
   612	        `SELECT COALESCE(SUM(allocated_principal_paise), 0) as total FROM transactions
   613	         WHERE loan_id = ? AND transaction_type IN ('COLLECTION', 'REVERSAL')
   614	           AND NOT EXISTS (
   615	             SELECT 1 FROM sync_outbox so
    37	}: MoneyInputProps) {
    38	  const [isFocused, setIsFocused] = useState(false);
    39	
    40	  const displayValue = valuePaise !== undefined 
    41	    ? (valuePaise > 0 ? Math.round(valuePaise / 100).toString() : '')
    42	    : (value || '');
    43	
    44	  const handleChangeText = (text: string) => {
    45	    // Only allow digits
    46	    const cleaned = text.replace(/[^0-9]/g, '');
    47	    if (onChangeValue) {
    48	      onChangeValue(cleaned);
    49	    }
    50	    if (onChangePaise) {
    51	      const rupees = parseInt(cleaned, 10) || 0;
    52	      onChangePaise(toPaise(rupees));
    53	    }
    54	  };
    55	
    56	  const getInWords = (numStr: string) => {
    57	    const val = parseInt(numStr, 10);
    58	    if (!val || isNaN(val)) return null;
    59	    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
701-            )
702-            replacement_tx = res.get('transaction')
703-
704:        correction_obj = PaymentCorrection.objects.create(
705-            tenant=tenant,
706-            loan=locked_loan,
707-            original_transaction=orig_tx,
--
733-
734-        SyncOutbox.objects.create(
735-            tenant=tenant,
736:            record_type='PAYMENT_CORRECTION',
737:            record_id=correction_obj.id,
738-            operation_type='INSERT',
739-            payload={
740:                'id': str(correction_obj.id),
741-                'loan_id': str(locked_loan.id),
742-                'original_transaction_id': str(orig_tx.id),
743-                'original_operation_id': str(orig_tx.operation_id),
744-                'reversal_transaction_id': str(reversal_tx.id),
745-                'replacement_transaction_id': str(replacement_tx.id) if replacement_tx else None,
746:                'original_amount_paise': correction_obj.original_amount_paise,
747:                'corrected_amount_paise': correction_obj.corrected_amount_paise,
748:                'reason': correction_obj.reason,
749-                'operation_id': str(operation_id)
750-            }
751-        )
--
760-            }
761-        )
762-
763:        return {'status': 'SUCCESS', 'correction': correction_obj}
764-
765-
766-def close_loan(

codex
I found blocking sync defects: lost push responses can cause payment replay, and locally created terms and corrections can collide with server records during pull. Attachment operations also use IDs the server rejects.

TypeScript passed. Expo lint and Jest hit filesystem-write errors in the read-only sandbox; scoped ESLint is still running.
exec
/bin/bash -lc "python3 - <<'PY'
import sqlite3
for table in ('loan_terms', 'payment_corrections'):
    db = sqlite3.connect(':memory:')
    db.execute(f'CREATE TABLE {table}(id TEXT PRIMARY KEY, operation_id TEXT UNIQUE)')
    db.execute(f'INSERT INTO {table} VALUES (?, ?)', ('local-id', 'shared-operation-id'))
    try:
        db.execute(f'INSERT INTO {table} VALUES (?, ?) ON CONFLICT(id) DO NOTHING', ('server-id', 'shared-operation-id'))
    except sqlite3.IntegrityError as error:
        print(f'{table}: {error}')
PY" in /mnt/f/personal projects/credkeep
 succeeded in 117ms:
loan_terms: UNIQUE constraint failed: loan_terms.operation_id
payment_corrections: UNIQUE constraint failed: payment_corrections.operation_id

 succeeded in 48937ms:
codex
**REWORK**

1. **P1 — Failed push can double-count payments.** [syncService.ts:1178](/mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:1178): If the server commits a payment but its response is lost, pull now proceeds with the operation still `PENDING`. Pending replay applies it again over the server’s updated schedule, potentially settling an underpaid loan. Restore the failure guard or reconcile acknowledged operations before replay.

2. **P1 — Bullet extensions block subsequent sync.** [loanRepository.ts:485](/mnt/f/personal projects/credkeep/src/core/database/loanRepository.ts:485): Local and server terms have different IDs but now share a unique `operation_id`. Pull reconciles only by primary ID, causing a uniqueness failure that prevents cursor advancement. Reconcile terms by operation ID before insertion.

3. **P1 — Payment corrections block subsequent sync.** [syncService.ts:312](/mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:312): Local corrections now persist the same unique operation ID returned under a different server correction ID. `ON CONFLICT(id)` does not handle this collision, so accepted corrections repeatedly fail during pull. Reconcile by operation ID.

4. **P1 — New-loan attachments cannot sync.** [loanRepository.ts:247](/mnt/f/personal projects/credkeep/src/core/database/loanRepository.ts:247): Attachment operations use `att-<uuid>`, which the server rejects as an invalid UUID. They also precede their parent loan operation. Generate valid UUIDs and enqueue the loan first.

TypeScript and scoped ESLint passed. SQLite uniqueness failures were reproduced in memory. Jest could not run because its temporary-directory creation was blocked by the read-only sandbox.
tokens used
89,881
**REWORK**

1. **P1 — Failed push can double-count payments.** [syncService.ts:1178](/mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:1178): If the server commits a payment but its response is lost, pull now proceeds with the operation still `PENDING`. Pending replay applies it again over the server’s updated schedule, potentially settling an underpaid loan. Restore the failure guard or reconcile acknowledged operations before replay.

2. **P1 — Bullet extensions block subsequent sync.** [loanRepository.ts:485](/mnt/f/personal projects/credkeep/src/core/database/loanRepository.ts:485): Local and server terms have different IDs but now share a unique `operation_id`. Pull reconciles only by primary ID, causing a uniqueness failure that prevents cursor advancement. Reconcile terms by operation ID before insertion.

3. **P1 — Payment corrections block subsequent sync.** [syncService.ts:312](/mnt/f/personal projects/credkeep/src/core/sync/syncService.ts:312): Local corrections now persist the same unique operation ID returned under a different server correction ID. `ON CONFLICT(id)` does not handle this collision, so accepted corrections repeatedly fail during pull. Reconcile by operation ID.

4. **P1 — New-loan attachments cannot sync.** [loanRepository.ts:247](/mnt/f/personal projects/credkeep/src/core/database/loanRepository.ts:247): Attachment operations use `att-<uuid>`, which the server rejects as an invalid UUID. They also precede their parent loan operation. Generate valid UUIDs and enqueue the loan first.

TypeScript and scoped ESLint passed. SQLite uniqueness failures were reproduced in memory. Jest could not run because its temporary-directory creation was blocked by the read-only sandbox.

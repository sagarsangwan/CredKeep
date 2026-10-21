OpenAI Codex v0.163.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a15d35-2139-7270-a6ed-110efcc19e83
--------
user
Perform focused, read-only QA review on milestone Incident_Recovery_P0.
Review ONLY the git diff between 4aab583 and 1ee62c7 and directly impacted dependencies.
Scope: Verify financial calculation correctness, payment idempotency, tenant isolation, SQLCipher/database mutations, migrations, or sync integrity.

Token-Optimization & Review Invariants:
1. Review only the changed files in the commit range (4aab583...1ee62c7). Do not perform broad repository indexing.
2. Limit your findings to at most 5 actionable issues, ordered strictly by severity (P0 Critical first, down to P2 Minor).
3. If no critical or high severity defects are found, return: APPROVED.
4. If blocking defects exist, provide concise file/line references and return: REWORK.
5. Do NOT suggest broad architectural rewrites or stylistic nitpicks.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the specified diff and directly impacted dependencies, focusing on the listed financial, database, security, and sync risks. I’ll keep the review read-only.
exec
/bin/bash -lc 'cat .agents/skills/code-review/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 47ms:
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
/bin/bash -lc 'git diff --stat 4aab583...1ee62c7; git status --short' in /mnt/f/personal projects/credkeep
 succeeded in 3129ms:
 src/app/(tabs)/_layout.tsx                  |  9 +++++++--
 src/app/(tabs)/index.tsx                    |  4 ++--
 src/app/(tabs)/more.tsx                     |  6 +++---
 src/app/auth/register.tsx                   |  6 +++---
 src/app/loan/components/MonthlyKistView.tsx |  3 ++-
 src/app/loan/create/LoanWizardContext.tsx   |  6 ++++++
 src/app/loan/create/review.tsx              |  2 +-
 src/core/sync/syncService.ts                | 21 +++++++++++++++++----
 8 files changed, 41 insertions(+), 16 deletions(-)
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
 M .workflow/reports/V2_Signoff_qa_guard.json
 M .workflow/reports/V2_Signoff_qa_prompt.txt
 M .workflow/reports/V2_Signoff_qa_report.md
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
 M backend/tenants/migrations/0006_googleidentity.py
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
?? .workflow/reports/Incident_Recovery_P0_qa_prompt.txt
?? .workflow/reports/Incident_Recovery_P0_qa_report.md
?? .workflow/reports/OAuth_Audience_Fix_qa_guard.json
?? .workflow/reports/OAuth_Audience_Fix_qa_prompt.txt
?? .workflow/reports/OAuth_Audience_Fix_qa_report.md

codex
I’m applying the code-review skill within your severity and scope limits. The range changes eight files; I’ll read them from the target commit so local working-tree changes don’t affect the review.
exec
/bin/bash -lc 'git diff 4aab583...1ee62c7 --; git log --oneline 4aab583..1ee62c7' in /mnt/f/personal projects/credkeep
 succeeded in 409ms:
diff --git a/src/app/(tabs)/_layout.tsx b/src/app/(tabs)/_layout.tsx
index 103e868..f013a6c 100644
--- a/src/app/(tabs)/_layout.tsx
+++ b/src/app/(tabs)/_layout.tsx
@@ -1,9 +1,14 @@
 import { Tabs } from 'expo-router';
 import { Home, Users, Landmark, Banknote, Menu } from 'lucide-react-native';
 
+import { useSafeAreaInsets } from 'react-native-safe-area-context';
+
 import { theme } from '../../ui/theme';
 
 export default function TabLayout() {
+  const insets = useSafeAreaInsets();
+  const bottomInset = insets.bottom;
+
   return (
     <Tabs screenOptions={{ 
       headerShown: false,
@@ -13,8 +18,8 @@ export default function TabLayout() {
         backgroundColor: theme.colors.background,
         borderTopWidth: 1,
         borderTopColor: theme.colors.borderDefault,
-        height: 60,
-        paddingBottom: 8,
+        height: 60 + bottomInset,
+        paddingBottom: Math.max(bottomInset, 8),
         paddingTop: 6,
       },
       tabBarLabelStyle: {
diff --git a/src/app/(tabs)/index.tsx b/src/app/(tabs)/index.tsx
index e9ac8b7..176148a 100644
--- a/src/app/(tabs)/index.tsx
+++ b/src/app/(tabs)/index.tsx
@@ -144,7 +144,7 @@ export default function HomeScreen() {
       {/* Top Header */}
       <View style={styles.header}>
         <View style={styles.headerLeft}>
-          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
             {tenantName}
           </Typography>
           <View style={styles.syncRow}>
@@ -170,7 +170,7 @@ export default function HomeScreen() {
       </View>
 
       {/* Hairline Offline Banner */}
-      <OfflineBanner visible={syncState.status === 'OFFLINE' || syncState.pendingCount > 0} />
+      <OfflineBanner visible={syncState.status === 'OFFLINE'} />
 
       <ScrollView
         style={styles.container}
diff --git a/src/app/(tabs)/more.tsx b/src/app/(tabs)/more.tsx
index 7cb6659..7f641da 100644
--- a/src/app/(tabs)/more.tsx
+++ b/src/app/(tabs)/more.tsx
@@ -161,11 +161,11 @@ export default function MoreScreen() {
         {/* Cloud Sync & Account Status Card */}
         <Card style={styles.syncCard}>
           <View style={styles.syncHeader}>
-            <View style={{ flex: 1 }}>
-              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
+            <View style={{ flex: 1, marginRight: 8 }}>
+              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
                 {user ? `Workspace: ${tenantName || 'Private'}` : 'Not Signed In'}
               </Typography>
-              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
+              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                 {user ? `@${user.username}` : 'Sign in to access your ledger'}
               </Typography>
             </View>
diff --git a/src/app/auth/register.tsx b/src/app/auth/register.tsx
index fa156cb..aa1f38c 100644
--- a/src/app/auth/register.tsx
+++ b/src/app/auth/register.tsx
@@ -278,17 +278,17 @@ export default function RegisterScreen() {
               }
             />
 
-            {/* Zero Cloud Reliance Spec Card */}
+            {/* Offline-First Encrypted Ledger Spec Card */}
             <View style={styles.specCard}>
               <View style={styles.specIconBadge}>
                 <Shield size={18} color={theme.colors.textPrimary} />
               </View>
               <View style={{ flex: 1 }}>
                 <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
-                  Zero Cloud Reliance
+                  Offline-First Encrypted Ledger
                 </Typography>
                 <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.specText}>
-                  Your records never leave internal sandboxed flash memory. Data export is manual via encrypted SQLite archives.
+                  Your records are securely encrypted on-device with SQLCipher 256-bit and synchronize seamlessly with your cloud ledger when online.
                 </Typography>
               </View>
             </View>
diff --git a/src/app/loan/components/MonthlyKistView.tsx b/src/app/loan/components/MonthlyKistView.tsx
index 21d4486..c54c29c 100644
--- a/src/app/loan/components/MonthlyKistView.tsx
+++ b/src/app/loan/components/MonthlyKistView.tsx
@@ -72,6 +72,7 @@ export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
       case 'PAID':
         return { bg: theme.colors.successContainer, text: theme.colors.successText, label: 'Paid' };
       case 'PARTIAL':
+      case 'PARTIALLY_PAID':
         return { bg: theme.colors.warningContainer, text: theme.colors.warningText, label: 'Partial' };
       case 'OVERDUE':
         return { bg: theme.colors.dangerContainer, text: theme.colors.dangerText, label: 'Overdue' };
@@ -230,7 +231,7 @@ export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
                 </View>
                 {totalPaid > 0 && item.status !== 'PAID' && (
                   <Typography variant="bodySm" tabularNums color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
-                    Paid {formatINR(totalPaid)}
+                    Paid {formatINR(totalPaid)} • Due {formatINR(Math.max(0, (item.total_due_paise || 0) - totalPaid) as Paise)}
                   </Typography>
                 )}
               </View>
diff --git a/src/app/loan/create/LoanWizardContext.tsx b/src/app/loan/create/LoanWizardContext.tsx
index 9a46617..bca1785 100644
--- a/src/app/loan/create/LoanWizardContext.tsx
+++ b/src/app/loan/create/LoanWizardContext.tsx
@@ -7,6 +7,7 @@ import {
   generateSchedule,
   calculateContractInterest,
   calculateMaturityDate,
+  calculateNextDueDate,
 } from '../../../core/domain/schedule';
 
 export interface LoanDraftState {
@@ -27,6 +28,7 @@ export interface CalculatedLoanSummary {
   totalInterestPaise: Paise;
   totalPayablePaise: Paise;
   monthlyAmountPaise: Paise;
+  firstDueDate: string;
   maturityDate: string;
   schedule: {
     periodNumber: number;
@@ -93,11 +95,13 @@ export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children
       const totalInterestPaise = Math.round(monthlyInterestPaise * months) as Paise;
       const totalPayablePaise = (principal + totalInterestPaise) as Paise;
       const maturityDate = calculateMaturityDate(startDate, months, dueDay);
+      const firstDueDate = calculateNextDueDate(startDate, 1, dueDay);
 
       return {
         totalInterestPaise,
         totalPayablePaise,
         monthlyAmountPaise: monthlyInterestPaise,
+        firstDueDate,
         maturityDate,
         schedule: [],
       };
@@ -106,6 +110,7 @@ export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children
       const interestPaise = calculateContractInterest(principal, rate, months);
       const totalPaise = (principal + interestPaise) as Paise;
       const maturityDate = calculateMaturityDate(startDate, months, dueDay);
+      const defaultFirstDueDate = calculateNextDueDate(startDate, 1, dueDay);
 
       let scheduleItems: any[] = [];
       try {
@@ -135,6 +140,7 @@ export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children
         totalInterestPaise: interestPaise,
         totalPayablePaise: totalPaise,
         monthlyAmountPaise: monthlyKist,
+        firstDueDate: scheduleItems[0]?.dueDate || defaultFirstDueDate,
         maturityDate,
         schedule: scheduleItems,
       };
diff --git a/src/app/loan/create/review.tsx b/src/app/loan/create/review.tsx
index 6e07e19..bad1300 100644
--- a/src/app/loan/create/review.tsx
+++ b/src/app/loan/create/review.tsx
@@ -90,7 +90,7 @@ export default function Step4ReviewScreen() {
           />
           <FinancialSummaryRow
             label="First Payment Due"
-            value={calculated.schedule[0]?.dueDate || draft.startDate}
+            value={calculated.firstDueDate || calculated.schedule[0]?.dueDate || draft.startDate}
           />
           <FinancialSummaryRow
             label="Maturity Date"
diff --git a/src/core/sync/syncService.ts b/src/core/sync/syncService.ts
index eeca0d7..1f89e40 100644
--- a/src/core/sync/syncService.ts
+++ b/src/core/sync/syncService.ts
@@ -21,7 +21,7 @@ export class SyncService {
   /**
    * PUSH Protocol: Sends un-synced local operations to /api/v2/sync/push/
    */
-  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number }> {
+  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number; transportError?: string }> {
     const token = await AuthStore.getToken();
     if (!token) return { pushed: 0, failed: 0 };
 
@@ -82,9 +82,13 @@ export class SyncService {
           // Stop further batch execution on failure to preserve sequential dependency
           break;
         }
-      } catch {
-        totalFailed += pending.length;
-        break;
+      } catch (err: any) {
+        console.warn('[SYNC] Push batch failed transport:', err);
+        return {
+          pushed: totalPushed,
+          failed: totalFailed,
+          transportError: err?.message || 'Network or server error during push',
+        };
       }
     }
 
@@ -1288,6 +1292,15 @@ export class SyncService {
   static async syncAll(db: SQLiteDatabase): Promise<SyncResult> {
     try {
       const pushRes = await this.pushPending(db);
+      if ((pushRes as any).transportError) {
+        return {
+          pushedCount: pushRes.pushed,
+          pulledCount: 0,
+          needsReviewCount: 0,
+          success: false,
+          errors: [`Sync push failed: ${(pushRes as any).transportError}`],
+        };
+      }
       const pullRes = await this.pullChanges(db);
       const needsReviewItems = await OutboxManager.getNeedsReview(db);
       if (needsReviewItems.length > 0 || pushRes.failed > 0) {
1ee62c7 fix(sync,ui): fix android 3-button tab inset, bullet loan schedule date, and sync transport error handling

exec
/bin/bash -lc 'git show 1ee62c7:src/app/loan/create/LoanWizardContext.tsx; git show 1ee62c7:src/app/loan/components/MonthlyKistView.tsx; git show 1ee62c7:src/core/domain/schedule.ts' in /mnt/f/personal projects/credkeep
 succeeded in 311ms:
import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { Paise, toPaise } from '../../../core/domain/money';
import { Borrower } from '../../../core/database/borrowerRepository';
import { AttachmentItem } from '../../../ui/AttachmentGrid';
import { useDatabase } from '../../../core/database/DatabaseProvider';
import {
  generateSchedule,
  calculateContractInterest,
  calculateMaturityDate,
  calculateNextDueDate,
} from '../../../core/domain/schedule';

export interface LoanDraftState {
  borrowerId: string;
  borrower: Borrower | null;
  productType: 'instalment' | 'bullet';
  rateBasis: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';
  principalPaise: Paise;
  annualRate: number;
  termMonths: number;
  startDate: string;
  dueDay: number;
  collateral: string;
  attachments: AttachmentItem[];
}

export interface CalculatedLoanSummary {
  totalInterestPaise: Paise;
  totalPayablePaise: Paise;
  monthlyAmountPaise: Paise;
  firstDueDate: string;
  maturityDate: string;
  schedule: {
    periodNumber: number;
    dueDate: string;
    principalDuePaise: Paise;
    markupDuePaise: Paise;
    totalDuePaise: Paise;
  }[];
}

export interface LoanWizardContextValue {
  draft: LoanDraftState;
  updateDraft: (updates: Partial<LoanDraftState>) => void;
  resetDraft: () => void;
  calculated: CalculatedLoanSummary;
  commitLoan: () => Promise<string>;
  isSubmitting: boolean;
  submitError: string | null;
}

const initialDraft: LoanDraftState = {
  borrowerId: '',
  borrower: null,
  productType: 'instalment',
  rateBasis: 'ANNUAL_SIMPLE_FLAT',
  principalPaise: toPaise(50000),
  annualRate: 24,
  termMonths: 10,
  startDate: new Date().toISOString().split('T')[0],
  dueDay: 5,
  collateral: '',
  attachments: [],
};

const LoanWizardContext = createContext<LoanWizardContextValue | undefined>(undefined);

export const LoanWizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { loans, triggerRefresh } = useDatabase();
  const [draft, setDraft] = useState<LoanDraftState>(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateDraft = (updates: Partial<LoanDraftState>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const resetDraft = () => {
    setDraft(initialDraft);
    setSubmitError(null);
  };

  const calculated = useMemo<CalculatedLoanSummary>(() => {
    const principal = draft.principalPaise;
    const rate = draft.annualRate;
    const months = draft.termMonths;
    const startDate = draft.startDate;
    const dueDay = draft.dueDay;
    const isBullet = draft.productType === 'bullet';

    if (isBullet) {
      // Bullet loan: Monthly interest only, full principal at maturity
      const monthlyRate = rate / 12 / 100;
      const monthlyInterestPaise = Math.round(principal * monthlyRate) as Paise;
      const totalInterestPaise = Math.round(monthlyInterestPaise * months) as Paise;
      const totalPayablePaise = (principal + totalInterestPaise) as Paise;
      const maturityDate = calculateMaturityDate(startDate, months, dueDay);
      const firstDueDate = calculateNextDueDate(startDate, 1, dueDay);

      return {
        totalInterestPaise,
        totalPayablePaise,
        monthlyAmountPaise: monthlyInterestPaise,
        firstDueDate,
        maturityDate,
        schedule: [],
      };
    } else {
      // Instalment loan: Fixed monthly kists
      const interestPaise = calculateContractInterest(principal, rate, months);
      const totalPaise = (principal + interestPaise) as Paise;
      const maturityDate = calculateMaturityDate(startDate, months, dueDay);
      const defaultFirstDueDate = calculateNextDueDate(startDate, 1, dueDay);

      let scheduleItems: any[] = [];
      try {
        const gen = generateSchedule({
          principal,
          annualRate: rate,
          rateBasis: 'ANNUAL_SIMPLE_FLAT',
          termMonths: months,
          startDate,
          dueDay,
          productType: 'instalment',
        });
        scheduleItems = gen.map((item) => ({
          periodNumber: item.kistNumber,
          dueDate: item.dueDate,
          principalDuePaise: item.principalDue,
          markupDuePaise: item.markupDue,
          totalDuePaise: item.amountDue,
        }));
      } catch {
        // Fallback if dates invalid during typing
      }

      const monthlyKist = months > 0 ? (Math.round(totalPaise / months) as Paise) : (0 as Paise);

      return {
        totalInterestPaise: interestPaise,
        totalPayablePaise: totalPaise,
        monthlyAmountPaise: monthlyKist,
        firstDueDate: scheduleItems[0]?.dueDate || defaultFirstDueDate,
        maturityDate,
        schedule: scheduleItems,
      };
    }
  }, [
    draft.principalPaise,
    draft.annualRate,
    draft.termMonths,
    draft.startDate,
    draft.dueDay,
    draft.productType,
  ]);

  const commitLoan = async (): Promise<string> => {
    if (!loans) throw new Error('Database not initialized');
    if (!draft.borrowerId) throw new Error('Please select a borrower');

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isBullet = draft.productType === 'bullet';

      // Map attachments to repository input
      const attachmentInputs = draft.attachments.map((att) => ({
        file_path: att.filePath,
        doc_type: att.docType,
        notes: att.fileName,
      }));

      const createdLoan = await loans.createLoanWithSchedule(
        draft.borrowerId,
        {
          principal: draft.principalPaise,
          annualRate: draft.annualRate,
          rateBasis: isBullet ? 'ANNUAL_SIMPLE_FLAT' : undefined,
          termMonths: draft.termMonths,
          startDate: draft.startDate,
          dueDay: draft.dueDay,
          productType: draft.productType,
          collateral: draft.collateral || undefined,
          attachments: attachmentInputs,
        }
      );

      triggerRefresh();
      resetDraft();
      return createdLoan.id;
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create loan');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoanWizardContext.Provider
      value={{
        draft,
        updateDraft,
        resetDraft,
        calculated,
        commitLoan,
        isSubmitting,
        submitError,
      }}
    >
      {children}
    </LoanWizardContext.Provider>
  );
};

export const useLoanWizard = () => {
  const context = useContext(LoanWizardContext);
  if (!context) {
    throw new Error('useLoanWizard must be used within a LoanWizardProvider');
  }
  return context;
};
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { AttachmentGrid } from '../../../ui/AttachmentGrid';
import { AuditTimeline, AuditEvent } from '../../../ui/AuditTimeline';
import { theme } from '../../../ui/theme';
import { Loan, LoanAttachment } from '../../../core/database/loanRepository';
import { Borrower } from '../../../core/database/borrowerRepository';
import { formatINR, Paise } from '../../../core/domain/money';

export interface MonthlyKistViewProps {
  loan: Loan;
  borrower: Borrower | null;
  schedule: any[];
  earnings: any;
  history: any[];
  attachments: LoanAttachment[];
  onRecordPayment: () => void;
  onCorrectPayment: (tx: any) => void;
}

export const MonthlyKistView: React.FC<MonthlyKistViewProps> = ({
  loan,
  borrower,
  schedule,
  earnings,
  history,
  attachments,
  onRecordPayment,
  onCorrectPayment,
}) => {

  // Financial calculations
  const totalPrincipal = loan.principal_paise as Paise;
  const totalInterest = (loan.interest_paise || 0) as Paise;
  const totalContract = (loan.total_paise || totalPrincipal + totalInterest) as Paise;

  const principalReturned = (earnings?.principalReturned || 0) as Paise;
  const markupReceived = (earnings?.markupReceived || 0) as Paise;
  const totalCollected = (principalReturned + markupReceived) as Paise;
  const remainingTotal = Math.max(0, totalContract - totalCollected) as Paise;

  const paidKistsCount = schedule.filter((s) => s.status === 'PAID').length;
  const totalKistsCount = schedule.length;

  // Format ledger history events for AuditTimeline
  const auditEvents: AuditEvent[] = history.map((tx) => {
    let type: AuditEvent['type'] = 'COLLECTION';
    if (tx.transaction_type === 'DISBURSEMENT') type = 'DISBURSEMENT';
    else if (tx.transaction_type === 'PENALTY_ASSESSMENT') type = 'PENALTY_ASSESSMENT';
    else if (tx.transaction_type === 'REVERSAL') type = 'REVERSAL';
    else if (tx.transaction_type === 'CORRECTION_REPLACEMENT') type = 'REPLACEMENT';

    return {
      id: tx.id,
      type,
      title: tx.notes || undefined,
      amountPaise: tx.amount_paise as Paise,
      effectiveDate: tx.effective_date,
      principalPaise: tx.allocated_principal_paise !== undefined ? (tx.allocated_principal_paise as Paise) : undefined,
      interestPaise: tx.allocated_markup_paise !== undefined ? (tx.allocated_markup_paise as Paise) : undefined,
      penaltyPaise: tx.allocated_penalty_paise !== undefined ? (tx.allocated_penalty_paise as Paise) : undefined,
      paymentMethod: tx.payment_method || undefined,
      reason: tx.reason || undefined,
    };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return { bg: theme.colors.successContainer, text: theme.colors.successText, label: 'Paid' };
      case 'PARTIAL':
      case 'PARTIALLY_PAID':
        return { bg: theme.colors.warningContainer, text: theme.colors.warningText, label: 'Partial' };
      case 'OVERDUE':
        return { bg: theme.colors.dangerContainer, text: theme.colors.dangerText, label: 'Overdue' };
      case 'DUE':
      default:
        return { bg: theme.colors.surfaceSoft, text: theme.colors.textSecondary, label: 'Due' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Borrower Header Row */}
      <View style={styles.borrowerCard}>
        <View style={styles.borrowerLeft}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
            {borrower?.name || 'Borrower'}
          </Typography>
          <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
            {borrower?.phone} • Monthly Instalment
          </Typography>
        </View>

        <View
          style={[
            styles.statusPill,
            loan.status === 'ACTIVE'
              ? styles.pillActive
              : loan.status === 'SETTLED'
              ? styles.pillSettled
              : styles.pillDefault,
          ]}
        >
          <Typography
            variant="labelSm"
            color={
              loan.status === 'ACTIVE'
                ? theme.colors.success
                : loan.status === 'SETTLED'
                ? theme.colors.textSecondary
                : theme.colors.danger
            }
          >
            {loan.status}
          </Typography>
        </View>
      </View>

      {/* Hero Financial Summary */}
      <Card style={styles.heroCard}>
        <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.5 }}>
          OUTSTANDING BALANCE
        </Typography>
        <Typography variant="rupeeDisplay" tabularNums color={theme.colors.textPrimary} style={{ marginVertical: 4 }}>
          {formatINR(remainingTotal)}
        </Typography>

        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: totalKistsCount > 0 ? `${(paidKistsCount / totalKistsCount) * 100}%` : '0%' },
              ]}
            />
          </View>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ marginLeft: 8 }}>
            {paidKistsCount} of {totalKistsCount} paid
          </Typography>
        </View>

        {/* 3 Metrics Sub-Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Principal
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalPrincipal)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Total Markup
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalInterest)}
            </Typography>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              Collected
            </Typography>
            <Typography variant="titleMd" tabularNums color={theme.colors.success} style={{ fontWeight: '600', marginTop: 2 }}>
              {formatINR(totalCollected)}
            </Typography>
          </View>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <View style={{ flex: 1 }}>
          <Button
            title="Record Collection"
            variant="primary"
            onPress={onRecordPayment}
          />
        </View>
      </View>

      {/* Repayment Schedule Table */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Repayment Schedule ({schedule.length} Kists)
      </Typography>

      <Card style={styles.scheduleCard}>
        {schedule.map((item, index) => {
          const badge = getStatusBadge(item.status);
          const totalPaid = ((item.principal_paid_paise || 0) + (item.markup_paid_paise || 0)) as Paise;

          return (
            <View
              key={item.id || item.period_number}
              style={[
                styles.scheduleItem,
                index === schedule.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.scheduleItemLeft}>
                <View style={styles.kistBadge}>
                  <Typography variant="labelSm" color={theme.colors.textSecondary} style={{ fontWeight: '700' }}>
                    #{item.period_number}
                  </Typography>
                </View>
                <View>
                  <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                    {formatINR(item.total_due_paise as Paise)}
                  </Typography>
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    Due {item.effective_due_date || item.due_date}
                  </Typography>
                </View>
              </View>

              <View style={styles.scheduleItemRight}>
                <View style={[styles.kistStatusPill, { backgroundColor: badge.bg }]}>
                  <Typography variant="labelSm" color={badge.text} style={{ fontWeight: '600' }}>
                    {badge.label}
                  </Typography>
                </View>
                {totalPaid > 0 && item.status !== 'PAID' && (
                  <Typography variant="bodySm" tabularNums color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                    Paid {formatINR(totalPaid)} • Due {formatINR(Math.max(0, (item.total_due_paise || 0) - totalPaid) as Paise)}
                  </Typography>
                )}
              </View>
            </View>
          );
        })}
      </Card>

      {/* Verified Attachments */}
      {attachments.length > 0 && (
        <>
          <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
            Attached Documents ({attachments.length})
          </Typography>
          <AttachmentGrid
            attachments={attachments.map((a) => ({
              id: a.id,
              filePath: a.file_path,
              docType: (a.doc_type || 'other') as any,
              fileName: a.file_name,
            }))}
            readOnly
          />
        </>
      )}

      {/* Transaction & Audit History */}
      <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.sectionTitle}>
        Financial Audit Trail
      </Typography>

      <AuditTimeline events={auditEvents} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
    paddingBottom: 40,
  },
  borrowerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  borrowerLeft: {
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: theme.colors.successContainer,
    borderColor: '#86EFAC',
  },
  pillSettled: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderDefault,
  },
  pillDefault: {
    backgroundColor: theme.colors.dangerContainer,
    borderColor: '#FECACA',
  },
  heroCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderDefault,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.actionPrimary,
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  metricCol: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.borderDefault,
    marginHorizontal: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  sectionTitle: {
    marginTop: 12,
    fontWeight: '600',
  },
  scheduleCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  scheduleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kistBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleItemRight: {
    alignItems: 'flex-end',
  },
  kistStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
});
import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
import { ScheduledKist } from './models';

export type RateBasis = 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM';

export type ScheduleOptions = {
  principal: Paise;
  annualRate?: number;
  rateBasis?: RateBasis;
  markupFactor?: number;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  productType: 'instalment' | 'bullet';
  collateral?: string | null;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
  const [yearStr, monthStr] = startDateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  
  month += monthsToAdd;
  
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  
  const daysInMonth = getDaysInMonth(year, month);
  const finalDay = Math.min(targetDueDay, daysInMonth);
  
  const yyyy = year.toString();
  const mm = month.toString().padStart(2, '0');
  const dd = finalDay.toString().padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

export function calculateMaturityDate(startDateStr: string, termMonths: number, targetDueDay: number): string {
  return calculateNextDueDate(startDateStr, termMonths, targetDueDay);
}

export function calculateContractInterest(
  principal: Paise,
  annualRate: number,
  termMonths: number
): Paise {
  if (annualRate < 0 || termMonths <= 0) {
    throw new Error('annualRate and termMonths must be non-negative');
  }
  // Formula: Interest = Principal × AnnualRate × DurationMonths / 1200
  return Math.round((principal * annualRate * termMonths) / 1200) as Paise;
}

export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
  const {
    principal,
    annualRate,
    rateBasis = (annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM'),
    markupFactor = 0,
    termMonths,
    startDate,
    dueDay,
    productType
  } = options;

  if (termMonths <= 0) {
    throw new Error('termMonths must be a positive integer');
  }

  // ONE-TIME REPAYMENT (Bullet): NO monthly kists are generated.
  if (productType === 'bullet' && rateBasis === 'ANNUAL_SIMPLE_FLAT') {
    return [];
  }

  let totalMarkup: Paise;
  if (rateBasis === 'ANNUAL_SIMPLE_FLAT' && annualRate !== undefined) {
    totalMarkup = calculateContractInterest(principal, annualRate, termMonths);
  } else {
    if (!Number.isFinite(markupFactor) || markupFactor < 0) {
      throw new Error('markupFactor must be a finite non-negative number');
    }
    totalMarkup = multiplyPaise(principal, markupFactor);
  }

  const schedule: ScheduledKist[] = [];

  if (productType === 'instalment') {
    const principalInstalments = dividePaise(principal, termMonths);
    const markupInstalments = dividePaise(totalMarkup, termMonths);

    for (let i = 0; i < termMonths; i++) {
      schedule.push({
        kistNumber: i + 1,
        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
        principalDue: principalInstalments[i],
        markupDue: markupInstalments[i]
      });
    }
  } else if (productType === 'bullet') {
    // Legacy fixed-term markup bullet
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

exec
/bin/bash -lc "git show 1ee62c7:src/core/database/loanRepository.ts | rg -n -C 7 'bullet|maturity|first_due|due_date'; git show 1ee62c7:src/app/loan/components/BulletLoanView.tsx | rg -n -C 5 'due|Due|monthly|Monthly|maturity'; git show 1ee62c7:src/app/loan/create/review.tsx; git show 1ee62c7:src/core/sync/syncService.ts | sed -n '1,160p;1270,1360p'; git show 1ee62c7:package.json" in /mnt/f/personal projects/credkeep
 succeeded in 485ms:
11-  borrower_id: string;
12-  principal_paise: number;
13-  markup_factor: number;
14-  annual_rate?: number | null;
15-  rate_basis?: 'ANNUAL_SIMPLE_FLAT' | 'LEGACY_FIXED_TERM' | null;
16-  interest_paise?: number | null;
17-  total_paise?: number | null;
18:  maturity_date?: string | null;
19-  term_months: number;
20-  start_date: string;
21-  due_day: number;
22-  product_type: string;
23-  status: string;
24-  collateral?: string | null;
25-  created_at: string;
--
29-  id: string;
30-  loan_id: string;
31-  term_number: number;
32-  duration_months: number;
33-  annual_rate: number;
34-  interest_paise: number;
35-  start_date: string;
36:  maturity_date: string;
37-  interest_settled: number;
38-  settled?: number;
39-  operation_id?: string | null;
40-  created_at: string;
41-};
42-
43-export type LoanAttachmentInput = {
--
98-    
99-    const annualRate = options.annualRate ?? (options.markupFactor ? Math.round(options.markupFactor * 100 * 12 / (options.termMonths || 1)) : 0);
100-    const rateBasis = options.rateBasis || (options.annualRate !== undefined ? 'ANNUAL_SIMPLE_FLAT' : 'LEGACY_FIXED_TERM');
101-    const interestPaise = (rateBasis === 'ANNUAL_SIMPLE_FLAT' || options.annualRate !== undefined)
102-      ? calculateContractInterest(options.principal, annualRate, options.termMonths)
103-      : multiplyPaise(options.principal as Paise, options.markupFactor || 0);
104-    const totalPaise = options.principal + interestPaise;
105:    const maturityDate = calculateMaturityDate(options.startDate, options.termMonths, options.dueDay);
106-
107-    const schedule = generateSchedule({
108-      ...options,
109-      annualRate,
110-      rateBasis,
111-    });
112-
--
147-          }
148-        }
149-      }
150-
151-      await txHandle.runAsync(
152-        `INSERT INTO loans (
153-          id, borrower_id, principal_paise, markup_factor, annual_rate, rate_basis,
154:          interest_paise, total_paise, maturity_date, term_months, start_date, due_day,
155-          product_type, collateral, created_at
156-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
157-        [
158-          loanId,
159-          borrowerId,
160-          options.principal,
161-          options.markupFactor || 0,
162-          annualRate,
163-          rateBasis,
164-          interestPaise,
165-          totalPaise,
166:          maturityDate,
167-          options.termMonths,
168-          options.startDate,
169-          options.dueDay,
170-          options.productType,
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
181:            start_date, maturity_date, interest_settled, settled, operation_id, created_at
182-          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
183-          [
184-            generateUuid(),
185-            loanId,
186-            1,
187-            options.termMonths,
188-            annualRate,
189-            interestPaise,
190-            options.startDate,
191:            maturityDate,
192-            0,
193-            0,
194-            clientOpId || null,
195-            created_at,
196-          ]
197-        );
198-      }
199-      
200-      if (schedule.length > 0) {
201-        const statement = await txHandle.prepareAsync(`
202-          INSERT INTO repayment_schedules 
203:          (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
204-          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
205-        `);
206-        
207-        try {
208-          for (const kist of schedule) {
209-            await statement.executeAsync([
210-              generateUuid(),
--
230-          borrower_id: borrowerId,
231-          principal_paise: options.principal,
232-          markup_factor: options.markupFactor || 0,
233-          annual_rate: annualRate,
234-          rate_basis: rateBasis,
235-          interest_paise: interestPaise,
236-          total_paise: totalPaise,
237:          maturity_date: maturityDate,
238-          term_months: options.termMonths,
239-          start_date: options.startDate,
240-          due_day: options.dueDay,
241-          product_type: options.productType,
242-          collateral: options.collateral || null,
243-        },
244-      });
--
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
320-      SELECT * FROM repayment_schedules 
321-      WHERE loan_id = ? 
322-      ORDER BY installment_number ASC
323-    `, [loanId]);
324-    
325-    if (kists.length === 0) return;
326-    const lastKist = kists[kists.length - 1];
327-    const currentDate = new Date().toISOString().split('T')[0];
328-    
329-    // If the last kist's due date is in the past, generate new ones until we pass currentDate
330:    if (lastKist.effective_due_date < currentDate) {
331-      const totalMarkup = multiplyPaise(loan.principal_paise as Paise, loan.markup_factor);
332-      const markupDuePerMonth = Math.floor(totalMarkup / loan.term_months);
333-      
334-      let nextInstalmentNumber = lastKist.installment_number + 1;
335-      let monthsToAddFromStart = nextInstalmentNumber;
336-      
337-      let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
338-      
339-      const statement = await tx.prepareAsync(`
340-        INSERT INTO repayment_schedules 
341:        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
342-        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
343-      `);
344-      
345-      try {
346-        while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1) {
347-          const kistId = generateUuid();
348-          await statement.executeAsync([
--
404-    let updatedLoan: Loan | null = null;
405-    let createdTerm: LoanTerm | null = null;
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
417-      );
418-
--
421-        if (interestCollectedPaise < lastTerm.interest_paise) {
422-          throw new Error(
423-            `Prior term's contractual interest must be fully settled before extending the loan. Required: ${lastTerm.interest_paise} paise, collected: ${interestCollectedPaise} paise.`
424-          );
425-        }
426-      }
427-      const termNumber = (lastTerm ? lastTerm.term_number : 0) + 1;
428:      const startDate = lastTerm ? lastTerm.maturity_date : (loan.maturity_date || loan.start_date);
429:      const maturityDate = calculateMaturityDate(startDate, additionalMonths, loan.due_day);
430-      const annualRate = loan.annual_rate || 0;
431-      const termInterest = calculateContractInterest(loan.principal_paise as Paise, annualRate, additionalMonths);
432-
433-      const termId = generateUuid();
434-      const createdAt = new Date().toISOString();
435-      const todayStr = createdAt.split('T')[0];
436-
--
467-          );
468-        }
469-      }
470-
471-      await txHandle.runAsync(
472-        `INSERT INTO loan_terms (
473-          id, loan_id, term_number, duration_months, annual_rate, interest_paise,
474:          start_date, maturity_date, interest_settled, settled, operation_id, created_at
475-        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
476-        [
477-          termId,
478-          loanId,
479-          termNumber,
480-          additionalMonths,
481-          annualRate,
482-          termInterest,
483-          startDate,
484:          maturityDate,
485-          0,
486-          0,
487-          opId,
488-          createdAt,
489-        ]
490-      );
491-
--
494-      const newTotalPaise = loan.principal_paise + newCumulativeInterest;
495-
496-      await txHandle.runAsync(
497-        `UPDATE loans SET
498-          term_months = ?,
499-          interest_paise = ?,
500-          total_paise = ?,
501:          maturity_date = ?
502-         WHERE id = ?`,
503:        [newCumulativeDuration, newCumulativeInterest, newTotalPaise, maturityDate, loanId]
504-      );
505-
506-      await OutboxManager.enqueue(txHandle, {
507-        operationId: opId,
508-        operationType: 'extend_loan',
509-        payload: {
510-          loan_id: loanId,
fatal: path 'src/app/loan/components/BulletLoanView.tsx' does not exist in '1ee62c7'
import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StepIndicator } from '../../../ui/StepIndicator';
import { Typography } from '../../../ui/Typography';
import { Card } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { FinancialSummaryRow } from '../../../ui/FinancialSummaryRow';
import { InlineErrorCard } from '../../../ui/Feedback';
import { theme } from '../../../ui/theme';
import { formatINR } from '../../../core/domain/money';
import { useLoanWizard } from './LoanWizardContext';

export default function Step4ReviewScreen() {
  const router = useRouter();
  const { draft, calculated, commitLoan, isSubmitting, submitError } = useLoanWizard();

  const isBullet = draft.productType === 'bullet';

  const handleCreate = async () => {
    try {
      const loanId = await commitLoan();
      Alert.alert(
        'Loan Created Successfully',
        `Contract committed to local encrypted ledger.`,
        [
          {
            text: 'View Loan Details',
            onPress: () => router.replace(`/loan/${loanId}` as any),
          },
        ]
      );
    } catch {
      // Error handled by submitError state
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* 4-Step Indicator Header */}
      <StepIndicator
        currentStep={4}
        totalSteps={4}
        stepTitle="Review & Confirm"
        onBack={() => router.back()}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Borrower Card */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            BORROWER
          </Typography>
          <View style={styles.borrowerRow}>
            <View>
              <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
                {draft.borrower?.name || 'Unknown Borrower'}
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                {draft.borrower?.phone}
              </Typography>
            </View>
            <View style={styles.badgePill}>
              <Typography variant="labelSm" color={theme.colors.textPrimary}>
                {isBullet ? 'Bullet Loan' : 'Monthly Kist'}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Financial Terms Breakdown */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            FINANCIAL CONTRACT BREAKDOWN
          </Typography>

          <FinancialSummaryRow
            label="Disbursed Principal"
            value={formatINR(draft.principalPaise)}
            variant="highlight"
          />
          <FinancialSummaryRow
            label="Interest Rate"
            value={`${draft.annualRate}% p.a.`}
          />
          <FinancialSummaryRow
            label="Term Duration"
            value={`${draft.termMonths} Months`}
          />
          <FinancialSummaryRow
            label="First Payment Due"
            value={calculated.firstDueDate || calculated.schedule[0]?.dueDate || draft.startDate}
          />
          <FinancialSummaryRow
            label="Maturity Date"
            value={calculated.maturityDate}
          />
          <FinancialSummaryRow
            label={isBullet ? 'Total Contract Interest' : 'Total Contract Markup'}
            value={formatINR(calculated.totalInterestPaise)}
          />
          <FinancialSummaryRow
            label={isBullet ? 'Monthly Interest Due' : 'Monthly Instalment (Kist)'}
            value={formatINR(calculated.monthlyAmountPaise)}
            variant="highlight"
          />
          <FinancialSummaryRow
            label="Total Amount Payable"
            value={formatINR(calculated.totalPayablePaise)}
            variant="highlight"
          />
        </Card>

        {/* Collateral & Documents Summary */}
        <Card style={styles.sectionCard}>
          <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
            SECURITY & ATTACHMENTS
          </Typography>

          <FinancialSummaryRow
            label="Physical Collateral"
            value={draft.collateral || 'None declared'}
          />
          <FinancialSummaryRow
            label="Verified Documents"
            value={`${draft.attachments.length} attached`}
          />
        </Card>

        {/* Schedule Preview (Instalment) */}
        {!isBullet && calculated.schedule.length > 0 && (
          <Card style={styles.sectionCard}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.cardHeaderLabel}>
              REPAYMENT SCHEDULE PREVIEW ({calculated.schedule.length} KISTS)
            </Typography>

            {calculated.schedule.slice(0, 5).map((item) => (
              <View key={item.periodNumber} style={styles.scheduleRow}>
                <View style={styles.scheduleLeft}>
                  <View style={styles.scheduleNumber}>
                    <Typography variant="labelSm" color={theme.colors.textSecondary}>
                      #{item.periodNumber}
                    </Typography>
                  </View>
                  <Typography variant="bodyMd" color={theme.colors.textPrimary}>
                    {item.dueDate}
                  </Typography>
                </View>

                <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  {formatINR(item.totalDuePaise)}
                </Typography>
              </View>
            ))}

            {calculated.schedule.length > 5 && (
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
                + {calculated.schedule.length - 5} more installments
              </Typography>
            )}
          </Card>
        )}

        {/* Error Card */}
        {submitError && (
          <InlineErrorCard
            title="Loan Creation Error"
            message={submitError}
            retryLabel="Try Again"
            onRetry={handleCreate}
          />
        )}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          title="Disburse & Create Loan"
          onPress={handleCreate}
          loading={isSubmitting}
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSoft,
  },
  content: {
    padding: theme.spacing.md,
    gap: 12,
    paddingBottom: 24,
  },
  sectionCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  cardHeaderLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  borrowerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  badgePill: {
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
});
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
  static async pushPending(db: SQLiteDatabase): Promise<{ pushed: number; failed: number; transportError?: string }> {
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
      } catch (err: any) {
        console.warn('[SYNC] Push batch failed transport:', err);
        return {
          pushed: totalPushed,
          failed: totalFailed,
          transportError: err?.message || 'Network or server error during push',
        };
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
      if ((pushRes as any).transportError) {
        return {
          pushedCount: pushRes.pushed,
          pulledCount: 0,
          needsReviewCount: 0,
          success: false,
          errors: [`Sync push failed: ${(pushRes as any).transportError}`],
        };
      }
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
{
  "name": "credkeep",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "@react-native-google-signin/google-signin": "^16.1.5",
    "crypto-js": "^4.2.0",
    "expo": "~57.0.30",
    "expo-build-properties": "~57.0.22",
    "expo-constants": "~57.0.22",
    "expo-crypto": "~57.0.4",
    "expo-document-picker": "~57.0.3",
    "expo-file-system": "~57.0.7",
    "expo-image-picker": "~57.0.20",
    "expo-linking": "~57.0.13",
    "expo-local-authentication": "~57.0.3",
    "expo-network": "~57.0.2",
    "expo-router": "~57.0.28",
    "expo-secure-store": "~57.0.4",
    "expo-sharing": "~57.0.23",
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
    "jest-expo": "~57.0.6",
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
/bin/bash -lc "git ls-tree --name-only 1ee62c7 src/app/loan/components/; git show 1ee62c7:src/app/loan/create/terms.tsx | rg -n -C 4 'bullet|monthly|Monthly|maturity|Due'; git show 1ee62c7:src/core/database/loanRepository.ts | sed -n '290,315p'; test -x node_modules/.bin/tsc && node_modules/.bin/tsc --noEmit" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "test -x node_modules/.bin/eslint && node_modules/.bin/eslint --no-cache 'src/app/(tabs)/_layout.tsx' 'src/app/(tabs)/index.tsx' 'src/app/(tabs)/more.tsx' src/app/auth/register.tsx src/app/loan/components/MonthlyKistView.tsx src/app/loan/create/LoanWizardContext.tsx src/app/loan/create/review.tsx src/core/sync/syncService.ts" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git show 1ee62c7:src/app/loan/components/OneTimeLoanView.tsx | rg -n -C 4 'due|Due|maturity|Monthly|monthly'; git show 1ee62c7:src/core/sync/SyncProvider.tsx | rg -n -C 5 'needsReviewCount|success|syncAll|OFFLINE'; git show 1ee62c7:src/core/sync/syncService.test.ts | rg -n -C 4 'transport|pushPending|syncAll|network'" in /mnt/f/personal projects/credkeep
 succeeded in 452ms:
52-
53-  // Active term is the latest term
54-  const activeTerm = terms.length > 0 ? terms[terms.length - 1] : null;
55-
56:  // Calculate monthly interest for active term
57-  const activeAnnualRate = activeTerm?.annual_rate ?? loan.annual_rate ?? 24;
58:  const monthlyRate = activeAnnualRate / 12 / 100;
59:  const monthlyInterestPaise = Math.round(remainingPrincipal * monthlyRate) as Paise;
60-
61-  const handleConfirmExtend = async () => {
62-    const months = parseInt(extendMonths, 10);
63-    if (isNaN(months) || months <= 0) {
--
148-          {formatINR(remainingPrincipal)}
149-        </Typography>
150-
151-        <Typography variant="bodySm" color={theme.colors.textSecondary}>
152:          Matures on {activeTerm?.maturity_date || loan.maturity_date || 'N/A'}
153-        </Typography>
154-
155-        {/* 3 Metrics Sub-Row */}
156-        <View style={styles.metricsRow}>
157-          <View style={styles.metricCol}>
158-            <Typography variant="labelSm" color={theme.colors.textSecondary}>
159:              Monthly Interest
160-            </Typography>
161-            <Typography variant="titleMd" tabularNums color={theme.colors.textPrimary} style={{ fontWeight: '600', marginTop: 2 }}>
162:              {formatINR(monthlyInterestPaise)}
163-            </Typography>
164-          </View>
165-
166-          <View style={styles.metricDivider} />
--
177-          <View style={styles.metricDivider} />
178-
179-          <View style={styles.metricCol}>
180-            <Typography variant="labelSm" color={theme.colors.textSecondary}>
181:              Penalties Due
182-            </Typography>
183-            <Typography
184-              variant="titleMd"
185-              tabularNums
--
239-                  <Typography variant="titleMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
240-                    {term.duration_months} Months @ {term.annual_rate}% p.a.
241-                  </Typography>
242-                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
243:                    {term.start_date} to {term.maturity_date}
244-                  </Typography>
245-                </View>
246-              </View>
247-
fatal: path 'src/core/sync/SyncProvider.tsx' does not exist in '1ee62c7'
139-          { operation_id: 'op-rejected', status: 'REJECTED', error: 'Invalid parameters' },
140-        ],
141-      });
142-
143:      const res = await SyncService.pushPending(mockDb);
144-
145-      expect(res.pushed).toBe(1);
146-      expect(res.failed).toBe(1);
147-      expect(ApiClient.post).toHaveBeenCalledWith('/sync/push/', expect.objectContaining({
--
618-      expect(loanStatus).toBe('SETTLED');
619-    });
620-
621-    it('reports failure and review required when push has failed operations while still pulling authoritative server state', async () => {
622:      const pushSpy = jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 1 });
623-      const pullSpy = jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 5 });
624-
625-      try {
626:        const res = await SyncService.syncAll(mockDb);
627-        expect(res.success).toBe(false);
628-        expect(res.pulledCount).toBe(5);
629-        expect(pullSpy).toHaveBeenCalled();
630-        expect(res.errors).toBeDefined();
--
635-      }
636-    });
637-
638-    it('reports conflict review required when outbox has NEEDS_REVIEW operations', async () => {
639:      const pushSpy = jest.spyOn(SyncService, 'pushPending').mockResolvedValueOnce({ pushed: 1, failed: 0 });
640-      const pullSpy = jest.spyOn(SyncService, 'pullChanges').mockResolvedValueOnce({ pulled: 2 });
641-      const reviewSpy = jest.spyOn(OutboxManager, 'getNeedsReview').mockResolvedValueOnce([
642-        {
643-          id: 'outbox-conflict-1',
--
650-        }
651-      ]);
652-
653-      try {
654:        const res = await SyncService.syncAll(mockDb);
655-        expect(res.success).toBe(false);
656-        expect(res.needsReviewCount).toBe(1);
657-        expect(res.errors![0]).toContain('require review due to server conflicts');
658-      } finally {
--
702-            status: 'ACCEPTED'
703-          }))
704-        });
705-
706:      const pushRes = await SyncService.pushPending(mockDb);
707-      expect(pushRes.pushed).toBe(65);
708-      expect(pushRes.failed).toBe(0);
709-      expect(ApiClient.post).toHaveBeenCalledTimes(2);
710-    });
--
857-          error: 'Borrower credit limit exceeded'
858-        }]
859-      });
860-
861:      const pushRes = await SyncService.pushPending(mockDb);
862-      expect(pushRes.failed).toBe(1);
863-
864-      // Verify compensating REVERSAL transaction was inserted
865-      expect(mockDb.runAsync).toHaveBeenCalledWith(

 succeeded in 15049ms:
src/app/loan/components/MonthlyKistView.tsx
src/app/loan/components/OneTimeLoanView.tsx
18-  const { draft, updateDraft, calculated } = useLoanWizard();
19-
20-  const [rateText, setRateText] = useState(draft.annualRate.toString());
21-  const [termText, setTermText] = useState(draft.termMonths.toString());
22:  const [dueDayText, setDueDayText] = useState(draft.dueDay.toString());
23-
24:  const isBullet = draft.productType === 'bullet';
25-
26-  const handleRateChange = (text: string) => {
27-    setRateText(text);
28-    const num = parseFloat(text);
--
38-      updateDraft({ termMonths: num });
39-    }
40-  };
41-
42:  const handleDueDayChange = (text: string) => {
43:    setDueDayText(text);
44-    const num = parseInt(text, 10);
45-    if (!isNaN(num) && num >= 1 && num <= 31) {
46-      updateDraft({ dueDay: num });
47-    }
--
113-
114-        <View style={styles.inputRow}>
115-          <View style={{ flex: 1 }}>
116-            <Input
117:              label="Monthly Due Day (1-31)"
118-              value={dueDayText}
119:              onChangeText={handleDueDayChange}
120-              keyboardType="number-pad"
121-              placeholder="5"
122-            />
123-          </View>
--
139-
140-          {isBullet ? (
141-            <>
142-              <FinancialSummaryRow
143:                label="Monthly Interest Payment"
144:                sublabel={`Due on day ${draft.dueDay} each month`}
145:                value={formatINR(calculated.monthlyAmountPaise)}
146-                variant="highlight"
147-              />
148-              <FinancialSummaryRow
149:                label="Principal Due at Maturity"
150:                sublabel={`Due on ${calculated.maturityDate}`}
151-                value={formatINR(draft.principalPaise)}
152-              />
153-              <FinancialSummaryRow
154-                label="Total Contract Interest"
--
156-                value={formatINR(calculated.totalInterestPaise)}
157-              />
158-              <FinancialSummaryRow
159-                label="Total Contract Value"
160:                sublabel="Principal + all monthly interest"
161-                value={formatINR(calculated.totalPayablePaise)}
162-                variant="highlight"
163-              />
164-            </>
165-          ) : (
166-            <>
167-              <FinancialSummaryRow
168:                label="Monthly Instalment (Kist)"
169:                sublabel={`Equal monthly payment across ${draft.termMonths} months`}
170:                value={formatINR(calculated.monthlyAmountPaise)}
171-                variant="highlight"
172-              />
173-              <FinancialSummaryRow
174-                label="Total Contract Markup / Interest"
--
183-              />
184-              <FinancialSummaryRow
185-                label="Maturity Date"
186-                sublabel="Final installment due"
187:                value={calculated.maturityDate}
188-              />
189-            </>
190-          )}
191-        </Card>

    return (await this.getById(loanId))!;
  }

  async getAll(): Promise<Loan[]> {
    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans ORDER BY created_at DESC`);
  }
  
  async getByBorrowerId(borrowerId: string): Promise<Loan[]> {
    return await this.db.getAllAsync<Loan>(`SELECT * FROM loans WHERE borrower_id = ? ORDER BY created_at DESC`, [borrowerId]);
  }

  async getById(id: string): Promise<Loan | null> {
    return await this.db.getFirstAsync<Loan>(`SELECT * FROM loans WHERE id = ?`, [id]);
  }
  
  async getSchedule(loanId: string) {
    await this.extendScheduleIfNeeded(loanId);
    return await this.db.getAllAsync(`
      SELECT * FROM repayment_schedules 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loanId]);
  }

  async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {

codex
The sync changes preserve pending operations and their IDs on transport failure, and stop the pull after that failure. I found no blocking regression in the reviewed changes. TypeScript passed; the scoped lint check is still running.
exec
/bin/bash -lc "ps -eo pid,etime,pcpu,args | rg '[e]slint|[t]sc'" in /mnt/f/personal projects/credkeep
 exited 1 in 42ms:
exec
/bin/bash -lc 'command -v node; head -n 8 node_modules/.bin/eslint; ps -eo pid,ppid,etime,args | tail -n 15' in /mnt/f/personal projects/credkeep
 succeeded in 42ms:
/home/sagar/.nvm/versions/node/v24.21.0/bin/node
#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")

case `uname` in
    *CYGWIN*|*MINGW*|*MSYS*)
        if command -v cygpath > /dev/null 2>&1; then
            basedir=`cygpath -w "$basedir"`
        fi
    PID    PPID     ELAPSED COMMAND
      1       0       00:00 codex-linux-sandbox --sandbox-policy-cwd /mnt/f/personal projects/credkeep --command-cwd /mnt/f/personal projects/credkeep --permission-profile {"type":"managed","file_system":{"type":"restricted","entries":[{"path":{"type":"special","value":{"kind":"root"}},"access":"read"}]},"network":"restricted"} --apply-seccomp-then-exec -- /bin/bash -c __CODEX_SNAPSHOT_OVERRIDE_SET_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" __CODEX_SNAPSHOT_OVERRIDE_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" __CODEX_SNAPSHOT_OVERRIDE_SET_1="${CODEX_PERMISSION_PROFILE+x}" __CODEX_SNAPSHOT_OVERRIDE_1="${CODEX_PERMISSION_PROFILE-}" __CODEX_SNAPSHOT_OVERRIDE_SET_2="${CODEX_PLUGIN_METRICS_OUTPUT+x}" __CODEX_SNAPSHOT_OVERRIDE_2="${CODEX_PLUGIN_METRICS_OUTPUT-}" __CODEX_SNAPSHOT_OVERRIDE_SET_3="${CODEX_SESSION_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_3="${CODEX_SESSION_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_4="${CODEX_THREAD_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_4="${CODEX_THREAD_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_5="${CODEX_TOOL_CALL_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_5="${CODEX_TOOL_CALL_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_6="${CODEX_VERSION+x}" __CODEX_SNAPSHOT_OVERRIDE_6="${CODEX_VERSION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0="${ALL_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_0="${ALL_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1="${BUNDLE_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_1="${BUNDLE_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2="${BUNDLE_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_2="${BUNDLE_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3="${BUNDLE_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_3="${BUNDLE_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4="${BUNDLE_SSL_CA_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_4="${BUNDLE_SSL_CA_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5="${CARGO_HTTP_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_5="${CARGO_HTTP_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6="${CODEX_CA_CERTIFICATE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_6="${CODEX_CA_CERTIFICATE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8="${CODEX_NETWORK_PROXY_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_8="${CODEX_NETWORK_PROXY_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9="${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_9="${CODEX_NETWORK_PROXY_ATTRIBUTION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12="${CURL_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_12="${CURL_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13="${DOCKER_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_13="${DOCKER_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14="${DOCKER_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_14="${DOCKER_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15="${ELECTRON_GET_USE_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_15="${ELECTRON_GET_USE_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16="${FTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_16="${FTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17="${GIT_SSL_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_17="${GIT_SSL_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18="${HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_18="${HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19="${HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_19="${HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20="${NODE_EXTRA_CA_CERTS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_20="${NODE_EXTRA_CA_CERTS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21="${NODE_USE_ENV_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_21="${NODE_USE_ENV_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22="${NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_22="${NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23="${NPM_CONFIG_CAFILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_23="${NPM_CONFIG_CAFILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24="${NPM_CONFIG_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_24="${NPM_CONFIG_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25="${NPM_CONFIG_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_25="${NPM_CONFIG_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26="${NPM_CONFIG_NOPROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_26="${NPM_CONFIG_NOPROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27="${NPM_CONFIG_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_27="${NPM_CONFIG_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28="${PIP_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_28="${PIP_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29="${PIP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_29="${PIP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30="${REQUESTS_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_30="${REQUESTS_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31="${SSL_CERT_FILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_31="${SSL_CERT_FILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32="${WSS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_32="${WSS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33="${WS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_33="${WS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34="${YARN_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_34="${YARN_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35="${YARN_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_35="${YARN_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36="${YARN_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_36="${YARN_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37="${all_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_37="${all_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38="${ftp_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_38="${ftp_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39="${http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_39="${http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40="${https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_40="${https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41="${no_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_41="${no_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42="${npm_config_cafile+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_42="${npm_config_cafile-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43="${npm_config_http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_43="${npm_config_http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44="${npm_config_https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_44="${npm_config_https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45="${npm_config_noproxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_45="${npm_config_noproxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46="${npm_config_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_46="${npm_config_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47="${ws_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_47="${ws_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48="${wss_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_48="${wss_proxy-}" __CODEX_SNAPSHOT_PROXY_ENV_SET="${CODEX_NETWORK_PROXY_ACTIVE+x}"  if . '/home/sagar/.codex/shell_snapshots/01a15d35-2139-7270-a6ed-110efcc19e83.1792565127037569184.sh' >/dev/null 2>&1; then :; fi  if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_0}" ]; then   if [ -z "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" ] || [ "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" != "${__CODEX_SNAPSHOT_OVERRIDE_0}" ]; then export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS="${__CODEX_SNAPSHOT_OVERRIDE_0}"; else export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi else builtin unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS 2>/dev/null || command unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_1}" ]; then   if [ -z "${CODEX_PERMISSION_PROFILE+x}" ] || [ "${CODEX_PERMISSION_PROFILE-}" != "${__CODEX_SNAPSHOT_OVERRIDE_1}" ]; then export CODEX_PERMISSION_PROFILE="${__CODEX_SNAPSHOT_OVERRIDE_1}"; else export CODEX_PERMISSION_PROFILE; fi else builtin unset CODEX_PERMISSION_PROFILE 2>/dev/null || command unset CODEX_PERMISSION_PROFILE; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_2}" ]; then   if [ -z "${CODEX_PLUGIN_METRICS_OUTPUT+x}" ] || [ "${CODEX_PLUGIN_METRICS_OUTPUT-}" != "${__CODEX_SNAPSHOT_OVERRIDE_2}" ]; then export CODEX_PLUGIN_METRICS_OUTPUT="${__CODEX_SNAPSHOT_OVERRIDE_2}"; else export CODEX_PLUGIN_METRICS_OUTPUT; fi else builtin unset CODEX_PLUGIN_METRICS_OUTPUT 2>/dev/null || command unset CODEX_PLUGIN_METRICS_OUTPUT; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_3}" ]; then   if [ -z "${CODEX_SESSION_ID+x}" ] || [ "${CODEX_SESSION_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_3}" ]; then export CODEX_SESSION_ID="${__CODEX_SNAPSHOT_OVERRIDE_3}"; else export CODEX_SESSION_ID; fi else builtin unset CODEX_SESSION_ID 2>/dev/null || command unset CODEX_SESSION_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_4}" ]; then   if [ -z "${CODEX_THREAD_ID+x}" ] || [ "${CODEX_THREAD_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_4}" ]; then export CODEX_THREAD_ID="${__CODEX_SNAPSHOT_OVERRIDE_4}"; else export CODEX_THREAD_ID; fi else builtin unset CODEX_THREAD_ID 2>/dev/null || command unset CODEX_THREAD_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_5}" ]; then   if [ -z "${CODEX_TOOL_CALL_ID+x}" ] || [ "${CODEX_TOOL_CALL_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_5}" ]; then export CODEX_TOOL_CALL_ID="${__CODEX_SNAPSHOT_OVERRIDE_5}"; else export CODEX_TOOL_CALL_ID; fi else builtin unset CODEX_TOOL_CALL_ID 2>/dev/null || command unset CODEX_TOOL_CALL_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_6}" ]; then   if [ -z "${CODEX_VERSION+x}" ] || [ "${CODEX_VERSION-}" != "${__CODEX_SNAPSHOT_OVERRIDE_6}" ]; then export CODEX_VERSION="${__CODEX_SNAPSHOT_OVERRIDE_6}"; else export CODEX_VERSION; fi else builtin unset CODEX_VERSION 2>/dev/null || command unset CODEX_VERSION; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_6 __CODEX_SNAPSHOT_OVERRIDE_6 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_6 __CODEX_SNAPSHOT_OVERRIDE_6 if [ -n "$__CODEX_SNAPSHOT_PROXY_ENV_SET" ] || [ -n "${CODEX_NETWORK_PROXY_ACTIVE+x}" ]; then if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0}" ]; then   if [ -z "${ALL_PROXY+x}" ] || [ "${ALL_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}" ]; then export ALL_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}"; else export ALL_PROXY; fi else builtin unset ALL_PROXY 2>/dev/null || command unset ALL_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1}" ]; then   if [ -z "${BUNDLE_HTTPS_PROXY+x}" ] || [ "${BUNDLE_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}" ]; then export BUNDLE_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}"; else export BUNDLE_HTTPS_PROXY; fi else builtin unset BUNDLE_HTTPS_PROXY 2>/dev/null || command unset BUNDLE_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2}" ]; then   if [ -z "${BUNDLE_HTTP_PROXY+x}" ] || [ "${BUNDLE_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}" ]; then export BUNDLE_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}"; else export BUNDLE_HTTP_PROXY; fi else builtin unset BUNDLE_HTTP_PROXY 2>/dev/null || command unset BUNDLE_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3}" ]; then   if [ -z "${BUNDLE_NO_PROXY+x}" ] || [ "${BUNDLE_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}" ]; then export BUNDLE_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}"; else export BUNDLE_NO_PROXY; fi else builtin unset BUNDLE_NO_PROXY 2>/dev/null || command unset BUNDLE_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4}" ]; then   if [ -z "${BUNDLE_SSL_CA_CERT+x}" ] || [ "${BUNDLE_SSL_CA_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}" ]; then export BUNDLE_SSL_CA_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}"; else export BUNDLE_SSL_CA_CERT; fi else builtin unset BUNDLE_SSL_CA_CERT 2>/dev/null || command unset BUNDLE_SSL_CA_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5}" ]; then   if [ -z "${CARGO_HTTP_CAINFO+x}" ] || [ "${CARGO_HTTP_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}" ]; then export CARGO_HTTP_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}"; else export CARGO_HTTP_CAINFO; fi else builtin unset CARGO_HTTP_CAINFO 2>/dev/null || command unset CARGO_HTTP_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6}" ]; then   if [ -z "${CODEX_CA_CERTIFICATE+x}" ] || [ "${CODEX_CA_CERTIFICATE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}" ]; then export CODEX_CA_CERTIFICATE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}"; else export CODEX_CA_CERTIFICATE; fi else builtin unset CODEX_CA_CERTIFICATE 2>/dev/null || command unset CODEX_CA_CERTIFICATE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7}" ]; then   if [ -z "${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" ] || [ "${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}" ]; then export CODEX_NETWORK_ALLOW_LOCAL_BINDING="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}"; else export CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi else builtin unset CODEX_NETWORK_ALLOW_LOCAL_BINDING 2>/dev/null || command unset CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}" ]; then export CODEX_NETWORK_PROXY_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}"; else export CODEX_NETWORK_PROXY_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" ] || [ "${CODEX_NETWORK_PROXY_ATTRIBUTION-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}" ]; then export CODEX_NETWORK_PROXY_ATTRIBUTION="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}"; else export CODEX_NETWORK_PROXY_ATTRIBUTION; fi else builtin unset CODEX_NETWORK_PROXY_ATTRIBUTION 2>/dev/null || command unset CODEX_NETWORK_PROXY_ATTRIBUTION; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" ] || [ "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}" ]; then export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}"; else export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi else builtin unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS 2>/dev/null || command unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}" ]; then export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}"; else export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12}" ]; then   if [ -z "${CURL_CA_BUNDLE+x}" ] || [ "${CURL_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}" ]; then export CURL_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}"; else export CURL_CA_BUNDLE; fi else builtin unset CURL_CA_BUNDLE 2>/dev/null || command unset CURL_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13}" ]; then   if [ -z "${DOCKER_HTTPS_PROXY+x}" ] || [ "${DOCKER_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}" ]; then export DOCKER_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}"; else export DOCKER_HTTPS_PROXY; fi else builtin unset DOCKER_HTTPS_PROXY 2>/dev/null || command unset DOCKER_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14}" ]; then   if [ -z "${DOCKER_HTTP_PROXY+x}" ] || [ "${DOCKER_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}" ]; then export DOCKER_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}"; else export DOCKER_HTTP_PROXY; fi else builtin unset DOCKER_HTTP_PROXY 2>/dev/null || command unset DOCKER_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15}" ]; then   if [ -z "${ELECTRON_GET_USE_PROXY+x}" ] || [ "${ELECTRON_GET_USE_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}" ]; then export ELECTRON_GET_USE_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}"; else export ELECTRON_GET_USE_PROXY; fi else builtin unset ELECTRON_GET_USE_PROXY 2>/dev/null || command unset ELECTRON_GET_USE_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16}" ]; then   if [ -z "${FTP_PROXY+x}" ] || [ "${FTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}" ]; then export FTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}"; else export FTP_PROXY; fi else builtin unset FTP_PROXY 2>/dev/null || command unset FTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17}" ]; then   if [ -z "${GIT_SSL_CAINFO+x}" ] || [ "${GIT_SSL_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}" ]; then export GIT_SSL_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}"; else export GIT_SSL_CAINFO; fi else builtin unset GIT_SSL_CAINFO 2>/dev/null || command unset GIT_SSL_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18}" ]; then   if [ -z "${HTTPS_PROXY+x}" ] || [ "${HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}" ]; then export HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}"; else export HTTPS_PROXY; fi else builtin unset HTTPS_PROXY 2>/dev/null || command unset HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19}" ]; then   if [ -z "${HTTP_PROXY+x}" ] || [ "${HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}" ]; then export HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}"; else export HTTP_PROXY; fi else builtin unset HTTP_PROXY 2>/dev/null || command unset HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20}" ]; then   if [ -z "${NODE_EXTRA_CA_CERTS+x}" ] || [ "${NODE_EXTRA_CA_CERTS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}" ]; then export NODE_EXTRA_CA_CERTS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}"; else export NODE_EXTRA_CA_CERTS; fi else builtin unset NODE_EXTRA_CA_CERTS 2>/dev/null || command unset NODE_EXTRA_CA_CERTS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21}" ]; then   if [ -z "${NODE_USE_ENV_PROXY+x}" ] || [ "${NODE_USE_ENV_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}" ]; then export NODE_USE_ENV_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}"; else export NODE_USE_ENV_PROXY; fi else builtin unset NODE_USE_ENV_PROXY 2>/dev/null || command unset NODE_USE_ENV_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22}" ]; then   if [ -z "${NO_PROXY+x}" ] || [ "${NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}" ]; then export NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}"; else export NO_PROXY; fi else builtin unset NO_PROXY 2>/dev/null || command unset NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23}" ]; then   if [ -z "${NPM_CONFIG_CAFILE+x}" ] || [ "${NPM_CONFIG_CAFILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}" ]; then export NPM_CONFIG_CAFILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}"; else export NPM_CONFIG_CAFILE; fi else builtin unset NPM_CONFIG_CAFILE 2>/dev/null || command unset NPM_CONFIG_CAFILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24}" ]; then   if [ -z "${NPM_CONFIG_HTTPS_PROXY+x}" ] || [ "${NPM_CONFIG_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}" ]; then export NPM_CONFIG_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}"; else export NPM_CONFIG_HTTPS_PROXY; fi else builtin unset NPM_CONFIG_HTTPS_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25}" ]; then   if [ -z "${NPM_CONFIG_HTTP_PROXY+x}" ] || [ "${NPM_CONFIG_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}" ]; then export NPM_CONFIG_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}"; else export NPM_CONFIG_HTTP_PROXY; fi else builtin unset NPM_CONFIG_HTTP_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26}" ]; then   if [ -z "${NPM_CONFIG_NOPROXY+x}" ] || [ "${NPM_CONFIG_NOPROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}" ]; then export NPM_CONFIG_NOPROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}"; else export NPM_CONFIG_NOPROXY; fi else builtin unset NPM_CONFIG_NOPROXY 2>/dev/null || command unset NPM_CONFIG_NOPROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27}" ]; then   if [ -z "${NPM_CONFIG_PROXY+x}" ] || [ "${NPM_CONFIG_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}" ]; then export NPM_CONFIG_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}"; else export NPM_CONFIG_PROXY; fi else builtin unset NPM_CONFIG_PROXY 2>/dev/null || command unset NPM_CONFIG_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28}" ]; then   if [ -z "${PIP_CERT+x}" ] || [ "${PIP_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}" ]; then export PIP_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}"; else export PIP_CERT; fi else builtin unset PIP_CERT 2>/dev/null || command unset PIP_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29}" ]; then   if [ -z "${PIP_PROXY+x}" ] || [ "${PIP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}" ]; then export PIP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}"; else export PIP_PROXY; fi else builtin unset PIP_PROXY 2>/dev/null || command unset PIP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30}" ]; then   if [ -z "${REQUESTS_CA_BUNDLE+x}" ] || [ "${REQUESTS_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}" ]; then export REQUESTS_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}"; else export REQUESTS_CA_BUNDLE; fi else builtin unset REQUESTS_CA_BUNDLE 2>/dev/null || command unset REQUESTS_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31}" ]; then   if [ -z "${SSL_CERT_FILE+x}" ] || [ "${SSL_CERT_FILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}" ]; then export SSL_CERT_FILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}"; else export SSL_CERT_FILE; fi else builtin unset SSL_CERT_FILE 2>/dev/null || command unset SSL_CERT_FILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32}" ]; then   if [ -z "${WSS_PROXY+x}" ] || [ "${WSS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}" ]; then export WSS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}"; else export WSS_PROXY; fi else builtin unset WSS_PROXY 2>/dev/null || command unset WSS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33}" ]; then   if [ -z "${WS_PROXY+x}" ] || [ "${WS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}" ]; then export WS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}"; else export WS_PROXY; fi else builtin unset WS_PROXY 2>/dev/null || command unset WS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34}" ]; then   if [ -z "${YARN_HTTPS_PROXY+x}" ] || [ "${YARN_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}" ]; then export YARN_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}"; else export YARN_HTTPS_PROXY; fi else builtin unset YARN_HTTPS_PROXY 2>/dev/null || command unset YARN_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35}" ]; then   if [ -z "${YARN_HTTP_PROXY+x}" ] || [ "${YARN_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}" ]; then export YARN_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}"; else export YARN_HTTP_PROXY; fi else builtin unset YARN_HTTP_PROXY 2>/dev/null || command unset YARN_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36}" ]; then   if [ -z "${YARN_NO_PROXY+x}" ] || [ "${YARN_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}" ]; then export YARN_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}"; else export YARN_NO_PROXY; fi else builtin unset YARN_NO_PROXY 2>/dev/null || command unset YARN_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37}" ]; then   if [ -z "${all_proxy+x}" ] || [ "${all_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}" ]; then export all_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}"; else export all_proxy; fi else builtin unset all_proxy 2>/dev/null || command unset all_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38}" ]; then   if [ -z "${ftp_proxy+x}" ] || [ "${ftp_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}" ]; then export ftp_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}"; else export ftp_proxy; fi else builtin unset ftp_proxy 2>/dev/null || command unset ftp_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39}" ]; then   if [ -z "${http_proxy+x}" ] || [ "${http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}" ]; then export http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}"; else export http_proxy; fi else builtin unset http_proxy 2>/dev/null || command unset http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40}" ]; then   if [ -z "${https_proxy+x}" ] || [ "${https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}" ]; then export https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}"; else export https_proxy; fi else builtin unset https_proxy 2>/dev/null || command unset https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41}" ]; then   if [ -z "${no_proxy+x}" ] || [ "${no_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}" ]; then export no_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}"; else export no_proxy; fi else builtin unset no_proxy 2>/dev/null || command unset no_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42}" ]; then   if [ -z "${npm_config_cafile+x}" ] || [ "${npm_config_cafile-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}" ]; then export npm_config_cafile="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}"; else export npm_config_cafile; fi else builtin unset npm_config_cafile 2>/dev/null || command unset npm_config_cafile; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43}" ]; then   if [ -z "${npm_config_http_proxy+x}" ] || [ "${npm_config_http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}" ]; then export npm_config_http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}"; else export npm_config_http_proxy; fi else builtin unset npm_config_http_proxy 2>/dev/null || command unset npm_config_http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44}" ]; then   if [ -z "${npm_config_https_proxy+x}" ] || [ "${npm_config_https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}" ]; then export npm_config_https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}"; else export npm_config_https_proxy; fi else builtin unset npm_config_https_proxy 2>/dev/null || command unset npm_config_https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45}" ]; then   if [ -z "${npm_config_noproxy+x}" ] || [ "${npm_config_noproxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}" ]; then export npm_config_noproxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}"; else export npm_config_noproxy; fi else builtin unset npm_config_noproxy 2>/dev/null || command unset npm_config_noproxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46}" ]; then   if [ -z "${npm_config_proxy+x}" ] || [ "${npm_config_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}" ]; then export npm_config_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}"; else export npm_config_proxy; fi else builtin unset npm_config_proxy 2>/dev/null || command unset npm_config_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47}" ]; then   if [ -z "${ws_proxy+x}" ] || [ "${ws_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}" ]; then export ws_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}"; else export ws_proxy; fi else builtin unset ws_proxy 2>/dev/null || command unset ws_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48}" ]; then   if [ -z "${wss_proxy+x}" ] || [ "${wss_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}" ]; then export wss_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}"; else export wss_proxy; fi else builtin unset wss_proxy 2>/dev/null || command unset wss_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 fi if [ -n "${PATH:-}" ]; then export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path':"$PATH"; else export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path'; fi  exec '/bin/bash' -c 'command -v node; head -n 8 node_modules/.bin/eslint; ps -eo pid,ppid,etime,args | tail -n 15'
      2       1       00:00 /bin/bash -c command -v node; head -n 8 node_modules/.bin/eslint; ps -eo pid,ppid,etime,args | tail -n 15
      4       2       00:00 ps -eo pid,ppid,etime,args
      5       2       00:00 tail -n 15

 exited 130 in 113862ms:
codex
The focused review is complete with no critical or high severity defects found. The lint check produced no output and was stopped after stalling, so I can’t report a lint pass. No files were changed.
codex
APPROVED.
tokens used
67,212
APPROVED.

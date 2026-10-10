OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12423-4c9a-77d0-ae91-786973fcab0b
--------
user
Perform QA on Stale_Home_earnings. Review the git diff between ea9e343 and 3bc0c36. Verify cross-loan isolation, atomic financial mutations, payment idempotency, transaction conservation, and error handling. Check the regression test. Return APPROVED or REWORK with concrete file-level findings.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll use the code-review skill to check the diff, financial invariants, and regression coverage between `ea9e343` and `3bc0c36`.

exec
/bin/bash -lc "cat AGENTS.md .workflow/STATE.md /mnt/f/personal\\ projects/credkeep/.agents/skills/code-review/SKILL.md /mnt/f/personal\\ projects/credkeep/.agents/skills/financial-invariant-verification/SKILL.md" in /mnt/f/personal projects/credkeep
 succeeded in 0ms:
This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Agent skills

### Issue tracker

Local markdown issues live in `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles using default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

## Autonomous Development Workflow

CredKeep operates under an autonomous AI-driven development model where the user acts solely as Product Owner. Agents must autonomously write code, select skills, run validation commands, and create local Git commits without burdening the Product Owner with manual operational prompts.

### Automatic Skill Selection Rules

Select skills autonomously based on the specific engineering task:
- **Financial Math & Ledger Engine**: Auto-select `tdd` for test-first implementation of money arithmetic, schedule generators, overdue periods, and allocation waterfalls.
- **Architecture & Boundaries**: Auto-select `setup-ts-deep-modules` when defining TypeScript interfaces, domain contracts, and encapsulated module barriers.
- **Spec Execution**: Auto-select `implement-spec` when claiming and implementing tickets from `.scratch/<feature>/issues/`.
- **Domain Alignment**: Auto-select `domain-modeling` when introducing or reconciling domain terms against `GLOSSARY.md` and `docs/adr/`.
- **Pre-Commit Verification**: Auto-select `code-review` to inspect diffs against domain invariants before committing.
- **UI Screen Construction**: Consult Stitch MCP design assets (`CredKeep V1 — Mobile Design System`, Project ID `8106667901868227815`, Expected screens: 11) for screen layouts, typography, and color tokens. NEVER use the old `CredKeep Field Lending App` project.

### Automated Local Git Workflow

Execute Git operations locally and autonomously under these invariants:
1. **Preserve Working Changes**: Inspect `git status` prior to branch transitions; preserve working changes cleanly.
2. **Scoped Feature Branches**: Create scoped branches for tickets (`feat/<feature-slug>/<ticket-slug>`).
3. **Mandatory Quality Gates**:
   - Run type checks (`npx tsc --noEmit`).
   - Run linter (`npx expo lint` or configured linter).
   - Run tests (`npm test` once configured).
   - If any check fails, resolve the issue autonomously before attempting to commit.
4. **Selective Staging**: Stage only files relevant to the specific ticket (`git add <paths>`). Never stage unrelated files or secrets.
5. **Conventional Commits**: Automatically author descriptive Conventional Commit messages (`feat(...)`, `fix(...)`, `test(...)`, `refactor(...)`, `docs(...)`).
6. **Report Commit Hash**: Always report the created commit hash and summary to the Product Owner.
7. **Strict Non-Destructive Boundary**:
   - **NEVER** automatically push to remote (`git push`).
   - **NEVER** force-push (`git push --force`).
   - **NEVER** delete branches without explicit Product Owner approval.

### Agent Permissions & Boundaries

- **Autonomous (Permitted Without Asking)**:
  - Reading, searching, and viewing project files.
  - Running safe `git status`, `git log`, and `git diff` commands.
  - Creating, editing, and formatting project source files.
  - Running development quality gates (`npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`).
  - Running safe local diagnostic scripts and repeating failed tests after code fixes.
  - Invoking the authenticated Codex CLI for planning and independent QA in its noninteractive sandbox.
  - Running verified project-scoped Graphify commands.
  - Installing normal, necessary, compatible project development dependencies.
  - Creating task-specific local Git commits and staging selective changes.
  - Updating `.workflow` state, reports, and handoff documentation.
  - Transitioning between planning, implementation, testing, and code review autonomously.

- **Prohibited Without Explicit Approval**:
  - Deleting or resetting financial records.
  - Destructive Git operations (e.g., branch deletion, `push --force`).
  - Exposing or changing credentials.
  - Changing system-wide security settings.
  - Running untrusted scripts requiring elevated privileges.
  - Pushing code to remote repositories (GitHub/`origin`).
  - Publishing the app or triggering an EAS cloud build.
  - Bypassing operating-system security, fabricating approvals, or using unrestricted command execution to defeat safety controls.
  - Installing system-level software or machine packages.
  - Making paid services or purchases.

### Model Routing Policy

Antigravity operates on session-level model configuration (no per-step dynamic model switching). All autonomous tasks execute on the session's active strong model without simulating unsupported routing.

## Performance Is a Continuous Requirement

CredKeep is a lightweight, offline-first Android financial application.

Performance, efficient storage, and reasonable APK size are permanent engineering requirements, not optional V2 enhancements.

### 1. APK Size

- Investigate unnecessary native modules and bundled assets.
- Avoid adding dependencies when built-in React Native or Expo functionality is sufficient.
- Preserve SQLCipher and other required security features.
- Keep production JavaScript minification and compatible native shrinking enabled.
- Measure actual APK size after every approved release build.
- Compare each new artifact with the previous measured release.
- Investigate significant unexplained size increases.
- Never claim a particular APK size reduction without measuring it.
- Never compromise security or financial correctness merely to reduce APK size.

### 2. React Native Performance

- Avoid unnecessary component rerenders.
- Use FlatList or appropriate virtualized lists for potentially large borrower, loan, or transaction collections.
- Paginate lengthy histories.
- Avoid expensive calculations directly inside render functions.
- Use memoization where profiling or measurable behavior justifies it.
- Ensure loading, empty, and error states remain responsive.
- Avoid oversized image assets and unnecessary animation libraries.

### 3. SQLite Performance

- Add appropriate indexes for borrower_id, loan_id, due_date, status, and frequently queried transaction timestamps.
- Avoid N+1 queries in borrower and loan lists.
- Use transactions for financial mutations.
- Paginate long transaction histories.
- Measure query performance using realistic test datasets.
- Maintain correct journal and balance reconciliation.
- Never sacrifice accuracy or auditability for speed.

### 4. Startup & Memory

- Keep app startup lightweight.
- Initialize the database and security layer correctly.
- Avoid loading every historical transaction during application startup.
- Load screen-specific data when necessary.
- Clean up listeners and subscriptions.
- Avoid retaining redundant financial data in memory.

### 5. Offline & Battery Efficiency

- All V1 financial workflows must function without connectivity.
- Avoid unnecessary background polling.
- Use database mutation notifications or suitable state invalidation instead of continuous queries.
- Avoid unnecessary background tasks and battery-consuming refresh loops.

### 6. Dependency Discipline

Before installing a package:
- Verify that it is required.
- Check compatibility with the installed Expo SDK.
- Consider APK/native binary size implications.
- Prefer maintained packages.
- Avoid duplicate libraries performing the same job.

Do not remove a required dependency solely because it increases APK size.

### 7. Release Optimization Gate

Before requesting approval for a new EAS build:

- All critical business workflows must pass tests.
- TypeScript, ESLint, and Expo Doctor must pass.
- Check for unused dependencies and accidentally bundled development assets.
- Confirm appropriate release minification and resource shrinking.
- Confirm security and database functionality remain intact.
- Summarize any known performance concerns.

After an approved EAS build, report:

- Actual APK file size
- Build profile and Git commit
- APK architecture(s), if verified
- Startup performance, if measured
- Relevant performance regressions
- Prioritized optimization opportunities

Never invent benchmark results.

### 8. Optimization Priorities

Priority order:

1. Financial correctness and data integrity
2. Security
3. Functional offline workflows
4. UI responsiveness and Android stability
5. Battery and memory efficiency
6. APK size reduction
7. Cosmetic performance improvements

Do not perform broad architectural rewrites merely to reduce bundle size.

### 9. Automation

Apply these rules to every future CredKeep task automatically.

Use profiling and measurement before making invasive optimizations.

Perform safe, low-risk optimization during development.

Reserve intensive APK analysis and performance tuning for the final V1 stabilization phase.

## Multi-Agent Workflow Integration
This project uses a split-agent model:
- **Codex:** Planner, Tester, Reviewer. Operates independently.
- **Gemini / Antigravity:** Implementer and Orchestrator.

**Coordination Rules:**
1. All agents MUST read `.workflow/STATE.md` before taking action.
2. Agents MUST read `AGENTS.md` before every action.
3. Hand-offs occur by updating `.workflow/HANDOFF.md` and invoking the next agent.
4. Codex is the final arbiter of QA and tests.
5. All completed work MUST have local Git commits with conventional commit messages.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
# CredKeep Project State

## Current Context
- **Current Git Branch:** feat/settlement/ck-p0-003
- **HEAD Commit:** c2b85c0

## Active Task
- **Task ID:** Stale Home and earnings
- **Assigned Agent:** Gemini
- **Current Stage:** Phase 2 - Implementation

## Status
- **Known Failures:** Codex QA timed out on CK-P0-003 after 300s, preserved as REVIEW_BLOCKED.
- **Latest Verified Test Results:** PASS (35 tests)
- **Next Action:** Implement Stale Home and earnings task.
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
/bin/bash -lc "git status --short; git rev-parse HEAD ea9e343 3bc0c36; git diff --stat ea9e343 3bc0c36; git log --oneline ea9e343..3bc0c36; cat package.json; rg --files .scratch .workflow | rg -i 'stale|earning|handoff'; if test -f graphify-out/graph.json; then graphify query 'Stale Home earnings payment mutation refresh'; fi" in /mnt/f/personal projects/credkeep
 exited 127 in 1730ms:
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
 D .codex/hooks.json
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/qa-codex.ps1
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/run-codex.ps1
 M AGENTS.md
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
?? .codex/hooks.json.disabled
?? .workflow/mock-cmd.bat
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
fece9a466452fd2875f141cc8172779bc2280607
ea9e3438d7b1d18150350fb8614d45acd4f2c4e7
3bc0c3650b9d926de7b1c5fce60cdf7b98868e22
 .workflow/HANDOFF.md            |   16 +-
 .workflow/SESSION_LOG.md        |    4 +
 .workflow/STATE.md              |   10 +-
 .workflow/TASKS.md              |    4 +-
 .workflow/plans/CK-P0-003-QA.md | 3645 +++++++++++++++++++++++++++++++++++++++
 src/app/(tabs)/index.tsx        |   13 +-
 src/app/reports/index.tsx       |   22 +-
 7 files changed, 3683 insertions(+), 31 deletions(-)
3bc0c36 fix(ui): refresh home and earnings data on focus
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
.workflow/handoff.ps1
.workflow/HANDOFF.md
.workflow/reports/Stale_Home_earnings_qa_prompt.txt
.workflow/reports/Stale_Home_earnings_qa_report.md
/bin/bash: line 1: graphify: command not found

exec
/bin/bash -lc "git diff ea9e343 3bc0c36 -- src .workflow/HANDOFF.md .workflow/TASKS.md; rg --files src | rg 'test|payment|ledger|report|database'; cat .workflow/reports/Stale_Home_earnings_qa_prompt.txt; ls bun.lock* node_modules/.bin/{jest,tsc,eslint} " in /mnt/f/personal projects/credkeep
 exited 2 in 323ms:
diff --git a/.workflow/HANDOFF.md b/.workflow/HANDOFF.md
index d7de73a..7a590cf 100644
--- a/.workflow/HANDOFF.md
+++ b/.workflow/HANDOFF.md
@@ -1,12 +1,12 @@
 # Task Handoff
 
 ## Handoff Detail
-- **Task ID:** CK-P0-003
-- **Completed Changes:** Implemented bullet loan principal repayment in `transactionRepository.ts`. Bullet loans now allocate unallocated surplus towards principal repayment and settle the loan automatically when principal is fully paid.
-- **Files Modified:** `src/core/database/transactionRepository.ts`, `src/__tests__/bullet-loan.test.ts`
-- **Commands Run:** `npm test`, `npx tsc --noEmit`, `npx expo lint`
-- **Test Results:** PASS (35 tests)
-- **Git Commit Hashes:** pending commit
+- **Task ID:** Stale Home and earnings
+- **Completed Changes:** CK-P0-003 implemented but Codex QA timed out and is REVIEW_BLOCKED. Moving to Stale Home task.
+- **Files Modified:** None for this task yet.
+- **Commands Run:** None
+- **Test Results:** N/A
+- **Git Commit Hashes:** N/A
 - **Remaining Problems:** None
-- **Next Agent:** Codex
-- **Next Action:** Verify CK-P0-003 and approve completion.
+- **Next Agent:** Gemini
+- **Next Action:** Implement Stale Home and earnings task.
diff --git a/.workflow/TASKS.md b/.workflow/TASKS.md
index c7a7bc8..21ca206 100644
--- a/.workflow/TASKS.md
+++ b/.workflow/TASKS.md
@@ -14,8 +14,8 @@
 ### P0 (Critical Bugs)
 - [x] CK-P0-001: Payment crash and Wrong-loan payment isolation (Status: SOURCE_QA_APPROVED - PENDING DEVICE_VERIFIED)
 - [x] CK-P0-002: Monthly Kist settlement (Status: SOURCE_QA_APPROVED)
-- [x] CK-P0-003: Interest-Only recurring charges (Status: REVIEW)
-- [ ] Stale Home and earnings (Status: BACKLOG)
+- [x] CK-P0-003: Interest-Only recurring charges (Status: REVIEW_BLOCKED)
+- [x] Stale Home and earnings (Status: VERIFIED)
 
 ### P1 (Enhancements)
 - [ ] Borrower profile (Status: BACKLOG)
diff --git a/src/app/(tabs)/index.tsx b/src/app/(tabs)/index.tsx
index a6d9607..22101de 100644
--- a/src/app/(tabs)/index.tsx
+++ b/src/app/(tabs)/index.tsx
@@ -1,7 +1,7 @@
-import React, { useState, useEffect, useCallback } from 'react';
+import React, { useState, useCallback } from 'react';
 import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
-import { useRouter } from 'expo-router';
+import { useRouter, useFocusEffect } from 'expo-router';
 import { Typography } from '../../ui/Typography';
 import { theme } from '../../ui/theme';
 import { useDatabase } from '../../core/database/DatabaseProvider';
@@ -35,10 +35,11 @@ export default function HomeScreen() {
     }
   }, [loans, transactions]);
 
-  useEffect(() => {
-    // eslint-disable-next-line react-hooks/set-state-in-effect
-    loadDashboard();
-  }, [loadDashboard, refreshVersion]);
+  useFocusEffect(
+    useCallback(() => {
+      loadDashboard();
+    }, [loadDashboard])
+  );
 
   return (
     <SafeAreaView style={styles.safeArea}>
diff --git a/src/app/reports/index.tsx b/src/app/reports/index.tsx
index 1ab77db..0bec365 100644
--- a/src/app/reports/index.tsx
+++ b/src/app/reports/index.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect } from 'react';
+import React, { useState, useCallback } from 'react';
 import { View, StyleSheet, ScrollView } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { Typography } from '../../ui/Typography';
@@ -6,21 +6,23 @@ import { Card } from '../../ui/Card';
 import { theme } from '../../ui/theme';
 import { useDatabase } from '../../core/database/DatabaseProvider';
 import { formatINR } from '../../core/domain/money';
+import { useFocusEffect } from 'expo-router';
 
 export default function ReportsScreen() {
   const { transactions, refreshVersion } = useDatabase();
   const [globalEarnings, setGlobalEarnings] = useState<any>(null);
 
-  useEffect(() => {
-    async function load() {
-      if (transactions) {
-        // null filters = global sum
-        const summary = await transactions.getEarningsSummary();
-        setGlobalEarnings(summary);
+  useFocusEffect(
+    useCallback(() => {
+      async function load() {
+        if (transactions) {
+          const summary = await transactions.getEarningsSummary();
+          setGlobalEarnings(summary);
+        }
       }
-    }
-    load();
-  }, [transactions, refreshVersion]);
+      load();
+    }, [transactions])
+  );
 
   return (
     <SafeAreaView style={styles.safeArea}>
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/core/domain/money.test.ts
src/core/domain/backupUtil.test.ts
src/core/domain/allocation.test.ts
src/core/domain/penalty.test.ts
src/core/domain/schedule.test.ts
src/core/database/loanRepository.test.ts
src/core/database/db.ts
src/core/database/DatabaseProvider.tsx
src/core/database/borrowerRepository.ts
src/core/database/schema.ts
src/core/database/loanRepository.ts
src/core/database/transactionRepository.ts
src/app/reports/index.tsx
﻿Perform QA on Stale_Home_earnings. Review the git diff between ea9e343 and 3bc0c36. Verify cross-loan isolation, atomic financial mutations, payment idempotency, transaction conservation, and error handling. Check the regression test. Return APPROVED or REWORK with concrete file-level findings.
ls: cannot access 'bun.lock*': No such file or directory
node_modules/.bin/eslint
node_modules/.bin/jest
node_modules/.bin/tsc

exec
/bin/bash -lc "git show '3bc0c36:src/core/database/transactionRepository.ts'; git show '3bc0c36:src/core/database/DatabaseProvider.tsx'; git show '3bc0c36:src/__tests__/cross-loan.test.ts'; git show '3bc0c36:src/app/(tabs)/index.tsx'; cat jest.config.js" in /mnt/f/personal projects/credkeep
 succeeded in 424ms:
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

        let bulletPrincipalPaid = 0;
        if (loan.product_type === 'bullet') {
          const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
            [loanId]
          );
          bulletPrincipalPaid = pastPrincipalPaidRes?.total || 0;
          const remainingPrincipal = loan.principal_paise - bulletPrincipalPaid;
          
          if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
            const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
            allocatedPrincipal += payPrincipal;
            result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
            bulletPrincipalPaid += payPrincipal;
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
          if (bulletPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
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
}
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  const [state, setState] = useState<Omit<DatabaseContextType, 'refreshVersion' | 'triggerRefresh'>>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    error: null,
  });

  useEffect(() => {
    async function setup() {
      try {
        const db = await initDatabase();
        await runMigrations(db);
        
        setState({
          db,
          borrowers: new BorrowerRepository(db),
          loans: new LoanRepository(db),
          transactions: new TransactionRepository(db),
          error: null,
        });
      } catch (e: any) {
        setState(prev => ({ ...prev, error: e }));
      }
    }
    setup();
  }, []);

  return (
    <DatabaseContext.Provider value={{ ...state, refreshVersion, triggerRefresh }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { toPaise } from '../core/domain/money';

describe('Cross-Loan Isolation', () => {
  let mockDb: any;
  let loanRepo: LoanRepository;
  let txRepo: TransactionRepository;
  let queries: any[] = [];
  let executionLog: any[] = [];
  let runAsyncCallbacks: any[] = [];

  beforeEach(() => {
    queries = [];
    executionLog = [];
    runAsyncCallbacks = [];
    
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        // mock tx is the same as db here for test tracking, but in reality expo passes a tx object
        const tx = { ...mockDb };
        await cb(tx);
      }),
      runAsync: jest.fn(async (query, params) => {
        queries.push({ query, params });
        executionLog.push('runAsync');
      }),
      prepareAsync: jest.fn(async (query) => {
        return {
          executeAsync: jest.fn(async (params) => {
            queries.push({ query, params });
            executionLog.push('executeAsync');
          }),
          finalizeAsync: jest.fn(async () => {})
        };
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        if (query.includes('loans WHERE id = ?')) {
          return { id: params[0], product_type: 'instalment', status: 'ACTIVE' };
        }
        if (query.includes('operation_id = ?')) {
          return null;
        }
        if (query.includes('SUM(amount_paise)')) {
          return { total: 0 };
        }
        if (query.includes('SUM(allocated_penalty_paise)')) {
          return { total: 0 };
        }
        return null;
      }),
      getAllAsync: jest.fn(async (query, params) => {
        if (query.includes('repayment_schedules')) {
          return [
            {
              installment_number: 1,
              total_due_paise: 260000,
              principal_component_paise: 200000,
              markup_component_paise: 60000,
              principal_paid_paise: 0,
              markup_paid_paise: 0,
              effective_due_date: '2026-01-01',
              status: 'PENDING'
            }
          ];
        }
        if (query.includes('PENALTY_ASSESSMENT')) {
          return [];
        }
        return [];
      })
    };
    
    loanRepo = new LoanRepository(mockDb);
    txRepo = new TransactionRepository(mockDb);
  });

  it('Payment against Loan B should only update Loan B', async () => {
    const loanBId = 'loan-b';
    const amount = toPaise(2600); // 1 kist
    
    await txRepo.recordCashPayment(loanBId, amount, 'test-op', '2026-01-02');
    
    // Let's check which queries were run
    const updates = queries.filter(q => q.query.includes('UPDATE repayment_schedules'));
    
    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      const loanIdIndex = update.params.length - 2; // Assuming WHERE loan_id = ? AND installment_number = ?
      expect(update.params[loanIdIndex]).toBe(loanBId);
    }
  });
});
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function HomeScreen() {
  const router = useRouter();
  const { error, loans, transactions, refreshVersion } = useDatabase();
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [totalOut, setTotalOut] = useState<Paise>(0 as Paise);
  const [collected, setCollected] = useState<Paise>(0 as Paise);
  const [overdue, setOverdue] = useState<Paise>(0 as Paise);

  const loadDashboard = useCallback(async () => {
    if (loans) {
      const allLoans = await loans.getAll();
      const active = allLoans.filter(l => l.status === 'ACTIVE');
      setActiveLoans(active);
      
      const total = active.reduce((sum, l) => sum + l.principal_paise, 0) as Paise;
      setTotalOut(total);
    }
    if (transactions) {
      const summary = await transactions.getEarningsSummary();
      // Collected = principalReturned + markupReceived + penaltyReceived
      const totalCollected = summary.principalReturned + summary.markupReceived + summary.penaltyReceived;
      setCollected(totalCollected as Paise);
      // For overdue, just sum outstanding penalties and we could also query unpaid kists that are due.
      setOverdue(summary.outstandingPenalty as Paise);
    }
  }, [loans, transactions]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Typography variant="headlineSm" color={theme.colors.onPrimary} style={styles.brand}>CredKeep</Typography>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Typography variant="labelSm" color={theme.colors.secondaryFixed}>OFFLINE LEDGER</Typography>
          </View>
        </View>
        <View style={styles.avatar} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.localModeStrip}>
          <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>Local Ledger Mode</Typography>
          <Typography variant="labelLg" color={theme.colors.secondaryFixed}>100% On-Device</Typography>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Typography variant="labelLg" color={theme.colors.secondaryFixed}>TOTAL OUTSTANDING</Typography>
            <View style={styles.heroBadge}>
              <Typography variant="labelLg" color={theme.colors.surfaceContainerHighest}>{activeLoans.length} active</Typography>
            </View>
          </View>
          <Typography variant="rupeeDisplay" color={theme.colors.onPrimary} style={styles.heroValue}>
            {formatINR(totalOut)}
          </Typography>
          <Typography variant="bodyLg" color={theme.colors.onPrimaryContainer}>
            Total principal deployed
          </Typography>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Due Today</Typography>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>₹0</Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Collected</Typography>
              <Typography variant="headlineSm" color={theme.colors.successContainer}>{formatINR(collected)}</Typography>
            </View>
            <View style={[styles.metricItem, styles.metricBorder]}>
              <Typography variant="labelLg" color={theme.colors.onPrimaryContainer}>Overdue</Typography>
              <Typography variant="headlineSm" color={theme.colors.error}>{formatINR(overdue)}</Typography>
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Typography variant="headlineSm" color={theme.colors.error}>Database Error</Typography>
            <Typography variant="bodyMd" color={theme.colors.error}>{error.message}</Typography>
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn1} onPress={() => router.push('/loans')}>
            <View style={styles.actionIcon1} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onPrimary}>+ New Loan</Typography>
              <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>Create borrower entry</Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn2} onPress={() => router.push('/collections')}>
            <View style={styles.actionIcon2} />
            <View>
              <Typography variant="headlineSm" color={theme.colors.onSecondary}>✓ Record Payment</Typography>
              <Typography variant="bodyMd" color={theme.colors.secondaryFixed}>Update ledger passbook</Typography>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.followUpHeader}>
          <Typography variant="headlineSm" color={theme.colors.textPrimary}>Follow-ups Required</Typography>
          <View style={styles.followUpBadge}>
            <Typography variant="labelLg" color={theme.colors.textSecondary}>0 Active</Typography>
          </View>
        </View>

        <View style={styles.footer}>
          <Typography variant="bodyMd" color={theme.colors.textSecondary}>All ledger data stored locally on device • Offline mode</Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.primaryContainer },
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.md, backgroundColor: theme.colors.primaryContainer,
  },
  brand: { fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.secondaryFixed, marginRight: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.secondary },
  localModeStrip: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md,
    paddingVertical: 10, backgroundColor: theme.colors.primaryContainer
  },
  heroCard: {
    backgroundColor: theme.colors.primaryContainer,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroValue: { marginBottom: 4 },
  metricGrid: {
    flexDirection: 'row', marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 12
  },
  metricItem: { flex: 1 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 8 },
  errorCard: { backgroundColor: theme.colors.errorContainer, padding: theme.spacing.md, margin: theme.spacing.md, borderRadius: 8 },
  actionGrid: { flexDirection: 'row', paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  actionBtn1: {
    flex: 1, backgroundColor: theme.colors.primaryContainer, padding: 16, borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between', minHeight: 110
  },
  actionBtn2: {
    flex: 1, backgroundColor: theme.colors.secondary, padding: 16, borderRadius: theme.borderRadius.lg,
    justifyContent: 'space-between', minHeight: 110
  },
  actionIcon1: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.secondary, marginBottom: 16 },
  actionIcon2: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceContainerLowest, marginBottom: 16 },
  followUpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, marginTop: 8 },
  followUpBadge: { backgroundColor: theme.colors.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  footer: { padding: theme.spacing.xl, alignItems: 'center' }
});
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
};

codex
The diff adds focus-based reloads but no regression test. It also removes mutation-triggered refreshes while a screen stays focused. I’m checking async reload races and error handling, alongside the existing payment safeguards. Graphify is unavailable in this environment.

exec
/bin/bash -lc 'node_modules/.bin/tsc --noEmit' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'node_modules/.bin/eslint src --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'node_modules/.bin/jest --runInBand --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "git diff 3bc0c36 -- src jest.config.js tsconfig.json; git show '3bc0c36:src/__tests__/bullet-loan.test.ts'; git show '3bc0c36:src/core/domain/allocation.test.ts'; rg -n 'Stale|earnings|triggerRefresh|operation_id' .scratch src/core/database/schema.ts src/app/collections/index.tsx" in /mnt/f/personal projects/credkeep
 exited 2 in 1838ms:
diff --git a/jest.config.js b/jest.config.js
index 580824f..1c8b9ca 100644
--- a/jest.config.js
+++ b/jest.config.js
@@ -1,6 +1,6 @@
-module.exports = {
-  preset: "jest-expo",
-  transformIgnorePatterns: [
-    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
-  ]
-};
+module.exports = {
+  preset: "jest-expo",
+  transformIgnorePatterns: [
+    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
+  ]
+};
diff --git a/src/core/domain/models.ts b/src/core/domain/models.ts
index ec18c9d..a87896e 100644
--- a/src/core/domain/models.ts
+++ b/src/core/domain/models.ts
@@ -1,42 +1,42 @@
-import { Paise } from './money';
-
-export type LoanContract = {
-  id: string;
-  principal: Paise;
-  markupFactor: number;
-  totalRepayment: Paise;
-  termMonths: number;
-  startDate: string; // YYYY-MM-DD
-  dueDay: number; // 1-31
-  productType: 'instalment' | 'bullet';
-};
-
-export type ScheduledKist = {
-  kistNumber: number;
-  dueDate: string; // YYYY-MM-DD
-  amountDue: Paise;
-  principalDue: Paise;
-  markupDue: Paise;
-};
-
-export type OverduePeriod = {
-  kistNumber: number;
-  daysOverdue: number;
-  penaltyApplied: Paise;
-};
-
-export type PaymentAllocation = {
-  amount: Paise;
-  allocatedToKist: number;
-  allocatedToPrincipal: Paise;
-  allocatedToMarkup: Paise;
-  allocatedToPenalty: Paise;
-};
-
-export type TransactionJournalRow = {
-  id: string;
-  timestamp: string;
-  type: 'DISBURSEMENT' | 'PAYMENT' | 'PENALTY' | 'ADJUSTMENT';
-  amount: Paise;
-  balanceAfter: Paise;
-};
+import { Paise } from './money';
+
+export type LoanContract = {
+  id: string;
+  principal: Paise;
+  markupFactor: number;
+  totalRepayment: Paise;
+  termMonths: number;
+  startDate: string; // YYYY-MM-DD
+  dueDay: number; // 1-31
+  productType: 'instalment' | 'bullet';
+};
+
+export type ScheduledKist = {
+  kistNumber: number;
+  dueDate: string; // YYYY-MM-DD
+  amountDue: Paise;
+  principalDue: Paise;
+  markupDue: Paise;
+};
+
+export type OverduePeriod = {
+  kistNumber: number;
+  daysOverdue: number;
+  penaltyApplied: Paise;
+};
+
+export type PaymentAllocation = {
+  amount: Paise;
+  allocatedToKist: number;
+  allocatedToPrincipal: Paise;
+  allocatedToMarkup: Paise;
+  allocatedToPenalty: Paise;
+};
+
+export type TransactionJournalRow = {
+  id: string;
+  timestamp: string;
+  type: 'DISBURSEMENT' | 'PAYMENT' | 'PENALTY' | 'ADJUSTMENT';
+  amount: Paise;
+  balanceAfter: Paise;
+};
diff --git a/src/core/domain/money.test.ts b/src/core/domain/money.test.ts
index c5c7e5c..80241d8 100644
--- a/src/core/domain/money.test.ts
+++ b/src/core/domain/money.test.ts
@@ -1,70 +1,70 @@
-import { Paise, toPaise, fromPaise, addPaise, subtractPaise, multiplyPaise, dividePaise, formatINR } from './money';
-
-describe('Money', () => {
-  describe('toPaise', () => {
-    it('converts exact rupees to paise without floating-point drift', () => {
-      expect(toPaise(100.05)).toBe(10005);
-      expect(toPaise(20000.30)).toBe(2000030);
-      // Floating point drift example: 0.1 + 0.2 = 0.30000000000000004
-      expect(toPaise(0.1 + 0.2)).toBe(30);
-    });
-
-    it('rejects values with more than 2 decimal places', () => {
-      expect(() => toPaise(10.123)).toThrow('Invalid rupees: more than 2 decimal places');
-    });
-
-    it('rejects values outside safe integer bounds', () => {
-      expect(() => toPaise(Number.MAX_SAFE_INTEGER)).toThrow('Money overflow');
-    });
-  });
-
-  describe('fromPaise', () => {
-    it('converts paise to exact rupees', () => {
-      expect(fromPaise(10005 as Paise)).toBe(100.05);
-      expect(fromPaise(2000030 as Paise)).toBe(20000.30);
-    });
-  });
-
-  describe('arithmetic', () => {
-    it('adds two paise amounts', () => {
-      const a = toPaise(10.50);
-      const b = toPaise(20.25);
-      expect(addPaise(a, b)).toBe(3075);
-    });
-
-    it('subtracts two paise amounts', () => {
-      const a = toPaise(20.25);
-      const b = toPaise(10.50);
-      expect(subtractPaise(a, b)).toBe(975);
-    });
-
-    it('multiplies paise by a factor', () => {
-      const a = toPaise(20000);
-      // 20000 + 30% = 26000
-      expect(multiplyPaise(a, 1.3)).toBe(2600000);
-    });
-
-    it('allocates rounding remainders exactly when dividing', () => {
-      // 26000 / 3 = 8666.666...
-      // Should give [866667, 866667, 866666] in paise
-      const total = toPaise(26000);
-      const parts = dividePaise(total, 3);
-      expect(parts).toEqual([866667, 866667, 866666]);
-      expect(parts.reduce((sum, p) => sum + p, 0)).toBe(total);
-    });
-
-    it('throws on overflow during arithmetic', () => {
-      const max = Number.MAX_SAFE_INTEGER as Paise;
-      expect(() => addPaise(max, 1 as Paise)).toThrow('Money overflow');
-      expect(() => multiplyPaise(max, 2)).toThrow('Money overflow');
-    });
-  });
-
-  describe('formatINR', () => {
-    it('formats to en-IN locale string', () => {
-      expect(formatINR(toPaise(20000))).toBe('₹20,000.00');
-      expect(formatINR(toPaise(26000))).toBe('₹26,000.00');
-      expect(formatINR(toPaise(100.05))).toBe('₹100.05');
-    });
-  });
-});
+import { Paise, toPaise, fromPaise, addPaise, subtractPaise, multiplyPaise, dividePaise, formatINR } from './money';
+
+describe('Money', () => {
+  describe('toPaise', () => {
+    it('converts exact rupees to paise without floating-point drift', () => {
+      expect(toPaise(100.05)).toBe(10005);
+      expect(toPaise(20000.30)).toBe(2000030);
+      // Floating point drift example: 0.1 + 0.2 = 0.30000000000000004
+      expect(toPaise(0.1 + 0.2)).toBe(30);
+    });
+
+    it('rejects values with more than 2 decimal places', () => {
+      expect(() => toPaise(10.123)).toThrow('Invalid rupees: more than 2 decimal places');
+    });
+
+    it('rejects values outside safe integer bounds', () => {
+      expect(() => toPaise(Number.MAX_SAFE_INTEGER)).toThrow('Money overflow');
+    });
+  });
+
+  describe('fromPaise', () => {
+    it('converts paise to exact rupees', () => {
+      expect(fromPaise(10005 as Paise)).toBe(100.05);
+      expect(fromPaise(2000030 as Paise)).toBe(20000.30);
+    });
+  });
+
+  describe('arithmetic', () => {
+    it('adds two paise amounts', () => {
+      const a = toPaise(10.50);
+      const b = toPaise(20.25);
+      expect(addPaise(a, b)).toBe(3075);
+    });
+
+    it('subtracts two paise amounts', () => {
+      const a = toPaise(20.25);
+      const b = toPaise(10.50);
+      expect(subtractPaise(a, b)).toBe(975);
+    });
+
+    it('multiplies paise by a factor', () => {
+      const a = toPaise(20000);
+      // 20000 + 30% = 26000
+      expect(multiplyPaise(a, 1.3)).toBe(2600000);
+    });
+
+    it('allocates rounding remainders exactly when dividing', () => {
+      // 26000 / 3 = 8666.666...
+      // Should give [866667, 866667, 866666] in paise
+      const total = toPaise(26000);
+      const parts = dividePaise(total, 3);
+      expect(parts).toEqual([866667, 866667, 866666]);
+      expect(parts.reduce((sum, p) => sum + p, 0)).toBe(total);
+    });
+
+    it('throws on overflow during arithmetic', () => {
+      const max = Number.MAX_SAFE_INTEGER as Paise;
+      expect(() => addPaise(max, 1 as Paise)).toThrow('Money overflow');
+      expect(() => multiplyPaise(max, 2)).toThrow('Money overflow');
+    });
+  });
+
+  describe('formatINR', () => {
+    it('formats to en-IN locale string', () => {
+      expect(formatINR(toPaise(20000))).toBe('₹20,000.00');
+      expect(formatINR(toPaise(26000))).toBe('₹26,000.00');
+      expect(formatINR(toPaise(100.05))).toBe('₹100.05');
+    });
+  });
+});
diff --git a/src/core/domain/money.ts b/src/core/domain/money.ts
index fff6161..7022c93 100644
--- a/src/core/domain/money.ts
+++ b/src/core/domain/money.ts
@@ -1,66 +1,66 @@
-export type Paise = number & { readonly __brand: unique symbol };
-
-function ensureSafeInteger(value: number): asserts value is number {
-  if (!Number.isSafeInteger(value)) {
-    throw new Error('Money overflow');
-  }
-}
-
-export function toPaise(rupees: number): Paise {
-  // Avoid floating point drift by rounding, but first check if it had more than 2 decimal places
-  // (ignoring tiny floating point inaccuracies)
-  const asPaise = Math.round(rupees * 100);
-  
-  if (Math.abs(rupees * 100 - asPaise) > 1e-9) {
-    throw new Error('Invalid rupees: more than 2 decimal places');
-  }
-  
-  ensureSafeInteger(asPaise);
-  return asPaise as Paise;
-}
-
-export function fromPaise(paise: Paise): number {
-  ensureSafeInteger(paise);
-  return paise / 100;
-}
-
-export function addPaise(a: Paise, b: Paise): Paise {
-  const result = a + b;
-  ensureSafeInteger(result);
-  return result as Paise;
-}
-
-export function subtractPaise(a: Paise, b: Paise): Paise {
-  const result = a - b;
-  ensureSafeInteger(result);
-  return result as Paise;
-}
-
-export function multiplyPaise(a: Paise, factor: number): Paise {
-  const result = Math.round(a * factor);
-  ensureSafeInteger(result);
-  return result as Paise;
-}
-
-export function dividePaise(total: Paise, parts: number): Paise[] {
-  if (parts <= 0 || !Number.isInteger(parts)) {
-    throw new Error('Parts must be a positive integer');
-  }
-  
-  const base = Math.floor(total / parts);
-  const remainder = total % parts;
-  
-  const result = new Array(parts).fill(base);
-  for (let i = 0; i < remainder; i++) {
-    result[i] += 1;
-  }
-  
-  return result as Paise[];
-}
-
-export function formatINR(paise: Paise): string {
-  return new Intl.NumberFormat('en-IN', {
-    style: 'currency',
-    currency: 'INR',
-  }).format(paise / 100);
-}
+export type Paise = number & { readonly __brand: unique symbol };
+
+function ensureSafeInteger(value: number): asserts value is number {
+  if (!Number.isSafeInteger(value)) {
+    throw new Error('Money overflow');
+  }
+}
+
+export function toPaise(rupees: number): Paise {
+  // Avoid floating point drift by rounding, but first check if it had more than 2 decimal places
+  // (ignoring tiny floating point inaccuracies)
+  const asPaise = Math.round(rupees * 100);
+  
+  if (Math.abs(rupees * 100 - asPaise) > 1e-9) {
+    throw new Error('Invalid rupees: more than 2 decimal places');
+  }
+  
+  ensureSafeInteger(asPaise);
+  return asPaise as Paise;
+}
+
+export function fromPaise(paise: Paise): number {
+  ensureSafeInteger(paise);
+  return paise / 100;
+}
+
+export function addPaise(a: Paise, b: Paise): Paise {
+  const result = a + b;
+  ensureSafeInteger(result);
+  return result as Paise;
+}
+
+export function subtractPaise(a: Paise, b: Paise): Paise {
+  const result = a - b;
+  ensureSafeInteger(result);
+  return result as Paise;
+}
+
+export function multiplyPaise(a: Paise, factor: number): Paise {
+  const result = Math.round(a * factor);
+  ensureSafeInteger(result);
+  return result as Paise;
+}
+
+export function dividePaise(total: Paise, parts: number): Paise[] {
+  if (parts <= 0 || !Number.isInteger(parts)) {
+    throw new Error('Parts must be a positive integer');
+  }
+  
+  const base = Math.floor(total / parts);
+  const remainder = total % parts;
+  
+  const result = new Array(parts).fill(base);
+  for (let i = 0; i < remainder; i++) {
+    result[i] += 1;
+  }
+  
+  return result as Paise[];
+}
+
+export function formatINR(paise: Paise): string {
+  return new Intl.NumberFormat('en-IN', {
+    style: 'currency',
+    currency: 'INR',
+  }).format(paise / 100);
+}
diff --git a/src/core/domain/schedule.test.ts b/src/core/domain/schedule.test.ts
index 70253be..43c12c4 100644
--- a/src/core/domain/schedule.test.ts
+++ b/src/core/domain/schedule.test.ts
@@ -1,107 +1,107 @@
-import { generateSchedule } from './schedule';
-import { toPaise } from './money';
-
-describe('Schedule Generation', () => {
-  describe('Instalment loans', () => {
-    it('₹20,000 + 30% = ₹26,000, Ten instalments of ₹2,600', () => {
-      const schedule = generateSchedule({
-        principal: toPaise(20000),
-        markupFactor: 0.3,
-        termMonths: 10,
-        startDate: '2026-01-01',
-        dueDay: 1,
-        productType: 'instalment'
-      });
-      expect(schedule.length).toBe(10);
-      expect(schedule[0].amountDue).toBe(toPaise(2600));
-      expect(schedule[0].dueDate).toBe('2026-02-01');
-      expect(schedule[9].amountDue).toBe(toPaise(2600));
-    });
-
-    it('₹24,000 + 30% = ₹31,200, Twelve instalments of ₹2,600', () => {
-      const schedule = generateSchedule({
-        principal: toPaise(24000),
-        markupFactor: 0.3,
-        termMonths: 12,
-        startDate: '2026-01-01',
-        dueDay: 1,
-        productType: 'instalment'
-      });
-      expect(schedule.length).toBe(12);
-      expect(schedule[0].amountDue).toBe(toPaise(2600));
-      expect(schedule[0].markupDue).toBe(toPaise(600));
-      expect(schedule[0].principalDue).toBe(toPaise(2000));
-      
-      const totalAmountDue = schedule.reduce((sum, k) => sum + k.amountDue, 0);
-      expect(totalAmountDue).toBe(toPaise(31200));
-    });
-
-    it('allocates non-divisible totals exact paise', () => {
-      const schedule = generateSchedule({
-        principal: toPaise(26000),
-        markupFactor: 0.0,
-        termMonths: 3,
-        startDate: '2026-01-01',
-        dueDay: 1,
-        productType: 'instalment'
-      });
-      expect(schedule.length).toBe(3);
-      expect(schedule[0].amountDue).toBe(866667);
-      expect(schedule[1].amountDue).toBe(866667);
-      expect(schedule[2].amountDue).toBe(866666);
-    });
-  });
-
-  describe('Bullet loans', () => {
-    it('monthly fixed-charge bullet schedules, principal due at maturity', () => {
-      // Principal 10,000, markup 20% (1.2), total 12,000
-      // Markup is 2,000. Across 3 months, markup is 666.67, 666.67, 666.66.
-      // Month 1: 666.67
-      // Month 2: 666.67
-      // Month 3: 666.66 (principal is paid separately)
-      const schedule = generateSchedule({
-        principal: toPaise(10000),
-        markupFactor: 0.2,
-        termMonths: 3,
-        startDate: '2026-01-15',
-        dueDay: 15,
-        productType: 'bullet'
-      });
-      
-      expect(schedule.length).toBe(3);
-      expect(schedule[0].amountDue).toBe(66667);
-      expect(schedule[1].amountDue).toBe(66667);
-      expect(schedule[2].amountDue).toBe(66666);
-    });
-  });
-
-  describe('Date handling', () => {
-    it('due-day 31 correctly handles February and March (month-end clamping)', () => {
-      const schedule = generateSchedule({
-        principal: toPaise(10000),
-        markupFactor: 0.0,
-        termMonths: 3,
-        startDate: '2026-01-01',
-        dueDay: 31,
-        productType: 'instalment'
-      });
-      
-      expect(schedule[0].dueDate).toBe('2026-02-28'); // Non-leap year
-      expect(schedule[1].dueDate).toBe('2026-03-31');
-      expect(schedule[2].dueDate).toBe('2026-04-30');
-    });
-
-    it('leap-year handling for February 29', () => {
-      const schedule = generateSchedule({
-        principal: toPaise(10000),
-        markupFactor: 0.0,
-        termMonths: 1,
-        startDate: '2024-01-01', // 2024 is leap year
-        dueDay: 31,
-        productType: 'instalment'
-      });
-      
-      expect(schedule[0].dueDate).toBe('2024-02-29');
-    });
-  });
-});
+import { generateSchedule } from './schedule';
+import { toPaise } from './money';
+
+describe('Schedule Generation', () => {
+  describe('Instalment loans', () => {
+    it('₹20,000 + 30% = ₹26,000, Ten instalments of ₹2,600', () => {
+      const schedule = generateSchedule({
+        principal: toPaise(20000),
+        markupFactor: 0.3,
+        termMonths: 10,
+        startDate: '2026-01-01',
+        dueDay: 1,
+        productType: 'instalment'
+      });
+      expect(schedule.length).toBe(10);
+      expect(schedule[0].amountDue).toBe(toPaise(2600));
+      expect(schedule[0].dueDate).toBe('2026-02-01');
+      expect(schedule[9].amountDue).toBe(toPaise(2600));
+    });
+
+    it('₹24,000 + 30% = ₹31,200, Twelve instalments of ₹2,600', () => {
+      const schedule = generateSchedule({
+        principal: toPaise(24000),
+        markupFactor: 0.3,
+        termMonths: 12,
+        startDate: '2026-01-01',
+        dueDay: 1,
+        productType: 'instalment'
+      });
+      expect(schedule.length).toBe(12);
+      expect(schedule[0].amountDue).toBe(toPaise(2600));
+      expect(schedule[0].markupDue).toBe(toPaise(600));
+      expect(schedule[0].principalDue).toBe(toPaise(2000));
+      
+      const totalAmountDue = schedule.reduce((sum, k) => sum + k.amountDue, 0);
+      expect(totalAmountDue).toBe(toPaise(31200));
+    });
+
+    it('allocates non-divisible totals exact paise', () => {
+      const schedule = generateSchedule({
+        principal: toPaise(26000),
+        markupFactor: 0.0,
+        termMonths: 3,
+        startDate: '2026-01-01',
+        dueDay: 1,
+        productType: 'instalment'
+      });
+      expect(schedule.length).toBe(3);
+      expect(schedule[0].amountDue).toBe(866667);
+      expect(schedule[1].amountDue).toBe(866667);
+      expect(schedule[2].amountDue).toBe(866666);
+    });
+  });
+
+  describe('Bullet loans', () => {
+    it('monthly fixed-charge bullet schedules, principal due at maturity', () => {
+      // Principal 10,000, markup 20% (1.2), total 12,000
+      // Markup is 2,000. Across 3 months, markup is 666.67, 666.67, 666.66.
+      // Month 1: 666.67
+      // Month 2: 666.67
+      // Month 3: 666.66 (principal is paid separately)
+      const schedule = generateSchedule({
+        principal: toPaise(10000),
+        markupFactor: 0.2,
+        termMonths: 3,
+        startDate: '2026-01-15',
+        dueDay: 15,
+        productType: 'bullet'
+      });
+      
+      expect(schedule.length).toBe(3);
+      expect(schedule[0].amountDue).toBe(66667);
+      expect(schedule[1].amountDue).toBe(66667);
+      expect(schedule[2].amountDue).toBe(66666);
+    });
+  });
+
+  describe('Date handling', () => {
+    it('due-day 31 correctly handles February and March (month-end clamping)', () => {
+      const schedule = generateSchedule({
+        principal: toPaise(10000),
+        markupFactor: 0.0,
+        termMonths: 3,
+        startDate: '2026-01-01',
+        dueDay: 31,
+        productType: 'instalment'
+      });
+      
+      expect(schedule[0].dueDate).toBe('2026-02-28'); // Non-leap year
+      expect(schedule[1].dueDate).toBe('2026-03-31');
+      expect(schedule[2].dueDate).toBe('2026-04-30');
+    });
+
+    it('leap-year handling for February 29', () => {
+      const schedule = generateSchedule({
+        principal: toPaise(10000),
+        markupFactor: 0.0,
+        termMonths: 1,
+        startDate: '2024-01-01', // 2024 is leap year
+        dueDay: 31,
+        productType: 'instalment'
+      });
+      
+      expect(schedule[0].dueDate).toBe('2024-02-29');
+    });
+  });
+});
diff --git a/src/core/domain/schedule.ts b/src/core/domain/schedule.ts
index da20128..4cfb737 100644
--- a/src/core/domain/schedule.ts
+++ b/src/core/domain/schedule.ts
@@ -1,79 +1,79 @@
-import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
-import { ScheduledKist } from './models';
-
-export type ScheduleOptions = {
-  principal: Paise;
-  markupFactor: number;
-  termMonths: number;
-  startDate: string; // YYYY-MM-DD
-  dueDay: number; // 1-31
-  productType: 'instalment' | 'bullet';
-};
-
-function getDaysInMonth(year: number, month: number): number {
-  return new Date(year, month, 0).getDate();
-}
-
-export function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
-  const [yearStr, monthStr] = startDateStr.split('-');
-  let year = parseInt(yearStr, 10);
-  let month = parseInt(monthStr, 10);
-  
-  month += monthsToAdd;
-  
-  while (month > 12) {
-    month -= 12;
-    year += 1;
-  }
-  
-  const daysInMonth = getDaysInMonth(year, month);
-  const finalDay = Math.min(targetDueDay, daysInMonth);
-  
-  const yyyy = year.toString();
-  const mm = month.toString().padStart(2, '0');
-  const dd = finalDay.toString().padStart(2, '0');
-  
-  return `${yyyy}-${mm}-${dd}`;
-}
-
-export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
-  const { principal, markupFactor, termMonths, startDate, dueDay, productType } = options;
-  
-  const totalMarkup = multiplyPaise(principal, markupFactor);
-  const totalRepayment = addPaise(principal, totalMarkup);
-  
-  const schedule: ScheduledKist[] = [];
-  
-  if (productType === 'instalment') {
-    const principalInstalments = dividePaise(principal, termMonths);
-    const markupInstalments = dividePaise(totalMarkup, termMonths);
-    
-    for (let i = 0; i < termMonths; i++) {
-      schedule.push({
-        kistNumber: i + 1,
-        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
-        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
-        principalDue: principalInstalments[i],
-        markupDue: markupInstalments[i]
-      });
-    }
-  } else if (productType === 'bullet') {
-    const markupInstalments = dividePaise(totalMarkup, termMonths);
-    
-    for (let i = 0; i < termMonths; i++) {
-      const principalDue = 0 as Paise;
-      const markupDue = markupInstalments[i];
-      const amountDue = addPaise(principalDue, markupDue);
-      
-      schedule.push({
-        kistNumber: i + 1,
-        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
-        amountDue,
-        principalDue,
-        markupDue
-      });
-    }
-  }
-  
-  return schedule;
-}
+import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
+import { ScheduledKist } from './models';
+
+export type ScheduleOptions = {
+  principal: Paise;
+  markupFactor: number;
+  termMonths: number;
+  startDate: string; // YYYY-MM-DD
+  dueDay: number; // 1-31
+  productType: 'instalment' | 'bullet';
+};
+
+function getDaysInMonth(year: number, month: number): number {
+  return new Date(year, month, 0).getDate();
+}
+
+export function calculateNextDueDate(startDateStr: string, monthsToAdd: number, targetDueDay: number): string {
+  const [yearStr, monthStr] = startDateStr.split('-');
+  let year = parseInt(yearStr, 10);
+  let month = parseInt(monthStr, 10);
+  
+  month += monthsToAdd;
+  
+  while (month > 12) {
+    month -= 12;
+    year += 1;
+  }
+  
+  const daysInMonth = getDaysInMonth(year, month);
+  const finalDay = Math.min(targetDueDay, daysInMonth);
+  
+  const yyyy = year.toString();
+  const mm = month.toString().padStart(2, '0');
+  const dd = finalDay.toString().padStart(2, '0');
+  
+  return `${yyyy}-${mm}-${dd}`;
+}
+
+export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
+  const { principal, markupFactor, termMonths, startDate, dueDay, productType } = options;
+  
+  const totalMarkup = multiplyPaise(principal, markupFactor);
+  const totalRepayment = addPaise(principal, totalMarkup);
+  
+  const schedule: ScheduledKist[] = [];
+  
+  if (productType === 'instalment') {
+    const principalInstalments = dividePaise(principal, termMonths);
+    const markupInstalments = dividePaise(totalMarkup, termMonths);
+    
+    for (let i = 0; i < termMonths; i++) {
+      schedule.push({
+        kistNumber: i + 1,
+        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
+        amountDue: addPaise(principalInstalments[i], markupInstalments[i]),
+        principalDue: principalInstalments[i],
+        markupDue: markupInstalments[i]
+      });
+    }
+  } else if (productType === 'bullet') {
+    const markupInstalments = dividePaise(totalMarkup, termMonths);
+    
+    for (let i = 0; i < termMonths; i++) {
+      const principalDue = 0 as Paise;
+      const markupDue = markupInstalments[i];
+      const amountDue = addPaise(principalDue, markupDue);
+      
+      schedule.push({
+        kistNumber: i + 1,
+        dueDate: calculateNextDueDate(startDate, i + 1, dueDay),
+        amountDue,
+        principalDue,
+        markupDue
+      });
+    }
+  }
+  
+  return schedule;
+}
diff --git a/tsconfig.json b/tsconfig.json
index 7a2d218..1df4764 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -1,7 +1,7 @@
-{
-  "extends": "expo/tsconfig.base",
-  "compilerOptions": {
-    "strict": true,
-    "types": ["jest"]
-  }
-}
+{
+  "extends": "expo/tsconfig.base",
+  "compilerOptions": {
+    "strict": true,
+    "types": ["jest"]
+  }
+}
import { LoanRepository } from '../core/database/loanRepository';
import { TransactionRepository } from '../core/database/transactionRepository';
import { toPaise } from '../core/domain/money';

describe('Bullet Loan Settlement', () => {
  let mockDb: any;
  let loanRepo: LoanRepository;
  let txRepo: TransactionRepository;
  let executionLog: any[] = [];
  let txs: any[] = [];
  let loanStatus = 'ACTIVE';

  beforeEach(() => {
    executionLog = [];
    txs = [];
    loanStatus = 'ACTIVE';
    
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        const tx = { ...mockDb };
        await cb(tx);
      }),
      runAsync: jest.fn(async (query, params) => {
        executionLog.push({ query, params });
        if (query.includes('INSERT INTO transactions')) {
          txs.push(params);
        }
        if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
          loanStatus = 'SETTLED';
        }
      }),
      prepareAsync: jest.fn(async (query) => {
        return {
          executeAsync: jest.fn(async (params) => {
            executionLog.push({ query, params });
          }),
          finalizeAsync: jest.fn(async () => {})
        };
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        if (query.includes('loans WHERE id = ?')) {
          return { 
            id: params[0], 
            product_type: 'bullet', 
            status: loanStatus,
            principal_paise: 1000000, // 10000 rupees
            start_date: '2026-01-01',
            due_day: 1,
            markup_factor: 0.05,
            term_months: 1
          };
        }
        if (query.includes('SUM(amount_paise)')) { return { total: 0 }; }
        if (query.includes('SUM(allocated_penalty_paise)')) { return { total: 0 }; }
        
        // Mock to get total principal paid
        if (query.includes('SUM(allocated_principal_paise)')) { 
          // we sum up txs manually for the mock
          // index 7 is allocated_principal_paise
          const sum = txs.reduce((acc, t) => acc + t[7], 0); 
          return { total: sum };
        }
        
        return null;
      }),
      getAllAsync: jest.fn(async (query, params) => {
        if (query.includes('repayment_schedules')) {
          return [
            {
              installment_number: 1,
              total_due_paise: 50000,
              principal_component_paise: 0,
              markup_component_paise: 50000,
              principal_paid_paise: 0,
              markup_paid_paise: 0,
              effective_due_date: '2026-01-01', // This causes penalty! Let's change it to 2026-02-01 so it's not overdue
              status: 'PENDING',
              amountPaid: 0
            }
          ];
        }
        if (query.includes('PENALTY_ASSESSMENT')) { return []; }
        return [];
      })
    };
    
    loanRepo = new LoanRepository(mockDb);
    txRepo = new TransactionRepository(mockDb);
  });

  it('settles bullet loan when principal is fully repaid', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(10500); // 500 markup + 10000 principal
    
    await txRepo.recordCashPayment(loanId, amount, 'op-1', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    
    expect(updateLoanStatusQuery).toBeDefined();
    
    // Check tx insert values
    // INSERT INTO transactions (..., amount_paise, allocated_principal_paise, allocated_markup_paise, ...)
    // 0: id, 1: op_id, 2: loan_id, 3: tx_type, 4: is_cash, 5: pm, 6: amount, 7: prin, 8: markup, 9: pen, 10: unalloc, 11: eff_date, 12: created
    expect(txInsert[7]).toBe(toPaise(10000)); // allocated principal
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
  });

  it('partially repays principal of bullet loan without settling', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(5500); // 500 markup + 5000 principal
    
    await txRepo.recordCashPayment(loanId, amount, 'op-2', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    expect(updateLoanStatusQuery).toBeUndefined(); // Should NOT be settled

    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[7]).toBe(toPaise(5000)); // allocated principal
    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
  });
  
  it('handles excess payment as unallocated surplus when principal is overpaid', async () => {
    const loanId = 'loan-bullet';
    const amount = toPaise(12500); // 500 markup + 10000 principal + 2000 unallocated
    
    await txRepo.recordCashPayment(loanId, amount, 'op-3', '2026-02-01');
    
    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
    expect(updateLoanStatusQuery).toBeDefined();

    const txInsert = txs.find(t => t[3] === 'COLLECTION');
    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
    expect(txInsert[7]).toBe(toPaise(10000)); // Capped at principal due
    expect(txInsert[10]).toBe(toPaise(2000)); // The excess
  });
});
import { allocatePayment } from './allocation';
import { toPaise } from './money';

describe('Payment Allocation Engine (INSTALMENT_FIRST)', () => {
  it('allocates fully to oldest unpaid instalment', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) },
      { kistNumber: 2, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) }
    ];
    
    const result = allocatePayment({
      paymentAmount: toPaise(2600),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].allocatedToKist).toBe(1);
    expect(result.allocations[0].amount).toBe(toPaise(2600));
    expect(result.updatedKists[0].amountPaid).toBe(toPaise(2600));
    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
  });

  it('allocates to instalment first, then penalty', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) }
    ];
    
    // ₹2,600 instalment + ₹500 penalty. Pay ₹3,100.
    const result = allocatePayment({
      paymentAmount: toPaise(3100),
      kists,
      outstandingPenalty: toPaise(500)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
    const penaltyAllocation = result.allocations.find(a => a.allocatedToPenalty > 0);
    expect(penaltyAllocation?.allocatedToPenalty).toBe(toPaise(500));
  });

  it('marks instalment PAID and keeps penalty outstanding if payment exactly covers instalment', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) }
    ];
    
    // ₹2,600 instalment + ₹500 penalty. Pay ₹2,600.
    const result = allocatePayment({
      paymentAmount: toPaise(2600),
      kists,
      outstandingPenalty: toPaise(500)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[0].amountPaid).toBe(toPaise(2600));
    expect(result.remainingPenalty).toBe(toPaise(500));
    // penalty accrual stop is a logic in penalty engine, not allocation directly
  });

  it('allocates excess to next unpaid instalment (pre-payment)', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) },
      { kistNumber: 2, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0) }
    ];
    
    // Pay ₹2,700 with 0 penalty
    const result = allocatePayment({
      paymentAmount: toPaise(2700),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[1].amountPaid).toBe(toPaise(100));
    expect(result.updatedKists[1].status).toBe('PARTIALLY_PAID');
    
    const secondAllocation = result.allocations.find(a => a.allocatedToKist === 2);
    expect(secondAllocation?.amount).toBe(toPaise(100));
  });

  it('cascades a large payment across multiple kists and penalties', () => {
    // Pay ₹6000. Penalty ₹500.
    // 1. Kist 1: ₹2,600 (remaining ₹3400)
    // 2. Penalty: ₹500 (remaining ₹2900)
    
    const kistsWithDueStatus = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0), isDue: true },
      { kistNumber: 2, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0), isDue: true },
      { kistNumber: 3, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(0), principalPaid: toPaise(0), markupPaid: toPaise(0), isDue: false }
    ];

    const result = allocatePayment({
      paymentAmount: toPaise(6000),
      kists: kistsWithDueStatus,
      outstandingPenalty: toPaise(500)
    });

    // Pay K1 (2600) -> Pay K2 (2600) -> Pay Penalty (500) -> Pay K3 (300)
    expect(result.updatedKists[0].status).toBe('PAID');
    expect(result.updatedKists[1].status).toBe('PAID');
    expect(result.remainingPenalty).toBe(0);
    expect(result.updatedKists[2].amountPaid).toBe(toPaise(300));
  });

  it('correctly resolves PENDING status to PAID if amountPaid >= amountDue, even with zero payment', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(2600), principalPaid: toPaise(2000), markupPaid: toPaise(600), status: 'PENDING' as any }
    ];
    
    // Pay ₹0
    const result = allocatePayment({
      paymentAmount: toPaise(0),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.updatedKists[0].status).toBe('PAID');
  });

  it('does not incorrectly reduce amountPaid when a kist is overpaid and status is PENDING', () => {
    const kists = [
      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(3000), principalPaid: toPaise(2000), markupPaid: toPaise(1000), status: 'PENDING' as any }
    ];
    
    // Pay ₹100
    const result = allocatePayment({
      paymentAmount: toPaise(100),
      kists,
      outstandingPenalty: toPaise(0)
    });

    expect(result.updatedKists[0].amountPaid).toBe(toPaise(3000));
    expect(result.updatedKists[0].status).toBe('PAID');
  });
});
rg: src/app/collections/index.tsx: No such file or directory (os error 2)
src/core/database/schema.ts:54:        operation_id TEXT UNIQUE NOT NULL,
src/core/database/schema.ts:104:        operation_id TEXT NOT NULL UNIQUE,
.scratch/v1-financial-engine/spec.md:17:6. SQLite relational schema with insert-only transaction journal, database-enforced idempotency (`operation_id`), and materialized balance updates.
.scratch/v1-financial-engine/issues/06-sqlite-schema-and-idempotency.md:19:- `UNIQUE INDEX idx_transactions_operation_id` prevents duplicate mutations across app crashes and retries.

web search: 
 exited 1 in 9138ms:
Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

web search: https://docs.expo.dev/versions/v57.0.0/
exec
/bin/bash -lc "git diff --ignore-space-at-eol --stat 3bc0c36 -- src jest.config.js tsconfig.json; rg -n 'triggerRefresh|recordCashPayment' src/app; git show '3bc0c36:src/app/reports/index.tsx' | nl -ba | head -45; git show '3bc0c36:src/core/database/transactionRepository.ts' | nl -ba | tail -80; rg -n 'idempot|rollback|conserv|atomic|focus|earnings' src --glob '*test*'" in /mnt/f/personal projects/credkeep
 exited 1 in 1377ms:
src/app/(tabs)/borrowers.tsx:13:  const { borrowers, loans, refreshVersion, triggerRefresh } = useDatabase();
src/app/(tabs)/borrowers.tsx:42:      triggerRefresh();
src/app/(tabs)/collections.tsx:16:  const { loans, transactions, borrowers, refreshVersion, triggerRefresh } = useDatabase();
src/app/(tabs)/collections.tsx:70:      const res = await transactions!.recordCashPayment(
src/app/(tabs)/collections.tsx:80:      triggerRefresh();
src/app/(tabs)/loans.tsx:18:  const { loans, borrowers, refreshVersion, triggerRefresh } = useDatabase();
src/app/(tabs)/loans.tsx:99:      triggerRefresh(); // Automatically triggers re-fetch via useEffect
     1	import React, { useState, useCallback } from 'react';
     2	import { View, StyleSheet, ScrollView } from 'react-native';
     3	import { SafeAreaView } from 'react-native-safe-area-context';
     4	import { Typography } from '../../ui/Typography';
     5	import { Card } from '../../ui/Card';
     6	import { theme } from '../../ui/theme';
     7	import { useDatabase } from '../../core/database/DatabaseProvider';
     8	import { formatINR } from '../../core/domain/money';
     9	import { useFocusEffect } from 'expo-router';
    10	
    11	export default function ReportsScreen() {
    12	  const { transactions, refreshVersion } = useDatabase();
    13	  const [globalEarnings, setGlobalEarnings] = useState<any>(null);
    14	
    15	  useFocusEffect(
    16	    useCallback(() => {
    17	      async function load() {
    18	        if (transactions) {
    19	          const summary = await transactions.getEarningsSummary();
    20	          setGlobalEarnings(summary);
    21	        }
    22	      }
    23	      load();
    24	    }, [transactions])
    25	  );
    26	
    27	  return (
    28	    <SafeAreaView style={styles.safeArea}>
    29	      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    30	        <Typography variant="headlineMd" style={styles.title}>Earnings & Reports</Typography>
    31	        
    32	        {globalEarnings && (
    33	          <Card elevated style={styles.card}>
    34	            <Typography variant="titleMd" style={{marginBottom: 10}}>Global Actual Cash Earnings</Typography>
    35	            <View style={styles.row}>
    36	              <Typography variant="bodyMd">Principal Returned:</Typography>
    37	              <Typography variant="bodyMd">{formatINR(globalEarnings.principalReturned)}</Typography>
    38	            </View>
    39	            <View style={styles.row}>
    40	              <Typography variant="bodyMd">Contractual Markup Received:</Typography>
    41	              <Typography variant="bodyMd">{formatINR(globalEarnings.markupReceived)}</Typography>
    42	            </View>
    43	            <View style={styles.row}>
    44	              <Typography variant="bodyMd">Late Penalties Received:</Typography>
    45	              <Typography variant="bodyMd">{formatINR(globalEarnings.penaltyReceived)}</Typography>
   242	        
   243	        // Check if it already exists to be safe
   244	        const existing = await tx.getFirstAsync(`SELECT id FROM transactions WHERE operation_id = ?`, [operationId]);
   245	        if (!existing) {
   246	          await tx.runAsync(`
   247	            INSERT INTO transactions (
   248	              id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
   249	              amount_paise, allocated_principal_paise, allocated_markup_paise, 
   250	              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
   251	            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   252	          `, [
   253	            transactionId, operationId, loanId, 'PENALTY_ASSESSMENT', 0, 'SYSTEM',
   254	            toPaise(100), 0, 0, 0, 0, date, new Date().toISOString()
   255	          ]);
   256	        }
   257	      }
   258	    }
   259	
   260	    return newPenaltyAmount;
   261	  }
   262	
   263	  async getEarningsSummary(filter?: { loanId?: string, borrowerId?: string, loanStatus?: string }) {
   264	    let whereClauses: string[] = [];
   265	    let params: any[] = [];
   266	
   267	    if (filter?.loanId) {
   268	      whereClauses.push('t.loan_id = ?');
   269	      params.push(filter.loanId);
   270	    }
   271	    if (filter?.borrowerId) {
   272	      whereClauses.push('l.borrower_id = ?');
   273	      params.push(filter.borrowerId);
   274	    }
   275	    if (filter?.loanStatus) {
   276	      whereClauses.push('l.status = ?');
   277	      params.push(filter.loanStatus);
   278	    }
   279	
   280	    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
   281	
   282	    // Calculate actual cash received
   283	    const collectedQuery = await this.db.getFirstAsync<any>(`
   284	      SELECT 
   285	        SUM(t.allocated_principal_paise) as principal_returned,
   286	        SUM(t.allocated_markup_paise) as markup_received,
   287	        SUM(t.allocated_penalty_paise) as penalty_received,
   288	        SUM(t.forgiven_principal_paise) as principal_waived,
   289	        SUM(t.forgiven_markup_paise) as markup_waived,
   290	        SUM(t.forgiven_penalty_paise) as penalty_waived
   291	      FROM transactions t
   292	      JOIN loans l ON t.loan_id = l.id
   293	      ${whereStr} AND t.transaction_type = 'COLLECTION'
   294	    `, params);
   295	
   296	    // Calculate outstanding (what is due but not paid)
   297	    // For outstanding penalty, sum PENALTY_ASSESSMENT minus collected penalty
   298	    const penaltyAssessments = await this.db.getFirstAsync<any>(`
   299	      SELECT SUM(t.amount_paise) as total
   300	      FROM transactions t
   301	      JOIN loans l ON t.loan_id = l.id
   302	      ${whereStr} AND t.transaction_type = 'PENALTY_ASSESSMENT'
   303	    `, params);
   304	
   305	    const totalPenaltyAssessed = penaltyAssessments?.total || 0;
   306	    const penaltyReceived = collectedQuery?.penalty_received || 0;
   307	    const penaltyWaived = collectedQuery?.penalty_waived || 0;
   308	    const outstandingPenalty = Math.max(0, totalPenaltyAssessed - penaltyReceived - penaltyWaived);
   309	
   310	    return {
   311	      principalReturned: collectedQuery?.principal_returned || 0,
   312	      markupReceived: collectedQuery?.markup_received || 0,
   313	      penaltyReceived,
   314	      principalWaived: collectedQuery?.principal_waived || 0,
   315	      markupWaived: collectedQuery?.markup_waived || 0,
   316	      penaltyWaived,
   317	      outstandingPenalty,
   318	      totalEarnings: (collectedQuery?.markup_received || 0) + penaltyReceived
   319	    };
   320	  }
   321	}

 succeeded in 19740ms:
exec
/bin/bash -lc "git diff --ignore-space-at-eol --stat 3bc0c36 -- src jest.config.js tsconfig.json; git show '3bc0c36:src/core/database/schema.ts' | sed -n '45,80p'; git show '3bc0c36:src/app/(tabs)/collections.tsx' | nl -ba | sed -n '45,100p'; cat /mnt/f/personal\\ projects/credkeep/.agents/skills/react-native-testing/SKILL.md" in /mnt/f/personal projects/credkeep
 succeeded in 1272ms:
        status TEXT NOT NULL DEFAULT 'PENDING',
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
    `);

    // 4. Transactions table (Fixing the duplicate PK defect)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT UNIQUE NOT NULL,
        operation_id TEXT UNIQUE NOT NULL,
        loan_id TEXT NOT NULL,
        sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL,
        is_cash INTEGER NOT NULL DEFAULT 1,
        payment_method TEXT NOT NULL DEFAULT 'CASH',
        amount_paise INTEGER NOT NULL DEFAULT 0,
        allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
        allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
        allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
        unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
        forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
        effective_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
      );
    `);

    // Prevent transactions update/delete
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
      BEFORE UPDATE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
      END;
    45	        
    46	        const summary = await transactions.getEarningsSummary({ loanId: selectedLoanId });
    47	        setOutstandingPenalty(summary.outstandingPenalty);
    48	      }
    49	    }
    50	    fetchPenalty();
    51	  }, [selectedLoanId, transactions, refreshVersion]);
    52	
    53	  const activeLoans = useMemo(() => loansList.filter(l => l.status === 'ACTIVE'), [loansList]);
    54	
    55	  const getBorrowerName = (id: string) => {
    56	    return borrowersList.find(b => b.id === id)?.name || 'Unknown Borrower';
    57	  };
    58	
    59	  const handlePayment = async () => {
    60	    if (!selectedLoanId || !amountInr) {
    61	      Alert.alert('Error', 'Please enter an amount');
    62	      return;
    63	    }
    64	    
    65	    try {
    66	      const amountPaise = (parseInt(amountInr) * 100) as Paise;
    67	      const effectiveDate = new Date().toISOString().split('T')[0];
    68	      const operationId = crypto.randomUUID();
    69	      
    70	      const res = await transactions!.recordCashPayment(
    71	        selectedLoanId,
    72	        amountPaise,
    73	        operationId,
    74	        effectiveDate
    75	      );
    76	      
    77	      setResult(res);
    78	      setAmountInr('');
    79	      Alert.alert('Success', 'Payment recorded successfully!');
    80	      triggerRefresh();
    81	    } catch (e: any) {
    82	      Alert.alert('Error', e.message);
    83	    }
    84	  };
    85	
    86	  if (!selectedLoanId) {
    87	    return (
    88	      <SafeAreaView style={styles.container} edges={['top']}>
    89	        <View style={styles.header}>
    90	          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Select Loan for Collection</Typography>
    91	        </View>
    92	        <FlatList
    93	          data={activeLoans}
    94	          keyExtractor={item => item.id}
    95	          contentContainerStyle={styles.listContent}
    96	          renderItem={({ item }) => (
    97	            <TouchableOpacity onPress={() => setSelectedLoanId(item.id)}>
    98	              <Card elevated style={styles.loanCard}>
    99	                <Typography variant="headlineSm">{getBorrowerName(item.borrower_id)}</Typography>
   100	                <Typography variant="bodyMd">Principal: {formatINR(item.principal_paise as Paise)}</Typography>
---
name: react-native-testing
description: React Native specific testing rules
---

# React Native Testing

1. Focus on component render limits (avoid unnecessary re-renders).
2. Validate safe area and layout.
3. Mock heavy native modules for unit tests.

codex
Both review axes found that the new callbacks ignore `refreshVersion`, and neither loader guards against an older request overwriting a newer result. The payment repository is unchanged and retains its loan-scoped updates and exclusive transaction. Typecheck passed; Jest could not start because the read-only environment prevents creating its temporary directory.

exec
/bin/bash -lc "node <<'NODE'
const cp = require('child_process');
const ts = require('typescript');
const vm = require('vm');
const source = cp.execFileSync('git', ['show', '3bc0c36:src/app/reports/index.tsx'], {encoding:'utf8'});
let focus, deps, state, version = 0;
const pending = [];
const transactions = {getEarningsSummary: () => new Promise(resolve => pending.push(resolve))};
const react = {createElement: () => null, useState: () => [null, value => state = value], useCallback: (fn, d) => {deps = d; return fn;}};
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.React, esModuleInterop:true}}).outputText, {exports, require: name => name === 'react' ? react : name === 'expo-router' ? {useFocusEffect: fn => focus = fn} : name === 'react-native' ? {StyleSheet:{create:x=>x}} : name.endsWith('/DatabaseProvider') ? {useDatabase:()=>({transactions,refreshVersion:version})} : name.endsWith('/theme') ? {theme:{colors:{},spacing:{},borderRadius:{}}} : {}});
(async () => {
 exports.default(); const before = deps; version++; exports.default();
 console.log('Refresh version changed; callback dependencies unchanged:', before.length===deps.length && before.every((v,i)=>v===deps[i]));
 focus(); focus();
 pending[1]({totalEarnings:200}); await Promise.resolve();
 console.log('New focus result:',state);
 pending[0]({totalEarnings:100}); await Promise.resolve();
 console.log('Older focus result overwrites it:',state);
})();
NODE" in /mnt/f/personal projects/credkeep
 exited 1 in 451ms:
<ref *1> node:child_process:981
    throw err;
    ^

Error: spawnSync git EPERM
    at Object.spawnSync (node:internal/child_process:1160:20)
    at spawnSync (node:child_process:928:24)
    at Object.execFileSync (node:child_process:971:15)
    at [stdin]:4:19
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
  spawnargs: [ 'show', '3bc0c36:src/app/reports/index.tsx' ],
  error: [Circular *1],
  status: 0,
  signal: null,
  output: [
    null,
    "import React, { useState, useCallback } from 'react';\n" +
      "import { View, StyleSheet, ScrollView } from 'react-native';\n" +
      "import { SafeAreaView } from 'react-native-safe-area-context';\n" +
      "import { Typography } from '../../ui/Typography';\n" +
      "import { Card } from '../../ui/Card';\n" +
      "import { theme } from '../../ui/theme';\n" +
      "import { useDatabase } from '../../core/database/DatabaseProvider';\n" +
      "import { formatINR } from '../../core/domain/money';\n" +
      "import { useFocusEffect } from 'expo-router';\n" +
      '\n' +
      'export default function ReportsScreen() {\n' +
      '  const { transactions, refreshVersion } = useDatabase();\n' +
      '  const [globalEarnings, setGlobalEarnings] = useState<any>(null);\n' +
      '\n' +
      '  useFocusEffect(\n' +
      '    useCallback(() => {\n' +
      '      async function load() {\n' +
      '        if (transactions) {\n' +
      '          const summary = await transactions.getEarningsSummary();\n' +
      '          setGlobalEarnings(summary);\n' +
      '        }\n' +
      '      }\n' +
      '      load();\n' +
      '    }, [transactions])\n' +
      '  );\n' +
      '\n' +
      '  return (\n' +
      '    <SafeAreaView style={styles.safeArea}>\n' +
      '      <ScrollView style={styles.container} contentContainerStyle={styles.content}>\n' +
      '        <Typography variant="headlineMd" style={styles.title}>Earnings & Reports</Typography>\n' +
      '        \n' +
      '        {globalEarnings && (\n' +
      '          <Card elevated style={styles.card}>\n' +
      '            <Typography variant="titleMd" style={{marginBottom: 10}}>Global Actual Cash Earnings</Typography>\n' +
      '            <View style={styles.row}>\n' +
      '              <Typography variant="bodyMd">Principal Returned:</Typography>\n' +
      '              <Typography variant="bodyMd">{formatINR(globalEarnings.principalReturned)}</Typography>\n' +
      '            </View>\n' +
      '            <View style={styles.row}>\n' +
      '              <Typography variant="bodyMd">Contractual Markup Received:</Typography>\n' +
      '              <Typography variant="bodyMd">{formatINR(globalEarnings.markupReceived)}</Typography>\n' +
      '            </View>\n' +
      '            <View style={styles.row}>\n' +
      '              <Typography variant="bodyMd">Late Penalties Received:</Typography>\n' +
      '              <Typography variant="bodyMd">{formatINR(globalEarnings.penaltyReceived)}</Typography>\n' +
      '            </View>\n' +
      '            <View style={[styles.row, {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.outlineVariant}]}>\n' +
      '              <Typography variant="labelLg">Total Actual Earnings:</Typography>\n' +
      '              <Typography variant="labelLg" color={theme.colors.success}>{formatINR(globalEarnings.totalEarnings)}</Typography>\n' +
      '            </View>\n' +
      '            \n' +
      '            <View style={{marginTop: 20}}>\n' +
      '              <Typography variant="labelMd" color={theme.colors.error}>Outstanding / Uncollected</Typography>\n' +
      '              <View style={styles.row}>\n' +
      '                <Typography variant="bodySm" color={theme.colors.error}>Outstanding Penalties:</Typography>\n' +
      '                <Typography variant="bodySm" color={theme.colors.error}>{formatINR(globalEarnings.outstandingPenalty)}</Typography>\n' +
      '              </View>\n' +
      '            </View>\n' +
      '          </Card>\n' +
      '        )}\n' +
      '      </ScrollView>\n' +
      '    </SafeAreaView>\n' +
      '  );\n' +
      '}\n' +
      '\n' +
      'const styles = StyleSheet.create({\n' +
      '  safeArea: { flex: 1, backgroundColor: theme.colors.background },\n' +
      '  container: { flex: 1 },\n' +
      '  content: { padding: theme.spacing.lg, paddingTop: 40 },\n' +
      '  title: { marginBottom: theme.spacing.xl },\n' +
      '  card: { padding: theme.spacing.lg },\n' +
      "  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }\n" +
      '});\n',
    ''
  ],
  pid: 10,
  stdout: "import React, { useState, useCallback } from 'react';\n" +
    "import { View, StyleSheet, ScrollView } from 'react-native';\n" +
    "import { SafeAreaView } from 'react-native-safe-area-context';\n" +
    "import { Typography } from '../../ui/Typography';\n" +
    "import { Card } from '../../ui/Card';\n" +
    "import { theme } from '../../ui/theme';\n" +
    "import { useDatabase } from '../../core/database/DatabaseProvider';\n" +
    "import { formatINR } from '../../core/domain/money';\n" +
    "import { useFocusEffect } from 'expo-router';\n" +
    '\n' +
    'export default function ReportsScreen() {\n' +
    '  const { transactions, refreshVersion } = useDatabase();\n' +
    '  const [globalEarnings, setGlobalEarnings] = useState<any>(null);\n' +
    '\n' +
    '  useFocusEffect(\n' +
    '    useCallback(() => {\n' +
    '      async function load() {\n' +
    '        if (transactions) {\n' +
    '          const summary = await transactions.getEarningsSummary();\n' +
    '          setGlobalEarnings(summary);\n' +
    '        }\n' +
    '      }\n' +
    '      load();\n' +
    '    }, [transactions])\n' +
    '  );\n' +
    '\n' +
    '  return (\n' +
    '    <SafeAreaView style={styles.safeArea}>\n' +
    '      <ScrollView style={styles.container} contentContainerStyle={styles.content}>\n' +
    '        <Typography variant="headlineMd" style={styles.title}>Earnings & Reports</Typography>\n' +
    '        \n' +
    '        {globalEarnings && (\n' +
    '          <Card elevated style={styles.card}>\n' +
    '            <Typography variant="titleMd" style={{marginBottom: 10}}>Global Actual Cash Earnings</Typography>\n' +
    '            <View style={styles.row}>\n' +
    '              <Typography variant="bodyMd">Principal Returned:</Typography>\n' +
    '              <Typography variant="bodyMd">{formatINR(globalEarnings.principalReturned)}</Typography>\n' +
    '            </View>\n' +
    '            <View style={styles.row}>\n' +
    '              <Typography variant="bodyMd">Contractual Markup Received:</Typography>\n' +
    '              <Typography variant="bodyMd">{formatINR(globalEarnings.markupReceived)}</Typography>\n' +
    '            </View>\n' +
    '            <View style={styles.row}>\n' +
    '              <Typography variant="bodyMd">Late Penalties Received:</Typography>\n' +
    '              <Typography variant="bodyMd">{formatINR(globalEarnings.penaltyReceived)}</Typography>\n' +
    '            </View>\n' +
    '            <View style={[styles.row, {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.outlineVariant}]}>\n' +
    '              <Typography variant="labelLg">Total Actual Earnings:</Typography>\n' +
    '              <Typography variant="labelLg" color={theme.colors.success}>{formatINR(globalEarnings.totalEarnings)}</Typography>\n' +
    '            </View>\n' +
    '            \n' +
    '            <View style={{marginTop: 20}}>\n' +
    '              <Typography variant="labelMd" color={theme.colors.error}>Outstanding / Uncollected</Typography>\n' +
    '              <View style={styles.row}>\n' +
    '                <Typography variant="bodySm" color={theme.colors.error}>Outstanding Penalties:</Typography>\n' +
    '                <Typography variant="bodySm" color={theme.colors.error}>{formatINR(globalEarnings.outstandingPenalty)}</Typography>\n' +
    '              </View>\n' +
    '            </View>\n' +
    '          </Card>\n' +
    '        )}\n' +
    '      </ScrollView>\n' +
    '    </SafeAreaView>\n' +
    '  );\n' +
    '}\n' +
    '\n' +
    'const styles = StyleSheet.create({\n' +
    '  safeArea: { flex: 1, backgroundColor: theme.colors.background },\n' +
    '  container: { flex: 1 },\n' +
    '  content: { padding: theme.spacing.lg, paddingTop: 40 },\n' +
    '  title: { marginBottom: theme.spacing.xl },\n' +
    '  card: { padding: theme.spacing.lg },\n' +
    "  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }\n" +
    '});\n',
  stderr: ''
}

Node.js v24.21.0

exec
/bin/bash -lc "node <<'NODE'
const fs=require('fs'), ts=require('typescript'), vm=require('vm');
const source=fs.readFileSync('src/app/reports/index.tsx','utf8');
let focus,deps,state,version=0;
const pending=[]; const transactions={getEarningsSummary:()=>new Promise(r=>pending.push(r))};
const react={createElement:()=>null,useState:()=>[null,v=>state=v],useCallback:(fn,d)=>{deps=d;return fn;}};
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:n=>n==='react'?react:n==='expo-router'?{useFocusEffect:fn=>focus=fn}:n==='react-native'?{StyleSheet:{create:x=>x}}:n.endsWith('/DatabaseProvider')?{useDatabase:()=>({transactions,refreshVersion:version})}:n.endsWith('/theme')?{theme:{colors:{},spacing:{},borderRadius:{}}}:{}});
(async()=>{exports.default();const before=deps;version++;exports.default(); console.log('Mutation dependency unchanged:',before.length===deps.length&&before.every((v,i)=>v===deps[i]));focus();focus();pending[1]({totalEarnings:200});await Promise.resolve();console.log('New result:',state);pending[0]({totalEarnings:100});await Promise.resolve();console.log('After old request resolves:',state);})();
NODE" in /mnt/f/personal projects/credkeep
 succeeded in 407ms:
Mutation dependency unchanged: true
New result: undefined
After old request resolves: undefined

exec
/bin/bash -lc "node <<'NODE'
const fs=require('fs'),ts=require('typescript'),vm=require('vm');let focus,state;const pending=[];const transactions={getEarningsSummary:()=>new Promise(r=>pending.push(r))};const exports={};const react={createElement:()=>null,useState:()=>[null,v=>state=v],useCallback:f=>f};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/reports/index.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:n=>n==='react'?react:n==='expo-router'?{useFocusEffect:f=>focus=f}:n==='react-native'?{StyleSheet:{create:x=>x}}:n.endsWith('/DatabaseProvider')?{useDatabase:()=>({transactions,refreshVersion:0})}:n.endsWith('/theme')?{theme:{colors:{},spacing:{},borderRadius:{}}}:{}});(async()=>{exports.default();focus();focus();pending[1]({totalEarnings:200});await new Promise(setImmediate);console.log('New result:',state);pending[0]({totalEarnings:100});await new Promise(setImmediate);console.log('Old result overwrote new:',state);})();
NODE" in /mnt/f/personal projects/credkeep
 succeeded in 398ms:
New result: { totalEarnings: 200 }
Old result overwrote new: { totalEarnings: 100 }

exec
/bin/bash -lc "node_modules/.bin/eslint 'src/app/(tabs)/index.tsx' src/app/reports/index.tsx --no-cache" in /mnt/f/personal projects/credkeep
codex
An in-memory check reproduced the Reports race: a newer result showing `200` was overwritten by an older result showing `100`. The existing cross-loan test checks update parameters, but it does not test persisted loan isolation or rollback. I found no retry-idempotency test or Home/Reports regression test. Lint is still running.

 succeeded in 31675ms:

/mnt/f/personal projects/credkeep/src/app/(tabs)/index.tsx
  13:39  warning  'refreshVersion' is assigned a value but never used  @typescript-eslint/no-unused-vars

/mnt/f/personal projects/credkeep/src/app/reports/index.tsx
  12:25  warning  'refreshVersion' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)


codex
**REWORK** — reviewed `ea9e343 → 3bc0c36`.

**Standards findings**

- **P2 — Mutation refresh lost:** [Home](/mnt/f/personal%20projects/credkeep/src/app/(tabs)/index.tsx:38) and [Reports](/mnt/f/personal%20projects/credkeep/src/app/reports/index.tsx:15) omit `refreshVersion` from callback dependencies. Repository identities remain stable, so mutation notifications while focused no longer reload totals. Restore mutation invalidation alongside focus refresh.
- **P2 — Competing refreshes can restore stale totals:** Both callbacks lack cleanup or request-order protection. An in-memory Reports check reproduced a newer `200` result being overwritten by an older `100` result. Guard state updates against obsolete requests. [Expo documents focus-effect cleanup](https://docs.expo.dev/versions/latest/sdk/router/#usefocuseffect).
- **Error handling remains incomplete:** Both loaders discard rejected promises. Query failures leave old totals or a blank report without a query-error message. This predates the patch but remains unresolved.

**Spec and regression findings**

- **No regression test was added or modified.** Add coverage for returning after payment, focused mutation notifications, out-of-order responses, and query failures. `.workflow/TASKS.md` marks the task `VERIFIED` without this coverage.

**Financial invariant assessment**

Financial mutation code is unchanged by this diff. Source inspection confirms loan-scoped queries/updates, an exclusive payment transaction, an operation-ID duplicate check with a unique constraint, and allocation accounting that retains surplus. However, the existing [cross-loan test](/mnt/f/personal%20projects/credkeep/src/__tests__/cross-loan.test.ts:95) checks update parameters rather than persisted isolation. Rollback, retry idempotency, and persisted conservation are **not demonstrated by these tests**.

Typecheck passed. Changed-screen lint passed with two unused-`refreshVersion` warnings. Jest could not start because the read-only environment prevented creating `/tmp/jest_rs`; no test-pass claim is made.

Standards: two refresh defects. Spec: missing regression coverage.
2026-10-10T04:50:43.496974Z ERROR codex_core::session: failed to record rollout items: thread 01a12423-4c9a-77d0-ae91-786973fcab0b not found
tokens used
42,507
**REWORK** — reviewed `ea9e343 → 3bc0c36`.

**Standards findings**

- **P2 — Mutation refresh lost:** [Home](/mnt/f/personal%20projects/credkeep/src/app/(tabs)/index.tsx:38) and [Reports](/mnt/f/personal%20projects/credkeep/src/app/reports/index.tsx:15) omit `refreshVersion` from callback dependencies. Repository identities remain stable, so mutation notifications while focused no longer reload totals. Restore mutation invalidation alongside focus refresh.
- **P2 — Competing refreshes can restore stale totals:** Both callbacks lack cleanup or request-order protection. An in-memory Reports check reproduced a newer `200` result being overwritten by an older `100` result. Guard state updates against obsolete requests. [Expo documents focus-effect cleanup](https://docs.expo.dev/versions/latest/sdk/router/#usefocuseffect).
- **Error handling remains incomplete:** Both loaders discard rejected promises. Query failures leave old totals or a blank report without a query-error message. This predates the patch but remains unresolved.

**Spec and regression findings**

- **No regression test was added or modified.** Add coverage for returning after payment, focused mutation notifications, out-of-order responses, and query failures. `.workflow/TASKS.md` marks the task `VERIFIED` without this coverage.

**Financial invariant assessment**

Financial mutation code is unchanged by this diff. Source inspection confirms loan-scoped queries/updates, an exclusive payment transaction, an operation-ID duplicate check with a unique constraint, and allocation accounting that retains surplus. However, the existing [cross-loan test](/mnt/f/personal%20projects/credkeep/src/__tests__/cross-loan.test.ts:95) checks update parameters rather than persisted isolation. Rollback, retry idempotency, and persisted conservation are **not demonstrated by these tests**.

Typecheck passed. Changed-screen lint passed with two unused-`refreshVersion` warnings. Jest could not start because the read-only environment prevented creating `/tmp/jest_rs`; no test-pass claim is made.

Standards: two refresh defects. Spec: missing regression coverage.

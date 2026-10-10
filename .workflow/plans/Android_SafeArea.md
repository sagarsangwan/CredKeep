OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a1243a-1ef6-7473-b661-8a06a64ae7aa
--------
user
Investigate and plan a fix for the 'Android safe-area layout' issue in CredKeep. Ensure the plan uses react-native-safe-area-context properly to avoid content overlapping with system bars on Android.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll read the workflow state and issue details, then inspect the safe-area setup and Expo SDK guidance to build a concrete fix plan.

exec
/bin/bash -lc 'cat AGENTS.md .workflow/STATE.md' in /mnt/f/personal projects/credkeep
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
- **Current Git Branch:** feat/ui/safe-area
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Android safe-area layout
- **Assigned Agent:** Gemini
- **Current Stage:** Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** 35 passed
- **Next Action:** Plan and implement the Android safe-area layout fix.

exec
/bin/bash -lc "cat /mnt/f/personal\\ projects/credkeep/.agents/skills/diagnosing-bugs/SKILL.md; cat package.json; rg --files .scratch .workflow docs/agents | head -80" in /mnt/f/personal projects/credkeep
 succeeded in 58ms:
---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, read `GLOSSARY.md` (if it exists) to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Redact

This skill has you show commands, outputs and captured artifacts. **Redact every secret first**: write `<REDACTED>` in its place. Build loops against env vars, so the credential stays in the environment rather than in what you show. Captured artifacts carry auth headers: quote only the lines that carry the signal.

If the redacted output is not enough to diagnose the bug, say so and ask the user.

## Phase 1: Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug (one that goes red on _this_ bug), you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) that drives the UI and asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with `scripts/hitl-loop.template.sh` so the loop is still structured. Captured output feeds back to you.

Build the right feedback loop, and the bug is 90% fixed.

### Tighten the loop

Treat the loop as a product. Once you have _a_ loop, **tighten** it:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight, a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not, so keep raising the rate until it's debuggable.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a redacted captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

### Completion criterion: a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** (a script path, a test invocation, a curl) that you have **already run at least once** (show the invocation and its output, redacted), and that is:

- [ ] **Red-capable**: it drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring"; it must be able to _catch this specific bug_.
- [ ] **Deterministic**: same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast**: seconds, not minutes.
- [ ] **Agent-runnable**: you can run it unattended; a human in the loop only via `scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop: jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

## Phase 2: Reproduce + minimise

Run the loop. Watch it go red as the bug appears.

Confirm:

- [ ] The loop produces the failure mode the **user** described, not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

### Minimise

Once it's red, shrink the repro to the **smallest scenario that still goes red**. Cut inputs, callers, config, data, and steps **one at a time**, re-running the loop after each cut, and keep only what's load-bearing for the failure.

Why bother: a minimal repro shrinks the hypothesis space in Phase 3 (fewer moving parts left to suspect) and becomes the clean regression test in Phase 5.

Done when **every remaining element is load-bearing**: removing any one of them makes the loop go green.

Do not proceed until you have reproduced **and** minimised.

## Phase 3: Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe: discard or sharpen it.

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they've already ruled out. Cheap checkpoint, big time saver. Don't block on it; proceed with your ranking if the user is AFK.

## Phase 4: Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5: Fix + regression test

Write the regression test **before the fix**, but only if there is a **correct seam** for it.

A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for the next phase.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

## Phase 6: Cleanup

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message, so the next debugger learns
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
.workflow/qa-codex.ps1
.workflow/SESSION_LOG.md
.workflow/run-codex.ps1
.workflow/status.ps1
.workflow/STATE.md
.workflow/TASKS.md
.workflow/test-qa-orchestrator.ps1
.workflow/handoff.ps1
.workflow/HANDOFF.md
.workflow/DECISIONS.md
.workflow/AGENT_ROLES.md
.workflow/mock-cmd.bat
.workflow/MODEL_POLICY.md
.workflow/QA_GATE.md
.workflow/plans/Borrower_Profile_prompt.txt
.workflow/plans/Borrower_Profile_Impl_prompt.txt
.workflow/plans/Borrower_Profile_Impl.md
.workflow/plans/Borrower_Profile.md
.workflow/plans/Android_SafeArea_prompt.txt
.workflow/plans/Android_SafeArea.md
.workflow/plans/CK-P0-003-QA.md
.workflow/plans/CK-P0-002.md
.workflow/plans/CK-P0-001.md
.workflow/plans/PIN_App_Lock.md
.workflow/plans/PIN_App_Lock_prompt.txt
.workflow/reports/codex_qa_report_2.md
.workflow/reports/codex_qa_report.md
.workflow/reports/CODEX_QA_DIAGNOSTIC.md
.workflow/reports/CODEX_EXECUTION_STATUS.md
.workflow/reports/codex_diagnostic_plan.md
.workflow/reports/CK-P0-002_QA.md
.workflow/reports/Stale_Home_earnings_qa_report.md
.workflow/reports/mock-task_qa_prompt.txt
.workflow/reports/graphify_tree.html
.workflow/reports/Stale_Home_earnings_qa_prompt.txt
.workflow/reports/QA_REPAIR_SUMMARY.md
.workflow/reports/graphify_query_result.md
.scratch/screens/CredKeep_Home.html
.scratch/screens/CredKeep_Collections.html
.scratch/screens/CredKeep_Borrowers.html
.scratch/screens/New_Loan_Review_&_Create.html
.scratch/screens/New_Loan_Borrower_&_Product.html
.scratch/screens/CredKeep_More_Settings.html
.scratch/screens/CredKeep_Loans.html
.scratch/screens/New_Loan_Terms_&_Calculation.html
.scratch/screens/New_Loan_Security.html
.scratch/screens/Payment_Recorded.html
.scratch/screens/Record_Payment.html
.scratch/v1-financial-engine/spec.md
.scratch/v1-financial-engine/issues/04-allocation-and-future-kist-reduction.md
.scratch/v1-financial-engine/issues/02-schedule-and-anchor-days.md
.scratch/v1-financial-engine/issues/03-overdue-period-engine.md
.scratch/v1-financial-engine/issues/06-sqlite-schema-and-idempotency.md
.scratch/v1-financial-engine/issues/05-due-date-modification.md
.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
.scratch/v1-financial-engine/issues/01-money-and-models.md
docs/agents/issue-tracker.md
docs/agents/domain.md
docs/agents/triage-labels.md

exec
/bin/bash -lc 'test ! -f graphify-out/graph.json || graphify query "Android safe-area layout screen wrappers headers bottom tabs system bars"' in /mnt/f/personal projects/credkeep
 exited 127 in 64ms:
/bin/bash: line 1: graphify: command not found

web search: 
web search: https://docs.expo.dev/versions/v57.0.0/
exec
/bin/bash -lc "cat .workflow/plans/Android_SafeArea.md .workflow/plans/Android_SafeArea_prompt.txt .workflow/HANDOFF.md; git status --short; rg -n 'SafeArea|safe-area|StatusBar|paddingTop|paddingBottom|tabBar|headerShown' src app.json; rg --files -g '*lock*' -g '*jest*' -g '*AGENTS.md' -g 'GLOSSARY.md' -g '*adr*'" in /mnt/f/personal projects/credkeep
 succeeded in 907ms:
OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a1243a-1ef6-7473-b661-8a06a64ae7aa
--------
user
Investigate and plan a fix for the 'Android safe-area layout' issue in CredKeep. Ensure the plan uses react-native-safe-area-context properly to avoid content overlapping with system bars on Android.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll read the workflow state and issue details, then inspect the safe-area setup and Expo SDK guidance to build a concrete fix plan.

exec
/bin/bash -lc 'cat AGENTS.md .workflow/STATE.md' in /mnt/f/personal projects/credkeep
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
- **Current Git Branch:** feat/ui/safe-area
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Android safe-area layout
- **Assigned Agent:** Gemini
- **Current Stage:** Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** 35 passed
- **Next Action:** Plan and implement the Android safe-area layout fix.

exec
/bin/bash -lc "cat /mnt/f/personal\\ projects/credkeep/.agents/skills/diagnosing-bugs/SKILL.md; cat package.json; rg --files .scratch .workflow docs/agents | head -80" in /mnt/f/personal projects/credkeep
 succeeded in 58ms:
---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, read `GLOSSARY.md` (if it exists) to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Redact

This skill has you show commands, outputs and captured artifacts. **Redact every secret first**: write `<REDACTED>` in its place. Build loops against env vars, so the credential stays in the environment rather than in what you show. Captured artifacts carry auth headers: quote only the lines that carry the signal.

If the redacted output is not enough to diagnose the bug, say so and ask the user.

## Phase 1: Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug (one that goes red on _this_ bug), you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) that drives the UI and asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with `scripts/hitl-loop.template.sh` so the loop is still structured. Captured output feeds back to you.

Build the right feedback loop, and the bug is 90% fixed.

### Tighten the loop

Treat the loop as a product. Once you have _a_ loop, **tighten** it:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight, a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not, so keep raising the rate until it's debuggable.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a redacted captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

### Completion criterion: a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** (a script path, a test invocation, a curl) that you have **already run at least once** (show the invocation and its output, redacted), and that is:

- [ ] **Red-capable**: it drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring"; it must be able to _catch this specific bug_.
- [ ] **Deterministic**: same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast**: seconds, not minutes.
- [ ] **Agent-runnable**: you can run it unattended; a human in the loop only via `scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop: jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

## Phase 2: Reproduce + minimise

Run the loop. Watch it go red as the bug appears.

Confirm:

- [ ] The loop produces the failure mode the **user** described, not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

### Minimise

Once it's red, shrink the repro to the **smallest scenario that still goes red**. Cut inputs, callers, config, data, and steps **one at a time**, re-running the loop after each cut, and keep only what's load-bearing for the failure.

Why bother: a minimal repro shrinks the hypothesis space in Phase 3 (fewer moving parts left to suspect) and becomes the clean regression test in Phase 5.

Done when **every remaining element is load-bearing**: removing any one of them makes the loop go green.

Do not proceed until you have reproduced **and** minimised.

## Phase 3: Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe: discard or sharpen it.

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they've already ruled out. Cheap checkpoint, big time saver. Don't block on it; proceed with your ranking if the user is AFK.

## Phase 4: Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5: Fix + regression test

Write the regression test **before the fix**, but only if there is a **correct seam** for it.

A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for the next phase.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

## Phase 6: Cleanup

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message, so the next debugger learns
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
.workflow/qa-codex.ps1
.workflow/SESSION_LOG.md
.workflow/run-codex.ps1
.workflow/status.ps1
.workflow/STATE.md
.workflow/TASKS.md
.workflow/test-qa-orchestrator.ps1
.workflow/handoff.ps1
.workflow/HANDOFF.md
.workflow/DECISIONS.md
.workflow/AGENT_ROLES.md
.workflow/mock-cmd.bat
.workflow/MODEL_POLICY.md
.workflow/QA_GATE.md
.workflow/plans/Borrower_Profile_prompt.txt
.workflow/plans/Borrower_Profile_Impl_prompt.txt
.workflow/plans/Borrower_Profile_Impl.md
.workflow/plans/Borrower_Profile.md
.workflow/plans/Android_SafeArea_prompt.txt
.workflow/plans/Android_SafeArea.md
.workflow/plans/CK-P0-003-QA.md
.workflow/plans/CK-P0-002.md
.workflow/plans/CK-P0-001.md
.workflow/plans/PIN_App_Lock.md
.workflow/plans/PIN_App_Lock_prompt.txt
.workflow/reports/codex_qa_report_2.md
.workflow/reports/codex_qa_report.md
.workflow/reports/CODEX_QA_DIAGNOSTIC.md
.workflow/reports/CODEX_EXECUTION_STATUS.md
.workflow/reports/codex_diagnostic_plan.md
.workflow/reports/CK-P0-002_QA.md
.workflow/reports/Stale_Home_earnings_qa_report.md
.workflow/reports/mock-task_qa_prompt.txt
.workflow/reports/graphify_tree.html
.workflow/reports/Stale_Home_earnings_qa_prompt.txt
.workflow/reports/QA_REPAIR_SUMMARY.md
.workflow/reports/graphify_query_result.md
.scratch/screens/CredKeep_Home.html
.scratch/screens/CredKeep_Collections.html
.scratch/screens/CredKeep_Borrowers.html
.scratch/screens/New_Loan_Review_&_Create.html
.scratch/screens/New_Loan_Borrower_&_Product.html
.scratch/screens/CredKeep_More_Settings.html
.scratch/screens/CredKeep_Loans.html
.scratch/screens/New_Loan_Terms_&_Calculation.html
.scratch/screens/New_Loan_Security.html
.scratch/screens/Payment_Recorded.html
.scratch/screens/Record_Payment.html
.scratch/v1-financial-engine/spec.md
.scratch/v1-financial-engine/issues/04-allocation-and-future-kist-reduction.md
.scratch/v1-financial-engine/issues/02-schedule-and-anchor-days.md
.scratch/v1-financial-engine/issues/03-overdue-period-engine.md
.scratch/v1-financial-engine/issues/06-sqlite-schema-and-idempotency.md
.scratch/v1-financial-engine/issues/05-due-date-modification.md
.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
.scratch/v1-financial-engine/issues/01-money-and-models.md
docs/agents/issue-tracker.md
docs/agents/domain.md
docs/agents/triage-labels.md

exec
/bin/bash -lc 'test ! -f graphify-out/graph.json || graphify query "Android safe-area layout screen wrappers headers bottom tabs system bars"' in /mnt/f/personal projects/credkeep
 exited 127 in 64ms:
/bin/bash: line 1: graphify: command not found

web search: 
web search: https://docs.expo.dev/versions/v57.0.0/
﻿Investigate and plan a fix for the 'Android safe-area layout' issue in CredKeep. Ensure the plan uses react-native-safe-area-context properly to avoid content overlapping with system bars on Android.
# Task Handoff

## Handoff Detail
- **Task ID:** Borrower profile
- **Completed Changes:** 
  - Implemented `getBorrowerSummary` in `TransactionRepository` to aggregate multi-loan balances accurately (including bullet vs instalment rules).
  - Built out the Borrower Profile UI in `src/app/borrower/[id].tsx` featuring a rich navy summary card, identity details, and active loan list with product badges.
  - Wired up "Record Payment" and "New Loan" quick actions by passing navigation parameters to `loans.tsx` and `collections.tsx`.
  - Added support for pre-selecting the borrower in the new loan wizard and collections screen.
  - Addressed lint errors and verified tests.
- **Files Modified:** `src/app/borrower/[id].tsx`, `src/app/(tabs)/loans.tsx`, `src/app/(tabs)/collections.tsx`, `src/core/database/transactionRepository.ts`.
- **Commands Run:** `npm test`, `npx tsc --noEmit`, `npx expo lint`
- **Test Results:** 35 tests passed.
- **Git Commit Hashes:** `82c53f8`
- **Remaining Problems:** None.
- **Next Agent:** Gemini
- **Next Action:** Implement PIN/app lock feature.
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
 M .workflow/HANDOFF.md
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
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
?? .workflow/plans/Android_SafeArea.md
?? .workflow/plans/Android_SafeArea_prompt.txt
?? .workflow/plans/Borrower_Profile.md
?? .workflow/plans/Borrower_Profile_Impl.md
?? .workflow/plans/Borrower_Profile_Impl_prompt.txt
?? .workflow/plans/Borrower_Profile_prompt.txt
?? .workflow/plans/PIN_App_Lock.md
?? .workflow/plans/PIN_App_Lock_prompt.txt
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
src/app/_layout.tsx:5:import { SafeAreaProvider } from 'react-native-safe-area-context';
src/app/_layout.tsx:9:    <SafeAreaProvider>
src/app/_layout.tsx:13:            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
src/app/_layout.tsx:14:            <Stack.Screen name="borrower" options={{ headerShown: false }} />
src/app/_layout.tsx:15:            <Stack.Screen name="loan" options={{ headerShown: false }} />
src/app/_layout.tsx:19:    </SafeAreaProvider>
src/app/loan/[id].tsx:39:    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
src/app/loan/[id].tsx:107:    paddingBottom: theme.spacing.xs,
src/app/(tabs)/_layout.tsx:7:      tabBarActiveTintColor: '#14283F',
src/app/(tabs)/_layout.tsx:8:      tabBarInactiveTintColor: '#64748B',
src/app/(tabs)/_layout.tsx:19:          tabBarIcon: ({ color }) => <Home color={color as string} size={24} />,
src/app/(tabs)/_layout.tsx:27:          tabBarIcon: ({ color }) => <Users color={color as string} size={24} />,
src/app/(tabs)/_layout.tsx:35:          tabBarIcon: ({ color }) => <Landmark color={color as string} size={24} />,
src/app/(tabs)/_layout.tsx:43:          tabBarIcon: ({ color }) => <Banknote color={color as string} size={24} />,
src/app/(tabs)/_layout.tsx:51:          tabBarIcon: ({ color }) => <Menu color={color as string} size={24} />,
src/app/borrower/[id].tsx:4:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/borrower/[id].tsx:57:    <SafeAreaView style={styles.safeArea}>
src/app/borrower/[id].tsx:61:    </SafeAreaView>
src/app/borrower/[id].tsx:77:    <SafeAreaView style={styles.safeArea}>
src/app/borrower/[id].tsx:175:    </SafeAreaView>
src/app/settings/security.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/settings/security.tsx:84:    <SafeAreaView style={styles.safeArea}>
src/app/settings/security.tsx:124:          <SafeAreaView style={styles.modalContainer}>
src/app/settings/security.tsx:154:          </SafeAreaView>
src/app/settings/security.tsx:157:    </SafeAreaView>
src/app/(tabs)/more.tsx:4:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/(tabs)/more.tsx:18:    <SafeAreaView style={styles.safeArea}>
src/app/(tabs)/more.tsx:41:    </SafeAreaView>
src/app/(tabs)/collections.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/(tabs)/collections.tsx:99:      <SafeAreaView style={styles.container} edges={['top']}>
src/app/(tabs)/collections.tsx:122:      </SafeAreaView>
src/app/(tabs)/collections.tsx:130:    <SafeAreaView style={styles.container} edges={['top']}>
src/app/(tabs)/collections.tsx:192:    </SafeAreaView>
src/app/(tabs)/collections.tsx:198:  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 16 },
src/app/settings/backup.tsx:9:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/settings/backup.tsx:178:    <SafeAreaView style={styles.safeArea}>
src/app/settings/backup.tsx:218:    </SafeAreaView>
src/app/(tabs)/index.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/(tabs)/index.tsx:45:    <SafeAreaView style={styles.safeArea}>
src/app/(tabs)/index.tsx:129:    </SafeAreaView>
src/app/(tabs)/index.tsx:136:  content: { paddingBottom: 100 },
src/app/(tabs)/index.tsx:159:    flexDirection: 'row', marginTop: 16, paddingTop: 12,
src/app/(tabs)/loans.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/(tabs)/loans.tsx:264:        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
src/app/(tabs)/loans.tsx:276:        </SafeAreaView>
src/app/(tabs)/loans.tsx:286:    padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 16
src/app/loan/[id]/index.tsx:4:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/loan/[id]/index.tsx:37:    <SafeAreaView style={styles.safeArea}>
src/app/loan/[id]/index.tsx:64:            <View style={[styles.row, {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.outlineVariant}]}>
src/app/loan/[id]/index.tsx:71:    </SafeAreaView>
src/app/loan/[id]/index.tsx:78:  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 40 },
src/app/(tabs)/borrowers.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/(tabs)/borrowers.tsx:49:    <SafeAreaView style={styles.container} edges={['top']}>
src/app/(tabs)/borrowers.tsx:73:        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
src/app/(tabs)/borrowers.tsx:109:        </SafeAreaView>
src/app/(tabs)/borrowers.tsx:111:    </SafeAreaView>
src/app/(tabs)/borrowers.tsx:119:    padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 16
src/app/reports/index.tsx:3:import { SafeAreaView } from 'react-native-safe-area-context';
src/app/reports/index.tsx:28:    <SafeAreaView style={styles.safeArea}>
src/app/reports/index.tsx:47:            <View style={[styles.row, {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.outlineVariant}]}>
src/app/reports/index.tsx:62:    </SafeAreaView>
src/app/reports/index.tsx:69:  content: { padding: theme.spacing.lg, paddingTop: 40 },
AGENTS.md
package-lock.json
jest.config.js
GLOSSARY.md

exec
/bin/bash -lc "cat src/app/_layout.tsx 'src/app/(tabs)/_layout.tsx' app.json; cat src/app/loan/'[id].tsx'; cat src/components/security/AppLockGate.tsx; rg --files src/components; cat GLOSSARY.md; rg --files docs/adr; command -v node npm npx adb; test -d node_modules && echo node_modules-present" in /mnt/f/personal projects/credkeep
 succeeded in 191ms:
import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="borrower" options={{ headerShown: false }} />
            <Stack.Screen name="loan" options={{ headerShown: false }} />
          </Stack>
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
import { Tabs } from 'expo-router';
import { Home, Users, Landmark, Banknote, Menu } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#14283F',
      tabBarInactiveTintColor: '#64748B',
      headerStyle: {
        backgroundColor: '#14283F',
      },
      headerTintColor: '#FFFFFF',
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Home color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="borrowers"
        options={{
          title: 'Borrowers',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Users color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Loans',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Landmark color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: 'Collections',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Banknote color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Menu color={color as string} size={24} />,
        }}
      />
    </Tabs>
  );
}
{
  "expo": {
    "name": "credkeep",
    "slug": "credkeep",
    "scheme": "credkeep",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.sagarsangwan.credkeep",
      "versionCode": 2,
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26,
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ],
      "expo-status-bar",
      "expo-sharing"
    ],
    "extra": {
      "router": {},
      "eas": {
        "projectId": "44042971-c1f1-4f47-bec5-04950efe3bbf"
      }
    },
    "owner": "sagarsangwan"
  }
}
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';

export default function LoanDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { loans } = useDatabase();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (loans && typeof id === 'string') {
        const l = await loans.getById(id);
        setLoan(l);
        if (l) {
          const s = await loans.getSchedule(id);
          setSchedule(s);
        }
      }
    }
    load();
  }, [id, loans]);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Typography>Loading...</Typography>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Loan Details' }} />
      
      <Card style={styles.headerCard}>
        <Typography variant="headlineMd">Principal: {loan.principal_paise / 100} INR</Typography>
        <Typography variant="bodyLg">Status: {loan.status}</Typography>
        <Typography variant="bodyMd" color={theme.colors.textSecondary}>
          Created: {new Date(loan.created_at).toLocaleDateString()}
        </Typography>
      </Card>

      <Typography variant="headlineSm" style={styles.sectionTitle}>Repayment Schedule</Typography>
      
      {schedule.map((kist) => (
        <Card key={kist.id} style={styles.kistCard}>
          <View style={styles.kistHeader}>
            <Typography variant="labelLg">Kist {kist.installment_number}</Typography>
            <Typography variant="labelLg" color={kist.status === 'PAID' ? theme.colors.success : theme.colors.warning}>
              {kist.status}
            </Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Due Date:</Typography>
            <Typography variant="bodyMd">{kist.effective_due_date}</Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Total Due:</Typography>
            <Typography variant="bodyMd">{kist.total_due_paise / 100} INR</Typography>
          </View>
          
          <View style={styles.kistRow}>
            <Typography variant="bodyMd">Paid:</Typography>
            <Typography variant="bodyMd">{(kist.principal_paid_paise + kist.markup_paid_paise) / 100} INR</Typography>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.primaryContainer,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  kistCard: {
    marginBottom: theme.spacing.sm,
  },
  kistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingBottom: theme.spacing.xs,
  },
  kistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  }
});
cat: src/components/security/AppLockGate.tsx: No such file or directory
rg: src/components: IO error for operation on src/components: No such file or directory (os error 2)
# CredKeep Domain Glossary

Field lending ledger vocabulary for single-financier informal and semi-formal Indian credit systems.

## Language

### Monetary Units & Calculations

**Paise**:
The canonical integer monetary unit (1 INR = 100 Paise) used for all internal calculations, storage, and ledger operations to eliminate floating-point rounding errors.
_Avoid_: Rupees (in domain models), float, decimal

**Contractual Face Value**:
The total monetary obligation legally agreed upon at loan origination, defined as Principal Disbursed plus Contractual Markup.
_Avoid_: Total debt, maturity sum, loan amount

**Principal Disbursed**:
The actual net capital handed over to the Borrower at loan origination.
_Avoid_: Base amount, capital advance, net loan

**Contractual Markup**:
The fixed monetary fee or profit charged for financing over the loan tenure, determined either as an upfront flat charge or as a monthly fixed charge.
_Avoid_: Interest, margin, service cut

### Loan Products & Schedules

**Borrower**:
An individual or micro-enterprise receiving funds and obligated to repay according to an agreed schedule.
_Avoid_: Client, customer, user, debtor

**Loan Account**:
An active contract between the single financier and a Borrower governing a specific disbursement, markup, schedule, and collateral.
_Avoid_: File, case, deal

**Upfront Markup Loan**:
A financing model where total markup is fixed upfront and added to principal, with the combined face value divided across equal scheduled Kists.
_Avoid_: Flat EMI, installment loan

**Monthly Bullet Loan**:
A financing model where the Borrower pays a fixed monthly service charge/markup periodically, and repays the entire principal in a single bullet payment at maturity.
_Avoid_: Interest-only loan, balloon loan

**Kist**:
A scheduled periodic installment due on an agreed calendar date.
_Avoid_: EMI, installment, payment slice

**Original Due Date**:
The immutable contractual calendar date on which a Kist was scheduled at loan origination.
_Avoid_: Contract date, anchor date

**Effective Due Date**:
The active operational calendar date on which a Kist is due, modified via formal schedule modification without altering the original contractual date.
_Avoid_: Revised date, dynamic due date

**Tenure**:
The agreed duration of the Loan Account expressed as the total count of monthly cycles.
_Avoid_: Term, period, duration

**Schedule Modification**:
An auditable record altering the Effective Due Date of a single specific Kist with an explicit penalty treatment decision.
_Avoid_: Reschedule, date shift, deferral

### Repayments, Penalties & Overdue Collections

**Collection Receipt**:
An immutable record of money received from a Borrower against a Loan Account, issued with a unique receipt number and timestamp.
_Avoid_: Payment slip, voucher, credit slip

**Waterfall Allocation**:
The deterministic sequence used to apply incoming collection funds across accrued Late Penalties, due Markup, and Principal.
_Avoid_: Payment splitting, balance deduction

**Partial Payment**:
A collection where the amount received is less than the currently due Kist plus accrued penalties.
_Avoid_: Half kist, split payment

**Future Kist Reduction**:
The immediate automatic allocation of excess collection cash toward the earliest unpaid future scheduled Kists without creating a separate advance wallet.
_Avoid_: Advance payment, wallet credit, overpayment buffer

**Unallocated Surplus**:
Cash collected in excess of the entire remaining contractual face value of a loan, held strictly for refunding.
_Avoid_: Excess balance, float, change

**Overdue Status**:
The state of a Loan Account having at least one unpaid Kist whose Effective Due Date has passed.
_Avoid_: Default term, aging bucket, overdue cycle

**Late Penalty**:
A flat fee of ₹100 per calendar day assessed once per overdue Loan Account starting the day after the earliest unpaid due date. Cleared upon payment and never carried into future months.
_Avoid_: Compounding fine, overdue charge, per-kist penalty

**Penalty Waiver**:
An explicit, recorded noncash action by the financier to forgive an accrued Late Penalty without modifying principal, markup, or cash collections.
_Avoid_: Discount, write-off

**Foreclosure**:
The early closure of a Loan Account prior to contractual maturity, settling outstanding principal and any agreed early-settlement markup.
_Avoid_: Pre-closure, early settlement

**Settlement (OTS)**:
A negotiated compromise where the financier accepts a lump sum lower than the total outstanding receivable and legally extinguishes the debt.
_Avoid_: Haircut, write-off, compromise

**Bad Debt Write-Off**:
An accounting impairment marking an unpaid loan as uncollectible, which removes it from active portfolio balance without extinguishing legal debt claims.
_Avoid_: Settlement, cancellation, waiver

### Security & Collateral

**CTS Cheque**:
A Cheque Truncation System standard cheque (blank or dated) logged as a security instrument under Section 138 Negotiable Instruments Act.
_Avoid_: Security cheque, bank slip

**Promissory Note**:
An executed legal undertaking on stamp paper affirming the Borrower's debt obligation.
_Avoid_: IOU, stamp paper, bond

**Guarantor**:
A third party who affirms personal responsibility for a Borrower's debt obligation.
_Avoid_: Surety, reference, co-signer

**Collateral Asset**:
A tangible asset, property document, or vehicle RC book held or pledged as security.
_Avoid_: Pledge, pawn, mortgage

### Storage & Security

**Database Master Key**:
A cryptographically secure 256-bit key generated locally and stored in the Android Keystore to encrypt the SQLite database at rest.
_Avoid_: Passcode, hardcoded key

**Backup Passphrase**:
A user-provided passphrase used to derive a Key Encryption Key (KEK) via PBKDF2 for encrypting portable export archives.
_Avoid_: App password, login pin

**Audit Correction**:
An immutable compensating ledger entry recording a manual adjustment, correction, or reversal with an explicit timestamp and reason.
_Avoid_: Edit, DB update, overwrite
docs/adr/0002-append-only-double-entry-ledger.md
docs/adr/0001-sqlcipher-encrypted-sqlite.md
docs/adr/0003-relational-ledger-with-audit-history.md
/home/sagar/.nvm/versions/node/v24.21.0/bin/node
/home/sagar/.nvm/versions/node/v24.21.0/bin/npm
/home/sagar/.nvm/versions/node/v24.21.0/bin/npx
node_modules-present

exec
/bin/bash -lc "sed -n '1,140p' 'src/app/(tabs)/borrowers.tsx'; sed -n '175,280p' 'src/app/(tabs)/loans.tsx'; sed -n '70,170p' src/app/settings/security.tsx; rg -n 'Modal|SafeArea|return|padding' src/components" in /mnt/f/personal projects/credkeep
 exited 2 in 34ms:
import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';

export default function BorrowersScreen() {
  const { borrowers, loans, refreshVersion, triggerRefresh } = useDatabase();
  const [data, setData] = useState<Borrower[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const loadBorrowers = useCallback(async () => {
    if (borrowers) {
      const result = await borrowers.getAll();
      setData(result);
    }
  }, [borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBorrowers();
  }, [loadBorrowers, refreshVersion]);

  const handleAdd = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    try {
      await borrowers!.create(name, phone);
      setModalVisible(false);
      setName('');
      setPhone('');
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>Customers</Typography>
        <Button title="Add New" onPress={() => setModalVisible(true)} style={styles.headerBtn} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card elevated style={styles.card}>
            <Typography variant="headlineSm">{item.name}</Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary}>{item.phone}</Typography>
          </Card>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Typography variant="bodyLg" color={theme.colors.textSecondary}>No customers found</Typography>
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Typography color={theme.colors.primary}>Cancel</Typography></TouchableOpacity>
            <Typography variant="labelLg">New Customer</Typography>
            <View style={{width: 40}} />
          </View>
          <View style={styles.modalContainer}>
            <Typography variant="headlineMd" style={styles.modalTitle}>Borrower Details</Typography>
            
            <Input
              label="Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            
            <View style={styles.modalActions}>
              <Button 
                title="Save Customer" 
                style={styles.modalButton} 
                onPress={handleAdd} 
              />
            </View>
          </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingTop: 16
  },
  headerBtn: { backgroundColor: theme.colors.secondary, borderRadius: 8 },
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  card: { marginBottom: theme.spacing.sm },
  empty: { padding: theme.spacing.xl, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.outline },
  modalContainer: { flex: 1, padding: theme.spacing.xl, backgroundColor: theme.colors.background },
  modalTitle: { marginBottom: theme.spacing.xl },
  modalActions: { flexDirection: 'row', marginTop: theme.spacing.xl, gap: theme.spacing.md },
  modalButton: { flex: 1 }
});
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 2: Terms & Calculation</Typography>
      <Input label="Principal (₹)" keyboardType="numeric" value={principal} onChangeText={setPrincipal} />
      <Input label="Markup Percentage (%) (e.g. 30 for 30%)" keyboardType="numeric" value={markupPercent} onChangeText={setMarkupPercent} />
      <Input label="Tenure (Months)" keyboardType="numeric" value={termMonths} onChangeText={setTermMonths} />
      <Input label="Due Day (1-31)" keyboardType="numeric" value={dueDay} onChangeText={setDueDay} />
      
      <View style={styles.row}>
        <Button title="Back" variant="outline" onPress={() => setStep(1)} style={{flex: 1, marginRight: 8}} />
        <Button title="Next: Security" onPress={() => setStep(3)} style={{flex: 1}} />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 3: Security & Collateral</Typography>
      <Input label="Collateral Details (Optional)" value={collateral} onChangeText={setCollateral} />
      
      <View style={styles.row}>
        <Button title="Back" variant="outline" onPress={() => setStep(2)} style={{flex: 1, marginRight: 8}} />
        <Button title="Next: Review" onPress={() => setStep(4)} style={{flex: 1}} />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer}>
      <Typography variant="headlineMd" style={styles.modalTitle}>Step 4: Review & Confirm</Typography>
      <Card style={styles.reviewCard}>
        <Typography variant="headlineSm">Borrower: {getBorrowerName(selectedBorrowerId)}</Typography>
        <Typography variant="bodyMd">Product: {productType === 'instalment' ? 'Upfront Markup' : 'Monthly Bullet'}</Typography>
        <Typography variant="bodyMd">Principal: {formatINR(toPaise(parseInt(principal) || 0))}</Typography>
        <Typography variant="bodyMd">Total Repayment: {formatINR(totalRepayment)}</Typography>
      </Card>
      
      <Typography variant="labelLg" style={{marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm}}>Repayment Schedule</Typography>
      {previewSchedule.map((kist, index) => (
        <View key={index} style={styles.scheduleRow}>
          <Typography variant="bodySm">#{kist.kistNumber} - {kist.dueDate}</Typography>
          <Typography variant="labelLg">{formatINR(kist.amountDue)}</Typography>
        </View>
      ))}

      <View style={[styles.row, {marginTop: theme.spacing.xl, marginBottom: 40}]}>
        <Button title="Back" variant="outline" onPress={() => setStep(3)} style={{flex: 1, marginRight: 8}} />
        <Button title="Confirm & Disburse" onPress={handleCreate} style={{flex: 1}} />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="headlineMd" color={theme.colors.onPrimary}>Active Loans</Typography>
        <Button title="New Loan" onPress={() => { resetForm(); setModalVisible(true); }} style={styles.headerBtn} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/loan/${item.id}`)}>
            <Card elevated style={styles.card}>
              <Typography variant="headlineSm">{formatINR(item.principal_paise as unknown as Paise)}</Typography>
              <Typography variant="bodyMd" color={theme.colors.textSecondary}>Borrower: {getBorrowerName(item.borrower_id)}</Typography>
              <Typography variant="bodySm" color={item.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
                Status: {item.status}
              </Typography>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            {error ? (
              <Typography variant="bodyLg" color={theme.colors.error}>{error}</Typography>
            ) : (
              <Typography variant="bodyLg" color={theme.colors.textSecondary}>No active loans</Typography>
            )}
          </View>
        )}
      />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Typography color={theme.colors.primary}>Cancel</Typography></TouchableOpacity>
            <Typography variant="labelLg">New Loan - Step {step}/4</Typography>
            <View style={{width: 40}} />
          </View>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
          Alert.alert('Success', 'App Lock removed.');
        }}
      ]
    );
  };

  const startPinSetup = () => {
    setIsSettingPin(true);
    setStep(1);
    setPinEntry('');
    setFirstPin('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Shield size={32} color={theme.colors.primary} />
          <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
            App Security
          </Typography>
        </View>

        <Card style={styles.summaryCard}>
          <Typography variant="bodyMd" color={theme.colors.onPrimaryContainer}>
            Protect your financial data by requiring a PIN or biometrics to open the app.
          </Typography>
        </Card>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.onSurfaceVariant}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: theme.spacing.lg }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && (
          <Button title="Set up PIN" onPress={startPinSetup} style={{ marginTop: theme.spacing.xl }} />
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: theme.spacing.xl }} />
        )}

        <Modal visible={isSettingPin} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Typography variant="headlineMd" color={theme.colors.primary}>
                {step === 1 ? 'Create PIN' : 'Confirm PIN'}
              </Typography>
              <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={{ marginTop: 8 }}>
                {step === 1 ? 'Enter a 4-digit PIN' : 'Re-enter your PIN'}
              </Typography>
            </View>

            <View style={styles.dotsContainer}>
              {[1, 2, 3, 4].map(i => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    pinEntry.length >= i ? styles.dotFilled : null
                  ]} 
                />
              ))}
            </View>

            <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />

            <Button 
              variant="ghost" 
              title="Cancel" 
              onPress={() => setIsSettingPin(false)} 
              style={{ marginTop: 40 }} 
            />
          </SafeAreaView>
        </Modal>
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
    padding: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
rg: src/components: IO error for operation on src/components: No such file or directory (os error 2)

web search: 
web search: https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/
codex
The root provider and SDK-compatible dependency are already present. The screens use insets inconsistently: tab headers coexist with screen-level top padding, two form modals protect only the top edge, and one loan-detail route has no safe-area wrapper.

I’m using the diagnosing-bugs skill to define verification. There’s no Android runtime available here, so these are code findings; device overlap still needs reproduction. Graphify is also unavailable, so I’m inspecting the source directly.

exec
/bin/bash -lc "cat src/ui/PinLock.tsx; cat src/core/database/DatabaseProvider.tsx; cat jest.config.js; rg --files src/app; rg -n 'safe-area|Header|insets|SafeAreaProvider' node_modules/expo-router/build/ExpoRoot.js node_modules/@react-navigation/bottom-tabs/src/views/BottomTabView.tsx node_modules/@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'npx --no-install tsc --noEmit' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'npm test -- --runInBand --cache=false' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'CI=1 npx --no-install expo lint --no-cache' in /mnt/f/personal projects/credkeep
 exited 2 in 112ms:
import React, { useState, useEffect, createContext, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';
import { Keypad } from './Keypad';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

interface SecurityContextValue {
  hasPin: boolean;
  bioEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setBioEnabled: (enabled: boolean) => Promise<void>;
  lockApp: () => void;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export const useSecurity = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within PinLock');
  return ctx;
};

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false); // Default to false until checked
  const [hasPin, setHasPinState] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);
  
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async (isResume = false) => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
      
      setHasPinState(!!pin);
      setStoredPin(pin);
      setBioEnabledState(bio === 'true');
      
      if (pin) {
        setIsLocked(true);
        // Only auto-prompt biometrics if we just resumed or starting up
        if (bio === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
              disableDeviceFallback: true, // Force them to use our PIN if bio fails
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      // Fail secure - if there's an error and we think we might have a PIN, lock it.
      // But we can't read the PIN to verify. So just leave it locked with an error message?
      // For now, fail secure if we can't read it.
      setIsLocked(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (hasPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup(true);
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [hasPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
          setPinEntry('');
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  const setPin = async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    setStoredPin(pin);
    setHasPinState(true);
  };

  const removePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setStoredPin(null);
    setHasPinState(false);
    setBioEnabledState(false);
    setIsLocked(false);
  };

  const setBioEnabled = async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
    setBioEnabledState(enabled);
  };

  const lockApp = () => {
    if (hasPin) {
      setIsLocked(true);
      setPinEntry('');
    }
  };

  const handleRetryBio = async () => {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock CredKeep',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    if (auth.success) {
      setIsLocked(false);
    }
  };

  const contextValue: SecurityContextValue = {
    hasPin,
    bioEnabled,
    setPin,
    removePin,
    setBioEnabled,
    lockApp,
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Typography variant="headlineMd">Loading...</Typography>
      </View>
    );
  }

  if (isLocked) {
    return (
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
          Enter PIN
        </Typography>
        
        <View style={styles.dotsContainer}>
          {[1, 2, 3, 4].map(i => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                pinEntry.length >= i ? styles.dotFilled : null,
                error ? styles.dotError : null
              ]} 
            />
          ))}
        </View>

        <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />

        {bioEnabled && (
          <TouchableOpacity onPress={handleRetryBio} style={styles.bioButton}>
            <Typography variant="labelLg" color={theme.colors.primary}>Use Biometrics</Typography>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 60,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  bioButton: {
    marginTop: 40,
    padding: 16,
  }
});
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
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
};
src/app/_layout.tsx
src/app/(tabs)/index.tsx
src/app/(tabs)/collections.tsx
src/app/(tabs)/borrowers.tsx
src/app/(tabs)/more.tsx
src/app/(tabs)/loans.tsx
src/app/(tabs)/_layout.tsx
src/app/loan/[id].tsx
src/app/reports/index.tsx
src/app/settings/backup.tsx
src/app/settings/security.tsx
src/app/borrower/[id].tsx
src/app/loan/[id]/index.tsx
rg: node_modules/@react-navigation/bottom-tabs/src/views/BottomTabView.tsx: No such file or directory (os error 2)
rg: node_modules/@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx: No such file or directory (os error 2)
node_modules/expo-router/build/ExpoRoot.js:41:const react_native_safe_area_context_1 = require("react-native-safe-area-context");
node_modules/expo-router/build/ExpoRoot.js:62:        insets: { top: 0, left: 0, right: 0, bottom: 0 },
node_modules/expo-router/build/ExpoRoot.js:75:     * View's like <SafeAreaProvider /> generate a <div> so if the parent wrapper
node_modules/expo-router/build/ExpoRoot.js:79:        return ((0, jsx_runtime_1.jsx)(ParentWrapper, { children: (0, jsx_runtime_1.jsx)(LinkPreviewContext_1.LinkPreviewContextProvider, { children: (0, jsx_runtime_1.jsx)(react_native_safe_area_context_1.SafeAreaProvider

web search: 
web search: https://docs.expo.dev/develop/user-interface/safe-areas/
 exited 1 in 4163ms:

> credkeep@1.0.0 test
> jest --runInBand --cache=false

Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

 exited 7 in 4528ms:
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

 succeeded in 11914ms:
web search: 
web search: https://docs.expo.dev/develop/user-interface/system-bars.md
exec
/bin/bash -lc './node_modules/.bin/eslint . --no-cache' in /mnt/f/personal projects/credkeep
web search: 
web search: https://docs.expo.dev/develop/user-interface/system-bars/
codex
The plan will assign each edge to one owner: custom screen headers handle the top inset, the tab navigator handles the bottom inset on tab screens, and standalone screens and modals handle their own edges. This should address overlap without adding duplicate padding.

TypeScript passed. Expo lint and Jest hit filesystem-write restrictions; I’m checking ESLint directly with caching disabled.

exec
/bin/bash -lc './node_modules/.bin/eslint src/app src/ui/PinLock.tsx --no-cache' in /mnt/f/personal projects/credkeep
codex
The issue appears to be inconsistent inset ownership, rather than a missing dependency. CredKeep already has `SafeAreaProvider` and `react-native-safe-area-context ~5.7.0`, matching [Expo SDK 57’s recommendation](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/). Android overlap remains unverified on a device.

The fix plan is:

1. **Keep the root provider; avoid global padding around the navigator.** A provider supplies inset measurements—it does not protect content by itself.

2. **Standardize tab screens.** In [the tab layout](</mnt/f/personal projects/credkeep/src/app/(tabs)/_layout.tsx>), hide navigator headers because screens already render custom headers. Give each tab screen `SafeAreaView edges={['top', 'left', 'right']}`, including Loans’ current plain `View`. Let the normal tab bar own the bottom inset, avoiding duplicate bottom padding.

3. **Protect standalone screens and the PIN gate.** Use all edges when the navigator header is hidden; omit the top edge when a visible navigator header already handles it. Apply this to loading and error states too. Resolve the competing `loan/[id].tsx` and `loan/[id]/index.tsx` routes so navigation reaches one consistently protected screen.

4. **Fix native modal boundaries.** Borrower creation and the loan wizard currently protect only the top edge. Give borrower, loan, and PIN-setup modals a modal-local `SafeAreaProvider` and an all-edge `SafeAreaView`. Measure modal insets locally rather than reusing root initial metrics. Expo explicitly identifies modals as potential additional provider boundaries. [SDK documentation](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/)

5. **Separate design spacing from system insets.** Review Home’s `paddingBottom: 100` and header padding values. Preserve intentional spacing; replace system-bar compensation with measured insets. Use `useSafeAreaInsets()` only where a custom footer requires it, and never apply the same inset twice. Keep keyboard avoidance separate.

Acceptance requires Android checks with gesture and three-button navigation, cutouts, and keyboards open/closed. Verify every tab, detail screen, modal, and PIN gate: headers and controls must remain outside system bars, final list items must be reachable, and no duplicate inset gaps should appear. Include an iOS regression pass.

Typecheck passed. Expo lint and Jest were blocked by filesystem-write restrictions; direct ESLint attempts have not completed. No device reproduction, saved handoff, or commit was possible in this read-only session.
2026-10-10T05:14:54.518305Z ERROR codex_core::session: failed to record rollout items: thread 01a1243a-1ef6-7473-b661-8a06a64ae7aa not found
2026-10-10T05:14:54.519396Z ERROR codex_core::session: failed to record rollout items: thread 01a1243a-1ef6-7473-b661-8a06a64ae7aa not found
tokens used
67,061
The issue appears to be inconsistent inset ownership, rather than a missing dependency. CredKeep already has `SafeAreaProvider` and `react-native-safe-area-context ~5.7.0`, matching [Expo SDK 57’s recommendation](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/). Android overlap remains unverified on a device.

The fix plan is:

1. **Keep the root provider; avoid global padding around the navigator.** A provider supplies inset measurements—it does not protect content by itself.

2. **Standardize tab screens.** In [the tab layout](</mnt/f/personal projects/credkeep/src/app/(tabs)/_layout.tsx>), hide navigator headers because screens already render custom headers. Give each tab screen `SafeAreaView edges={['top', 'left', 'right']}`, including Loans’ current plain `View`. Let the normal tab bar own the bottom inset, avoiding duplicate bottom padding.

3. **Protect standalone screens and the PIN gate.** Use all edges when the navigator header is hidden; omit the top edge when a visible navigator header already handles it. Apply this to loading and error states too. Resolve the competing `loan/[id].tsx` and `loan/[id]/index.tsx` routes so navigation reaches one consistently protected screen.

4. **Fix native modal boundaries.** Borrower creation and the loan wizard currently protect only the top edge. Give borrower, loan, and PIN-setup modals a modal-local `SafeAreaProvider` and an all-edge `SafeAreaView`. Measure modal insets locally rather than reusing root initial metrics. Expo explicitly identifies modals as potential additional provider boundaries. [SDK documentation](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/)

5. **Separate design spacing from system insets.** Review Home’s `paddingBottom: 100` and header padding values. Preserve intentional spacing; replace system-bar compensation with measured insets. Use `useSafeAreaInsets()` only where a custom footer requires it, and never apply the same inset twice. Keep keyboard avoidance separate.

Acceptance requires Android checks with gesture and three-button navigation, cutouts, and keyboards open/closed. Verify every tab, detail screen, modal, and PIN gate: headers and controls must remain outside system bars, final list items must be reachable, and no duplicate inset gaps should appear. Include an iOS regression pass.

Typecheck passed. Expo lint and Jest were blocked by filesystem-write restrictions; direct ESLint attempts have not completed. No device reproduction, saved handoff, or commit was possible in this read-only session.

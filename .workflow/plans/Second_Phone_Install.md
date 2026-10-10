OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12443-10ab-7d11-9d08-38f89898fc1f
--------
user
Investigate and plan a fix for the 'Second-phone installation failure' bug in CredKeep. The database should be correctly initialized or restored when installing on a second device.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll use the diagnosing-bugs skill to trace database initialization and restore behavior, then prepare a fix plan based on the evidence.

exec
/bin/bash -lc "cat AGENTS.md .workflow/STATE.md '/mnt/f/personal projects/credkeep/.agents/skills/diagnosing-bugs/SKILL.md'" in /mnt/f/personal projects/credkeep
 succeeded in 6ms:
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
- **Current Git Branch:** feat/bugfix/second-phone-install
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Second-phone installation failure
- **Assigned Agent:** Gemini
- **Current Stage:** Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** 35 passed
- **Next Action:** Investigate the 'Second-phone installation failure' bug and formulate a plan.
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

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
if test -f graphify-out/graph.json; then graphify query \"second phone installation database initialization restore\"; fi
 git status --short
cat package.json .workflow/HANDOFF.md
rg -n -i 'second.phone|installation failure|restore|initializeDatabase|openDatabase|securestore|sqlcipher' src .scratch docs/adr GLOSSARY.md app.json" in /mnt/f/personal projects/credkeep
 succeeded in 1347ms:
/bin/bash: line 2: graphify: command not found
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
 M .workflow/plans/PIN_App_Lock.md
 M .workflow/plans/PIN_App_Lock_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_report.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/reports/mock-task_qa_prompt.txt
 M AGENTS.md
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
?? .codex/hooks.json.disabled
?? .workflow/plans/Second_Phone_Install.md
?? .workflow/plans/Second_Phone_Install_prompt.txt
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
app.json:32:          "useSQLCipher": true
docs/adr/0001-sqlcipher-encrypted-sqlite.md:1:# 0001. SQLCipher Encrypted SQLite, Keystore Lifecycle, and Versioned Envelope Backups
docs/adr/0001-sqlcipher-encrypted-sqlite.md:9:1. **Android Keystore Hardware Limitations**: Hardware-backed Keymaster/StrongBox support varies wildly across budget Android devices common in India. Furthermore, Android Keystore keys are non-exportable and are irrevocably wiped upon app uninstallation or OS "Clear Data". Platform auto-backup (Google Drive / Android Backup Service) cannot restore hardware-bound Keystore keys.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:15:### 1. Database Encryption via SQLCipher (`expo-sqlite`)
docs/adr/0001-sqlcipher-encrypted-sqlite.md:16:We use `expo-sqlite` configured with the official native plugin `useSQLCipher: true` in `app.json`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:17:- **Native Build Prerequisite**: SQLCipher compiles native binaries and is **unsupported in Expo Go**. All local execution and testing require custom development builds (`npx expo prebuild` followed by `npx expo run:android` or EAS Build).
docs/adr/0001-sqlcipher-encrypted-sqlite.md:21:  3. Open database using `openDatabaseAsync('credkeep.db')`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:58:  - The envelope stores its version and iteration count explicitly, allowing future versions to migrate to Argon2id without breaking backward-compatible restore of older archives.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:64:- **Restore & Verification Process**:
docs/adr/0001-sqlcipher-encrypted-sqlite.md:68:  4. Write decrypted content to `restore_test.db`, execute `PRAGMA integrity_check;`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:69:  5. Upon verification, replace active database and update the local Android Keystore with the restored database key.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:74:1. **App Uninstallation / Clear Data**: Verify that a freshly reinstalled app can restore all loans, borrowers, and ledgers from a `.ckenc` file using only the user passphrase.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:75:2. **Device Migration**: Verify that a backup generated on Device A can be successfully decrypted and restored on Device B with different hardware Keystore environments.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:76:3. **Corrupted File Detection**: Flip random bits in the ciphertext or header of a `.ckenc` file; confirm the restore aborts cleanly at the GCM tag verification stage with zero database side effects.
docs/adr/0003-relational-ledger-with-audit-history.md:207:   - Scheduled kist paid amounts restored in reverse order.
docs/adr/0003-relational-ledger-with-audit-history.md:224:10. **Reschedule with Penalty Waiver**: Kist extended after ₹300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to ₹0.
docs/adr/0003-relational-ledger-with-audit-history.md:228:14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and ₹100 of K2 &rarr; both kists and DPD restore to exact prior states.
.scratch/screens/CredKeep_More_Settings.html:84:  <!-- GROUP 2: BACKUP & RESTORE -->
.scratch/screens/CredKeep_More_Settings.html:90:          Backup &amp; Restore
.scratch/screens/CredKeep_More_Settings.html:122:      <!-- Restore from File -->
.scratch/screens/CredKeep_More_Settings.html:123:      <div class="p-space-md flex items-center justify-between gap-space-md cursor-pointer hover:bg-surface-container-low transition-colors" onclick="alert('Select a valid .ckdb backup file from device storage to restore.')">
.scratch/screens/CredKeep_More_Settings.html:126:            <span class="material-symbols-outlined text-[22px]">settings_backup_restore</span>
.scratch/screens/CredKeep_More_Settings.html:129:            <span class="font-body-lg text-[16px] text-on-surface block font-semibold">Restore from File</span>
src/ui/PinLock.tsx:3:import * as SecureStore from 'expo-secure-store';
src/ui/PinLock.tsx:43:      const pin = await SecureStore.getItemAsync(PIN_KEY);
src/ui/PinLock.tsx:44:      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:71:      console.error('SecureStore error', e);
src/ui/PinLock.tsx:124:    await SecureStore.setItemAsync(PIN_KEY, pin);
src/ui/PinLock.tsx:130:    await SecureStore.deleteItemAsync(PIN_KEY);
src/ui/PinLock.tsx:131:    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:139:    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
src/core/domain/backupUtil.test.ts:3:describe('Backup & Restore Utility', () => {
src/core/domain/backupUtil.test.ts:15:    const restored = decryptBackupPayload(encrypted, password);
src/core/domain/backupUtil.test.ts:16:    expect(restored.key).toBe(originalKey);
src/core/domain/backupUtil.test.ts:17:    expect(restored.dbBase64).toBe(originalDb);
src/app/settings/backup.tsx:6:import * as SecureStore from 'expo-secure-store';
src/app/settings/backup.tsx:48:      // 2. Read DB Key from SecureStore
src/app/settings/backup.tsx:84:  const handleRestore = async () => {
src/app/settings/backup.tsx:100:          Alert.alert('Warning', 'File does not appear to be a CredKeep Backup (.ckb). Restore anyway?', [
src/app/settings/backup.tsx:102:            { text: 'Restore', onPress: () => performRestore(file.uri) }
src/app/settings/backup.tsx:107:        await performRestore(file.uri);
src/app/settings/backup.tsx:116:  const performRestore = async (uri: string) => {
src/app/settings/backup.tsx:127:      const tempDbName = `temp_restore_${Date.now()}.db`;
src/app/settings/backup.tsx:143:        const testDb = await SQLite.openDatabaseAsync(tempDbName);
src/app/settings/backup.tsx:165:      // Update SecureStore with the imported key
src/app/settings/backup.tsx:166:      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
src/app/settings/backup.tsx:171:      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
src/app/settings/backup.tsx:173:      Alert.alert('Restore Failed', e.message);
src/app/settings/backup.tsx:181:          Backup & Restore
src/app/settings/backup.tsx:186:          To restore on a new device, you must enter the exact same password.
src/app/settings/backup.tsx:210:            title="Restore from Backup (.ckb)" 
src/app/settings/backup.tsx:211:            onPress={handleRestore}
src/core/database/db.ts:2:import * as SecureStore from 'expo-secure-store';
src/core/database/db.ts:15:  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
src/core/database/db.ts:22:    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
src/core/database/db.ts:34:  const db = await SQLite.openDatabaseAsync(DB_NAME);
src/app/(tabs)/more.tsx:14:    { title: 'Backup & Restore', route: '/settings/backup' },

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat .workflow/plans/Second_Phone_Install.md .workflow/plans/Second_Phone_Install_prompt.txt src/core/database/db.ts src/app/_layout.tsx src/app/settings/backup.tsx src/core/domain/backupUtil.ts app.json jest.config.js GLOSSARY.md docs/adr/0001-sqlcipher-encrypted-sqlite.md
rg --files -g '*lock*' -g '*test*' -g '*migration*' -g '*schema*' -g '*backup*' -g '*graphify*' | head -65" in /mnt/f/personal projects/credkeep
 succeeded in 102ms:
OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12443-10ab-7d11-9d08-38f89898fc1f
--------
user
Investigate and plan a fix for the 'Second-phone installation failure' bug in CredKeep. The database should be correctly initialized or restored when installing on a second device.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll use the diagnosing-bugs skill to trace database initialization and restore behavior, then prepare a fix plan based on the evidence.

exec
/bin/bash -lc "cat AGENTS.md .workflow/STATE.md '/mnt/f/personal projects/credkeep/.agents/skills/diagnosing-bugs/SKILL.md'" in /mnt/f/personal projects/credkeep
 succeeded in 6ms:
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
- **Current Git Branch:** feat/bugfix/second-phone-install
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Second-phone installation failure
- **Assigned Agent:** Gemini
- **Current Stage:** Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** 35 passed
- **Next Action:** Investigate the 'Second-phone installation failure' bug and formulate a plan.
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

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
if test -f graphify-out/graph.json; then graphify query \"second phone installation database initialization restore\"; fi
 git status --short
cat package.json .workflow/HANDOFF.md
rg -n -i 'second.phone|installation failure|restore|initializeDatabase|openDatabase|securestore|sqlcipher' src .scratch docs/adr GLOSSARY.md app.json" in /mnt/f/personal projects/credkeep
 succeeded in 1347ms:
/bin/bash: line 2: graphify: command not found
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
 M .workflow/plans/PIN_App_Lock.md
 M .workflow/plans/PIN_App_Lock_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_report.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/reports/mock-task_qa_prompt.txt
 M AGENTS.md
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
?? .codex/hooks.json.disabled
?? .workflow/plans/Second_Phone_Install.md
?? .workflow/plans/Second_Phone_Install_prompt.txt
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
app.json:32:          "useSQLCipher": true
docs/adr/0001-sqlcipher-encrypted-sqlite.md:1:# 0001. SQLCipher Encrypted SQLite, Keystore Lifecycle, and Versioned Envelope Backups
docs/adr/0001-sqlcipher-encrypted-sqlite.md:9:1. **Android Keystore Hardware Limitations**: Hardware-backed Keymaster/StrongBox support varies wildly across budget Android devices common in India. Furthermore, Android Keystore keys are non-exportable and are irrevocably wiped upon app uninstallation or OS "Clear Data". Platform auto-backup (Google Drive / Android Backup Service) cannot restore hardware-bound Keystore keys.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:15:### 1. Database Encryption via SQLCipher (`expo-sqlite`)
docs/adr/0001-sqlcipher-encrypted-sqlite.md:16:We use `expo-sqlite` configured with the official native plugin `useSQLCipher: true` in `app.json`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:17:- **Native Build Prerequisite**: SQLCipher compiles native binaries and is **unsupported in Expo Go**. All local execution and testing require custom development builds (`npx expo prebuild` followed by `npx expo run:android` or EAS Build).
docs/adr/0001-sqlcipher-encrypted-sqlite.md:21:  3. Open database using `openDatabaseAsync('credkeep.db')`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:58:  - The envelope stores its version and iteration count explicitly, allowing future versions to migrate to Argon2id without breaking backward-compatible restore of older archives.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:64:- **Restore & Verification Process**:
docs/adr/0001-sqlcipher-encrypted-sqlite.md:68:  4. Write decrypted content to `restore_test.db`, execute `PRAGMA integrity_check;`.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:69:  5. Upon verification, replace active database and update the local Android Keystore with the restored database key.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:74:1. **App Uninstallation / Clear Data**: Verify that a freshly reinstalled app can restore all loans, borrowers, and ledgers from a `.ckenc` file using only the user passphrase.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:75:2. **Device Migration**: Verify that a backup generated on Device A can be successfully decrypted and restored on Device B with different hardware Keystore environments.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:76:3. **Corrupted File Detection**: Flip random bits in the ciphertext or header of a `.ckenc` file; confirm the restore aborts cleanly at the GCM tag verification stage with zero database side effects.
docs/adr/0003-relational-ledger-with-audit-history.md:207:   - Scheduled kist paid amounts restored in reverse order.
docs/adr/0003-relational-ledger-with-audit-history.md:224:10. **Reschedule with Penalty Waiver**: Kist extended after ₹300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to ₹0.
docs/adr/0003-relational-ledger-with-audit-history.md:228:14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and ₹100 of K2 &rarr; both kists and DPD restore to exact prior states.
.scratch/screens/CredKeep_More_Settings.html:84:  <!-- GROUP 2: BACKUP & RESTORE -->
.scratch/screens/CredKeep_More_Settings.html:90:          Backup &amp; Restore
.scratch/screens/CredKeep_More_Settings.html:122:      <!-- Restore from File -->
.scratch/screens/CredKeep_More_Settings.html:123:      <div class="p-space-md flex items-center justify-between gap-space-md cursor-pointer hover:bg-surface-container-low transition-colors" onclick="alert('Select a valid .ckdb backup file from device storage to restore.')">
.scratch/screens/CredKeep_More_Settings.html:126:            <span class="material-symbols-outlined text-[22px]">settings_backup_restore</span>
.scratch/screens/CredKeep_More_Settings.html:129:            <span class="font-body-lg text-[16px] text-on-surface block font-semibold">Restore from File</span>
src/ui/PinLock.tsx:3:import * as SecureStore from 'expo-secure-store';
src/ui/PinLock.tsx:43:      const pin = await SecureStore.getItemAsync(PIN_KEY);
src/ui/PinLock.tsx:44:      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:71:      console.error('SecureStore error', e);
src/ui/PinLock.tsx:124:    await SecureStore.setItemAsync(PIN_KEY, pin);
src/ui/PinLock.tsx:130:    await SecureStore.deleteItemAsync(PIN_KEY);
src/ui/PinLock.tsx:131:    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:139:    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
src/core/domain/backupUtil.test.ts:3:describe('Backup & Restore Utility', () => {
src/core/domain/backupUtil.test.ts:15:    const restored = decryptBackupPayload(encrypted, password);
src/core/domain/backupUtil.test.ts:16:    expect(restored.key).toBe(originalKey);
src/core/domain/backupUtil.test.ts:17:    expect(restored.dbBase64).toBe(originalDb);
src/app/settings/backup.tsx:6:import * as SecureStore from 'expo-secure-store';
src/app/settings/backup.tsx:48:      // 2. Read DB Key from SecureStore
src/app/settings/backup.tsx:84:  const handleRestore = async () => {
src/app/settings/backup.tsx:100:          Alert.alert('Warning', 'File does not appear to be a CredKeep Backup (.ckb). Restore anyway?', [
src/app/settings/backup.tsx:102:            { text: 'Restore', onPress: () => performRestore(file.uri) }
src/app/settings/backup.tsx:107:        await performRestore(file.uri);
src/app/settings/backup.tsx:116:  const performRestore = async (uri: string) => {
src/app/settings/backup.tsx:127:      const tempDbName = `temp_restore_${Date.now()}.db`;
src/app/settings/backup.tsx:143:        const testDb = await SQLite.openDatabaseAsync(tempDbName);
src/app/settings/backup.tsx:165:      // Update SecureStore with the imported key
src/app/settings/backup.tsx:166:      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
src/app/settings/backup.tsx:171:      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
src/app/settings/backup.tsx:173:      Alert.alert('Restore Failed', e.message);
src/app/settings/backup.tsx:181:          Backup & Restore
src/app/settings/backup.tsx:186:          To restore on a new device, you must enter the exact same password.
src/app/settings/backup.tsx:210:            title="Restore from Backup (.ckb)" 
src/app/settings/backup.tsx:211:            onPress={handleRestore}
src/core/database/db.ts:2:import * as SecureStore from 'expo-secure-store';
src/core/database/db.ts:15:  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
src/core/database/db.ts:22:    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
src/core/database/db.ts:34:  const db = await SQLite.openDatabaseAsync(DB_NAME);
src/app/(tabs)/more.tsx:14:    { title: 'Backup & Restore', route: '/settings/backup' },

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat .workflow/plans/Second_Phone_Install.md .workflow/plans/Second_Phone_Install_prompt.txt src/core/database/db.ts src/app/_layout.tsx src/app/settings/backup.tsx src/core/domain/backupUtil.ts app.json jest.config.js GLOSSARY.md docs/adr/0001-sqlcipher-encrypted-sqlite.md
rg --files -g '*lock*' -g '*test*' -g '*migration*' -g '*schema*' -g '*backup*' -g '*graphify*' | head -65" in /mnt/f/personal projects/credkeep
﻿Investigate and plan a fix for the 'Second-phone installation failure' bug in CredKeep. The database should be correctly initialized or restored when installing on a second device.
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_NAME = 'credkeep_db_master_key';
const DB_NAME = 'credkeep.db';

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getDatabaseKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
  
  if (!key) {
    // Generate a 32-byte cryptographically secure random key
    const randomBytes = Crypto.getRandomBytes(32);
    key = bufferToHex(randomBytes.buffer as ArrayBuffer);
    
    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
      requireAuthentication: false,
    });
  }
  
  return key;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const key = await getDatabaseKey();
  
  // Note: expo-sqlite SDK 50+ natively supports opening databases.
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // PRAGMA configuration
  await db.execAsync(`
    PRAGMA key = "x'${key}'";
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
  
  // Verify encryption by querying something
  await db.getFirstAsync('SELECT 1');
  
  return db;
}
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
import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createEncryptedBackupPayload, decryptBackupPayload } from '../../core/domain/backupUtil';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { getDatabaseKey } from '../../core/database/db';

export default function BackupScreen() {
  const { db } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const dbPath = `${FileSystem.documentDirectory}SQLite/credkeep.db`;

  const handleBackup = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a password to encrypt your backup.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Checkpoint SQLite WAL so the .db file contains all data
      if (db) {
        await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
      }

      const exists = await FileSystem.getInfoAsync(dbPath);
      if (!exists.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }
      
      // 2. Read DB Key from SecureStore
      const masterKey = await getDatabaseKey();
      
      // 3. Read DB file as Base64
      const dbBase64 = await FileSystem.readAsStringAsync(dbPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4 & 5. Create payload and encrypt
      const encrypted = createEncryptedBackupPayload(masterKey, dbBase64, password);

      // 6. Save to temp file
      const backupUri = `${FileSystem.cacheDirectory}credkeep_backup_${Date.now()}.ckb`;
      await FileSystem.writeAsStringAsync(backupUri, encrypted, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(backupUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Save CredKeep Backup',
      });
      
      setPassword('');
    } catch (e: any) {
      Alert.alert('Backup Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter the password to decrypt the backup.');
      return;
    }

    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        if (!file.name.endsWith('.ckb')) {
          Alert.alert('Warning', 'File does not appear to be a CredKeep Backup (.ckb). Restore anyway?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: () => performRestore(file.uri) }
          ]);
          return;
        }
        
        await performRestore(file.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const performRestore = async (uri: string) => {
    try {
      // 1. Read encrypted file
      const encrypted = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // 2 & 3. Decrypt and Parse JSON
      const payload = decryptBackupPayload(encrypted, password);

      // 4. Write to temp DB to verify integrity
      const tempDbName = `temp_restore_${Date.now()}.db`;
      const tempDbPath = `${FileSystem.documentDirectory}SQLite/${tempDbName}`;
      
      // Ensure SQLite dir exists
      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(tempDbPath, payload.dbBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      // 5. Verify Temp DB
      try {
        const testDb = await SQLite.openDatabaseAsync(tempDbName);
        await testDb.execAsync(`PRAGMA key = "x'${payload.key}'"; PRAGMA journal_mode = WAL;`);
        // Test query
        await testDb.getFirstAsync('SELECT count(*) FROM loans');
        await testDb.getFirstAsync('PRAGMA integrity_check');
        // If we reach here, it's valid
        // NOTE: expo-sqlite doesn't have an explicit close() in the standard API for SDK 50+, 
        // but it's fine, we will overwrite the main DB.
      } catch (e: any) {
        // Delete temp DB
        await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
        throw new Error('Backup integrity check failed. The file is corrupt or incompatible.');
      }

      // 6. It's valid. Swap DBs and set key
      // Close main DB? We can't explicitly close it, but overwriting works if we restart.
      await FileSystem.copyAsync({
        from: tempDbPath,
        to: dbPath,
      });
      await FileSystem.deleteAsync(tempDbPath, { idempotent: true });

      // Update SecureStore with the imported key
      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
        requireAuthentication: false,
      });

      setPassword('');
      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          Backup & Restore
        </Typography>
        
        <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={styles.description}>
          Export your SQLite database securely. The backup will be encrypted with the password you provide. 
          To restore on a new device, you must enter the exact same password.
        </Typography>

        <Input 
          label="Encryption Password" 
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter a strong password"
          editable={false}
        />

        <View style={styles.actions}>
          <Typography variant="bodySm" color={theme.colors.error} style={{ marginBottom: 16 }}>
            Note: Portable backup is currently disabled pending a cryptographic security audit for AES key derivation and integrity protection.
          </Typography>
          <Button 
            title="Export Secure Backup (.ckb)" 
            onPress={handleBackup} 
            disabled={true}
          />
          <View style={{ height: 20 }} />
          <Button 
            variant="outline" 
            title="Restore from Backup (.ckb)" 
            onPress={handleRestore}
            disabled={true}
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />}
      </ScrollView>
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
  title: {
    marginBottom: theme.spacing.md,
  },
  description: {
    marginBottom: theme.spacing.xl,
  },
  actions: {
    marginTop: theme.spacing.xl,
  }
});
import CryptoJS from 'crypto-js';

export function createEncryptedBackupPayload(key: string, dbBase64: string, password: string): string {
  const payload = JSON.stringify({ key, dbBase64 });
  return CryptoJS.AES.encrypt(payload, password).toString();
}

export function decryptBackupPayload(encryptedPayload: string, password: string): { key: string, dbBase64: string } {
  const bytes = CryptoJS.AES.decrypt(encryptedPayload, password);
  let decryptedText: string;
  try {
    decryptedText = bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    throw new Error('Decryption failed. Incorrect password or corrupt file.');
  }

  if (!decryptedText) {
    throw new Error('Decryption failed. Incorrect password or corrupt file.');
  }

  const payload = JSON.parse(decryptedText);
  if (!payload.key || !payload.dbBase64) {
    throw new Error('Invalid backup file format.');
  }

  return payload;
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
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
};
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
# 0001. SQLCipher Encrypted SQLite, Keystore Lifecycle, and Versioned Envelope Backups

**Status**: Accepted (Amended)

## Context
CredKeep stores private financial ledger balances, promissory note metadata, and borrower KYC records entirely on an Android mobile device. In informal Indian lending, field devices face risks of physical loss, theft, unauthorized inspection, or physical seizure. Data at rest must be strongly encrypted without compromising local SQLite query performance.

However, relying uncritically on platform key storage or fixed cryptographic parameters introduces catastrophic operational risks:
1. **Android Keystore Hardware Limitations**: Hardware-backed Keymaster/StrongBox support varies wildly across budget Android devices common in India. Furthermore, Android Keystore keys are non-exportable and are irrevocably wiped upon app uninstallation or OS "Clear Data". Platform auto-backup (Google Drive / Android Backup Service) cannot restore hardware-bound Keystore keys.
2. **Biometric Invalidation**: Tying cryptographic master keys to Android biometrics (`setUserAuthenticationRequired(true)`) risks permanent data loss if the financier adds, updates, or resets device fingerprints, causing the OS to invalidate the key (`KeyPermanentlyInvalidatedException`).
3. **Static PBKDF2 Iteration Counts**: Assuming a fixed 100,000 iterations for PBKDF2 without an upgrade path fails modern security standards (OWASP recommends 600,000 iterations for PBKDF2-HMAC-SHA256) and prevents performance tuning across device tiers.

## Decision

### 1. Database Encryption via SQLCipher (`expo-sqlite`)
We use `expo-sqlite` configured with the official native plugin `useSQLCipher: true` in `app.json`.
- **Native Build Prerequisite**: SQLCipher compiles native binaries and is **unsupported in Expo Go**. All local execution and testing require custom development builds (`npx expo prebuild` followed by `npx expo run:android` or EAS Build).
- **Database Initialization Sequence**:
  1. On application launch, retrieve the 256-bit Database Master Key from `expo-secure-store`.
  2. If absent (first launch), generate 32 cryptographically secure random bytes using `expo-crypto` (`getRandomBytes(32)`), hex-encode the key, and store it in `expo-secure-store`.
  3. Open database using `openDatabaseAsync('credkeep.db')`.
  4. Immediately execute `PRAGMA key = "x'<hex_key>'";` before any schema or data query.
  5. Verify successful unlocking by querying `PRAGMA cipher_version;` and `PRAGMA integrity_check;`.
  6. **Fail-Closed Policy**: If key retrieval or database decryption fails, the app halts immediately and renders a recovery diagnostic screen. Under no circumstances will the app attempt to open an unencrypted fallback database.

### 2. Keystore Lifecycle & Decoupling
- The Database Master Key stored in `expo-secure-store` is created with `requireAuthentication: false`.
- Biometric authentication (fingerprint/face) and app PINs act strictly as **UI-level session gates**. They do not guard the hardware Keystore key directly, preventing biometric enrollment changes from bricking database access.

### 3. Versioned Encrypted Backup Envelope
Because Android Keystore keys cannot survive app uninstallation or phone replacement, recovery depends on a portable, self-contained backup file (`.ckenc`).

We establish a versioned envelope format:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (6B): 'CKENC' + Version (0x01)                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ KDF Metadata:                                                                │
│   • Algorithm ID (1B): 0x01 (PBKDF2-HMAC-SHA256)                             │
│   • Iteration Count (4B Big-Endian): 600,000                                 │
│   • Salt Length (1B): 32 bytes                                               │
│   • KDF Salt (32B)                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cipher Metadata:                                                             │
│   • Cipher ID (1B): 0x01 (AES-256-GCM)                                       │
│   • Nonce / IV (12B)                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Ciphertext Payload:                                                          │
│   • Encrypted SQLite Database Dump (Variable Length)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Authentication Tag:                                                          │
│   • AES-GCM Tag (16B)                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Key Derivation Policy**:
  - Version 1 derives the Key Encryption Key (KEK) using PBKDF2-HMAC-SHA256 with a 32-byte CSPRNG salt and **600,000 iterations** (OWASP 2023/2024 standard).
  - The envelope stores its version and iteration count explicitly, allowing future versions to migrate to Argon2id without breaking backward-compatible restore of older archives.
- **Export Process**:
  1. Capture a consistent snapshot of the SQLite database using `VACUUM INTO 'snapshot.db'`.
  2. Prompt user for a strong **Backup Passphrase**.
  3. Derive KEK, encrypt the snapshot using AES-256-GCM, and construct the `.ckenc` envelope.
  4. Write to a temporary file (`backup.ckenc.tmp`), sync to disk, and atomically rename to `credkeep_backup_<ISO_TIMESTAMP>.ckenc`.
- **Restore & Verification Process**:
  1. Inspect the 6-byte header magic (`CKENC\x01`). If missing, reject immediately.
  2. Read KDF metadata, derive the candidate KEK from user input.
  3. Authenticate and decrypt payload. If the 16-byte GCM authentication tag fails, reject with `"Invalid Passphrase or Tampered File"` without altering the active database.
  4. Write decrypted content to `restore_test.db`, execute `PRAGMA integrity_check;`.
  5. Upon verification, replace active database and update the local Android Keystore with the restored database key.

## Recovery & Test Scenarios

The test suite must validate these five operational scenarios:
1. **App Uninstallation / Clear Data**: Verify that a freshly reinstalled app can restore all loans, borrowers, and ledgers from a `.ckenc` file using only the user passphrase.
2. **Device Migration**: Verify that a backup generated on Device A can be successfully decrypted and restored on Device B with different hardware Keystore environments.
3. **Corrupted File Detection**: Flip random bits in the ciphertext or header of a `.ckenc` file; confirm the restore aborts cleanly at the GCM tag verification stage with zero database side effects.
4. **Incorrect Passphrase**: Verify that entering the wrong passphrase rejects gracefully with zero data loss or partial writes.
5. **Biometric Reset Resilience**: Verify that clearing or updating system fingerprints in Android OS does not impede the app from opening the database on next launch.

## Consequences
- **Positive**: Complete cryptographic privacy at rest, zero risk of data loss from Keystore wipe, resilient against phone theft, future-proof backup envelope.
- **Negative**: Development requires local native builds (`npx expo run:android`), disabling quick prototyping in Expo Go. Backup creation incurs ~1-2 seconds of CPU load during the 600,000 PBKDF2 iteration derivation.
.graphifyignore
package-lock.json
test-bug.js
graphify-out/.graphify_root
graphify-out/.graphify_analysis.json
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/core/database/loanRepository.test.ts
src/core/database/schema.ts
src/core/domain/backupUtil.ts
src/core/domain/backupUtil.test.ts
src/core/domain/allocation.test.ts
src/core/domain/penalty.test.ts
src/core/domain/money.test.ts
src/core/domain/schedule.test.ts
src/app/settings/backup.tsx

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat src/core/database/db.ts src/app/_layout.tsx
sed -n '1,178p' src/app/settings/backup.tsx
cat test-bug.js
command -v node npm bun adb
 test -d node_modules && echo node_modules-present" in /mnt/f/personal projects/credkeep
 succeeded in 208ms:
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_NAME = 'credkeep_db_master_key';
const DB_NAME = 'credkeep.db';

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getDatabaseKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
  
  if (!key) {
    // Generate a 32-byte cryptographically secure random key
    const randomBytes = Crypto.getRandomBytes(32);
    key = bufferToHex(randomBytes.buffer as ArrayBuffer);
    
    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
      requireAuthentication: false,
    });
  }
  
  return key;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const key = await getDatabaseKey();
  
  // Note: expo-sqlite SDK 50+ natively supports opening databases.
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // PRAGMA configuration
  await db.execAsync(`
    PRAGMA key = "x'${key}'";
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
  
  // Verify encryption by querying something
  await db.getFirstAsync('SELECT 1');
  
  return db;
}
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
import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createEncryptedBackupPayload, decryptBackupPayload } from '../../core/domain/backupUtil';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { getDatabaseKey } from '../../core/database/db';

export default function BackupScreen() {
  const { db } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const dbPath = `${FileSystem.documentDirectory}SQLite/credkeep.db`;

  const handleBackup = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a password to encrypt your backup.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Checkpoint SQLite WAL so the .db file contains all data
      if (db) {
        await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
      }

      const exists = await FileSystem.getInfoAsync(dbPath);
      if (!exists.exists) {
        Alert.alert('Error', 'Database file not found.');
        return;
      }
      
      // 2. Read DB Key from SecureStore
      const masterKey = await getDatabaseKey();
      
      // 3. Read DB file as Base64
      const dbBase64 = await FileSystem.readAsStringAsync(dbPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4 & 5. Create payload and encrypt
      const encrypted = createEncryptedBackupPayload(masterKey, dbBase64, password);

      // 6. Save to temp file
      const backupUri = `${FileSystem.cacheDirectory}credkeep_backup_${Date.now()}.ckb`;
      await FileSystem.writeAsStringAsync(backupUri, encrypted, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(backupUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Save CredKeep Backup',
      });
      
      setPassword('');
    } catch (e: any) {
      Alert.alert('Backup Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter the password to decrypt the backup.');
      return;
    }

    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        if (!file.name.endsWith('.ckb')) {
          Alert.alert('Warning', 'File does not appear to be a CredKeep Backup (.ckb). Restore anyway?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: () => performRestore(file.uri) }
          ]);
          return;
        }
        
        await performRestore(file.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const performRestore = async (uri: string) => {
    try {
      // 1. Read encrypted file
      const encrypted = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // 2 & 3. Decrypt and Parse JSON
      const payload = decryptBackupPayload(encrypted, password);

      // 4. Write to temp DB to verify integrity
      const tempDbName = `temp_restore_${Date.now()}.db`;
      const tempDbPath = `${FileSystem.documentDirectory}SQLite/${tempDbName}`;
      
      // Ensure SQLite dir exists
      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(tempDbPath, payload.dbBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      // 5. Verify Temp DB
      try {
        const testDb = await SQLite.openDatabaseAsync(tempDbName);
        await testDb.execAsync(`PRAGMA key = "x'${payload.key}'"; PRAGMA journal_mode = WAL;`);
        // Test query
        await testDb.getFirstAsync('SELECT count(*) FROM loans');
        await testDb.getFirstAsync('PRAGMA integrity_check');
        // If we reach here, it's valid
        // NOTE: expo-sqlite doesn't have an explicit close() in the standard API for SDK 50+, 
        // but it's fine, we will overwrite the main DB.
      } catch (e: any) {
        // Delete temp DB
        await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
        throw new Error('Backup integrity check failed. The file is corrupt or incompatible.');
      }

      // 6. It's valid. Swap DBs and set key
      // Close main DB? We can't explicitly close it, but overwriting works if we restart.
      await FileSystem.copyAsync({
        from: tempDbPath,
        to: dbPath,
      });
      await FileSystem.deleteAsync(tempDbPath, { idempotent: true });

      // Update SecureStore with the imported key
      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
        requireAuthentication: false,
      });

      setPassword('');
      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
const fs = require('fs');
const crypto = require('crypto');
const { initDatabase } = require('./src/core/database/db');
const { runMigrations } = require('./src/core/database/schema');
const { LoanRepository } = require('./src/core/database/loanRepository');
const { TransactionRepository } = require('./src/core/database/transactionRepository');
const { toPaise } = require('./src/core/domain/money');

async function main() {
  const dbPath = 'test-db.sqlite';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  
  // mock expo-sqlite
  const sqlite3 = require('sqlite3');
  // Wait, I can't easily mock expo-sqlite API here because expo-sqlite Next API is completely different from sqlite3.
  // I will write a test using Jest and run it through npm run test!
}
main();
/home/sagar/.nvm/versions/node/v24.21.0/bin/node
/home/sagar/.nvm/versions/node/v24.21.0/bin/npm
node_modules-present

web search: 
web search: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
codex
The startup and restore paths are available to inspect, but there’s no device error log or usable Android reproduction harness here. I’ll check the initialization behavior in isolation. Graphify is unavailable, so I’m using source files directly.

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat src/core/database/DatabaseProvider.tsx
sed -n '1,90p' src/core/database/schema.ts
rg -n 'allowBackup|backup_rules|data_extraction|closeAsync|defaultDatabaseDirectory' node_modules/expo-secure-store/plugin node_modules/expo-sqlite/src node_modules/@expo/config-types/build/ExpoConfig.d.ts
node <<'NODE'
const fs=require('fs'),ts=require('typescript'),vm=require('vm');
async function scenario(existing){
 let saved=null;
 const modules={
 'expo-secure-store':{getItemAsync:async()=>null,setItemAsync:async(_,key)=>{saved=key}},
 'expo-crypto':{getRandomBytes:()=>new Uint8Array(32).fill(7)},
 'expo-sqlite':{openDatabaseAsync:async()=>({execAsync:async()=>{if(existing)throw Error('file is not a database')},getFirstAsync:async()=>({value:1})})}
 };
 const sandbox={exports:{},require:n=>modules[n],Uint8Array};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/core/database/db.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
 try{await sandbox.exports.initDatabase();console.log('Fresh second-device state: initialized with new key =',"'!!saved)}catch(e){console.log('"'Restored encrypted file + missing key: startup failed =',e.message,'; replacement key persisted =',"'!!saved)}
}
(async()=>{await scenario(false);await scenario(true)})().catch(e=>{console.error(e.message);process.exitCode=1});
NODE' in /mnt/f/personal projects/credkeep
 succeeded in 596ms:
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
import { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    // 1. Borrowers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Loans table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY NOT NULL,
        borrower_id TEXT NOT NULL,
        principal_paise INTEGER NOT NULL,
        markup_factor REAL NOT NULL,
        term_months INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        product_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
      );
    `);

    // 3. Repayment Schedules
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS repayment_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        installment_number INTEGER NOT NULL,
        original_due_date TEXT NOT NULL,
        effective_due_date TEXT NOT NULL,
        principal_component_paise INTEGER NOT NULL,
        markup_component_paise INTEGER NOT NULL,
        total_due_paise INTEGER NOT NULL,
        principal_paid_paise INTEGER NOT NULL DEFAULT 0,
        markup_paid_paise INTEGER NOT NULL DEFAULT 0,
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
    `);

    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS prevent_transactions_delete
      BEFORE DELETE ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
      END;
    `);

node_modules/@expo/config-types/build/ExpoConfig.d.ts:572:    allowBackup?: boolean;
node_modules/expo-secure-store/plugin/src/withSecureStore.ts:11:const BACKUP_RULES_PATH = '@xml/secure_store_backup_rules';
node_modules/expo-secure-store/plugin/src/withSecureStore.ts:12:const EXTRACTION_RULES_PATH = '@xml/secure_store_data_extraction_rules';
node_modules/expo-secure-store/plugin/build/withSecureStore.js:5:const BACKUP_RULES_PATH = '@xml/secure_store_backup_rules';
node_modules/expo-secure-store/plugin/build/withSecureStore.js:6:const EXTRACTION_RULES_PATH = '@xml/secure_store_data_extraction_rules';
node_modules/expo-sqlite/src/NativeSession.ts:14:  public closeAsync(database: SQLiteAnyDatabase): Promise<void>;
node_modules/expo-sqlite/src/pathUtils.ts:9:  const resolvedDirectory = directory ?? ExpoSQLite.defaultDatabaseDirectory;
node_modules/expo-sqlite/src/pathUtils.ts:11:    throw new Error('Both provided directory and defaultDatabaseDirectory are null.');
node_modules/expo-sqlite/src/SQLiteSession.ts:40:  public closeAsync(): Promise<void> {
node_modules/expo-sqlite/src/SQLiteSession.ts:41:    return this.nativeSession.closeAsync(this.nativeDatabase);
node_modules/expo-sqlite/src/hooks.tsx:30:   * @default defaultDatabaseDirectory
node_modules/expo-sqlite/src/hooks.tsx:215:        await db?.closeAsync();
node_modules/expo-sqlite/src/hooks.tsx:269:        db.closeAsync();
node_modules/expo-sqlite/src/SQLiteDevToolsClient.ts:84:  await client?.closeAsync();
node_modules/expo-sqlite/src/SQLiteDatabase.ts:44:  public closeAsync(): Promise<void> {
node_modules/expo-sqlite/src/SQLiteDatabase.ts:48:    return this.nativeDatabase.closeAsync();
node_modules/expo-sqlite/src/SQLiteDatabase.ts:191:      await transaction.closeAsync();
node_modules/expo-sqlite/src/SQLiteDatabase.ts:559:export const defaultDatabaseDirectory = ExpoSQLite.defaultDatabaseDirectory;
node_modules/expo-sqlite/src/SQLiteDatabase.ts:574: * @param directory The directory where the database file is located. The default value is `defaultDatabaseDirectory`. This parameter is not supported on web.
node_modules/expo-sqlite/src/SQLiteDatabase.ts:603: * @param directory The directory where the database file is located. The default value is `defaultDatabaseDirectory`. This parameter is not supported on web.
node_modules/expo-sqlite/src/SQLiteDatabase.ts:671: * @param directory The directory where the database file is located. The default value is `defaultDatabaseDirectory`.
node_modules/expo-sqlite/src/SQLiteDatabase.ts:684: * @param directory The directory where the database file is located. The default value is `defaultDatabaseDirectory`.
node_modules/expo-sqlite/src/NativeDatabase.ts:14:  public closeAsync(): Promise<void>;
node_modules/expo-sqlite/src/Storage.ts:103:  async closeAsync(): Promise<void> {
node_modules/expo-sqlite/src/Storage.ts:107:        await this.db.closeAsync();
node_modules/expo-sqlite/src/Storage.ts:350:   * Alias for [`closeAsync()`](#closeasync-1) method.
node_modules/expo-sqlite/src/Storage.ts:353:    await this.closeAsync();
Fresh second-device state: initialized with new key = true
Restored encrypted file + missing key: startup failed = file is not a database ; replacement key persisted = true

exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
./node_modules/.bin/tsc --noEmit' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
./node_modules/.bin/eslint . --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
npm test -- --runInBand --no-cache' in /mnt/f/personal projects/credkeep
web search: 
web search: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
 exited 1 in 4992ms:

> credkeep@1.0.0 test
> jest --runInBand --no-cache

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
/bin/bash -lc "cat AGENTS.md >/dev/null
sed -n '145,200p' node_modules/expo-sqlite/src/SQLiteDatabase.ts
rg -n -A28 'class Transaction' node_modules/expo-sqlite/src/SQLiteDatabase.ts
rg -n 'error|loading' 'src/app/(tabs)/index.tsx'
sed -n '560,574p' node_modules/@expo/config-types/build/ExpoConfig.d.ts
cat node_modules/expo-secure-store/android/src/main/AndroidManifest.xml
rg --files node_modules/expo-secure-store/android | rg 'backup|extraction'
 git log -3 --oneline" in /mnt/f/personal projects/credkeep
 succeeded in 337ms:
    } catch (e) {
      await this.execAsync('ROLLBACK');
      throw e;
    }
  }

  /**
   * Execute a transaction and automatically commit/rollback based on the `task` result.
   *
   * The transaction may be exclusive.
   * As long as the transaction is converted into a write transaction,
   * the other async write queries will abort with `database is locked` error.
   *
   * > **Note:** This function is not supported on web.
   *
   * @param task An async function to execute within a transaction. Any queries inside the transaction must be executed on the `txn` object.
   * The `txn` object has the same interfaces as the [`SQLiteDatabase`](#sqlitedatabase) object. You can use `txn` like a [`SQLiteDatabase`](#sqlitedatabase) object.
   *
   * @platform android
   * @platform ios
   * @platform macos
   * @platform tvos
   *
   * @example
   * ```ts
   * db.withExclusiveTransactionAsync(async (txn) => {
   *   await txn.execAsync('UPDATE test SET name = "aaa"');
   * });
   * ```
   */
  public async withExclusiveTransactionAsync(
    task: (txn: Transaction) => Promise<void>
  ): Promise<void> {
    if (Platform.OS === 'web') {
      throw new Error('withExclusiveTransactionAsync is not supported on web');
    }
    const transaction = await Transaction.createAsync(this);
    let error;
    try {
      await transaction.execAsync('BEGIN');
      await task(transaction);
      await transaction.execAsync('COMMIT');
    } catch (e) {
      await transaction.execAsync('ROLLBACK');
      error = e;
    } finally {
      await transaction.closeAsync();
    }
    if (error) {
      throw error;
    }
  }

  /**
   * Synchronous call to return whether the database is currently in a transaction.
   */
787:class Transaction extends SQLiteDatabase {
788-  public static async createAsync(db: SQLiteDatabase): Promise<Transaction> {
789-    const options = { ...db.options, useNewConnection: true };
790-    const nativeDatabase = new ExpoSQLite.NativeDatabase(
791-      db.databasePath,
792-      flattenOpenOptions(options)
793-    );
794-    await nativeDatabase.initAsync();
795-    return new Transaction(db.databasePath, options, nativeDatabase);
796-  }
797-}
13:  const { error, loans, transactions, refreshVersion } = useDatabase();
88:              <Typography variant="headlineSm" color={theme.colors.error}>{formatINR(overdue)}</Typography>
93:        {error && (
94:          <View style={styles.errorCard}>
95:            <Typography variant="headlineSm" color={theme.colors.error}>Database Error</Typography>
96:            <Typography variant="bodyMd" color={theme.colors.error}>{error.message}</Typography>
165:  errorCard: { backgroundColor: theme.colors.errorContainer, padding: theme.spacing.md, margin: theme.spacing.md, borderRadius: 8 },
    intentFilters?: {
        /**
         * You may also use an intent filter to set your app as the default handler for links (without showing the user a dialog with options). To do so use `true` and then configure your server to serve a JSON file verifying that you own the domain. [Learn more](https://developer.android.com/training/app-links)
         */
        autoVerify?: boolean;
        action: string;
        data?: AndroidIntentFiltersData | AndroidIntentFiltersData[];
        category?: string | string[];
    }[];
    /**
     * Allows your user's app data to be automatically backed up to their Google Drive. If this is set to false, no backup or restore of the application will ever be performed (this is useful if your app deals with sensitive information). Defaults to the Android default, which is `true`.
     */
    allowBackup?: boolean;
    /**
     * Determines how the software keyboard will impact the layout of your application. This maps to the `android:windowSoftInputMode` property. Defaults to `resize`. Valid values: `resize`, `pan`.
<manifest>
</manifest>
node_modules/expo-secure-store/android/src/main/res/xml/secure_store_backup_rules.xml
node_modules/expo-secure-store/android/src/main/res/xml/secure_store_data_extraction_rules.xml
4242801 fix(ui): standardize SafeAreaView edges for Android system bars
d1fed6e feat(security): implement PIN/app lock with biometric integration
82c53f8 feat(ui): implement borrower profile and financial summary

 succeeded in 12635ms:
web search: 
web search: 'backup'
codex
What happened on the second phone: did Android refuse to install the APK, or did CredKeep install and then show a database error? Please include the exact error and whether Android transferred app data or you imported a backup.
exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat node_modules/expo-secure-store/android/src/main/res/xml/secure_store_backup_rules.xml node_modules/expo-secure-store/android/src/main/res/xml/secure_store_data_extraction_rules.xml
sed -n '1,115p' node_modules/expo-secure-store/plugin/src/withSecureStore.ts
rg -n 'withExclusiveTransactionAsync|PRAGMA key' src/core/database
nl -ba src/core/database/db.ts | head -65
nl -ba src/app/settings/backup.tsx | sed -n '135,218p'
rg -n 'SQLCipher|sqlcipher|key' node_modules/expo-sqlite/android/src/main/java/expo/modules/sqlite/SQLiteModule.kt | head -25" in /mnt/f/personal projects/credkeep
 succeeded in 176ms:
<?xml version="1.0" encoding="utf-8"?>

<!--  Auto Backup configuration for Android 11 and lower -->
<full-backup-content>
  <include domain="sharedpref" path="."/>
  <exclude domain="sharedpref" path="SecureStore"/>
</full-backup-content>
<?xml version="1.0" encoding="utf-8"?>

<!--  Auto Backup configuration for Android 12 and higher -->
<data-extraction-rules>
  <cloud-backup>
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
  </cloud-backup>
  <device-transfer>
    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
  </device-transfer>
</data-extraction-rules>
import {
  type ConfigPlugin,
  IOSConfig,
  createRunOncePlugin,
  withAndroidManifest,
  AndroidConfig,
} from 'expo/config-plugins';

const pkg = require('../../package.json');

const BACKUP_RULES_PATH = '@xml/secure_store_backup_rules';
const EXTRACTION_RULES_PATH = '@xml/secure_store_data_extraction_rules';
const FACEID_USAGE = 'Allow $(PRODUCT_NAME) to access your Face ID biometric data.';

export type Props = {
  /**
   * A string to set the `NSFaceIDUsageDescription` permission message.
   * @default "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
   * @platform ios
   */
  faceIDPermission?: string | false;
  /**
   * Whether to configure automatic Android backup to work correctly with expo-secure-store.
   * @default true
   * @platform android
   */
  configureAndroidBackup?: boolean;
};

const withSecureStore: ConfigPlugin<Props | void> = (
  config,
  { faceIDPermission, configureAndroidBackup = true } = {}
) => {
  IOSConfig.Permissions.createPermissionsPlugin({
    NSFaceIDUsageDescription: FACEID_USAGE,
  })(config, {
    NSFaceIDUsageDescription: faceIDPermission,
  });

  withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const backupConfig = mainApplication.$['android:fullBackupContent']; // SDK <= 30
    const dataExtractionRules = mainApplication.$['android:dataExtractionRules']; // SDK >= 31

    if (!configureAndroidBackup) {
      backupConfig === BACKUP_RULES_PATH && delete mainApplication.$['android:fullBackupContent'];
      dataExtractionRules === EXTRACTION_RULES_PATH &&
        delete mainApplication.$['android:dataExtractionRules'];
      return config;
    }

    const canApplyBackupConfig = !backupConfig || backupConfig === BACKUP_RULES_PATH;
    const canApplyDataExtractionRules =
      !dataExtractionRules || dataExtractionRules === EXTRACTION_RULES_PATH;

    if (canApplyBackupConfig && canApplyDataExtractionRules) {
      mainApplication.$['android:fullBackupContent'] = BACKUP_RULES_PATH;
      mainApplication.$['android:dataExtractionRules'] = EXTRACTION_RULES_PATH;
      return config;
    }

    console.warn(
      'Expo-secure-store tried to apply Android Auto Backup rules, but other backup rules are already present. ' +
        'Refer to the expo-secure-store docs (https://docs.expo.dev/versions/latest/sdk/securestore/) to configure your backup rules.'
    );
    return config;
  });
  return config;
};

export default createRunOncePlugin(withSecureStore, pkg.name, pkg.version);
src/core/database/loanRepository.test.ts:14:      withExclusiveTransactionAsync: jest.fn(async (cb) => {
src/core/database/db.ts:38:    PRAGMA key = "x'${key}'";
src/core/database/schema.ts:4:  await db.withExclusiveTransactionAsync(async (tx) => {
src/core/database/transactionRepository.ts:17:      await this.db.withExclusiveTransactionAsync(async (tx) => {
src/core/database/loanRepository.ts:30:    await this.db.withExclusiveTransactionAsync(async (tx) => {
     1	import * as SQLite from 'expo-sqlite';
     2	import * as SecureStore from 'expo-secure-store';
     3	import * as Crypto from 'expo-crypto';
     4	
     5	const DB_KEY_NAME = 'credkeep_db_master_key';
     6	const DB_NAME = 'credkeep.db';
     7	
     8	function bufferToHex(buffer: ArrayBuffer): string {
     9	  return Array.from(new Uint8Array(buffer))
    10	    .map(b => b.toString(16).padStart(2, '0'))
    11	    .join('');
    12	}
    13	
    14	export async function getDatabaseKey(): Promise<string> {
    15	  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
    16	  
    17	  if (!key) {
    18	    // Generate a 32-byte cryptographically secure random key
    19	    const randomBytes = Crypto.getRandomBytes(32);
    20	    key = bufferToHex(randomBytes.buffer as ArrayBuffer);
    21	    
    22	    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
    23	      requireAuthentication: false,
    24	    });
    25	  }
    26	  
    27	  return key;
    28	}
    29	
    30	export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    31	  const key = await getDatabaseKey();
    32	  
    33	  // Note: expo-sqlite SDK 50+ natively supports opening databases.
    34	  const db = await SQLite.openDatabaseAsync(DB_NAME);
    35	  
    36	  // PRAGMA configuration
    37	  await db.execAsync(`
    38	    PRAGMA key = "x'${key}'";
    39	    PRAGMA journal_mode = WAL;
    40	    PRAGMA synchronous = NORMAL;
    41	    PRAGMA foreign_keys = ON;
    42	  `);
    43	  
    44	  // Verify encryption by querying something
    45	  await db.getFirstAsync('SELECT 1');
    46	  
    47	  return db;
    48	}
   135	      }
   136	
   137	      await FileSystem.writeAsStringAsync(tempDbPath, payload.dbBase64, {
   138	        encoding: FileSystem.EncodingType.Base64
   139	      });
   140	
   141	      // 5. Verify Temp DB
   142	      try {
   143	        const testDb = await SQLite.openDatabaseAsync(tempDbName);
   144	        await testDb.execAsync(`PRAGMA key = "x'${payload.key}'"; PRAGMA journal_mode = WAL;`);
   145	        // Test query
   146	        await testDb.getFirstAsync('SELECT count(*) FROM loans');
   147	        await testDb.getFirstAsync('PRAGMA integrity_check');
   148	        // If we reach here, it's valid
   149	        // NOTE: expo-sqlite doesn't have an explicit close() in the standard API for SDK 50+, 
   150	        // but it's fine, we will overwrite the main DB.
   151	      } catch (e: any) {
   152	        // Delete temp DB
   153	        await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
   154	        throw new Error('Backup integrity check failed. The file is corrupt or incompatible.');
   155	      }
   156	
   157	      // 6. It's valid. Swap DBs and set key
   158	      // Close main DB? We can't explicitly close it, but overwriting works if we restart.
   159	      await FileSystem.copyAsync({
   160	        from: tempDbPath,
   161	        to: dbPath,
   162	      });
   163	      await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
   164	
   165	      // Update SecureStore with the imported key
   166	      await SecureStore.setItemAsync('credkeep_db_master_key', payload.key, {
   167	        requireAuthentication: false,
   168	      });
   169	
   170	      setPassword('');
   171	      Alert.alert('Success', 'Database restored successfully. Please force-close and restart the app immediately to apply changes.');
   172	    } catch (e: any) {
   173	      Alert.alert('Restore Failed', e.message);
   174	    }
   175	  };
   176	
   177	  return (
   178	    <SafeAreaView style={styles.safeArea}>
   179	      <ScrollView style={styles.container}>
   180	        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
   181	          Backup & Restore
   182	        </Typography>
   183	        
   184	        <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant} style={styles.description}>
   185	          Export your SQLite database securely. The backup will be encrypted with the password you provide. 
   186	          To restore on a new device, you must enter the exact same password.
   187	        </Typography>
   188	
   189	        <Input 
   190	          label="Encryption Password" 
   191	          value={password}
   192	          onChangeText={setPassword}
   193	          secureTextEntry
   194	          placeholder="Enter a strong password"
   195	          editable={false}
   196	        />
   197	
   198	        <View style={styles.actions}>
   199	          <Typography variant="bodySm" color={theme.colors.error} style={{ marginBottom: 16 }}>
   200	            Note: Portable backup is currently disabled pending a cryptographic security audit for AES key derivation and integrity protection.
   201	          </Typography>
   202	          <Button 
   203	            title="Export Secure Backup (.ckb)" 
   204	            onPress={handleBackup} 
   205	            disabled={true}
   206	          />
   207	          <View style={{ height: 20 }} />
   208	          <Button 
   209	            variant="outline" 
   210	            title="Restore from Backup (.ckb)" 
   211	            onPress={handleRestore}
   212	            disabled={true}
   213	          />
   214	        </View>
   215	
   216	        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />}
   217	      </ScrollView>
   218	    </SafeAreaView>
397:      for ((key, param) in bindParams) {
398:        val index = getBindParamIndex(statement, key, shouldPassAsArray)
411:      for ((key, param) in bindBlobParams) {
412:        val index = getBindParamIndex(statement, key, shouldPassAsArray)
581:  private fun getBindParamIndex(statement: NativeStatement, key: String, shouldPassAsArray: Boolean): Int =
583:      (key.toIntOrNull() ?: throw InvalidBindParameterException()) + 1
585:      statement.ref.sqlite3_bind_parameter_index(key)

web search: 
web search: https://docs.expo.dev/versions/latest/config/app.md
codex
The isolated check confirms that startup saves a new key whenever SecureStore has none, without checking for an existing database. It does not confirm that Android transferred a database on the affected phone.

Restore is also disabled in the UI. Its dormant implementation copies over an open database and ignores the integrity-check result, so enabling that button alone would be unsafe. I’ll make the plan cover both fresh installation and verified recovery.

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
node <<'NODE'
const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let writes=0;
const dependencies={
'expo-secure-store':{getItemAsync:async()=>null,setItemAsync:async()=>{writes++}},
'expo-crypto':{getRandomBytes:()=>new Uint8Array(32).fill(7)},
'expo-sqlite':{openDatabaseAsync:async()=>({execAsync:async()=>{throw Error('fixture: existing encrypted database rejects unrelated key')},getFirstAsync:async()=>null})}
};
const context={exports:{},require:n=>dependencies[n],Uint8Array};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/core/database/db.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
(async()=>{
try{await context.exports.initDatabase()}catch{}
try{assert.equal(writes,0,'Existing encrypted database without key must not persist a replacement key');console.log('PASS')}catch(e){console.log('FAIL:',e.message);console.log('Expected key writes: 0; actual:',writes);process.exitCode=1}
})();
NODE" in /mnt/f/personal projects/credkeep
 exited 1 in 484ms:
FAIL: Existing encrypted database without key must not persist a replacement key

1 !== 0

Expected key writes: 0; actual: 1

exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
cat eslint.config.js
./node_modules/.bin/eslint src --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "cat AGENTS.md >/dev/null
rg -n 'include.*exclude|exclude.*include' node_modules/expo-secure-store/plugin/src/withSecureStore.ts
rg -n 'runMigrations|initDatabase|decryptBackupPayload' src --glob '*test*'
 git diff --stat -- src/core/database src/app/settings/backup.tsx app.json" in /mnt/f/personal projects/credkeep
 succeeded in 390ms:
src/core/domain/backupUtil.test.ts:1:import { createEncryptedBackupPayload, decryptBackupPayload } from './backupUtil';
src/core/domain/backupUtil.test.ts:15:    const restored = decryptBackupPayload(encrypted, password);
src/core/domain/backupUtil.test.ts:28:      decryptBackupPayload(encrypted, 'wrong_password');
src/core/domain/backupUtil.test.ts:38:      decryptBackupPayload(encrypted, 'password');

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
ps -eo pid,etime,pcpu,args | rg 'eslint|jest|tsc'" in /mnt/f/personal projects/credkeep
 succeeded in 20ms:
      1       00:00 33.3 codex-linux-sandbox --sandbox-policy-cwd /mnt/f/personal projects/credkeep --command-cwd /mnt/f/personal projects/credkeep --permission-profile {"type":"managed","file_system":{"type":"restricted","entries":[{"path":{"type":"special","value":{"kind":"root"}},"access":"read"}]},"network":"restricted"} --apply-seccomp-then-exec -- /bin/bash -c __CODEX_SNAPSHOT_OVERRIDE_SET_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" __CODEX_SNAPSHOT_OVERRIDE_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" __CODEX_SNAPSHOT_OVERRIDE_SET_1="${CODEX_PERMISSION_PROFILE+x}" __CODEX_SNAPSHOT_OVERRIDE_1="${CODEX_PERMISSION_PROFILE-}" __CODEX_SNAPSHOT_OVERRIDE_SET_2="${CODEX_PLUGIN_METRICS_OUTPUT+x}" __CODEX_SNAPSHOT_OVERRIDE_2="${CODEX_PLUGIN_METRICS_OUTPUT-}" __CODEX_SNAPSHOT_OVERRIDE_SET_3="${CODEX_SESSION_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_3="${CODEX_SESSION_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_4="${CODEX_THREAD_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_4="${CODEX_THREAD_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_5="${CODEX_VERSION+x}" __CODEX_SNAPSHOT_OVERRIDE_5="${CODEX_VERSION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0="${ALL_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_0="${ALL_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1="${BUNDLE_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_1="${BUNDLE_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2="${BUNDLE_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_2="${BUNDLE_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3="${BUNDLE_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_3="${BUNDLE_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4="${BUNDLE_SSL_CA_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_4="${BUNDLE_SSL_CA_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5="${CARGO_HTTP_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_5="${CARGO_HTTP_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6="${CODEX_CA_CERTIFICATE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_6="${CODEX_CA_CERTIFICATE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8="${CODEX_NETWORK_PROXY_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_8="${CODEX_NETWORK_PROXY_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9="${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_9="${CODEX_NETWORK_PROXY_ATTRIBUTION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12="${CURL_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_12="${CURL_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13="${DOCKER_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_13="${DOCKER_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14="${DOCKER_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_14="${DOCKER_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15="${ELECTRON_GET_USE_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_15="${ELECTRON_GET_USE_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16="${FTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_16="${FTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17="${GIT_SSL_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_17="${GIT_SSL_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18="${HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_18="${HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19="${HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_19="${HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20="${NODE_EXTRA_CA_CERTS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_20="${NODE_EXTRA_CA_CERTS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21="${NODE_USE_ENV_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_21="${NODE_USE_ENV_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22="${NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_22="${NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23="${NPM_CONFIG_CAFILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_23="${NPM_CONFIG_CAFILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24="${NPM_CONFIG_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_24="${NPM_CONFIG_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25="${NPM_CONFIG_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_25="${NPM_CONFIG_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26="${NPM_CONFIG_NOPROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_26="${NPM_CONFIG_NOPROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27="${NPM_CONFIG_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_27="${NPM_CONFIG_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28="${PIP_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_28="${PIP_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29="${PIP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_29="${PIP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30="${REQUESTS_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_30="${REQUESTS_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31="${SSL_CERT_FILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_31="${SSL_CERT_FILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32="${WSS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_32="${WSS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33="${WS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_33="${WS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34="${YARN_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_34="${YARN_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35="${YARN_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_35="${YARN_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36="${YARN_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_36="${YARN_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37="${all_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_37="${all_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38="${ftp_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_38="${ftp_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39="${http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_39="${http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40="${https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_40="${https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41="${no_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_41="${no_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42="${npm_config_cafile+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_42="${npm_config_cafile-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43="${npm_config_http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_43="${npm_config_http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44="${npm_config_https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_44="${npm_config_https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45="${npm_config_noproxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_45="${npm_config_noproxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46="${npm_config_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_46="${npm_config_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47="${ws_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_47="${ws_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48="${wss_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_48="${wss_proxy-}" __CODEX_SNAPSHOT_PROXY_ENV_SET="${CODEX_NETWORK_PROXY_ACTIVE+x}"  if . '/home/sagar/.codex/shell_snapshots/01a12443-10ab-7d11-9d08-38f89898fc1f.1791609738563842981.sh' >/dev/null 2>&1; then :; fi  if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_0}" ]; then   if [ -z "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" ] || [ "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" != "${__CODEX_SNAPSHOT_OVERRIDE_0}" ]; then export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS="${__CODEX_SNAPSHOT_OVERRIDE_0}"; else export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi else builtin unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS 2>/dev/null || command unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_1}" ]; then   if [ -z "${CODEX_PERMISSION_PROFILE+x}" ] || [ "${CODEX_PERMISSION_PROFILE-}" != "${__CODEX_SNAPSHOT_OVERRIDE_1}" ]; then export CODEX_PERMISSION_PROFILE="${__CODEX_SNAPSHOT_OVERRIDE_1}"; else export CODEX_PERMISSION_PROFILE; fi else builtin unset CODEX_PERMISSION_PROFILE 2>/dev/null || command unset CODEX_PERMISSION_PROFILE; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_2}" ]; then   if [ -z "${CODEX_PLUGIN_METRICS_OUTPUT+x}" ] || [ "${CODEX_PLUGIN_METRICS_OUTPUT-}" != "${__CODEX_SNAPSHOT_OVERRIDE_2}" ]; then export CODEX_PLUGIN_METRICS_OUTPUT="${__CODEX_SNAPSHOT_OVERRIDE_2}"; else export CODEX_PLUGIN_METRICS_OUTPUT; fi else builtin unset CODEX_PLUGIN_METRICS_OUTPUT 2>/dev/null || command unset CODEX_PLUGIN_METRICS_OUTPUT; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_3}" ]; then   if [ -z "${CODEX_SESSION_ID+x}" ] || [ "${CODEX_SESSION_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_3}" ]; then export CODEX_SESSION_ID="${__CODEX_SNAPSHOT_OVERRIDE_3}"; else export CODEX_SESSION_ID; fi else builtin unset CODEX_SESSION_ID 2>/dev/null || command unset CODEX_SESSION_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_4}" ]; then   if [ -z "${CODEX_THREAD_ID+x}" ] || [ "${CODEX_THREAD_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_4}" ]; then export CODEX_THREAD_ID="${__CODEX_SNAPSHOT_OVERRIDE_4}"; else export CODEX_THREAD_ID; fi else builtin unset CODEX_THREAD_ID 2>/dev/null || command unset CODEX_THREAD_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_5}" ]; then   if [ -z "${CODEX_VERSION+x}" ] || [ "${CODEX_VERSION-}" != "${__CODEX_SNAPSHOT_OVERRIDE_5}" ]; then export CODEX_VERSION="${__CODEX_SNAPSHOT_OVERRIDE_5}"; else export CODEX_VERSION; fi else builtin unset CODEX_VERSION 2>/dev/null || command unset CODEX_VERSION; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 if [ -n "$__CODEX_SNAPSHOT_PROXY_ENV_SET" ] || [ -n "${CODEX_NETWORK_PROXY_ACTIVE+x}" ]; then if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0}" ]; then   if [ -z "${ALL_PROXY+x}" ] || [ "${ALL_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}" ]; then export ALL_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}"; else export ALL_PROXY; fi else builtin unset ALL_PROXY 2>/dev/null || command unset ALL_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1}" ]; then   if [ -z "${BUNDLE_HTTPS_PROXY+x}" ] || [ "${BUNDLE_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}" ]; then export BUNDLE_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}"; else export BUNDLE_HTTPS_PROXY; fi else builtin unset BUNDLE_HTTPS_PROXY 2>/dev/null || command unset BUNDLE_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2}" ]; then   if [ -z "${BUNDLE_HTTP_PROXY+x}" ] || [ "${BUNDLE_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}" ]; then export BUNDLE_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}"; else export BUNDLE_HTTP_PROXY; fi else builtin unset BUNDLE_HTTP_PROXY 2>/dev/null || command unset BUNDLE_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3}" ]; then   if [ -z "${BUNDLE_NO_PROXY+x}" ] || [ "${BUNDLE_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}" ]; then export BUNDLE_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}"; else export BUNDLE_NO_PROXY; fi else builtin unset BUNDLE_NO_PROXY 2>/dev/null || command unset BUNDLE_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4}" ]; then   if [ -z "${BUNDLE_SSL_CA_CERT+x}" ] || [ "${BUNDLE_SSL_CA_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}" ]; then export BUNDLE_SSL_CA_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}"; else export BUNDLE_SSL_CA_CERT; fi else builtin unset BUNDLE_SSL_CA_CERT 2>/dev/null || command unset BUNDLE_SSL_CA_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5}" ]; then   if [ -z "${CARGO_HTTP_CAINFO+x}" ] || [ "${CARGO_HTTP_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}" ]; then export CARGO_HTTP_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}"; else export CARGO_HTTP_CAINFO; fi else builtin unset CARGO_HTTP_CAINFO 2>/dev/null || command unset CARGO_HTTP_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6}" ]; then   if [ -z "${CODEX_CA_CERTIFICATE+x}" ] || [ "${CODEX_CA_CERTIFICATE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}" ]; then export CODEX_CA_CERTIFICATE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}"; else export CODEX_CA_CERTIFICATE; fi else builtin unset CODEX_CA_CERTIFICATE 2>/dev/null || command unset CODEX_CA_CERTIFICATE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7}" ]; then   if [ -z "${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" ] || [ "${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}" ]; then export CODEX_NETWORK_ALLOW_LOCAL_BINDING="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}"; else export CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi else builtin unset CODEX_NETWORK_ALLOW_LOCAL_BINDING 2>/dev/null || command unset CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}" ]; then export CODEX_NETWORK_PROXY_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}"; else export CODEX_NETWORK_PROXY_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" ] || [ "${CODEX_NETWORK_PROXY_ATTRIBUTION-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}" ]; then export CODEX_NETWORK_PROXY_ATTRIBUTION="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}"; else export CODEX_NETWORK_PROXY_ATTRIBUTION; fi else builtin unset CODEX_NETWORK_PROXY_ATTRIBUTION 2>/dev/null || command unset CODEX_NETWORK_PROXY_ATTRIBUTION; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" ] || [ "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}" ]; then export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}"; else export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi else builtin unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS 2>/dev/null || command unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}" ]; then export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}"; else export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12}" ]; then   if [ -z "${CURL_CA_BUNDLE+x}" ] || [ "${CURL_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}" ]; then export CURL_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}"; else export CURL_CA_BUNDLE; fi else builtin unset CURL_CA_BUNDLE 2>/dev/null || command unset CURL_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13}" ]; then   if [ -z "${DOCKER_HTTPS_PROXY+x}" ] || [ "${DOCKER_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}" ]; then export DOCKER_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}"; else export DOCKER_HTTPS_PROXY; fi else builtin unset DOCKER_HTTPS_PROXY 2>/dev/null || command unset DOCKER_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14}" ]; then   if [ -z "${DOCKER_HTTP_PROXY+x}" ] || [ "${DOCKER_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}" ]; then export DOCKER_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}"; else export DOCKER_HTTP_PROXY; fi else builtin unset DOCKER_HTTP_PROXY 2>/dev/null || command unset DOCKER_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15}" ]; then   if [ -z "${ELECTRON_GET_USE_PROXY+x}" ] || [ "${ELECTRON_GET_USE_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}" ]; then export ELECTRON_GET_USE_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}"; else export ELECTRON_GET_USE_PROXY; fi else builtin unset ELECTRON_GET_USE_PROXY 2>/dev/null || command unset ELECTRON_GET_USE_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16}" ]; then   if [ -z "${FTP_PROXY+x}" ] || [ "${FTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}" ]; then export FTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}"; else export FTP_PROXY; fi else builtin unset FTP_PROXY 2>/dev/null || command unset FTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17}" ]; then   if [ -z "${GIT_SSL_CAINFO+x}" ] || [ "${GIT_SSL_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}" ]; then export GIT_SSL_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}"; else export GIT_SSL_CAINFO; fi else builtin unset GIT_SSL_CAINFO 2>/dev/null || command unset GIT_SSL_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18}" ]; then   if [ -z "${HTTPS_PROXY+x}" ] || [ "${HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}" ]; then export HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}"; else export HTTPS_PROXY; fi else builtin unset HTTPS_PROXY 2>/dev/null || command unset HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19}" ]; then   if [ -z "${HTTP_PROXY+x}" ] || [ "${HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}" ]; then export HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}"; else export HTTP_PROXY; fi else builtin unset HTTP_PROXY 2>/dev/null || command unset HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20}" ]; then   if [ -z "${NODE_EXTRA_CA_CERTS+x}" ] || [ "${NODE_EXTRA_CA_CERTS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}" ]; then export NODE_EXTRA_CA_CERTS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}"; else export NODE_EXTRA_CA_CERTS; fi else builtin unset NODE_EXTRA_CA_CERTS 2>/dev/null || command unset NODE_EXTRA_CA_CERTS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21}" ]; then   if [ -z "${NODE_USE_ENV_PROXY+x}" ] || [ "${NODE_USE_ENV_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}" ]; then export NODE_USE_ENV_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}"; else export NODE_USE_ENV_PROXY; fi else builtin unset NODE_USE_ENV_PROXY 2>/dev/null || command unset NODE_USE_ENV_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22}" ]; then   if [ -z "${NO_PROXY+x}" ] || [ "${NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}" ]; then export NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}"; else export NO_PROXY; fi else builtin unset NO_PROXY 2>/dev/null || command unset NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23}" ]; then   if [ -z "${NPM_CONFIG_CAFILE+x}" ] || [ "${NPM_CONFIG_CAFILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}" ]; then export NPM_CONFIG_CAFILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}"; else export NPM_CONFIG_CAFILE; fi else builtin unset NPM_CONFIG_CAFILE 2>/dev/null || command unset NPM_CONFIG_CAFILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24}" ]; then   if [ -z "${NPM_CONFIG_HTTPS_PROXY+x}" ] || [ "${NPM_CONFIG_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}" ]; then export NPM_CONFIG_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}"; else export NPM_CONFIG_HTTPS_PROXY; fi else builtin unset NPM_CONFIG_HTTPS_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25}" ]; then   if [ -z "${NPM_CONFIG_HTTP_PROXY+x}" ] || [ "${NPM_CONFIG_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}" ]; then export NPM_CONFIG_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}"; else export NPM_CONFIG_HTTP_PROXY; fi else builtin unset NPM_CONFIG_HTTP_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26}" ]; then   if [ -z "${NPM_CONFIG_NOPROXY+x}" ] || [ "${NPM_CONFIG_NOPROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}" ]; then export NPM_CONFIG_NOPROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}"; else export NPM_CONFIG_NOPROXY; fi else builtin unset NPM_CONFIG_NOPROXY 2>/dev/null || command unset NPM_CONFIG_NOPROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27}" ]; then   if [ -z "${NPM_CONFIG_PROXY+x}" ] || [ "${NPM_CONFIG_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}" ]; then export NPM_CONFIG_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}"; else export NPM_CONFIG_PROXY; fi else builtin unset NPM_CONFIG_PROXY 2>/dev/null || command unset NPM_CONFIG_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28}" ]; then   if [ -z "${PIP_CERT+x}" ] || [ "${PIP_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}" ]; then export PIP_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}"; else export PIP_CERT; fi else builtin unset PIP_CERT 2>/dev/null || command unset PIP_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29}" ]; then   if [ -z "${PIP_PROXY+x}" ] || [ "${PIP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}" ]; then export PIP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}"; else export PIP_PROXY; fi else builtin unset PIP_PROXY 2>/dev/null || command unset PIP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30}" ]; then   if [ -z "${REQUESTS_CA_BUNDLE+x}" ] || [ "${REQUESTS_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}" ]; then export REQUESTS_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}"; else export REQUESTS_CA_BUNDLE; fi else builtin unset REQUESTS_CA_BUNDLE 2>/dev/null || command unset REQUESTS_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31}" ]; then   if [ -z "${SSL_CERT_FILE+x}" ] || [ "${SSL_CERT_FILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}" ]; then export SSL_CERT_FILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}"; else export SSL_CERT_FILE; fi else builtin unset SSL_CERT_FILE 2>/dev/null || command unset SSL_CERT_FILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32}" ]; then   if [ -z "${WSS_PROXY+x}" ] || [ "${WSS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}" ]; then export WSS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}"; else export WSS_PROXY; fi else builtin unset WSS_PROXY 2>/dev/null || command unset WSS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33}" ]; then   if [ -z "${WS_PROXY+x}" ] || [ "${WS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}" ]; then export WS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}"; else export WS_PROXY; fi else builtin unset WS_PROXY 2>/dev/null || command unset WS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34}" ]; then   if [ -z "${YARN_HTTPS_PROXY+x}" ] || [ "${YARN_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}" ]; then export YARN_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}"; else export YARN_HTTPS_PROXY; fi else builtin unset YARN_HTTPS_PROXY 2>/dev/null || command unset YARN_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35}" ]; then   if [ -z "${YARN_HTTP_PROXY+x}" ] || [ "${YARN_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}" ]; then export YARN_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}"; else export YARN_HTTP_PROXY; fi else builtin unset YARN_HTTP_PROXY 2>/dev/null || command unset YARN_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36}" ]; then   if [ -z "${YARN_NO_PROXY+x}" ] || [ "${YARN_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}" ]; then export YARN_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}"; else export YARN_NO_PROXY; fi else builtin unset YARN_NO_PROXY 2>/dev/null || command unset YARN_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37}" ]; then   if [ -z "${all_proxy+x}" ] || [ "${all_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}" ]; then export all_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}"; else export all_proxy; fi else builtin unset all_proxy 2>/dev/null || command unset all_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38}" ]; then   if [ -z "${ftp_proxy+x}" ] || [ "${ftp_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}" ]; then export ftp_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}"; else export ftp_proxy; fi else builtin unset ftp_proxy 2>/dev/null || command unset ftp_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39}" ]; then   if [ -z "${http_proxy+x}" ] || [ "${http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}" ]; then export http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}"; else export http_proxy; fi else builtin unset http_proxy 2>/dev/null || command unset http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40}" ]; then   if [ -z "${https_proxy+x}" ] || [ "${https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}" ]; then export https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}"; else export https_proxy; fi else builtin unset https_proxy 2>/dev/null || command unset https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41}" ]; then   if [ -z "${no_proxy+x}" ] || [ "${no_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}" ]; then export no_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}"; else export no_proxy; fi else builtin unset no_proxy 2>/dev/null || command unset no_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42}" ]; then   if [ -z "${npm_config_cafile+x}" ] || [ "${npm_config_cafile-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}" ]; then export npm_config_cafile="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}"; else export npm_config_cafile; fi else builtin unset npm_config_cafile 2>/dev/null || command unset npm_config_cafile; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43}" ]; then   if [ -z "${npm_config_http_proxy+x}" ] || [ "${npm_config_http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}" ]; then export npm_config_http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}"; else export npm_config_http_proxy; fi else builtin unset npm_config_http_proxy 2>/dev/null || command unset npm_config_http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44}" ]; then   if [ -z "${npm_config_https_proxy+x}" ] || [ "${npm_config_https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}" ]; then export npm_config_https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}"; else export npm_config_https_proxy; fi else builtin unset npm_config_https_proxy 2>/dev/null || command unset npm_config_https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45}" ]; then   if [ -z "${npm_config_noproxy+x}" ] || [ "${npm_config_noproxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}" ]; then export npm_config_noproxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}"; else export npm_config_noproxy; fi else builtin unset npm_config_noproxy 2>/dev/null || command unset npm_config_noproxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46}" ]; then   if [ -z "${npm_config_proxy+x}" ] || [ "${npm_config_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}" ]; then export npm_config_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}"; else export npm_config_proxy; fi else builtin unset npm_config_proxy 2>/dev/null || command unset npm_config_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47}" ]; then   if [ -z "${ws_proxy+x}" ] || [ "${ws_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}" ]; then export ws_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}"; else export ws_proxy; fi else builtin unset ws_proxy 2>/dev/null || command unset ws_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48}" ]; then   if [ -z "${wss_proxy+x}" ] || [ "${wss_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}" ]; then export wss_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}"; else export wss_proxy; fi else builtin unset wss_proxy 2>/dev/null || command unset wss_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 fi if [ -n "${PATH:-}" ]; then export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path':"$PATH"; else export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path'; fi  exec '/bin/bash' -c 'cat AGENTS.md >/dev/null ps -eo pid,etime,pcpu,args | rg '"'"'eslint|jest|tsc'"'"''
      2       00:00  0.0 /bin/bash -c cat AGENTS.md >/dev/null ps -eo pid,etime,pcpu,args | rg 'eslint|jest|tsc'
      5       00:00  0.0 rg eslint|jest|tsc

codex
The fix plan will preserve any existing encrypted database, add a recovery path that works before startup succeeds, and restore the database and key as a recoverable pair.

TypeScript passed. Jest could not start because this read-only sandbox prevents creation of its temporary directory; lint has not returned a result yet. I also can’t save the plan or create a local commit in this session.

 exited 2 in 116357ms:

Oops! Something went wrong! :(

ESLint: 9.39.5

Error: Cannot find native binding. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
Occurred while linting /mnt/f/personal projects/credkeep/src/app/settings/backup.tsx:1
Rule: "import/namespace"
    at Object.<anonymous> (/mnt/f/personal projects/credkeep/node_modules/unrs-resolver/index.js:571:11)
    at Module._compile (node:internal/modules/cjs/loader:1929:14)
    at Object..js (node:internal/modules/cjs/loader:2060:10)
    at Module.load (node:internal/modules/cjs/loader:1651:32)
    at Module._load (node:internal/modules/cjs/loader:1443:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
    at Module.require (node:internal/modules/cjs/loader:1674:12)
    at require (node:internal/modules/helpers:157:16)
    at Object.<anonymous> (/mnt/f/personal projects/credkeep/node_modules/eslint-import-resolver-typescript/lib/index.cjs:12:20)
    at Module._compile (node:internal/modules/cjs/loader:1929:14)
    at Object..js (node:internal/modules/cjs/loader:2060:10)
    at Module.load (node:internal/modules/cjs/loader:1651:32)
    at Module._load (node:internal/modules/cjs/loader:1443:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
    at Module.require (node:internal/modules/cjs/loader:1674:12)
    at require (node:internal/modules/helpers:157:16)
    at tryRequire (/mnt/f/personal projects/credkeep/node_modules/eslint-module-utils/resolve.js:66:10)
    at requireResolver (/mnt/f/personal projects/credkeep/node_modules/eslint-module-utils/resolve.js:101:20)
    at fullResolve (/mnt/f/personal projects/credkeep/node_modules/eslint-module-utils/resolve.js:203:22)
    at resolve.relative (/mnt/f/personal projects/credkeep/node_modules/eslint-module-utils/resolve.js:220:10)
    at RemotePath.resolve (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/remotePath.js:10:37)
    at captureDependency (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/captureDependency.js:35:362)
    at captureDependencyWithSpecifiers (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/captureDependency.js:59:3)
    at ImportExportVisitorBuilder.ImportDeclaration (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/visitor.js:67:70)
    at /mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/builder.js:193:35
    at Array.forEach (<anonymous>)
    at ExportMapBuilder.parse (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/builder.js:189:18)
    at ExportMapBuilder._for (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/builder.js:84:38)
    at /mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/builder.js:32:53
    at /mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/index.js:178:158
    at Set.forEach (<anonymous>)
    at ExportMap.get (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/exportMap/index.js:178:126)
    at /mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/rules/namespace.js:23:22
    at Array.forEach (<anonymous>)
    at processBodyStatement (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/rules/namespace.js:20:26)
    at /mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/rules/namespace.js:85:40
    at Array.forEach (<anonymous>)
    at Program (/mnt/f/personal projects/credkeep/node_modules/eslint-plugin-import/lib/rules/namespace.js:85:18)
    at ruleErrorHandler (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:1173:33)
    at /mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/source-code-visitor.js:76:46
    at Array.forEach (<anonymous>)
    at SourceCodeVisitor.callSync (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/source-code-visitor.js:76:30)
    at /mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/source-code-traverser.js:291:18
    at Array.forEach (<anonymous>)
    at SourceCodeTraverser.traverseSync (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/source-code-traverser.js:290:10)
    at runRules (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:1214:12)
    at #flatVerifyWithoutProcessors (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:2115:4)
    at Linter._verifyWithFlatConfigArrayAndWithoutProcessors (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:2203:43)
    at Linter._verifyWithFlatConfigArray (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:2306:15)
    at Linter.verify (/mnt/f/personal projects/credkeep/node_modules/eslint/lib/linter/linter.js:1677:10)

codex
I found database lifecycle defects, but **the affected phone’s root cause remains unconfirmed** without its exact error.

- [Initialization](/mnt/f/personal%20projects/credkeep/src/core/database/db.ts:14) generates and saves a new key whenever SecureStore is empty—even if an encrypted database already exists. An isolated harness confirmed this behavior; native decryption was simulated.
- [Backup and restore](/mnt/f/personal%20projects/credkeep/src/app/settings/backup.tsx:198) are disabled. The dormant restore code overwrites an open database, ignores the integrity-check result, and updates the key afterward.
- Device-bound SecureStore data cannot provide portable recovery after reinstall or migration. [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)

The proposed fix plan:

1. **Distinguish startup states.** Inspect database existence before creating a key. Initialize and migrate a fresh database; unlock an existing database with its saved key; preserve an existing database with a missing or invalid key and show recovery.
2. **Add recovery before normal navigation.** Provide retry and backup import without requiring successful database initialization. Never automatically delete financial data or fall back to plaintext.
3. **Implement secure portable restore.** Follow ADR-0001’s authenticated, versioned backup format. Validate the archive, key, schema, integrity results, and financial reconciliation before replacing anything. Keep the current backup buttons disabled until this is verified.
4. **Make replacement recoverable.** Pause database operations, close connections, preserve the old database/key pair, handle WAL files, and use a crash-recoverable replacement protocol. Reopen, migrate, rebuild repositories, and refresh screens before reporting success. SDK 57 supports [`closeAsync()`](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).
5. **Verify native initialization and transfer policy.** Check migrations’ exclusive transaction connection and generated Android backup rules. Test both cloud restore and device transfer; `allowBackup: false` alone does not prevent every manufacturer’s device transfer. [Android documentation](https://developer.android.com/identity/data/autobackup)

Acceptance tests should cover fresh installation, existing database/key, missing or wrong key, Device A → B restore, wrong passphrase, corruption, interrupted replacement, and restart. Borrowers, loans, receipts, schedules, and balances must reconcile exactly.

TypeScript passed. ESLint failed on a missing native resolver binding; Jest could not create its temporary directory. No files or commits were created because this session is read-only.

The remaining diagnostic input is the exact second-phone error and whether failure occurred during APK installation, first launch, or backup import.
2026-10-10T05:25:28.446719Z ERROR codex_core::session: failed to record rollout items: thread 01a12443-10ab-7d11-9d08-38f89898fc1f not found
tokens used
63,318
I found database lifecycle defects, but **the affected phone’s root cause remains unconfirmed** without its exact error.

- [Initialization](/mnt/f/personal%20projects/credkeep/src/core/database/db.ts:14) generates and saves a new key whenever SecureStore is empty—even if an encrypted database already exists. An isolated harness confirmed this behavior; native decryption was simulated.
- [Backup and restore](/mnt/f/personal%20projects/credkeep/src/app/settings/backup.tsx:198) are disabled. The dormant restore code overwrites an open database, ignores the integrity-check result, and updates the key afterward.
- Device-bound SecureStore data cannot provide portable recovery after reinstall or migration. [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)

The proposed fix plan:

1. **Distinguish startup states.** Inspect database existence before creating a key. Initialize and migrate a fresh database; unlock an existing database with its saved key; preserve an existing database with a missing or invalid key and show recovery.
2. **Add recovery before normal navigation.** Provide retry and backup import without requiring successful database initialization. Never automatically delete financial data or fall back to plaintext.
3. **Implement secure portable restore.** Follow ADR-0001’s authenticated, versioned backup format. Validate the archive, key, schema, integrity results, and financial reconciliation before replacing anything. Keep the current backup buttons disabled until this is verified.
4. **Make replacement recoverable.** Pause database operations, close connections, preserve the old database/key pair, handle WAL files, and use a crash-recoverable replacement protocol. Reopen, migrate, rebuild repositories, and refresh screens before reporting success. SDK 57 supports [`closeAsync()`](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).
5. **Verify native initialization and transfer policy.** Check migrations’ exclusive transaction connection and generated Android backup rules. Test both cloud restore and device transfer; `allowBackup: false` alone does not prevent every manufacturer’s device transfer. [Android documentation](https://developer.android.com/identity/data/autobackup)

Acceptance tests should cover fresh installation, existing database/key, missing or wrong key, Device A → B restore, wrong passphrase, corruption, interrupted replacement, and restart. Borrowers, loans, receipts, schedules, and balances must reconcile exactly.

TypeScript passed. ESLint failed on a missing native resolver binding; Jest could not create its temporary directory. No files or commits were created because this session is read-only.

The remaining diagnostic input is the exact second-phone error and whether failure occurred during APK installation, first launch, or backup import.

OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a1242a-c716-71b0-925d-345d165d995e
--------
user
Plan the implementation of the Borrower Profile screen (src/app/borrower/[id].tsx) to match the rich aesthetics of the design system. It should show borrower details, contact info, total outstanding balance across all loans, a list of associated loans with clear status indicators, and quick actions like 'Record Payment' or 'New Loan'. Use the code-review skill and read AGENTS.md for conventions.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll read the project conventions, workflow state, and code-review skill, then inspect the current screen and design references to build an implementation plan.
exec
/bin/bash -lc "cat AGENTS.md .workflow/STATE.md '/mnt/f/personal projects/credkeep/.agents/skills/code-review/SKILL.md'" in /mnt/f/personal projects/credkeep
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
- **Current Git Branch:** feat/ui/borrower-profile
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Borrower profile
- **Assigned Agent:** Gemini
- **Current Stage:** Phase 1 - Planning and Layout

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** N/A
- **Next Action:** Review Stitch MCP UI assets and implement the Borrower Profile screen.
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

codex
I’m using the code-review skill’s Standards and Spec criteria to shape the plan and its acceptance checks. A full diff review needs a fixed comparison point; this request is for planning, so I’ll reserve that review for the implementation. Stitch tools aren’t available in this session, so I’ll look for checked-in design references.
exec
/bin/bash -lc "cat AGENTS.md >/dev/null
if test -f graphify-out/graph.json; then graphify query 'Borrower profile screen data loans balance design system'; fi
 git status --short
cat package.json
cat .agents/skills/code-review/SKILL.md
rg --files src docs .scratch .workflow | rg 'borrower|loan|payment|theme|design|token|HANDOFF|GLOSSARY|issue-tracker'" in /mnt/f/personal projects/credkeep
 succeeded in 1040ms:
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
 M .workflow/STATE.md
 M .workflow/TASKS.md
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
?? .workflow/plans/Borrower_Profile.md
?? .workflow/plans/Borrower_Profile_prompt.txt
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
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
.workflow/HANDOFF.md
docs/agents/issue-tracker.md
.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/ui/theme.ts
src/app/(tabs)/borrowers.tsx
src/app/(tabs)/loans.tsx
src/app/loan/[id].tsx
src/app/borrower/[id].tsx
src/core/database/loanRepository.test.ts
src/core/database/borrowerRepository.ts
src/core/database/loanRepository.ts
src/app/loan/[id]/index.tsx

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat 'src/app/borrower/[id].tsx' src/ui/theme.ts src/core/database/borrowerRepository.ts src/core/database/loanRepository.ts .workflow/plans/Borrower_Profile.md .workflow/HANDOFF.md
rg --files src/ui src/core src/app assets docs | head -90
rg -n 'outstanding|balance|status|record-payment|new-loan|Record Payment|New Loan|810666|Stitch' src/app src/core/domain docs GLOSSARY.md" in /mnt/f/personal projects/credkeep
 succeeded in 86ms:
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Borrower } from '../../core/database/borrowerRepository';
import { Loan } from '../../core/database/loanRepository';
import { formatINR, Paise } from '../../core/domain/money';

export default function BorrowerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { borrowers, loans, refreshVersion } = useDatabase();
  
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);

  useEffect(() => {
    async function load() {
      if (borrowers && loans && id) {
        const b = await borrowers.getById(id as string);
        setBorrower(b);
        const lns = await loans.getAll();
        setBorrowerLoans(lns.filter((l: Loan) => l.borrower_id === id));
      }
    }
    load();
  }, [id, borrowers, loans, refreshVersion]);

  if (!borrower) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Borrower Profile</Typography>
        </View>
        
        <Card elevated style={styles.card}>
          <Typography variant="headlineSm">{borrower.name}</Typography>
          <Typography variant="bodyMd" color={theme.colors.onSurfaceVariant}>{borrower.phone}</Typography>
        </Card>
        
        <Typography variant="titleMd" style={styles.sectionTitle}>Associated Loans</Typography>
        
        {borrowerLoans.map(loan => (
          <TouchableOpacity key={loan.id} onPress={() => router.push(`/loan/${loan.id}` as any)}>
            <Card style={styles.loanCard}>
              <Typography variant="bodyLg">{loan.product_type === 'instalment' ? 'Monthly Kist' : 'Interest Only'}</Typography>
              <Typography variant="headlineSm" color={theme.colors.primary}>{formatINR(loan.principal_paise as Paise)}</Typography>
              <Typography variant="bodySm" color={loan.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
                {loan.status}
              </Typography>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  header: { padding: theme.spacing.lg, backgroundColor: theme.colors.primary },
  content: { padding: theme.spacing.lg },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.xl },
  sectionTitle: { marginBottom: theme.spacing.md },
  loanCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md }
});
export const theme = {
  colors: {
    primary: '#001328',
    primaryContainer: '#14283f',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#7c8fab',
    secondary: '#006a62',
    secondaryFixed: '#94f3e7',
    onSecondary: '#ffffff',
    background: '#f7f9fb',
    onBackground: '#191c1e',
    surface: '#f7f9fb',
    onSurface: '#191c1e',
    surfaceVariant: '#e0e3e5',
    onSurfaceVariant: '#44474d',
    surfaceTint: '#4d6079',
    surfaceContainerHighest: '#e0e3e5',
    surfaceContainerHigh: '#e6e8ea',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainerLowest: '#ffffff',
    outline: '#74777e',
    outlineVariant: '#c4c6cd',
    textPrimary: '#191c1e',
    textSecondary: '#44474d',
    success: '#16a34a',
    successContainer: '#7ffc97',
    warning: '#EA580C',
    warningContainer: '#FFEDD5',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
  },
  typography: {
    rupeeDisplay: {
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.03 * 30,
    },
    headlineLg: {
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: '700' as const,
      letterSpacing: -0.02 * 32,
    },
    headlineMd: {
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.01 * 22,
    },
    headlineSm: {
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    titleMd: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '500' as const,
    },
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400' as const,
    },
    bodyMd: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '400' as const,
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '400' as const,
    },
    labelLg: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.01 * 14,
    },
    labelMd: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '600' as const,
      letterSpacing: 0.02 * 12,
    },
    labelSm: {
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '700' as const,
      letterSpacing: 0.04 * 10,
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  }
};
import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';

export type Borrower = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

export class BorrowerRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(name: string, phone: string): Promise<Borrower> {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    await this.db.runAsync(
      `INSERT INTO borrowers (id, name, phone, created_at) VALUES (?, ?, ?, ?)`,
      [id, name, phone, created_at]
    );
    
    return { id, name, phone, created_at };
  }

  async getAll(): Promise<Borrower[]> {
    return await this.db.getAllAsync<Borrower>(`SELECT * FROM borrowers ORDER BY name ASC`);
  }

  async getById(id: string): Promise<Borrower | null> {
    return await this.db.getFirstAsync<Borrower>(`SELECT * FROM borrowers WHERE id = ?`, [id]);
  }
}
import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';
import { ScheduleOptions, generateSchedule } from '../domain/schedule';

export type Loan = {
  id: string;
  borrower_id: string;
  principal_paise: number;
  markup_factor: number;
  term_months: number;
  start_date: string;
  due_day: number;
  product_type: string;
  status: string;
  created_at: string;
};

export class LoanRepository {
  constructor(private db: SQLiteDatabase) {}

  async createLoanWithSchedule(
    borrowerId: string, 
    options: ScheduleOptions
  ): Promise<Loan> {
    const loanId = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const schedule = generateSchedule(options);

    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await this.db.runAsync(
        `INSERT INTO loans (id, borrower_id, principal_paise, markup_factor, term_months, start_date, due_day, product_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, borrowerId, options.principal, options.markupFactor, options.termMonths, options.startDate, options.dueDay, options.productType, created_at]
      );
      
      const statement = await this.db.prepareAsync(`
        INSERT INTO repayment_schedules 
        (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        for (const kist of schedule) {
          await statement.executeAsync([
            crypto.randomUUID(),
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
    });

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
          
          if (nextDueDate > currentDate) break;
          
          nextInstalmentNumber++;
          monthsToAddFromStart++;
          nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
        }
      } finally {
        await statement.finalizeAsync();
      }
    }
  }
}
OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a1242a-c716-71b0-925d-345d165d995e
--------
user
Plan the implementation of the Borrower Profile screen (src/app/borrower/[id].tsx) to match the rich aesthetics of the design system. It should show borrower details, contact info, total outstanding balance across all loans, a list of associated loans with clear status indicators, and quick actions like 'Record Payment' or 'New Loan'. Use the code-review skill and read AGENTS.md for conventions.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll read the project conventions, workflow state, and code-review skill, then inspect the current screen and design references to build an implementation plan.
exec
/bin/bash -lc "cat AGENTS.md .workflow/STATE.md '/mnt/f/personal projects/credkeep/.agents/skills/code-review/SKILL.md'" in /mnt/f/personal projects/credkeep
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
- **Current Git Branch:** feat/ui/borrower-profile
- **HEAD Commit:** pending

## Active Task
- **Task ID:** Borrower profile
- **Assigned Agent:** Gemini
- **Current Stage:** Phase 1 - Planning and Layout

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** N/A
- **Next Action:** Review Stitch MCP UI assets and implement the Borrower Profile screen.
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

codex
I’m using the code-review skill’s Standards and Spec criteria to shape the plan and its acceptance checks. A full diff review needs a fixed comparison point; this request is for planning, so I’ll reserve that review for the implementation. Stitch tools aren’t available in this session, so I’ll look for checked-in design references.
exec
/bin/bash -lc "cat AGENTS.md >/dev/null
if test -f graphify-out/graph.json; then graphify query 'Borrower profile screen data loans balance design system'; fi
 git status --short
cat package.json
cat .agents/skills/code-review/SKILL.md
rg --files src docs .scratch .workflow | rg 'borrower|loan|payment|theme|design|token|HANDOFF|GLOSSARY|issue-tracker'" in /mnt/f/personal projects/credkeep
 succeeded in 1040ms:
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
 M .workflow/STATE.md
 M .workflow/TASKS.md
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
?? .workflow/plans/Borrower_Profile.md
?? .workflow/plans/Borrower_Profile_prompt.txt
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
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
.workflow/HANDOFF.md
docs/agents/issue-tracker.md
.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/ui/theme.ts
src/app/(tabs)/borrowers.tsx
src/app/(tabs)/loans.tsx
src/app/loan/[id].tsx
src/app/borrower/[id].tsx
src/core/database/loanRepository.test.ts
src/core/database/borrowerRepository.ts
src/core/database/loanRepository.ts
src/app/loan/[id]/index.tsx

# Task Handoff

## Handoff Detail
- **Task ID:** QA Orchestration Repair (WSL Integration)
- **Completed Changes:** 
  - Installed Node.js LTS and `@openai/codex` globally in WSL Ubuntu.
  - Authenticated Codex interactively via the local server.
  - Updated `.workflow/run-codex.ps1` and `.workflow/qa-codex.ps1` to seamlessly pass prompts to `wsl.exe` and execute native Linux Codex.
  - Successfully verified execution using a real QA review against an existing commit, confirming that the orchestrator rejects `REWORK` verdicts with a nonzero exit code.
- **Files Modified:** `.workflow/run-codex.ps1`, `.workflow/qa-codex.ps1`, `.workflow/STATE.md`, `.workflow/SESSION_LOG.md`
- **Commands Run:** Native Linux `codex` through `wsl.exe`.
- **Test Results:** WSL_CODEX_WORKING
- **Git Commit Hashes:** N/A (about to commit)
- **Remaining Problems:** None.
- **Next Agent:** Gemini
- **Next Action:** Resume standard autonomous workflow.
docs/FINANCIAL_RULES.md
assets/android-icon-monochrome.png
assets/android-icon-foreground.png
assets/android-icon-background.png
assets/icon.png
assets/favicon.png
assets/splash-icon.png
src/app/_layout.tsx
src/ui/Typography.tsx
src/ui/theme.ts
src/ui/PinLock.tsx
src/ui/Input.tsx
src/ui/Card.tsx
src/ui/Button.tsx
docs/adr/0002-append-only-double-entry-ledger.md
docs/adr/0003-relational-ledger-with-audit-history.md
docs/adr/0001-sqlcipher-encrypted-sqlite.md
docs/agents/issue-tracker.md
docs/agents/domain.md
docs/agents/triage-labels.md
src/app/loan/[id].tsx
src/app/reports/index.tsx
src/app/settings/backup.tsx
src/app/settings/security.tsx
src/app/borrower/[id].tsx
src/core/domain/money.test.ts
src/core/domain/models.ts
src/core/domain/backupUtil.ts
src/core/domain/backupUtil.test.ts
src/core/domain/allocation.ts
src/core/domain/allocation.test.ts
src/core/domain/penalty.ts
src/core/domain/penalty.test.ts
src/core/domain/money.ts
src/core/domain/schedule.test.ts
src/core/domain/schedule.ts
src/app/(tabs)/index.tsx
src/app/(tabs)/collections.tsx
src/app/(tabs)/borrowers.tsx
src/app/(tabs)/more.tsx
src/app/(tabs)/loans.tsx
src/app/(tabs)/_layout.tsx
src/core/database/loanRepository.test.ts
src/core/database/db.ts
src/core/database/DatabaseProvider.tsx
src/core/database/borrowerRepository.ts
src/core/database/schema.ts
src/core/database/loanRepository.ts
src/core/database/transactionRepository.ts
src/app/loan/[id]/index.tsx
GLOSSARY.md:71:_Avoid_: Payment splitting, balance deduction
GLOSSARY.md:83:_Avoid_: Excess balance, float, change
GLOSSARY.md:98:The early closure of a Loan Account prior to contractual maturity, settling outstanding principal and any agreed early-settlement markup.
GLOSSARY.md:102:A negotiated compromise where the financier accepts a lump sum lower than the total outstanding receivable and legally extinguishes the debt.
GLOSSARY.md:106:An accounting impairment marking an unpaid loan as uncollectible, which removes it from active portfolio balance without extinguishing legal debt claims.
docs/FINANCIAL_RULES.md:65:CredKeep V1 eliminates advance wallets, credit balances, and virtual holding accounts.
docs/FINANCIAL_RULES.md:69:- Future kists show their reduced remaining balance directly.
docs/FINANCIAL_RULES.md:129:- Recording payment executes atomically: updates kist status, reduces balances, logs the transaction journal entry.
docs/FINANCIAL_RULES.md:147:10. **Reschedule with Waiver**: Kist extended after ₹300 penalties accrued, with waiver selected &rarr; penalty balance resets to ₹0; kist due date extended.
docs/FINANCIAL_RULES.md:151:14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and ₹100 of K2 &rarr; K1 and K2 restore exact prior unpaid balances; DPD recalculates cleanly.
docs/FINANCIAL_RULES.md:165:   - *Recommendation*: The ₹100 daily fee continues as long as *any* non-zero balance remains on a past-due kist.
docs/FINANCIAL_RULES.md:170:     2. Only after due instalment obligations are covered, apply remaining funds toward outstanding penalties.
docs/FINANCIAL_RULES.md:171:     3. If the scheduled instalment is completely covered but its penalty remains unpaid, mark the instalment PAID and keep the penalty outstanding separately.
docs/FINANCIAL_RULES.md:172:     4. Stop further daily penalty accrual when all overdue instalment obligations are cleared, even when historical penalties remain unpaid. Example: ₹2,600 instalment + ₹500 penalty. Borrower pays ₹2,600. The instalment becomes PAID, ₹500 penalty remains outstanding, and no further penalty accrues for that overdue period.
docs/adr/0003-relational-ledger-with-audit-history.md:13:7. Crash resilience ensuring an unexpected device shutdown or power loss mid-operation leaves zero inconsistent states between materialized balances and transaction logs.
docs/adr/0003-relational-ledger-with-audit-history.md:19:We implement a normalized relational financial schema using SQLite. The design combines **immutable transaction records** with **materialized balance columns**, governed by database-level constraints, atomic transaction blocks, and deterministic in-memory financial domain logic.
docs/adr/0003-relational-ledger-with-audit-history.md:100:  If a duplicate submission occurs (e.g., following an app restart after an interrupted response or double-tap), SQLite raises a `SQLITE_CONSTRAINT_UNIQUE` violation. The repository intercepts this error, queries the existing transaction by `operation_id`, and safely returns the existing record without mutating balances.
docs/adr/0003-relational-ledger-with-audit-history.md:137:    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIALLY_PAID', 'PAID'
docs/adr/0003-relational-ledger-with-audit-history.md:141:- Extra payments directly increase `principal_paid_paise` and `markup_paid_paise` on future kists. The future kist displays its remaining net payable balance without changing its scheduled due date.
docs/adr/0003-relational-ledger-with-audit-history.md:167:- If `accrued_penalty_action = 'WAIVE'`, a noncash `PENALTY_WAIVER` transaction row is inserted in the same atomic transaction, reducing `outstanding_penalty_paise`.
docs/adr/0003-relational-ledger-with-audit-history.md:215:1. **On-Time Payment**: Full payment of ₹2,600 on due date &rarr; status `PAID`, ₹0 penalty, next month starts clean at ₹2,600.
docs/adr/0003-relational-ledger-with-audit-history.md:224:10. **Reschedule with Penalty Waiver**: Kist extended after ₹300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to ₹0.
docs/adr/0003-relational-ledger-with-audit-history.md:240:  - High query speed via materialized balances on loans and schedules.
docs/adr/0003-relational-ledger-with-audit-history.md:246:  - Materialized balances require strict discipline to update only within exclusive transactions alongside journal rows.
docs/adr/0001-sqlcipher-encrypted-sqlite.md:6:CredKeep stores private financial ledger balances, promissory note metadata, and borrower KYC records entirely on an Android mobile device. In informal Indian lending, field devices face risks of physical loss, theft, unauthorized inspection, or physical seizure. Data at rest must be strongly encrypted without compromising local SQLite query performance.
src/app/loan/[id].tsx:44:        <Typography variant="bodyLg">Status: {loan.status}</Typography>
src/app/loan/[id].tsx:56:            <Typography variant="labelLg" color={kist.status === 'PAID' ? theme.colors.success : theme.colors.warning}>
src/app/loan/[id].tsx:57:              {kist.status}
src/app/(tabs)/index.tsx:22:      const active = allLoans.filter(l => l.status === 'ACTIVE');
src/app/(tabs)/index.tsx:33:      // For overdue, just sum outstanding penalties and we could also query unpaid kists that are due.
src/app/(tabs)/index.tsx:34:      setOverdue(summary.outstandingPenalty as Paise);
src/app/(tabs)/index.tsx:104:              <Typography variant="headlineSm" color={theme.colors.onPrimary}>+ New Loan</Typography>
src/app/(tabs)/index.tsx:112:              <Typography variant="headlineSm" color={theme.colors.onSecondary}>✓ Record Payment</Typography>
src/app/(tabs)/loans.tsx:23:  // New Loan Wizard State
src/app/(tabs)/loans.tsx:221:        <Button title="New Loan" onPress={() => { resetForm(); setModalVisible(true); }} style={styles.headerBtn} />
src/app/(tabs)/loans.tsx:233:              <Typography variant="bodySm" color={item.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
src/app/(tabs)/loans.tsx:234:                Status: {item.status}
src/app/(tabs)/loans.tsx:255:            <Typography variant="labelLg">New Loan - Step {step}/4</Typography>
src/app/borrower/[id].tsx:54:              <Typography variant="bodySm" color={loan.status === 'ACTIVE' ? theme.colors.success : theme.colors.textSecondary}>
src/app/borrower/[id].tsx:55:                {loan.status}
src/app/reports/index.tsx:56:                <Typography variant="bodySm" color={theme.colors.error}>{formatINR(globalEarnings.outstandingPenalty)}</Typography>
src/app/(tabs)/collections.tsx:25:  const [outstandingPenalty, setOutstandingPenalty] = useState<number>(0);
src/app/(tabs)/collections.tsx:47:        setOutstandingPenalty(summary.outstandingPenalty);
src/app/(tabs)/collections.tsx:53:  const activeLoans = useMemo(() => loansList.filter(l => l.status === 'ACTIVE'), [loansList]);
src/app/(tabs)/collections.tsx:116:  const totalPenalty = previewPenalty + outstandingPenalty;
src/app/(tabs)/collections.tsx:138:              Outstanding: {formatINR(outstandingPenalty as Paise)}
src/app/(tabs)/collections.tsx:159:        <Button title="Record Payment" onPress={handlePayment} style={styles.button} />
src/app/loan/[id]/index.tsx:46:          <Typography variant="bodyMd">Status: {loan.status}</Typography>
src/core/domain/allocation.ts:13:  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
src/core/domain/allocation.ts:41:  outstandingPenalty: Paise;
src/core/domain/allocation.ts:53:  let remainingPenalty = input.outstandingPenalty;
src/core/domain/allocation.ts:56:    let resolvedStatus = k.status;
src/core/domain/allocation.ts:60:    // Also auto-fix if amountPaid somehow >= amountDue but status isn't PAID
src/core/domain/allocation.ts:64:    return { ...k, status: resolvedStatus };
src/core/domain/allocation.ts:71:    if (kist.isDue !== false && kist.status !== 'PAID' && remainingFunds > 0) {
src/core/domain/allocation.ts:79:        kist.status = 'PAID';
src/core/domain/allocation.ts:81:        kist.status = 'PARTIALLY_PAID';
src/core/domain/allocation.ts:117:    if (kist.isDue === false && kist.status !== 'PAID' && remainingFunds > 0) {
src/core/domain/allocation.ts:125:        kist.status = 'PAID';
src/core/domain/allocation.ts:127:        kist.status = 'PARTIALLY_PAID';
src/core/domain/models.ts:41:  balanceAfter: Paise;
src/core/domain/allocation.test.ts:14:      outstandingPenalty: toPaise(0)
src/core/domain/allocation.test.ts:21:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:34:      outstandingPenalty: toPaise(500)
src/core/domain/allocation.test.ts:37:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:43:  it('marks instalment PAID and keeps penalty outstanding if payment exactly covers instalment', () => {
src/core/domain/allocation.test.ts:52:      outstandingPenalty: toPaise(500)
src/core/domain/allocation.test.ts:55:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:71:      outstandingPenalty: toPaise(0)
src/core/domain/allocation.test.ts:74:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:76:    expect(result.updatedKists[1].status).toBe('PARTIALLY_PAID');
src/core/domain/allocation.test.ts:96:      outstandingPenalty: toPaise(500)
src/core/domain/allocation.test.ts:100:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:101:    expect(result.updatedKists[1].status).toBe('PAID');
src/core/domain/allocation.test.ts:106:  it('correctly resolves PENDING status to PAID if amountPaid >= amountDue, even with zero payment', () => {
src/core/domain/allocation.test.ts:108:      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(2600), principalPaid: toPaise(2000), markupPaid: toPaise(600), status: 'PENDING' as any }
src/core/domain/allocation.test.ts:115:      outstandingPenalty: toPaise(0)
src/core/domain/allocation.test.ts:118:    expect(result.updatedKists[0].status).toBe('PAID');
src/core/domain/allocation.test.ts:121:  it('does not incorrectly reduce amountPaid when a kist is overpaid and status is PENDING', () => {
src/core/domain/allocation.test.ts:123:      { kistNumber: 1, amountDue: toPaise(2600), principalDue: toPaise(2000), markupDue: toPaise(600), amountPaid: toPaise(3000), principalPaid: toPaise(2000), markupPaid: toPaise(1000), status: 'PENDING' as any }
src/core/domain/allocation.test.ts:130:      outstandingPenalty: toPaise(0)
src/core/domain/allocation.test.ts:134:    expect(result.updatedKists[0].status).toBe('PAID');

exec
/bin/bash -lc "cat AGENTS.md >/dev/null
cat src/core/database/schema.ts src/ui/Button.tsx src/ui/Card.tsx src/ui/Typography.tsx
sed -n '1,105p' 'src/app/(tabs)/collections.tsx'
sed -n '1,95p' 'src/app/(tabs)/loans.tsx'
rg -n 'getLoan|Summary|outstanding|principal.*paid|SUM|penalty' src/core/database/transactionRepository.ts
cat docs/FINANCIAL_RULES.md | head -85
ls bun.lock node_modules/.bin/tsc node_modules/.bin/eslint 2>/dev/null" in /mnt/f/personal projects/credkeep
 exited 2 in 33ms:
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

    // 5. Schedule Modifications
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schedule_modifications (
        id TEXT PRIMARY KEY NOT NULL,
        loan_id TEXT NOT NULL,
        kist_id TEXT NOT NULL,
        original_due_date TEXT NOT NULL,
        prior_effective_due_date TEXT NOT NULL,
        revised_effective_due_date TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        reason TEXT,
        accrued_penalty_action TEXT NOT NULL,
        waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
        operation_id TEXT NOT NULL UNIQUE,
        FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
      );
    `);
  });
}
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ActivityIndicator } from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  title: string;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  title,
  loading = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: [styles.container, styles.primaryContainer, disabled && styles.disabledContainer],
          text: theme.colors.onPrimary,
        };
      case 'secondary':
        return {
          container: [styles.container, styles.secondaryContainer, disabled && styles.disabledContainer],
          text: theme.colors.onSecondary,
        };
      case 'outline':
        return {
          container: [styles.container, styles.outlineContainer, disabled && styles.disabledOutlineContainer],
          text: theme.colors.primary,
        };
      case 'ghost':
        return {
          container: [styles.container, styles.ghostContainer],
          text: theme.colors.primary,
        };
    }
  };

  const currentStyles = getStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[currentStyles.container, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={currentStyles.text} />
      ) : (
        <Typography variant="labelLg" color={currentStyles.text}>
          {title}
        </Typography>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primaryContainer: {
    backgroundColor: theme.colors.primary,
  },
  secondaryContainer: {
    backgroundColor: theme.colors.secondary,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    backgroundColor: theme.colors.outlineVariant,
  },
  disabledOutlineContainer: {
    borderColor: theme.colors.outlineVariant,
    opacity: 0.5,
  },
});
import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from './theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ elevated = false, style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  elevated: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 0,
  },
});
import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { theme } from './theme';

type TypographyVariant = keyof typeof theme.typography;

interface TypographyProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: '400' | '500' | '600' | '700';
}

export function Typography({
  variant = 'bodyMd',
  color = theme.colors.textPrimary,
  align = 'left',
  weight,
  style,
  children,
  ...rest
}: TypographyProps) {
  const variantStyle = theme.typography[variant];
  
  return (
    <RNText
      style={[
        variantStyle,
        { color, textAlign: align },
        weight && { fontWeight: weight },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as crypto from 'expo-crypto';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, formatINR } from '../../core/domain/money';

export default function CollectionsScreen() {
  const { loans, transactions, borrowers, refreshVersion, triggerRefresh } = useDatabase();
  const [loansList, setLoansList] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [amountInr, setAmountInr] = useState('');
  const [result, setResult] = useState<any>(null);

  const [previewPenalty, setPreviewPenalty] = useState<number>(0);
  const [outstandingPenalty, setOutstandingPenalty] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      setLoansList(await loans.getAll());
      setBorrowersList(await borrowers.getAll());
    }
  }, [loans, borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshVersion]);

  useEffect(() => {
    async function fetchPenalty() {
      if (selectedLoanId && transactions) {
        const currentDate = new Date().toISOString().split('T')[0];
        const newPen = await transactions.previewPenalties(selectedLoanId, currentDate);
        setPreviewPenalty(newPen);
        
        const summary = await transactions.getEarningsSummary({ loanId: selectedLoanId });
        setOutstandingPenalty(summary.outstandingPenalty);
      }
    }
    fetchPenalty();
  }, [selectedLoanId, transactions, refreshVersion]);

  const activeLoans = useMemo(() => loansList.filter(l => l.status === 'ACTIVE'), [loansList]);

  const getBorrowerName = (id: string) => {
    return borrowersList.find(b => b.id === id)?.name || 'Unknown Borrower';
  };

  const handlePayment = async () => {
    if (!selectedLoanId || !amountInr) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }
    
    try {
      const amountPaise = (parseInt(amountInr) * 100) as Paise;
      const effectiveDate = new Date().toISOString().split('T')[0];
      const operationId = crypto.randomUUID();
      
      const res = await transactions!.recordCashPayment(
        selectedLoanId,
        amountPaise,
        operationId,
        effectiveDate
      );
      
      setResult(res);
      setAmountInr('');
      Alert.alert('Success', 'Payment recorded successfully!');
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (!selectedLoanId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Typography variant="headlineMd" color={theme.colors.onPrimary}>Select Loan for Collection</Typography>
        </View>
        <FlatList
          data={activeLoans}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedLoanId(item.id)}>
              <Card elevated style={styles.loanCard}>
                <Typography variant="headlineSm">{getBorrowerName(item.borrower_id)}</Typography>
                <Typography variant="bodyMd">Principal: {formatINR(item.principal_paise as Paise)}</Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary}>Loan ID: {item.id.substring(0, 8)}</Typography>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { theme } from '../../ui/theme';
import { useDatabase } from '../../core/database/DatabaseProvider';
import { Loan } from '../../core/database/loanRepository';
import { Borrower } from '../../core/database/borrowerRepository';
import { Paise, toPaise, formatINR } from '../../core/domain/money';
import { generateSchedule } from '../../core/domain/schedule';

export default function LoansScreen() {
  const router = useRouter();
  const { loans, borrowers, refreshVersion, triggerRefresh } = useDatabase();
  const [data, setData] = useState<Loan[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // New Loan Wizard State
  const [isModalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [productType, setProductType] = useState<'instalment' | 'bullet'>('instalment');
  const [principal, setPrincipal] = useState('10000');
  const [markupPercent, setMarkupPercent] = useState('30');
  const [termMonths, setTermMonths] = useState('6');
  const [dueDay, setDueDay] = useState('5');
  const [collateral, setCollateral] = useState('');

  const loadData = useCallback(async () => {
    if (loans && borrowers) {
      try {
        setError(null);
        setData(await loans.getAll());
        setBorrowersList(await borrowers.getAll());
      } catch (err: any) {
        setError(err.message || 'Failed to load loans');
      }
    }
  }, [loans, borrowers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshVersion]);

  const filteredBorrowers = useMemo(() => {
    if (!searchQuery) return borrowersList;
    const lower = searchQuery.toLowerCase();
    return borrowersList.filter(b => 
      b.name.toLowerCase().includes(lower) || 
      b.phone.includes(lower)
    );
  }, [borrowersList, searchQuery]);

  const previewSchedule = useMemo(() => {
    if (step === 4) {
      try {
        return generateSchedule({
          principal: toPaise(parseInt(principal) || 0),
          markupFactor: (parseFloat(markupPercent) || 0) / 100,
          termMonths: parseInt(termMonths) || 1,
          startDate: new Date().toISOString().split('T')[0],
          dueDay: parseInt(dueDay) || 1,
          productType
        });
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [step, principal, markupPercent, termMonths, dueDay, productType]);

  const totalRepayment = useMemo(() => {
    const sum = previewSchedule.reduce((acc, kist) => acc + (kist.amountDue as unknown as number), 0);
    return sum as unknown as Paise;
  }, [previewSchedule]);

  const handleCreate = async () => {
    if (!selectedBorrowerId) return;
    try {
      await loans!.createLoanWithSchedule(selectedBorrowerId, {
        principal: toPaise(parseInt(principal)),
        markupFactor: parseFloat(markupPercent) / 100,
        termMonths: parseInt(termMonths),
        startDate: new Date().toISOString().split('T')[0],
        dueDay: parseInt(dueDay),
        productType,
44:          amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
45:          principalPaid: k.principal_paid_paise as Paise,
54:        // Fetch outstanding penalty
55:        // Outstanding penalty = (Total PENALTY_ASSESSMENT amounts) - (Total allocated_penalty_paise from all collections)
56:        const penaltyAssessments = await tx.getFirstAsync<any>(
57:          `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
60:        const penaltyPaid = await tx.getFirstAsync<any>(
61:          `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
65:        const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
66:        const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
67:        const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid) as Paise;
69:        const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
87:            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
105:            allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
116:          SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
179:    const { calculateNewPenalties } = require('../domain/penalty');
189:        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
220:    const { calculateNewPenalties, LoanPenaltyState } = require('../domain/penalty');
230:        amountPaid: k.principal_paid_paise + k.markup_paid_paise,
241:        const operationId = `penalty-${loanId}-${date}`;
250:              allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
263:  async getEarningsSummary(filter?: { loanId?: string, borrowerId?: string, loanStatus?: string }) {
285:        SUM(t.allocated_principal_paise) as principal_returned,
286:        SUM(t.allocated_markup_paise) as markup_received,
287:        SUM(t.allocated_penalty_paise) as penalty_received,
288:        SUM(t.forgiven_principal_paise) as principal_waived,
289:        SUM(t.forgiven_markup_paise) as markup_waived,
290:        SUM(t.forgiven_penalty_paise) as penalty_waived
296:    // Calculate outstanding (what is due but not paid)
297:    // For outstanding penalty, sum PENALTY_ASSESSMENT minus collected penalty
298:    const penaltyAssessments = await this.db.getFirstAsync<any>(`
299:      SELECT SUM(t.amount_paise) as total
305:    const totalPenaltyAssessed = penaltyAssessments?.total || 0;
306:    const penaltyReceived = collectedQuery?.penalty_received || 0;
307:    const penaltyWaived = collectedQuery?.penalty_waived || 0;
308:    const outstandingPenalty = Math.max(0, totalPenaltyAssessed - penaltyReceived - penaltyWaived);
313:      penaltyReceived,
316:      penaltyWaived,
317:      outstandingPenalty,
318:      totalEarnings: (collectedQuery?.markup_received || 0) + penaltyReceived
# CredKeep V1 — Financial Rules & Calculation Engine

**Status:** Approved & Simplified Product Specification  
**Context:** Offline-First, Single-Financier Mobile Lending Ledger (Android)

---

## 1. Monetary Units & Arithmetic Principles

1. **Integer Paise Storage**:
   - All monetary figures (Principal, Markup, Penalties, Collections, Balances) are stored and computed strictly as integer **Paise** (`1 INR = 100 Paise`).
   - Floating-point arithmetic is prohibited in domain logic and database schema.
   - Example: ₹2,600.00 is stored as `260000` paise; ₹100.00 daily late fee is stored as `10000` paise.
2. **Contractual Face Value Conservation**:
   $$\text{ContractualFaceValuePaise} = \text{PrincipalDisbursedPaise} + \text{ContractualMarkupPaise}$$
3. **Strict Separation of Balances**:
   Contractual principal and markup are tracked independently from late penalties. Penalties never compound and are never added to principal.

---

## 2. Simplified Late Penalty Behavior

### 2.1 The Core Mental Model
In the user interface, the financier sees a simple, transparent breakdown for any overdue installment:

$$\text{Total Payable} = \text{Scheduled Instalment} + \text{Late Penalty}$$

- **Rate**: ₹100 per calendar day (`10000` paise).
- **Grace**: No penalty on the due date itself. The first chargeable day is the day immediately following the due date.
- **Example (Single Kist)**:
  - Scheduled Kist: ₹2,600
  - Paid 5 days late: Late Penalty = $5 \times ₹100 = \mathbf{₹500}$
  - Total Collected: ₹2,600 + ₹500 = **₹3,100**
  - **Outcome**: The kist is marked **Paid**, and the ₹500 penalty is **Cleared**.
  - **Next Month**: Starts fresh at its original scheduled amount of **₹2,600**. Paid penalties are **never carried into future months**. If the next month is also paid 5 days late, its payable is independently ₹3,100.

### 2.2 Multiple Overdue Instalments (Per-Loan Cap)
If a borrower misses multiple instalments simultaneously:
- **The penalty does NOT multiply per instalment.**
- The loan incurs a maximum of **₹100 per calendar day total**.
- Overdue days are calculated from the **earliest unpaid effective due date**:
  $$\text{OverdueDays} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate})\right)$$
  $$\text{ActiveLatePenalty} = \text{OverdueDays} \times ₹100$$

#### Concrete Example:
- Kist 1 (₹2,600) was due on `10 Oct`.
- Kist 2 (₹2,600) was due on `10 Nov`.
- On `22 Nov` (36 days after Kist 1, 12 days after Kist 2):
  - Total overdue days on the loan = **43 days** (from 11 Oct to 22 Nov).
  - Total Late Penalty = $43 \times ₹100 = \mathbf{₹4,300}$ (NOT $43 \times 100 + 12 \times 100$).
  - Total to bring loan current: Kist 1 (₹2,600) + Kist 2 (₹2,600) + Penalty (₹4,300) = **₹9,500**.

### 2.3 Clearing Overdue Status
- When all instalments whose due dates have passed are paid:
  - The loan is **current**.
  - No further late penalties accrue.
  - Future instalments sit at their original scheduled amounts.
- **Manual Waiver**:
  The financier can waive the late fee at any time (e.g., collect ₹2,600 instead of ₹3,100). The app marks the kist Paid and writes a `PENALTY_WAIVER` noncash audit record for ₹500.

---

## 3. Extra Payments Automatically Reduce Future Kists

CredKeep V1 eliminates advance wallets, credit balances, and virtual holding accounts.

### 3.1 Direct Sequential Reduction
- Any cash collected in excess of current due amounts is automatically applied to reduce the **earliest unpaid future scheduled kist(s)** in chronological order.
- Future kists show their reduced remaining balance directly.
- Original contractual due dates of future kists **do not change**.

### 3.2 Concrete Examples
- **Example A (Small Surplus)**:
  - Kist 1 due today: ₹2,600.
  - Borrower pays: ₹2,700.
  - Kist 1: Marked **Paid** (₹2,600 allocated).
  - Kist 2 (due next month): Receives ₹100 credit. **Remaining payable on Kist 2 is now ₹2,500**.
- **Example B (Lump Sum Covering Future Kists)**:
  - Monthly kists: ₹2,600 each. Kist 1 due today.
  - Borrower pays: ₹6,000.
  - Kist 1: **Paid** (₹2,600 allocated).
  - Kist 2: **Paid** (₹2,600 allocated).
  - Kist 3: **Partially Paid** (₹800 allocated, ₹1,800 remaining payable on its scheduled date).
  - Kists 4–10: Remain at ₹2,600 each.

node_modules/.bin/eslint
node_modules/.bin/tsc

web search: 
web search: https://docs.expo.dev/versions/v57.0.0/
codex
The current screen loads every loan and filters in memory; it also has no balance summary, quick actions, or loading/error states. The repository already supports borrower-scoped loan lookup. The plan also needs route parameter support in the payment and new-loan flows so those actions preserve the selected borrower.

The balance work is the key correctness risk: original principal is not outstanding balance, and bullet loans need separate principal handling. I’ll include financial tests before the UI work.
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
./node_modules/.bin/tsc --noEmit' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null
./node_modules/.bin/eslint .' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "cat AGENTS.md >/dev/null
sed -n '75,105p' src/core/database/transactionRepository.ts
sed -n '263,323p' src/core/database/transactionRepository.ts
cat src/core/database/DatabaseProvider.tsx
rg --files | rg 'stitch|design|html"'$|lock|eslint'"'
git rev-parse HEAD" in /mnt/f/personal projects/credkeep
 succeeded in 128ms:
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
eslint.config.js
package-lock.json
aeae6c55e818b8de6e3bdc7690cec4fac5e03f61

 succeeded in 11515ms:
codex
For the code-review skill’s full Standards and Spec review, which commit or branch should be the comparison point? I can complete the implementation plan while that remains unspecified.
web search: 
web search: https://docs.expo.dev/router/basics/navigation/
codex
The plan will use the existing navy, teal, light surfaces, and typography tokens, with exact visual matching deferred until the designated Stitch screen is available. I also found that the earnings summary is not a complete outstanding-balance source, so the profile needs a tested borrower-level summary query.

TypeScript passed. The baseline lint check is still running.
codex
The implementation should combine a polished profile layout with a tested borrower-level balance summary. The current screen shows name, phone, original loan principal, and raw status; it lacks the summary, actions, and recovery states.

1. **Confirm the visual reference.** Use Stitch project `8106667901868227815`, **CredKeep V1 — Mobile Design System**. Stitch is unavailable in this session, so exact layout matching remains unverified. Start from existing [theme tokens](/mnt/f/personal projects/credkeep/src/ui/theme.ts): navy, teal, pale surfaces, rounded cards, and prominent currency typography. Verify that Inter is actually loaded.

2. **Build the screen hierarchy.**
   - Back navigation and “Borrower Profile” title.
   - Identity card with initials avatar, name, phone, and borrower-since date.
   - Contact row with a call action and graceful handling of missing contact details.
   - Navy summary card with **Total Outstanding**, principal/markup/penalty breakdown, and active-loan count.
   - Prominent **Record Payment** and **New Loan** actions.
   - Associated-loan cards showing product, outstanding amount, next unpaid due date, and labelled status badges. Distinguish lifecycle status from overdue state; communicate status with text as well as color.

   Only show supported borrower fields; email, address, and photos are absent from the current model.

3. **Implement the data layer first.** Replace `loans.getAll()` plus filtering with borrower-scoped reads. Add an aggregate summary query that avoids per-loan queries and independently aggregates schedules and transactions before joining them.
   - Calculate in integer paise; format with `formatINR`.
   - Use remaining obligations, not original principal.
   - Handle bullet principal separately from interest schedules.
   - Account for payments, waivers, and supported reversals.
   - Keep total outstanding distinct from overdue amount, with explicit treatment of unassessed penalties.
   - Reconcile each loan’s balance with the borrower total.

   Use TDD for this financial work. The existing earnings summary alone cannot provide the required total.

4. **Wire actions into existing flows.** Extend the Loans screen to accept a borrower parameter and open its wizard with that borrower selected. Extend Collections to preserve borrower context and select an eligible loan before payment. Disable payment when none is eligible. Use Expo Router parameter objects, consistent with its [navigation documentation](https://docs.expo.dev/router/basics/navigation/).

5. **Keep the route lightweight.** Put profile loading and reusable presentation components outside `src/app/`. Use a virtualized loan list with profile sections in its header. Validate the route ID, ignore stale asynchronous results, refresh through existing mutation notifications, and provide loading, retry, not-found, and no-loans states. Support large text, accessible labels, and safe-area spacing.

6. **Validate and review.** Test multi-loan totals, partial payments, bullet loans, waivers, zero balances, overdue boundaries, action preselection, and refresh after payment. Verify Android layout and offline behavior. Run typecheck, lint, and tests, then apply the code-review skill’s separate **Standards** and **Spec** reviews against a pinned baseline before a selective conventional commit.

I read `AGENTS.md`, workflow state, and the code-review skill. Baseline typecheck passed; lint was started but has not returned a result. Graphify was unavailable. No files or commits were created because this session is read-only.
2026-10-10T04:57:59.335102Z ERROR codex_core::session: failed to record rollout items: thread 01a1242a-c716-71b0-925d-345d165d995e not found
tokens used
52,009
The implementation should combine a polished profile layout with a tested borrower-level balance summary. The current screen shows name, phone, original loan principal, and raw status; it lacks the summary, actions, and recovery states.

1. **Confirm the visual reference.** Use Stitch project `8106667901868227815`, **CredKeep V1 — Mobile Design System**. Stitch is unavailable in this session, so exact layout matching remains unverified. Start from existing [theme tokens](/mnt/f/personal projects/credkeep/src/ui/theme.ts): navy, teal, pale surfaces, rounded cards, and prominent currency typography. Verify that Inter is actually loaded.

2. **Build the screen hierarchy.**
   - Back navigation and “Borrower Profile” title.
   - Identity card with initials avatar, name, phone, and borrower-since date.
   - Contact row with a call action and graceful handling of missing contact details.
   - Navy summary card with **Total Outstanding**, principal/markup/penalty breakdown, and active-loan count.
   - Prominent **Record Payment** and **New Loan** actions.
   - Associated-loan cards showing product, outstanding amount, next unpaid due date, and labelled status badges. Distinguish lifecycle status from overdue state; communicate status with text as well as color.

   Only show supported borrower fields; email, address, and photos are absent from the current model.

3. **Implement the data layer first.** Replace `loans.getAll()` plus filtering with borrower-scoped reads. Add an aggregate summary query that avoids per-loan queries and independently aggregates schedules and transactions before joining them.
   - Calculate in integer paise; format with `formatINR`.
   - Use remaining obligations, not original principal.
   - Handle bullet principal separately from interest schedules.
   - Account for payments, waivers, and supported reversals.
   - Keep total outstanding distinct from overdue amount, with explicit treatment of unassessed penalties.
   - Reconcile each loan’s balance with the borrower total.

   Use TDD for this financial work. The existing earnings summary alone cannot provide the required total.

4. **Wire actions into existing flows.** Extend the Loans screen to accept a borrower parameter and open its wizard with that borrower selected. Extend Collections to preserve borrower context and select an eligible loan before payment. Disable payment when none is eligible. Use Expo Router parameter objects, consistent with its [navigation documentation](https://docs.expo.dev/router/basics/navigation/).

5. **Keep the route lightweight.** Put profile loading and reusable presentation components outside `src/app/`. Use a virtualized loan list with profile sections in its header. Validate the route ID, ignore stale asynchronous results, refresh through existing mutation notifications, and provide loading, retry, not-found, and no-loans states. Support large text, accessible labels, and safe-area spacing.

6. **Validate and review.** Test multi-loan totals, partial payments, bullet loans, waivers, zero balances, overdue boundaries, action preselection, and refresh after payment. Verify Android layout and offline behavior. Run typecheck, lint, and tests, then apply the code-review skill’s separate **Standards** and **Spec** reviews against a pinned baseline before a selective conventional commit.

I read `AGENTS.md`, workflow state, and the code-review skill. Baseline typecheck passed; lint was started but has not returned a result. Graphify was unavailable. No files or commits were created because this session is read-only.

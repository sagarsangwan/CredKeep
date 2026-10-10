Reading additional input from stdin...
OpenAI Codex v0.162.0
--------
workdir: F:\personal projects\credkeep
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a123c6-5ee7-75c0-a0d5-8568907210f8
--------
user
Review the implementation of bullet loan principal repayment (CK-P0-003) on branch feat/settlement/ck-p0-003 (commit e98f281). Verify domain correctness and test coverage. Verify: 1) 20000 principal + 2000 monthly interest. 2) After 6 mo, 12000 interest collected leaves 20000 principal outstanding. 3) Loan stays ACTIVE. 4) Additional monthly interest continues. 5) Explicit principal repayments are handled correctly. 6) Principal repayment never becomes negative or exceeds remaining principal. 7) Loan becomes SETTLED only when principal, accrued interest, and applicable penalties are fully resolved. 8) Payments cannot accidentally cross between different loans. 9) SQLite operations are atomic and idempotent. Report whether bullet-loan.test.ts uses mocked database operations or genuine SQLite. Do not describe mocked tests as native integration tests. If approved, update TASKS.md status to VERIFIED. Return REWORK if there are findings.
codex
I’m using the code-review skill for the required Standards/Spec split, plus the financial-invariant and SQLite-integration guidance for the repayment and persistence checks. I’ll inspect the pinned commit without changing branches, run the relevant tests and quality gates, then update `TASKS.md` only if there are no findings.
hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw AGENTS.md; Get-Content -Raw .workflow/STATE.md; Get-Content -Raw 'C:/Users/Sagar/.agents/skills/code-review/SKILL.md'; Get-Content -Raw 'F:/personal projects/credkeep/.agents/skills/financial-invariant-verification/SKILL.md'; Get-Content -Raw 'F:/personal projects/credkeep/.agents/skills/sqlite-integration-testing/SKILL.md'" in F:\personal projects\credkeep
 succeeded in 1683ms:
This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed â€” do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt â€” an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add â€” resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` â€” every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) â€” no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand â€” configure native behavior in `app.json` and config plugins.
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
- **UI Screen Construction**: Consult Stitch MCP design assets (`CredKeep V1 â€” Mobile Design System`, Project ID `8106667901868227815`, Expected screens: 11) for screen layouts, typography, and color tokens. NEVER use the old `CredKeep Field Lending App` project.

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
- **Task ID:** CK-P0-003
- **Assigned Agent:** Codex
- **Current Stage:** Phase 3 - Review

## Status
- **Known Failures:** None
- **Latest Verified Test Results:** PASS (35 tests)
- **Next Action:** Review and verify implementation of bullet loan principal repayment.

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

Each smell reads *what it is* â†’ *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. â†’ rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. â†’ extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. â†’ move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). â†’ bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. â†’ give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. â†’ replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. â†’ gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. â†’ split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. â†’ delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. â†’ hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. â†’ cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. â†’ drop the inheritance, use composition.

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

- Code that follows every standard but implements the wrong thing â†’ **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions â†’ **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.

---
name: financial-invariant-verification
description: Rules for verifying financial math and data invariants
---

# Financial Invariant Verification

1. Double-entry ledger must always balance.
2. Payments must not cross loan boundaries.
3. Calculations must be deterministic.

---
name: sqlite-integration-testing
description: Guidelines for testing SQLite integration in CredKeep
---

# SQLite Integration Testing

1. Test transactions thoroughly.
2. Avoid N+1 queries.
3. Validate foreign key constraints.
4. Ensure rollback on errors.


hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; git status --short --branch; git rev-parse e98f281; git rev-parse e98f281''^; git show --stat --oneline --decorate --no-renames e98f281; git log --oneline --decorate -8; if (Test-Path graphify-out/graph.json) { graphify query "CK-P0-003 bullet loan principal repayment settlement payment allocation SQLite atomic idempotent tests" }; Get-Content -Raw docs/agents/issue-tracker.md' in F:\personal projects\credkeep
codex
The pinned commit resolves, but the local ref is unexpectedly named `feat/settlement/ck-p0-002`, not `feat/settlement/ck-p0-003`; commit `e98f281` is present and checked out. The worktree also has unrelated workflow edits, so I’m isolating the review to `fb8a96b...e98f281` and will not overwrite those changes.
hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; Get-Content -Raw docs/agents/issue-tracker.md; Get-Content -Raw .scratch/settlement/issues/07-bullet-loan-settlement.md; Get-Content -Raw docs/agents/domain.md; Get-Content -Raw GLOSSARY.md; Get-ChildItem docs/adr -File | Select-Object -ExpandProperty FullName; Get-Content -Raw package.json; git diff --no-ext-diff --unified=80 fb8a96b...e98f281 -- . ':(exclude).workflow/HANDOFF.md' ':(exclude).workflow/STATE.md'" in F:\personal projects\credkeep
 succeeded in 415ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

Get-Content : Cannot find path 'F:\personal projects\credkeep\.scratch\settlement\issues\07-bullet-loan-settlement.md' 
because it does not exist.
At line:2 char:135
+ ... tracker.md; Get-Content -Raw .scratch/settlement/issues/07-bullet-loa ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (F:\personal pro...n-settlement.md:String) [Get-Content], ItemNotFoundEx 
   ception
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 
# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you are about to work in.

If any of these files don't exist, proceed silently. The `/domain-modeling` skill creates them lazily when terms or decisions get resolved.

## File structure

Single-context repository:

```
/
�"o�"?�"? GLOSSARY.md
�"o�"?�"? docs/
�",   �""�"?�"? adr/
�",       �"o�"?�"? 0001-encrypted-sqlite-sqlcipher.md
�",       �""�"?�"? 0002-append-only-ledger-waterfall.md
�""�"?�"? src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.

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
A flat fee of �,1100 per calendar day assessed once per overdue Loan Account starting the day after the earliest unpaid due date. Cleared upon payment and never carried into future months.
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

F:\personal projects\credkeep\docs\adr\0001-sqlcipher-encrypted-sqlite.md
F:\personal projects\credkeep\docs\adr\0002-append-only-double-entry-ledger.md
F:\personal projects\credkeep\docs\adr\0003-relational-ledger-with-audit-history.md
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

diff --git a/.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md b/.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
new file mode 100644
index 0000000..9f9c1c6
--- /dev/null
+++ b/.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
@@ -0,0 +1,21 @@
+# 07-bullet-loan-settlement
+
+Status: `ready-for-agent`
+
+## Overview
+Bullet loans (Interest-Only recurring charges) currently do not support principal repayment. The `recordCashPayment` engine allocates excess funds to `unallocated_surplus_paise` instead of settling the principal. We need to implement principal settlement for bullet loans.
+
+## Requirements
+1. Modify `recordCashPayment` in `transactionRepository.ts`.
+2. If `loan.product_type === 'bullet'`, after satisfying all due and future markup kists and penalties, apply any `remainingFunds` towards the loan's principal.
+3. If the cumulative principal paid across all transactions equals the `loan.principal_paise`, mark the loan as `SETTLED`.
+4. The principal payment should be recorded in the `transactions` table (e.g., in `allocated_principal_paise` or a new transaction type if needed, but since it's a COLLECTION, adding to `allocated_principal_paise` of the collection transaction is correct). Wait, for a bullet loan, there is no principal in the schedule. So the allocation result doesn't return `allocatedToPrincipal` for the bullet principal part, only for kists.
+5. So, `transactionRepository.ts` must manually allocate to principal, deduct from `unallocatedFunds`, and record it in `allocated_principal_paise`.
+6. Alternatively, update `allocatePayment` to know about the bullet loan principal? No, `allocatePayment` only takes `kists`. The `loan.principal_paise` is not in the schedule.
+7. So `transactionRepository` should handle it.
+
+## Acceptance Criteria
+- Overpayments on bullet loans go towards principal repayment after clearing markup and penalties.
+- When principal is fully paid, the bullet loan closes (`status = 'SETTLED'`).
+- The `allocated_principal_paise` column correctly records the principal paid.
+- Regression tests exist for bullet loan partial principal payment and full settlement.
diff --git a/.workflow/TASKS.md b/.workflow/TASKS.md
index 15f7d7e..c7a7bc8 100644
--- a/.workflow/TASKS.md
+++ b/.workflow/TASKS.md
@@ -1,24 +1,24 @@
 # CredKeep Task Ledger
 
 ## Status Legend
 - **BACKLOG:** Not started.
 - **PLANNED:** Tasks defined by Codex.
 - **IMPLEMENTING:** Gemini is working on it.
 - **REVIEW:** Ready for Codex review.
 - **REWORK:** Requires fixes from Gemini.
 - **VERIFIED:** Validated by Codex.
 - **BLOCKED:** Cannot proceed.
 
 ## Current Tasks
 
 ### P0 (Critical Bugs)
 - [x] CK-P0-001: Payment crash and Wrong-loan payment isolation (Status: SOURCE_QA_APPROVED - PENDING DEVICE_VERIFIED)
 - [x] CK-P0-002: Monthly Kist settlement (Status: SOURCE_QA_APPROVED)
-- [ ] Interest-Only recurring charges (Status: BACKLOG)
+- [x] CK-P0-003: Interest-Only recurring charges (Status: REVIEW)
 - [ ] Stale Home and earnings (Status: BACKLOG)
 
 ### P1 (Enhancements)
 - [ ] Borrower profile (Status: BACKLOG)
 - [ ] PIN/app lock (Status: BACKLOG)
 - [ ] Android safe-area layout (Status: BACKLOG)
 - [ ] Second-phone installation failure (Status: BACKLOG)
diff --git a/src/__tests__/bullet-loan.test.ts b/src/__tests__/bullet-loan.test.ts
new file mode 100644
index 0000000..ca65fb5
--- /dev/null
+++ b/src/__tests__/bullet-loan.test.ts
@@ -0,0 +1,139 @@
+import { LoanRepository } from '../core/database/loanRepository';
+import { TransactionRepository } from '../core/database/transactionRepository';
+import { toPaise } from '../core/domain/money';
+
+describe('Bullet Loan Settlement', () => {
+  let mockDb: any;
+  let loanRepo: LoanRepository;
+  let txRepo: TransactionRepository;
+  let executionLog: any[] = [];
+  let txs: any[] = [];
+  let loanStatus = 'ACTIVE';
+
+  beforeEach(() => {
+    executionLog = [];
+    txs = [];
+    loanStatus = 'ACTIVE';
+    
+    mockDb = {
+      withExclusiveTransactionAsync: jest.fn(async (cb) => {
+        const tx = { ...mockDb };
+        await cb(tx);
+      }),
+      runAsync: jest.fn(async (query, params) => {
+        executionLog.push({ query, params });
+        if (query.includes('INSERT INTO transactions')) {
+          txs.push(params);
+        }
+        if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
+          loanStatus = 'SETTLED';
+        }
+      }),
+      prepareAsync: jest.fn(async (query) => {
+        return {
+          executeAsync: jest.fn(async (params) => {
+            executionLog.push({ query, params });
+          }),
+          finalizeAsync: jest.fn(async () => {})
+        };
+      }),
+      getFirstAsync: jest.fn(async (query, params) => {
+        if (query.includes('loans WHERE id = ?')) {
+          return { 
+            id: params[0], 
+            product_type: 'bullet', 
+            status: loanStatus,
+            principal_paise: 1000000, // 10000 rupees
+            start_date: '2026-01-01',
+            due_day: 1,
+            markup_factor: 0.05,
+            term_months: 1
+          };
+        }
+        if (query.includes('SUM(amount_paise)')) { return { total: 0 }; }
+        if (query.includes('SUM(allocated_penalty_paise)')) { return { total: 0 }; }
+        
+        // Mock to get total principal paid
+        if (query.includes('SUM(allocated_principal_paise)')) { 
+          // we sum up txs manually for the mock
+          // index 7 is allocated_principal_paise
+          const sum = txs.reduce((acc, t) => acc + t[7], 0); 
+          return { total: sum };
+        }
+        
+        return null;
+      }),
+      getAllAsync: jest.fn(async (query, params) => {
+        if (query.includes('repayment_schedules')) {
+          return [
+            {
+              installment_number: 1,
+              total_due_paise: 50000,
+              principal_component_paise: 0,
+              markup_component_paise: 50000,
+              principal_paid_paise: 0,
+              markup_paid_paise: 0,
+              effective_due_date: '2026-01-01', // This causes penalty! Let's change it to 2026-02-01 so it's not overdue
+              status: 'PENDING',
+              amountPaid: 0
+            }
+          ];
+        }
+        if (query.includes('PENALTY_ASSESSMENT')) { return []; }
+        return [];
+      })
+    };
+    
+    loanRepo = new LoanRepository(mockDb);
+    txRepo = new TransactionRepository(mockDb);
+  });
+
+  it('settles bullet loan when principal is fully repaid', async () => {
+    const loanId = 'loan-bullet';
+    const amount = toPaise(10500); // 500 markup + 10000 principal
+    
+    await txRepo.recordCashPayment(loanId, amount, 'op-1', '2026-02-01');
+    
+    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
+    const txInsert = txs.find(t => t[3] === 'COLLECTION');
+    
+    expect(updateLoanStatusQuery).toBeDefined();
+    
+    // Check tx insert values
+    // INSERT INTO transactions (..., amount_paise, allocated_principal_paise, allocated_markup_paise, ...)
+    // 0: id, 1: op_id, 2: loan_id, 3: tx_type, 4: is_cash, 5: pm, 6: amount, 7: prin, 8: markup, 9: pen, 10: unalloc, 11: eff_date, 12: created
+    expect(txInsert[7]).toBe(toPaise(10000)); // allocated principal
+    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
+    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
+  });
+
+  it('partially repays principal of bullet loan without settling', async () => {
+    const loanId = 'loan-bullet';
+    const amount = toPaise(5500); // 500 markup + 5000 principal
+    
+    await txRepo.recordCashPayment(loanId, amount, 'op-2', '2026-02-01');
+    
+    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
+    expect(updateLoanStatusQuery).toBeUndefined(); // Should NOT be settled
+
+    const txInsert = txs.find(t => t[3] === 'COLLECTION');
+    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
+    expect(txInsert[7]).toBe(toPaise(5000)); // allocated principal
+    expect(txInsert[10]).toBe(toPaise(0)); // unallocated
+  });
+  
+  it('handles excess payment as unallocated surplus when principal is overpaid', async () => {
+    const loanId = 'loan-bullet';
+    const amount = toPaise(12500); // 500 markup + 10000 principal + 2000 unallocated
+    
+    await txRepo.recordCashPayment(loanId, amount, 'op-3', '2026-02-01');
+    
+    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
+    expect(updateLoanStatusQuery).toBeDefined();
+
+    const txInsert = txs.find(t => t[3] === 'COLLECTION');
+    expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
+    expect(txInsert[7]).toBe(toPaise(10000)); // Capped at principal due
+    expect(txInsert[10]).toBe(toPaise(2000)); // The excess
+  });
+});
diff --git a/src/core/database/transactionRepository.ts b/src/core/database/transactionRepository.ts
index e55d1d5..37a4dea 100644
--- a/src/core/database/transactionRepository.ts
+++ b/src/core/database/transactionRepository.ts
@@ -1,207 +1,229 @@
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
+
+        const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
+        if (!loan) throw new Error('Loan not found');
         
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
+
+        let bulletPrincipalPaid = 0;
+        if (loan.product_type === 'bullet') {
+          const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
+            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
+            [loanId]
+          );
+          bulletPrincipalPaid = pastPrincipalPaidRes?.total || 0;
+          const remainingPrincipal = loan.principal_paise - bulletPrincipalPaid;
+          
+          if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
+            const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
+            allocatedPrincipal += payPrincipal;
+            result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
+            bulletPrincipalPaid += payPrincipal;
+          }
+        }
         
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
-        const loan = await tx.getFirstAsync<any>(`SELECT product_type FROM loans WHERE id = ?`, [loanId]);
-        
         let allKistsPaid = true;
         for (const k of result.updatedKists) {
           if (k.status !== 'PAID') {
             allKistsPaid = false;
             break;
           }
         }
         
-        // For instalment loans, if all kists are paid and no outstanding penalty remains, settle the loan
-        // For bullet loans, they require an explicit principal repayment transaction to settle (not yet implemented in this method)
-        if (loan && loan.product_type === 'instalment' && allKistsPaid && result.remainingPenalty <= 0) {
-           await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
+        if (loan.product_type === 'instalment') {
+          if (allKistsPaid && result.remainingPenalty <= 0) {
+             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
+          }
+        } else if (loan.product_type === 'bullet') {
+          if (bulletPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
+             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
+          }
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

hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; git show e98f281:.scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md; Get-Content -Raw docs/adr/0002-append-only-double-entry-ledger.md; Get-Content -Raw docs/adr/0003-relational-ledger-with-audit-history.md; rg --files -g 'CONTRIBUTING*' -g '*STANDARDS*' -g 'README.md' -g 'docs/**/*.md' | Sort-Object; git show e98f281:src/core/database/transactionRepository.ts; git show e98f281:src/__tests__/bullet-loan.test.ts; git show e98f281:src/core/database/loanRepository.ts; git show e98f281:src/core/domain/allocation.ts" in F:\personal projects\credkeep
 succeeded in 656ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
# 07-bullet-loan-settlement

Status: `ready-for-agent`

## Overview
Bullet loans (Interest-Only recurring charges) currently do not support principal repayment. The `recordCashPayment` engine allocates excess funds to `unallocated_surplus_paise` instead of settling the principal. We need to implement principal settlement for bullet loans.

## Requirements
1. Modify `recordCashPayment` in `transactionRepository.ts`.
2. If `loan.product_type === 'bullet'`, after satisfying all due and future markup kists and penalties, apply any `remainingFunds` towards the loan's principal.
3. If the cumulative principal paid across all transactions equals the `loan.principal_paise`, mark the loan as `SETTLED`.
4. The principal payment should be recorded in the `transactions` table (e.g., in `allocated_principal_paise` or a new transaction type if needed, but since it's a COLLECTION, adding to `allocated_principal_paise` of the collection transaction is correct). Wait, for a bullet loan, there is no principal in the schedule. So the allocation result doesn't return `allocatedToPrincipal` for the bullet principal part, only for kists.
5. So, `transactionRepository.ts` must manually allocate to principal, deduct from `unallocatedFunds`, and record it in `allocated_principal_paise`.
6. Alternatively, update `allocatePayment` to know about the bullet loan principal? No, `allocatePayment` only takes `kists`. The `loan.principal_paise` is not in the schedule.
7. So `transactionRepository` should handle it.

## Acceptance Criteria
- Overpayments on bullet loans go towards principal repayment after clearing markup and penalties.
- When principal is fully paid, the bullet loan closes (`status = 'SETTLED'`).
- The `allocated_principal_paise` column correctly records the principal paid.
- Regression tests exist for bullet loan partial principal payment and full settlement.
# 0002. Append-Only Double-Entry Ledger and Waterfall Engine

**Status**: Superseded by ADR-0003

## Context
Earlier planning proposed a full event-sourced double-entry accounting engine with SHA-256 cryptographic hash chaining for each collection receipt, emulating distributed ledgers.

## Reason for Superseding
1. **Unnecessary Complexity**: For a single-financier offline ledger, full event-sourcing with event reducers adds substantial query latency, complex snapshotting, and difficult schema migrations without providing business value over relational tables with immutable transaction journals.
2. **False Security Illusion**: A SHA-256 hash chain stored inside an on-device SQLite database does not protect against tampering by someone with root access to the device or database file, because an attacker with the write key can simply recompute the entire hash chain. True tamper-evidence requires external hardware HSMs or remote timestamping authorities, which are deferred.
3. **Auditability Without Overkill**: Single-financier compliance requires immutable transaction logs, explicit correction records with timestamps, and foreign-key integrity, which relational tables provide naturally.

# 0003. Relational Transaction Ledger with Materialized Balances, Persistent Idempotency, and Direct Kist Penalties

**Status**: Accepted (Supersedes ADR-0002)

## Context
CredKeep V1 is an offline-first, single-financier lending ledger operating on Android. The application requires:
1. Fast indexed dashboard and borrower queries without computing entire account histories from raw transaction logs on every render.
2. An auditable, append-only financial ledger where no historic transaction can be deleted or silently modified at runtime.
3. Persistent protection against duplicate payment entries across application crashes, background process kills, or rapid user retries.
4. An intuitive, transparent penalty model: �,1100/day assessed per overdue loan (not multiplied per overdue kist), cleared alongside the instalment, with next month starting clean at its scheduled amount.
5. Direct sequential allocation of extra payments to future scheduled kists without exposing a complex advance-wallet interface.
6. Support for one-time instalment due-date revisions while preserving original contractual due dates and historical penalties.
7. Crash resilience ensuring an unexpected device shutdown or power loss mid-operation leaves zero inconsistent states between materialized balances and transaction logs.

Full event-sourcing with dynamic CQRS projections and blockchain-style hash chains were rejected (ADR-0002) as overengineered for a single-financier offline deployment.

## Decision

We implement a normalized relational financial schema using SQLite. The design combines **immutable transaction records** with **materialized balance columns**, governed by database-level constraints, atomic transaction blocks, and deterministic in-memory financial domain logic.

---

### 1. Database Configuration & Transaction Wrapper (`expo-sqlite ~57.0.4`)

Transaction execution strictly adheres to the official API provided by the installed `expo-sqlite` package:
- **Pragma Initialization**:
  On every database connection open:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  ```
- **Transaction Wrapper**:
  All multi-statement financial mutations must execute inside:
  ```typescript
  await db.withExclusiveTransactionAsync(async (tx) => {
    // Financial statements executed here
  });
  ```
- **Prohibition on Raw Transaction SQL**:
  Never execute manual SQL strings such as `BEGIN TRANSACTION`, `BEGIN IMMEDIATE`, or `COMMIT` directly inside `withExclusiveTransactionAsync`. In `expo-sqlite`, transaction lifecycle and locking are managed by the native bridge wrapper; manual transaction SQL causes internal state collisions and crashes.
- **Concurrency & Locking**:
  `withExclusiveTransactionAsync` acquires an exclusive lock (`BEGIN EXCLUSIVE` natively). Other concurrent asynchronous read/write queries are blocked until the block completes and commits, or automatically rolls back on an unhandled exception.

---

### 2. Append-Only Transaction Invariants & Immutability Safeguards

The `transactions` table represents the canonical journal of financial events (Disbursements, Collections, Penalties, Waivers, Adjustments, Reversals, Write-Offs):
- **Insert-Only Enforcement**:
  SQLite triggers actively prevent `UPDATE` and `DELETE` operations at runtime:
  ```sql
  CREATE TRIGGER prevent_transactions_update
  BEFORE UPDATE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Transactions table is append-only: updates are prohibited');
  END;

  CREATE TRIGGER prevent_transactions_delete
  BEFORE DELETE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Transactions table is append-only: deletions are prohibited');
  END;
  ```
- **Monotonic Sequence Ordering**:
  Transactions record an auto-incrementing integer `sequence_number` along with an ISO-8601 UTC timestamp to provide unambiguous ordering during reconciliation and audit replays.

---

### 3. Persistent Database-Enforced Payment Idempotency

UI debouncing and in-memory async mutexes are user-experience affordances to reduce duplicate network or bridge traffic, but **they are not correctness guarantees**. Correctness is enforced persistently by the database engine:
- Every mutation request requires a client-generated UUIDv4 `operation_id` generated when the submission action is initiated.
- The `transactions` table enforces a persistent unique index:
  ```sql
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    operation_id TEXT NOT NULL,
    loan_id TEXT NOT NULL,
    sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_type TEXT NOT NULL, -- 'DISBURSEMENT', 'COLLECTION', 'PENALTY_ASSESSMENT', 'PENALTY_WAIVER', 'WRITE_OFF', 'REFUND', 'COLLECTION_REVERSAL'
    is_cash INTEGER NOT NULL DEFAULT 1, -- 1 for physical/bank cash flows, 0 for noncash ledger adjustments
    payment_method TEXT NOT NULL DEFAULT 'CASH', -- 'CASH', 'UPI', 'BANK_TRANSFER'
    amount_paise INTEGER NOT NULL DEFAULT 0, -- Gross cash flow (0 for noncash adjustments)
    allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
    allocated_markup_paise INTEGER NOT NULL DEFAULT 0,
    allocated_penalty_paise INTEGER NOT NULL DEFAULT 0,
    unallocated_surplus_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_principal_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_markup_paise INTEGER NOT NULL DEFAULT 0,
    forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
    effective_date TEXT NOT NULL, -- ISO date YYYY-MM-DD
    created_at TEXT NOT NULL, -- ISO-8601 UTC timestamp
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
  );

  CREATE UNIQUE INDEX idx_transactions_operation_id ON transactions(operation_id);
  ```
- **Idempotent Handling**:
  If a duplicate submission occurs (e.g., following an app restart after an interrupted response or double-tap), SQLite raises a `SQLITE_CONSTRAINT_UNIQUE` violation. The repository intercepts this error, queries the existing transaction by `operation_id`, and safely returns the existing record without mutating balances.

---

### 4. Simplified Late Penalty Behavior & Per-Loan Cap

The penalty model matches the product owner's direct mental model without complex UI period abstractions:
1. **Per-Loan Daily Fee**: The penalty rate is �,1100 per calendar day (`10000` paise).
2. **Per Loan, Not Per Instalment**: If multiple kists are overdue simultaneously, the fee does NOT multiply. Overdue days are calculated from the earliest unpaid effective due date:
   $$\text{OverdueDays} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate})\right)$$
   $$\text{LatePenalty} = \text{OverdueDays} \times �,1100$$
3. **Clean Monthly Cycles**:
   - For an overdue installment, the UI displays:
     $$\text{Total Payable} = \text{Scheduled Kist (�,12,600)} + \text{Late Penalty (�,1500)} = \mathbf{�,13,100}$$
   - When �,13,100 is collected, that month's installment is marked **Paid** and the penalty is **Cleared**.
   - **Next Month Starts Clean**: The next month sits at its original scheduled amount of �,12,600. Paid penalties are never carried into future months.
4. **Idempotent Daily Assessment**: Running penalty calculations multiple times on the same calendar day assesses the fee exactly once using key `penalty_<loan_id>_<YYYY-MM-DD>`.

---

### 5. Extra Payments & Sequential Future Kist Reduction

CredKeep V1 eliminates advance-wallet interfaces:
- Extra cash beyond current obligations applies immediately to reduce the **earliest unpaid future scheduled kist(s)** in chronological order.
- In `repayment_schedules`:
  ```sql
  CREATE TABLE repayment_schedules (
    id TEXT PRIMARY KEY NOT NULL,
    loan_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL,
    original_due_date TEXT NOT NULL, -- Contractual anchor date
    effective_due_date TEXT NOT NULL, -- Active calculation date (modified via schedule_modifications)
    principal_component_paise INTEGER NOT NULL,
    markup_component_paise INTEGER NOT NULL,
    total_due_paise INTEGER NOT NULL,
    principal_paid_paise INTEGER NOT NULL DEFAULT 0,
    markup_paid_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIALLY_PAID', 'PAID'
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
  );
  ```
- Extra payments directly increase `principal_paid_paise` and `markup_paid_paise` on future kists. The future kist displays its remaining net payable balance without changing its scheduled due date.
- Any payment exceeding the total face value of the entire loan is routed to `unallocated_surplus_paise` for refunding.

---

### 6. One-Time Single-Instalment Due-Date Changes

Financiers can reschedule a single kist without disrupting other dates:
- Recorded in `schedule_modifications`:
  ```sql
  CREATE TABLE schedule_modifications (
    id TEXT PRIMARY KEY NOT NULL,
    loan_id TEXT NOT NULL,
    kist_id TEXT NOT NULL,
    original_due_date TEXT NOT NULL,
    prior_effective_due_date TEXT NOT NULL,
    revised_effective_due_date TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    reason TEXT,
    accrued_penalty_action TEXT NOT NULL, -- 'RETAIN' or 'WAIVE'
    waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
    operation_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
  );
  ```
- Only the target kist's `effective_due_date` updates in `repayment_schedules`. Subsequent kist due dates remain intact.
- If `accrued_penalty_action = 'WAIVE'`, a noncash `PENALTY_WAIVER` transaction row is inserted in the same atomic transaction, reducing `outstanding_penalty_paise`.

---

### 7. Comprehensive Reconciliation Equations

When full reconciliation executes, the system asserts mathematical identity across the entire ledger:

1. **Cash Ledger Reconciliation**:
   $$\text{TotalCashCollected} = \sum_{\substack{T \in \text{transactions} \\ T.\text{transaction\_type} = \text{'COLLECTION'}}} T.\text{amount\_paise} - \sum_{\substack{R \in \text{transactions} \\ R.\text{transaction\_type} = \text{'REFUND'}}} R.\text{amount\_paise}$$
   *Noncash waivers, bad-debt write-offs, and daily penalty assessments have $\text{amount\_paise} = 0$ and never inflate cash totals.*

2. **Principal Balance Reconciliation**:
   $$\text{MaterializedPrincipal} = \text{PrincipalDisbursed} - \sum \text{AllocatedPrincipal} - \sum \text{ForgivenPrincipal} + \sum \text{ReversedPrincipal}$$

3. **Markup Balance Reconciliation**:
   $$\text{MaterializedMarkup} = \text{ContractualMarkup} - \sum \text{AllocatedMarkup} - \sum \text{ForgivenMarkup} + \sum \text{ReversedMarkup}$$

4. **Penalty Balance Reconciliation**:
   $$\text{MaterializedPenalty} = \sum \text{AccruedPenalties} - \sum \text{AllocatedPenalty} - \sum \text{ForgivenPenalty} + \sum \text{ReversedPenalty}$$

5. **Schedule Balance Reconciliation**:
   For every kist $k$:
   $$\text{RemainingKistPayable}_k = \text{total\_due\_paise}_k - (\text{principal\_paid\_paise}_k + \text{markup\_paid\_paise}_k)$$

6. **Total Outstanding Receivable**:
   $$\text{TotalReceivable} = \text{MaterializedPrincipal} + \text{MaterializedMarkup} + \text{MaterializedPenalty} - \text{MaterializedSurplus}$$

---

### 8. Historical Payment Reversal Policy (LIFO)

1. **Latest-Payment Reversal Only (LIFO)**:
   In V1, **only the single latest active payment on a specific loan account may be reversed**.
2. **Rejection of Historical Reversals**:
   If a financier attempts to reverse an older payment when subsequent payments exist on that loan account, the engine **strictly rejects the request** with error code `CANNOT_REVERSE_HISTORICAL_PAYMENT`. The application will not perform silent cascading reallocations or multi-transaction rewrites.
3. **Compensating Reversal Transaction**:
   The reversal inserts a compensating transaction of type `COLLECTION_REVERSAL`:
   - Offsetting cash outflow logged.
   - Allocation legs inverted.
   - Scheduled kist paid amounts restored in reverse order.
   - Dynamic recomputation of Days Past Due (DPD) as of current calculation date.

---

## Required Automated Test Scenarios

The financial test suite must explicitly validate:
1. **On-Time Payment**: Full payment of �,12,600 on due date &rarr; status `PAID`, �,10 penalty, next month starts clean at �,12,600.
2. **Single Kist 5 Days Late**: �,12,600 paid 5 days late &rarr; $5 \times �,1100 = \mathbf{�,1500}$ penalty; total collected �,13,100; kist `PAID`, penalty cleared; next month starts clean at scheduled �,12,600.
3. **Independent Consecutive Late Payments**: Month 1 paid 5 days late (�,13,100 collected); Month 2 paid 5 days late &rarr; independently payable as �,13,100; zero penalty carried from Month 1.
4. **Multiple Overdue Kists (Two Kists)**: Two kists overdue for 12 days &rarr; total penalty on loan is exactly $12 \times �,1100 = \mathbf{�,11,200}$ (not �,12,400).
5. **Multiple Overdue Kists (Three Kists)**: Three kists overdue for 5 days &rarr; total penalty on loan is exactly $5 \times �,1100 = \mathbf{�,1500}$ (not �,11,500).
6. **Surplus Payment to Next Kist**: �,12,700 paid on �,12,600 kist &rarr; Kist 1 `PAID` (�,12,600), Kist 2 remaining payable is �,12,500 due on its original scheduled date.
7. **Lump Sum Across Multiple Kists**: �,16,000 paid against �,12,600 kists &rarr; Kist 1 `PAID` (�,12,600), Kist 2 `PAID` (�,12,600), Kist 3 `PARTIALLY_PAID` (�,1800 paid, �,11,800 remaining).
8. **Partial Payment**: �,11,000 paid against �,12,600 kist &rarr; Kist 1 `PARTIALLY_PAID`, �,11,600 remaining due.
9. **Single Kist Rescheduling**: Kist 2 moved from 10 Nov to 15 Nov &rarr; Kist 3 due date remains 10 Dec; paid on 15 Nov incurs �,10 penalty.
10. **Reschedule with Penalty Waiver**: Kist extended after �,1300 penalties accrued with `WAIVE` option &rarr; records `PENALTY_WAIVER`, restores penalty balance to �,10.
11. **Penalty Stops When Current**: All overdue kists cleared &rarr; penalty accrual stops immediately; future kists sit at scheduled �,12,600.
12. **Penalty Resumes on Later Miss**: Loan current in Oct; Nov kist missed &rarr; daily �,1100 accrual resumes starting day after Nov due date.
13. **Idempotent Daily Assessment**: Running penalty evaluation 10 times on the same date produces exactly one �,1100 daily fee.
14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and �,1100 of K2 &rarr; both kists and DPD restore to exact prior states.
15. **Month-End Leap Year Clamping**: Loan created with Anchor Day 31 across Jan-Feb-Mar 2028 (leap year) &rarr; Jan 31, Feb 29, Mar 31.
16. **Exception Rollback vs. Process-Termination Recovery**:
    - *Exception Rollback*: Verify transaction rollback on runtime exception.
    - *Process-Termination Recovery*: Verify SQLite WAL recovery on native crash leaving zero corruption.

---

## Consequences
- **Positive**:
  - Direct mental model aligns with real-world field collections.
  - Zero carrying of paid penalties into future months.
  - High query speed via materialized balances on loans and schedules.
  - Zero duplicate penalties or double-collections via database-enforced idempotency keys.
  - Excess funds reduce future kists without advance-wallet confusion.
  - Flexible field rescheduling without breaking subsequent schedules.
- **Negative / Trade-offs**:
  - Reversals in V1 are constrained to the latest payment (LIFO), preventing arbitrary out-of-order historical edits.
  - Materialized balances require strict discipline to update only within exclusive transactions alongside journal rows.

docs\adr\0001-sqlcipher-encrypted-sqlite.md
docs\adr\0002-append-only-double-entry-ledger.md
docs\adr\0003-relational-ledger-with-audit-history.md
docs\agents\domain.md
docs\agents\issue-tracker.md
docs\agents\triage-labels.md
docs\FINANCIAL_RULES.md
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

hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; Get-Content -Raw docs/FINANCIAL_RULES.md; rg -n \"bullet|operation_id|withExclusiveTransactionAsync|cross.loan|allocated_principal|SETTLED|sqlite\" src --glob '*.ts' --glob '*.tsx'; rg -n \"CREATE TABLE (loans|transactions|repayment_schedules)|UNIQUE.*operation|CHECK|FOREIGN KEY|prevent_transactions\" src; rg --files | rg \"(bun\\.lock|package-lock|yarn\\.lock|pnpm-lock|test|spec)\"" in F:\personal projects\credkeep
 succeeded in 589ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
# CredKeep V1 �?" Financial Rules & Calculation Engine

**Status:** Approved & Simplified Product Specification  
**Context:** Offline-First, Single-Financier Mobile Lending Ledger (Android)

---

## 1. Monetary Units & Arithmetic Principles

1. **Integer Paise Storage**:
   - All monetary figures (Principal, Markup, Penalties, Collections, Balances) are stored and computed strictly as integer **Paise** (`1 INR = 100 Paise`).
   - Floating-point arithmetic is prohibited in domain logic and database schema.
   - Example: �,12,600.00 is stored as `260000` paise; �,1100.00 daily late fee is stored as `10000` paise.
2. **Contractual Face Value Conservation**:
   $$\text{ContractualFaceValuePaise} = \text{PrincipalDisbursedPaise} + \text{ContractualMarkupPaise}$$
3. **Strict Separation of Balances**:
   Contractual principal and markup are tracked independently from late penalties. Penalties never compound and are never added to principal.

---

## 2. Simplified Late Penalty Behavior

### 2.1 The Core Mental Model
In the user interface, the financier sees a simple, transparent breakdown for any overdue installment:

$$\text{Total Payable} = \text{Scheduled Instalment} + \text{Late Penalty}$$

- **Rate**: �,1100 per calendar day (`10000` paise).
- **Grace**: No penalty on the due date itself. The first chargeable day is the day immediately following the due date.
- **Example (Single Kist)**:
  - Scheduled Kist: �,12,600
  - Paid 5 days late: Late Penalty = $5 \times �,1100 = \mathbf{�,1500}$
  - Total Collected: �,12,600 + �,1500 = **�,13,100**
  - **Outcome**: The kist is marked **Paid**, and the �,1500 penalty is **Cleared**.
  - **Next Month**: Starts fresh at its original scheduled amount of **�,12,600**. Paid penalties are **never carried into future months**. If the next month is also paid 5 days late, its payable is independently �,13,100.

### 2.2 Multiple Overdue Instalments (Per-Loan Cap)
If a borrower misses multiple instalments simultaneously:
- **The penalty does NOT multiply per instalment.**
- The loan incurs a maximum of **�,1100 per calendar day total**.
- Overdue days are calculated from the **earliest unpaid effective due date**:
  $$\text{OverdueDays} = \max\left(0, \text{differenceInCalendarDays}(\text{asOfDate}, \text{earliestUnpaidDueDate})\right)$$
  $$\text{ActiveLatePenalty} = \text{OverdueDays} \times �,1100$$

#### Concrete Example:
- Kist 1 (�,12,600) was due on `10 Oct`.
- Kist 2 (�,12,600) was due on `10 Nov`.
- On `22 Nov` (36 days after Kist 1, 12 days after Kist 2):
  - Total overdue days on the loan = **43 days** (from 11 Oct to 22 Nov).
  - Total Late Penalty = $43 \times �,1100 = \mathbf{�,14,300}$ (NOT $43 \times 100 + 12 \times 100$).
  - Total to bring loan current: Kist 1 (�,12,600) + Kist 2 (�,12,600) + Penalty (�,14,300) = **�,19,500**.

### 2.3 Clearing Overdue Status
- When all instalments whose due dates have passed are paid:
  - The loan is **current**.
  - No further late penalties accrue.
  - Future instalments sit at their original scheduled amounts.
- **Manual Waiver**:
  The financier can waive the late fee at any time (e.g., collect �,12,600 instead of �,13,100). The app marks the kist Paid and writes a `PENALTY_WAIVER` noncash audit record for �,1500.

---

## 3. Extra Payments Automatically Reduce Future Kists

CredKeep V1 eliminates advance wallets, credit balances, and virtual holding accounts.

### 3.1 Direct Sequential Reduction
- Any cash collected in excess of current due amounts is automatically applied to reduce the **earliest unpaid future scheduled kist(s)** in chronological order.
- Future kists show their reduced remaining balance directly.
- Original contractual due dates of future kists **do not change**.

### 3.2 Concrete Examples
- **Example A (Small Surplus)**:
  - Kist 1 due today: �,12,600.
  - Borrower pays: �,12,700.
  - Kist 1: Marked **Paid** (�,12,600 allocated).
  - Kist 2 (due next month): Receives �,1100 credit. **Remaining payable on Kist 2 is now �,12,500**.
- **Example B (Lump Sum Covering Future Kists)**:
  - Monthly kists: �,12,600 each. Kist 1 due today.
  - Borrower pays: �,16,000.
  - Kist 1: **Paid** (�,12,600 allocated).
  - Kist 2: **Paid** (�,12,600 allocated).
  - Kist 3: **Partially Paid** (�,1800 allocated, �,11,800 remaining payable on its scheduled date).
  - Kists 4�?"10: Remain at �,12,600 each.

---

## 4. One-Time Single-Instalment Due Date Changes

The financier can reschedule a single kist without shifting other months.

- **Example**:
  - Original Schedule: Kist 1 (10 Oct), Kist 2 (10 Nov), Kist 3 (10 Dec).
  - Borrower requests extra time for Kist 2: Financier moves Kist 2 to **15 Nov**.
  - **Outcome**: Kist 2 is due 15 Nov. **Kist 3 remains due on 10 Dec**.
- **Penalty Handling on Date Change**:
  - Overdue calculations use `effective_due_date` (15 Nov).
  - If the kist had already accrued penalties before the extension, the UI presents a clear choice:
    - **Retain Penalty**: Already accrued penalties remain payable.
    - **Waive Penalty**: Already accrued penalties are waived to �,10.
  - In both cases, no *new* penalties accrue between 10 Nov and 15 Nov.

---

## 5. Monthly Anchor Day & Calendar Semantics

1. **Anchor Day Selection (1 to 31)**:
   - Quick presets: 1, 5, 10, 15, 20, 25, 28.
   - Custom: Any integer from 1 to 31.
2. **Short Month Clamping**:
   - For months with fewer days than the anchor day, the due date clamps to the final day of that month.
   - Subsequent months restore the original anchor day.
   - Example (Anchor Day 31):
     - Jan: 31 Jan
     - Feb: 28 Feb (or 29 Feb in leap years) *(clamped)*
     - Mar: 31 Mar *(restored)*
     - Apr: 30 Apr *(clamped)*

---

## 6. Cash-First Payment Recording

- **Cash** is the default payment method.
- **UPI** and **Bank Transfer** are available as manual reference options.
- The UI displays:
  - `Scheduled Kist`: �,12,600
  - `Late Penalty`: �,1500 (if late)
  - `Total Amount Received` input (prefilled with total payable)
- Recording payment executes atomically: updates kist status, reduces balances, logs the transaction journal entry.
- Minimal on-screen confirmation shown; external receipt printing and WhatsApp sharing are deferred beyond V1.

---

## 7. Financial Engine Test Specifications

The pure TypeScript domain test suite must validate:

1. **On-Time Payment**: Pay �,12,600 on due date &rarr; Kist marked `PAID`, �,10 penalty, next month starts clean at �,12,600.
2. **Single Kist 5 Days Late**: Pay �,12,600 five days late &rarr; penalty calculated as $5 \times �,1100 = \mathbf{�,1500}$; total collected �,13,100; kist `PAID`, penalty cleared; next month starts clean at �,12,600.
3. **Independent Consecutive Late Payments**: Month 1 paid 5 days late (�,13,100 collected); Month 2 paid 5 days late &rarr; independently payable as �,13,100 (�,1500 penalty), no penalty carried over from Month 1.
4. **Two Overdue Kists (Single Daily Rate)**: Both Kist 1 and Kist 2 overdue for 12 days &rarr; total penalty on loan is exactly $12 \times �,1100 = \mathbf{�,11,200}$ (NOT �,12,400).
5. **Three Overdue Kists**: Three kists overdue for 5 days &rarr; total penalty on loan is exactly $5 \times �,1100 = \mathbf{�,1500}$ (NOT �,11,500).
6. **Surplus Payment to Next Kist**: �,12,700 paid on �,12,600 kist &rarr; Kist 1 `PAID` (�,12,600), Kist 2 remaining payable is �,12,500 due on its original date.
7. **Lump Sum Across Multiple Kists**: �,16,000 paid against �,12,600 kists &rarr; Kist 1 `PAID` (�,12,600), Kist 2 `PAID` (�,12,600), Kist 3 `PARTIALLY_PAID` (�,1800 paid, �,11,800 remaining).
8. **Partial Payment**: �,11,000 paid against �,12,600 kist &rarr; Kist 1 `PARTIALLY_PAID`, �,11,600 remaining due.
9. **Single Kist Rescheduled**: Kist 2 changed from 10 Nov to 15 Nov &rarr; Kist 3 remains due on 10 Dec. Paid on 15 Nov incurs �,10 penalty.
10. **Reschedule with Waiver**: Kist extended after �,1300 penalties accrued, with waiver selected &rarr; penalty balance resets to �,10; kist due date extended.
11. **Penalty Stops When Current**: All overdue kists cleared &rarr; penalty accrual stops immediately; future kists sit at scheduled �,12,600.
12. **Penalty Resumes on Later Miss**: Loan current in Oct; Nov kist missed &rarr; daily �,1100 accrual resumes starting day after Nov due date.
13. **Idempotent Daily Assessment**: Running penalty evaluation 10 times on the same date produces exactly one �,1100 daily fee.
14. **Payment Reversal (Latest Only)**: Reverse payment that paid K1 and �,1100 of K2 &rarr; K1 and K2 restore exact prior unpaid balances; DPD recalculates cleanly.
15. **Anchor Day 31 Clamping**: Anchor Day 31 over Jan-Feb-Mar 2028 (leap year) &rarr; Jan 31, Feb 29, Mar 31.

---

## 8. Remaining Product & Legal Decisions (Marked Unapproved)

The following parameters are documented with architect recommendations, but remain **unapproved pending formal confirmation**:

1. **Statutory Penalty Cap**:
   - *Status*: **Needs Legal Review**.
   - *Recommendation*: Cap total accrued penalties at 25% or 50% of the loan principal to comply with Indian state Money Lenders Acts and Usurious Loans Act 1918.
2. **Partial Payment Impact on Daily Overdue Accrual**:
   - *Status*: **Needs Product Decision**.
   - *Recommendation*: The �,1100 daily fee continues as long as *any* non-zero balance remains on a past-due kist.
3. **Cash Allocation Priority (Penalties vs Kists)**:
   - *Status*: **Approved (INSTALMENT_FIRST)**.
   - *Decision*: 
     1. Apply incoming payments toward the oldest unpaid scheduled instalment first.
     2. Only after due instalment obligations are covered, apply remaining funds toward outstanding penalties.
     3. If the scheduled instalment is completely covered but its penalty remains unpaid, mark the instalment PAID and keep the penalty outstanding separately.
     4. Stop further daily penalty accrual when all overdue instalment obligations are cleared, even when historical penalties remain unpaid. Example: �,12,600 instalment + �,1500 penalty. Borrower pays �,12,600. The instalment becomes PAID, �,1500 penalty remains outstanding, and no further penalty accrues for that overdue period.
     5. The next month's contractual instalment remains unchanged at �,12,600.
     6. If a borrower pays an excess amount (e.g., �,12,700 against a �,12,600 instalment with no penalty), apply �,1100 toward the next unpaid instalment.
     7. Never multiply �,1100/day by the number of missed instalments on the same loan.
     8. Preserve principal, markup, penalty, and future-instalment allocations separately using integer paise.
4. **Early Loan Settlement / Foreclosure Rebate**:
   - *Status*: **Needs Product Decision**.
   - *Recommendation*: Support configurable settlement options: `FLAT_NO_REBATE` (full contractual face value owed) vs `PRO_RATA_REBATE` (unearned markup credited).

src\__tests__\cross-loan.test.ts:19:      withExclusiveTransactionAsync: jest.fn(async (cb) => {
src\__tests__\cross-loan.test.ts:41:        if (query.includes('operation_id = ?')) {
src\__tests__\bullet-loan.test.ts:19:      withExclusiveTransactionAsync: jest.fn(async (cb) => {
src\__tests__\bullet-loan.test.ts:28:        if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
src\__tests__\bullet-loan.test.ts:29:          loanStatus = 'SETTLED';
src\__tests__\bullet-loan.test.ts:44:            product_type: 'bullet', 
src\__tests__\bullet-loan.test.ts:57:        if (query.includes('SUM(allocated_principal_paise)')) { 
src\__tests__\bullet-loan.test.ts:59:          // index 7 is allocated_principal_paise
src\__tests__\bullet-loan.test.ts:91:  it('settles bullet loan when principal is fully repaid', async () => {
src\__tests__\bullet-loan.test.ts:92:    const loanId = 'loan-bullet';
src\__tests__\bullet-loan.test.ts:97:    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
src\__tests__\bullet-loan.test.ts:103:    // INSERT INTO transactions (..., amount_paise, allocated_principal_paise, allocated_markup_paise, ...)
src\__tests__\bullet-loan.test.ts:110:  it('partially repays principal of bullet loan without settling', async () => {
src\__tests__\bullet-loan.test.ts:111:    const loanId = 'loan-bullet';
src\__tests__\bullet-loan.test.ts:116:    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
src\__tests__\bullet-loan.test.ts:126:    const loanId = 'loan-bullet';
src\__tests__\bullet-loan.test.ts:131:    const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
src\core\database\borrowerRepository.ts:1:import { SQLiteDatabase } from 'expo-sqlite';
src\core\database\db.ts:1:import * as SQLite from 'expo-sqlite';
src\core\database\db.ts:33:  // Note: expo-sqlite SDK 50+ natively supports opening databases.
src\core\database\transactionRepository.ts:1:import { SQLiteDatabase } from 'expo-sqlite';
src\core\database\transactionRepository.ts:17:      await this.db.withExclusiveTransactionAsync(async (tx) => {
src\core\database\transactionRepository.ts:19:        const existing = await tx.getFirstAsync(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
src\core\database\transactionRepository.ts:28:        // Ensure schedule is up to date (for bullet loans)
src\core\database\transactionRepository.ts:84:        let bulletPrincipalPaid = 0;
src\core\database\transactionRepository.ts:85:        if (loan.product_type === 'bullet') {
src\core\database\transactionRepository.ts:87:            `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
src\core\database\transactionRepository.ts:90:          bulletPrincipalPaid = pastPrincipalPaidRes?.total || 0;
src\core\database\transactionRepository.ts:91:          const remainingPrincipal = loan.principal_paise - bulletPrincipalPaid;
src\core\database\transactionRepository.ts:97:            bulletPrincipalPaid += payPrincipal;
src\core\database\transactionRepository.ts:103:            id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
src\core\database\transactionRepository.ts:104:            amount_paise, allocated_principal_paise, allocated_markup_paise, 
src\core\database\transactionRepository.ts:144:             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
src\core\database\transactionRepository.ts:146:        } else if (loan.product_type === 'bullet') {
src\core\database\transactionRepository.ts:147:          if (bulletPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
src\core\database\transactionRepository.ts:148:             await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
src\core\database\transactionRepository.ts:244:        const existing = await tx.getFirstAsync(`SELECT id FROM transactions WHERE operation_id = ?`, [operationId]);
src\core\database\transactionRepository.ts:248:              id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
src\core\database\transactionRepository.ts:249:              amount_paise, allocated_principal_paise, allocated_markup_paise, 
src\core\database\transactionRepository.ts:285:        SUM(t.allocated_principal_paise) as principal_returned,
src\core\database\DatabaseProvider.tsx:2:import { SQLiteDatabase } from 'expo-sqlite';
src\core\domain\schedule.ts:10:  productType: 'instalment' | 'bullet';
src\core\domain\schedule.ts:60:  } else if (productType === 'bullet') {
src\core\database\schema.ts:1:import { SQLiteDatabase } from 'expo-sqlite';
src\core\database\schema.ts:4:  await db.withExclusiveTransactionAsync(async (tx) => {
src\core\database\schema.ts:54:        operation_id TEXT UNIQUE NOT NULL,
src\core\database\schema.ts:61:        allocated_principal_paise INTEGER NOT NULL DEFAULT 0,
src\core\database\schema.ts:104:        operation_id TEXT NOT NULL UNIQUE,
src\core\database\loanRepository.test.ts:14:      withExclusiveTransactionAsync: jest.fn(async (cb) => {
src\core\domain\schedule.test.ts:56:    it('monthly fixed-charge bullet schedules, principal due at maturity', () => {
src\core\domain\schedule.test.ts:68:        productType: 'bullet'
src\core\database\loanRepository.ts:1:import { SQLiteDatabase } from 'expo-sqlite';
src\core\database\loanRepository.ts:30:    await this.db.withExclusiveTransactionAsync(async (tx) => {
src\core\database\loanRepository.ts:87:    if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE') return;
src\core\domain\models.ts:11:  productType: 'instalment' | 'bullet';
src\app\(tabs)\loans.tsx:30:  const [productType, setProductType] = useState<'instalment' | 'bullet'>('instalment');
src\app\(tabs)\loans.tsx:154:          style={[styles.productBtn, productType === 'bullet' && styles.productBtnActive]}
src\app\(tabs)\loans.tsx:155:          onPress={() => setProductType('bullet')}
src\app\(tabs)\loans.tsx:157:          <Typography color={productType === 'bullet' ? '#fff' : theme.colors.primary}>Monthly Bullet</Typography>
src\app\settings\backup.tsx:7:import * as SQLite from 'expo-sqlite';
src\app\settings\backup.tsx:131:      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
src\app\settings\backup.tsx:132:      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
src\app\settings\backup.tsx:134:        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
src\app\settings\backup.tsx:149:        // NOTE: expo-sqlite doesn't have an explicit close() in the standard API for SDK 50+, 
src\core\database\schema.ts:28:        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT
src\core\database\schema.ts:46:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
src\core\database\schema.ts:70:        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT
src\core\database\schema.ts:76:      CREATE TRIGGER IF NOT EXISTS prevent_transactions_update
src\core\database\schema.ts:84:      CREATE TRIGGER IF NOT EXISTS prevent_transactions_delete
src\core\database\schema.ts:105:        FOREIGN KEY (kist_id) REFERENCES repayment_schedules(id) ON DELETE RESTRICT
src\__tests__\loans.test.tsx
src\__tests__\cross-loan.test.ts
src\__tests__\bullet-loan.test.ts
src\core\domain\schedule.test.ts
src\core\domain\penalty.test.ts
src\core\domain\money.test.ts
src\core\domain\backupUtil.test.ts
src\core\domain\allocation.test.ts
src\core\database\loanRepository.test.ts
package-lock.json

hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; Get-Content -Raw src/core/domain/schedule.ts; Get-Content -Raw src/core/database/schema.ts; Get-Content -Raw src/__tests__/cross-loan.test.ts; Get-Content -Raw src/core/database/loanRepository.test.ts; git show --format=fuller --no-patch e98f281; git diff --check fb8a96b...e98f281' in F:\personal projects\credkeep
 exited 1 in 473ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
import { Paise, multiplyPaise, dividePaise, subtractPaise, addPaise } from './money';
import { ScheduledKist } from './models';

export type ScheduleOptions = {
  principal: Paise;
  markupFactor: number;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1-31
  productType: 'instalment' | 'bullet';
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

export function generateSchedule(options: ScheduleOptions): ScheduledKist[] {
  const { principal, markupFactor, termMonths, startDate, dueDay, productType } = options;
  
  const totalMarkup = multiplyPaise(principal, markupFactor);
  const totalRepayment = addPaise(principal, totalMarkup);
  
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

import { LoanRepository } from './loanRepository';
import { toPaise } from '../domain/money';

describe('LoanRepository Integration', () => {
  let mockDb: any;
  let repo: LoanRepository;
  let queries: any[] = [];
  let statements: any[] = [];

  beforeEach(() => {
    queries = [];
    statements = [];
    mockDb = {
      withExclusiveTransactionAsync: jest.fn(async (cb) => {
        await cb();
      }),
      runAsync: jest.fn(async (query, params) => {
        queries.push({ query, params });
      }),
      prepareAsync: jest.fn(async (query) => {
        const stmt = {
          executeAsync: jest.fn(async (params) => {
            statements.push({ query, params });
          }),
          finalizeAsync: jest.fn(async () => {})
        };
        return stmt;
      }),
      getFirstAsync: jest.fn(async (query, params) => {
        return {
          id: params[0],
          principal_paise: queries[0].params[2],
          markup_factor: queries[0].params[3]
        };
      }),
      getAllAsync: jest.fn()
    };
    
    repo = new LoanRepository(mockDb);
  });

  it('Form-to-database loan creation integration test (�,124,000, 30%, 12 months, Upfront Markup)', async () => {
    const loan = await repo.createLoanWithSchedule('test-borrower-id', {
      principal: toPaise(24000),
      markupFactor: 0.3,
      termMonths: 12,
      startDate: '2026-01-01',
      dueDay: 1,
      productType: 'instalment'
    });

    // Check loan creation query
    expect(queries.length).toBe(1);
    expect(queries[0].params[2]).toBe(toPaise(24000)); // principal
    expect(queries[0].params[3]).toBe(0.3); // markupFactor

    // Check schedules created
    expect(statements.length).toBe(12); // 12 months

    // Validate the first and last schedule
    const firstSchedule = statements[0].params;
    // index 5 = principal_component, index 6 = markup_component, index 7 = total_due
    expect(firstSchedule[5]).toBe(200000); // �,12,000 principal per month
    expect(firstSchedule[6]).toBe(60000); // �,1600 markup per month
    expect(firstSchedule[7]).toBe(260000); // �,12,600 total per month

    const lastSchedule = statements[11].params;
    expect(lastSchedule[5]).toBe(200000); // �,12,000 principal
    expect(lastSchedule[6]).toBe(60000); // �,1600 markup
    expect(lastSchedule[7]).toBe(260000); // �,12,600 total
  });
});

commit e98f2815028922ec5587dc908d48ecf1818828c2
Author:     sagar sangwan <iamsagarsangwan@gmail.com>
AuthorDate: Sat Oct 10 08:16:24 2026 +0530
Commit:     sagar sangwan <iamsagarsangwan@gmail.com>
CommitDate: Sat Oct 10 08:16:24 2026 +0530

    fix(financial): implement bullet loan principal repayment and settlement
src/__tests__/bullet-loan.test.ts:17: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:42: trailing whitespace.
+          return { 
src/__tests__/bullet-loan.test.ts:43: trailing whitespace.
+            id: params[0], 
src/__tests__/bullet-loan.test.ts:44: trailing whitespace.
+            product_type: 'bullet', 
src/__tests__/bullet-loan.test.ts:55: trailing whitespace.
+        
src/__tests__/bullet-loan.test.ts:57: trailing whitespace.
+        if (query.includes('SUM(allocated_principal_paise)')) { 
src/__tests__/bullet-loan.test.ts:60: trailing whitespace.
+          const sum = txs.reduce((acc, t) => acc + t[7], 0); 
src/__tests__/bullet-loan.test.ts:63: trailing whitespace.
+        
src/__tests__/bullet-loan.test.ts:86: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:94: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:96: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:99: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:101: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:113: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:115: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:124: trailing whitespace.
+  
src/__tests__/bullet-loan.test.ts:128: trailing whitespace.
+    
src/__tests__/bullet-loan.test.ts:130: trailing whitespace.
+    
src/core/database/transactionRepository.ts:92: trailing whitespace.
+          

codex
The implementation does use an exclusive transaction and loan-scoped SQL, but the new regression file is unequivocally a mock harness: it builds `mockDb` with `jest.fn` and never opens SQLite. I’m now checking whether its passing assertions correspond to real schedule extension, rollback, uniqueness, and multi-loan behavior—the areas the mock cannot validate.
hook: PreToolUse
hook: PreToolUse
hook: PreToolUse
hook: PreToolUse Completed
hook: PreToolUse Completed
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx tsc --noEmit' in F:\personal projects\credkeep
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx jest src/__tests__/bullet-loan.test.ts src/__tests__/cross-loan.test.ts --runInBand' in F:\personal projects\credkeep
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx expo lint' in F:\personal projects\credkeep
 exited 1 in 4976ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
Error: EPERM: operation not permitted, open 'C:\Users\Sagar\AppData\Local\Temp\jest\haste-map-d2ead37f67a12e75389fad4b60a6f505-e8458be46475fc1e6f38a57f05165f4a-33aa39c625cffd7e4ca933f91acca0b3'
    at Object.openSync (node:fs:562:18)
    at writeFileSync (node:fs:2440:35)
    at HasteMap._persist (F:\personal projects\credkeep\node_modules\jest-haste-map\build\index.js:714:37)
    at F:\personal projects\credkeep\node_modules\jest-haste-map\build\index.js:380:16
    at async F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:268:9
    at async Promise.all (index 0)
    at async buildContextsAndHasteMaps (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:248:20)
    at async _run10000 (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:327:41)
    at async runCLI (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:198:3)
    at async Object.run (F:\personal projects\credkeep\node_modules\jest-cli\build\run.js:130:37)

 succeeded in 10136ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 

 exited 1 in 15761ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 

Oops! Something went wrong! :(

ESLint: 9.39.5

Error: EPERM: operation not permitted, open 'F:\personal projects\credkeep\.expo\cache\eslint\.cache_1hhg9k0'
    at Object.writeFileSync (node:fs:2426:20)
    at writeJSON (F:\personal projects\credkeep\node_modules\flat-cache\src\utils.js:39:6)
    at Object.save (F:\personal projects\credkeep\node_modules\flat-cache\src\cache.js:136:5)
    at Object.reconcile (F:\personal projects\credkeep\node_modules\file-entry-cache\cache.js:287:15)
    at LintResultCache.reconcile (F:\personal projects\credkeep\node_modules\eslint\lib\cli-engine\lint-result-cache.js:216:23)
    at ESLint.lintFiles (F:\personal projects\credkeep\node_modules\eslint\lib\eslint\eslint.js:1065:20)
    at async Object.execute (F:\personal projects\credkeep\node_modules\eslint\lib\cli.js:428:14)
    at async main (F:\personal projects\credkeep\node_modules\eslint\bin\eslint.js:175:19)

hook: PreToolUse
hook: PreToolUse
hook: PreToolUse Completed
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx jest --runInBand --no-cache' in F:\personal projects\credkeep
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx expo lint --no-cache' in F:\personal projects\credkeep
 exited 1 in 3600ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
Error: EPERM: operation not permitted, open 'C:\Users\Sagar\AppData\Local\Temp\jest\haste-map-d2ead37f67a12e75389fad4b60a6f505-e8458be46475fc1e6f38a57f05165f4a-33aa39c625cffd7e4ca933f91acca0b3'
    at Object.openSync (node:fs:562:18)
    at writeFileSync (node:fs:2440:35)
    at HasteMap._persist (F:\personal projects\credkeep\node_modules\jest-haste-map\build\index.js:714:37)
    at F:\personal projects\credkeep\node_modules\jest-haste-map\build\index.js:380:16
    at async F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:268:9
    at async Promise.all (index 0)
    at async buildContextsAndHasteMaps (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:248:20)
    at async _run10000 (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:327:41)
    at async runCLI (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:198:3)
    at async Object.run (F:\personal projects\credkeep\node_modules\jest-cli\build\run.js:130:37)

 exited 1 in 6048ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 

Oops! Something went wrong! :(

ESLint: 9.39.5

Error: EPERM: operation not permitted, unlink 'F:\personal projects\credkeep\.expo\cache\eslint\.cache_1hhg9k0'
    at async Object.unlink (node:internal/fs/promises:1064:10)
    at async ESLint.lintFiles (F:\personal projects\credkeep\node_modules\eslint\lib\eslint\eslint.js:1004:6)
    at async Object.execute (F:\personal projects\credkeep\node_modules\eslint\lib\cli.js:428:14)
    at async main (F:\personal projects\credkeep\node_modules\eslint\bin\eslint.js:175:19)

hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; $n=0; Get-Content src/__tests__/bullet-loan.test.ts | ForEach-Object { $n++; '"'{0,4}: {1}' -f "'$n,$_ }; $n=0; Get-Content src/core/database/transactionRepository.ts | ForEach-Object { $n++; if($n -le 170){'"'{0,4}: {1}' -f "'$n,$_} }; $n=0; Get-Content src/core/database/loanRepository.ts | ForEach-Object { $n++; if($n -ge 75){'"'{0,4}: {1}' -f "'$n,$_} }; $n=0; Get-Content src/core/domain/schedule.test.ts | ForEach-Object { $n++; '"'{0,4}: {1}' -f "'$n,$_ }' in F:\personal projects\credkeep
 succeeded in 568ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
   1: import { LoanRepository } from '../core/database/loanRepository';
   2: import { TransactionRepository } from '../core/database/transactionRepository';
   3: import { toPaise } from '../core/domain/money';
   4: 
   5: describe('Bullet Loan Settlement', () => {
   6:   let mockDb: any;
   7:   let loanRepo: LoanRepository;
   8:   let txRepo: TransactionRepository;
   9:   let executionLog: any[] = [];
  10:   let txs: any[] = [];
  11:   let loanStatus = 'ACTIVE';
  12: 
  13:   beforeEach(() => {
  14:     executionLog = [];
  15:     txs = [];
  16:     loanStatus = 'ACTIVE';
  17:     
  18:     mockDb = {
  19:       withExclusiveTransactionAsync: jest.fn(async (cb) => {
  20:         const tx = { ...mockDb };
  21:         await cb(tx);
  22:       }),
  23:       runAsync: jest.fn(async (query, params) => {
  24:         executionLog.push({ query, params });
  25:         if (query.includes('INSERT INTO transactions')) {
  26:           txs.push(params);
  27:         }
  28:         if (query.includes("UPDATE loans SET status = 'SETTLED'")) {
  29:           loanStatus = 'SETTLED';
  30:         }
  31:       }),
  32:       prepareAsync: jest.fn(async (query) => {
  33:         return {
  34:           executeAsync: jest.fn(async (params) => {
  35:             executionLog.push({ query, params });
  36:           }),
  37:           finalizeAsync: jest.fn(async () => {})
  38:         };
  39:       }),
  40:       getFirstAsync: jest.fn(async (query, params) => {
  41:         if (query.includes('loans WHERE id = ?')) {
  42:           return { 
  43:             id: params[0], 
  44:             product_type: 'bullet', 
  45:             status: loanStatus,
  46:             principal_paise: 1000000, // 10000 rupees
  47:             start_date: '2026-01-01',
  48:             due_day: 1,
  49:             markup_factor: 0.05,
  50:             term_months: 1
  51:           };
  52:         }
  53:         if (query.includes('SUM(amount_paise)')) { return { total: 0 }; }
  54:         if (query.includes('SUM(allocated_penalty_paise)')) { return { total: 0 }; }
  55:         
  56:         // Mock to get total principal paid
  57:         if (query.includes('SUM(allocated_principal_paise)')) { 
  58:           // we sum up txs manually for the mock
  59:           // index 7 is allocated_principal_paise
  60:           const sum = txs.reduce((acc, t) => acc + t[7], 0); 
  61:           return { total: sum };
  62:         }
  63:         
  64:         return null;
  65:       }),
  66:       getAllAsync: jest.fn(async (query, params) => {
  67:         if (query.includes('repayment_schedules')) {
  68:           return [
  69:             {
  70:               installment_number: 1,
  71:               total_due_paise: 50000,
  72:               principal_component_paise: 0,
  73:               markup_component_paise: 50000,
  74:               principal_paid_paise: 0,
  75:               markup_paid_paise: 0,
  76:               effective_due_date: '2026-01-01', // This causes penalty! Let's change it to 2026-02-01 so it's not overdue
  77:               status: 'PENDING',
  78:               amountPaid: 0
  79:             }
  80:           ];
  81:         }
  82:         if (query.includes('PENALTY_ASSESSMENT')) { return []; }
  83:         return [];
  84:       })
  85:     };
  86:     
  87:     loanRepo = new LoanRepository(mockDb);
  88:     txRepo = new TransactionRepository(mockDb);
  89:   });
  90: 
  91:   it('settles bullet loan when principal is fully repaid', async () => {
  92:     const loanId = 'loan-bullet';
  93:     const amount = toPaise(10500); // 500 markup + 10000 principal
  94:     
  95:     await txRepo.recordCashPayment(loanId, amount, 'op-1', '2026-02-01');
  96:     
  97:     const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
  98:     const txInsert = txs.find(t => t[3] === 'COLLECTION');
  99:     
 100:     expect(updateLoanStatusQuery).toBeDefined();
 101:     
 102:     // Check tx insert values
 103:     // INSERT INTO transactions (..., amount_paise, allocated_principal_paise, allocated_markup_paise, ...)
 104:     // 0: id, 1: op_id, 2: loan_id, 3: tx_type, 4: is_cash, 5: pm, 6: amount, 7: prin, 8: markup, 9: pen, 10: unalloc, 11: eff_date, 12: created
 105:     expect(txInsert[7]).toBe(toPaise(10000)); // allocated principal
 106:     expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
 107:     expect(txInsert[10]).toBe(toPaise(0)); // unallocated
 108:   });
 109: 
 110:   it('partially repays principal of bullet loan without settling', async () => {
 111:     const loanId = 'loan-bullet';
 112:     const amount = toPaise(5500); // 500 markup + 5000 principal
 113:     
 114:     await txRepo.recordCashPayment(loanId, amount, 'op-2', '2026-02-01');
 115:     
 116:     const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
 117:     expect(updateLoanStatusQuery).toBeUndefined(); // Should NOT be settled
 118: 
 119:     const txInsert = txs.find(t => t[3] === 'COLLECTION');
 120:     expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
 121:     expect(txInsert[7]).toBe(toPaise(5000)); // allocated principal
 122:     expect(txInsert[10]).toBe(toPaise(0)); // unallocated
 123:   });
 124:   
 125:   it('handles excess payment as unallocated surplus when principal is overpaid', async () => {
 126:     const loanId = 'loan-bullet';
 127:     const amount = toPaise(12500); // 500 markup + 10000 principal + 2000 unallocated
 128:     
 129:     await txRepo.recordCashPayment(loanId, amount, 'op-3', '2026-02-01');
 130:     
 131:     const updateLoanStatusQuery = executionLog.find(q => q.query.includes("UPDATE loans SET status = 'SETTLED'"));
 132:     expect(updateLoanStatusQuery).toBeDefined();
 133: 
 134:     const txInsert = txs.find(t => t[3] === 'COLLECTION');
 135:     expect(txInsert[8]).toBe(toPaise(500)); // allocated markup
 136:     expect(txInsert[7]).toBe(toPaise(10000)); // Capped at principal due
 137:     expect(txInsert[10]).toBe(toPaise(2000)); // The excess
 138:   });
 139: });
   1: import { SQLiteDatabase } from 'expo-sqlite';
   2: import * as crypto from 'expo-crypto';
   3: import { allocatePayment, KistAllocationState } from '../domain/allocation';
   4: import { Paise } from '../domain/money';
   5: 
   6: export class TransactionRepository {
   7:   constructor(private db: SQLiteDatabase) {}
   8: 
   9:   async recordCashPayment(
  10:     loanId: string, 
  11:     paymentAmount: Paise, 
  12:     operationId: string,
  13:     effectiveDate: string
  14:   ) {
  15:       let returnResult: any = null;
  16: 
  17:       await this.db.withExclusiveTransactionAsync(async (tx) => {
  18:         // Idempotency check
  19:         const existing = await tx.getFirstAsync(`SELECT * FROM transactions WHERE operation_id = ?`, [operationId]);
  20:         if (existing) {
  21:           returnResult = existing;
  22:           return;
  23:         }
  24: 
  25:         const loan = await tx.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
  26:         if (!loan) throw new Error('Loan not found');
  27:         
  28:         // Ensure schedule is up to date (for bullet loans)
  29:         const { LoanRepository } = require('./loanRepository');
  30:         const loanRepo = new LoanRepository(tx);
  31:         await loanRepo.extendScheduleIfNeeded(loanId, tx);
  32: 
  33:         // Load current kists
  34:         const dbKists = await tx.getAllAsync<any>(
  35:           `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`, 
  36:           [loanId]
  37:         );
  38:         
  39:         const kists: KistAllocationState[] = dbKists.map(k => ({
  40:           kistNumber: k.installment_number,
  41:           amountDue: k.total_due_paise as Paise,
  42:           principalDue: k.principal_component_paise as Paise,
  43:           markupDue: k.markup_component_paise as Paise,
  44:           amountPaid: (k.principal_paid_paise + k.markup_paid_paise) as Paise,
  45:           principalPaid: k.principal_paid_paise as Paise,
  46:           markupPaid: k.markup_paid_paise as Paise,
  47:           status: k.status,
  48:           isDue: k.effective_due_date <= effectiveDate
  49:         }));
  50:         
  51:         // Assess penalties up to effectiveDate
  52:         await this.assessPenalties(loanId, effectiveDate, tx);
  53: 
  54:         // Fetch outstanding penalty
  55:         // Outstanding penalty = (Total PENALTY_ASSESSMENT amounts) - (Total allocated_penalty_paise from all collections)
  56:         const penaltyAssessments = await tx.getFirstAsync<any>(
  57:           `SELECT SUM(amount_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'PENALTY_ASSESSMENT'`,
  58:           [loanId]
  59:         );
  60:         const penaltyPaid = await tx.getFirstAsync<any>(
  61:           `SELECT SUM(allocated_penalty_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
  62:           [loanId]
  63:         );
  64:         
  65:         const totalPenaltyAssessed = (penaltyAssessments?.total || 0) as number;
  66:         const totalPenaltyPaid = (penaltyPaid?.total || 0) as number;
  67:         const outstandingPenalty = Math.max(0, totalPenaltyAssessed - totalPenaltyPaid) as Paise;
  68:   
  69:         const result = allocatePayment({ paymentAmount, kists, outstandingPenalty });
  70:         
  71:         const transactionId = crypto.randomUUID();
  72:         const createdAt = new Date().toISOString();
  73:         
  74:         let allocatedPrincipal = 0;
  75:         let allocatedMarkup = 0;
  76:         let allocatedPenalty = 0;
  77:         
  78:         for (const a of result.allocations) {
  79:           allocatedPrincipal += a.allocatedToPrincipal;
  80:           allocatedMarkup += a.allocatedToMarkup;
  81:           allocatedPenalty += a.allocatedToPenalty;
  82:         }
  83: 
  84:         let bulletPrincipalPaid = 0;
  85:         if (loan.product_type === 'bullet') {
  86:           const pastPrincipalPaidRes = await tx.getFirstAsync<any>(
  87:             `SELECT SUM(allocated_principal_paise) as total FROM transactions WHERE loan_id = ? AND transaction_type = 'COLLECTION'`,
  88:             [loanId]
  89:           );
  90:           bulletPrincipalPaid = pastPrincipalPaidRes?.total || 0;
  91:           const remainingPrincipal = loan.principal_paise - bulletPrincipalPaid;
  92:           
  93:           if (remainingPrincipal > 0 && result.unallocatedFunds > 0) {
  94:             const payPrincipal = Math.min(result.unallocatedFunds, remainingPrincipal) as Paise;
  95:             allocatedPrincipal += payPrincipal;
  96:             result.unallocatedFunds = (result.unallocatedFunds - payPrincipal) as Paise;
  97:             bulletPrincipalPaid += payPrincipal;
  98:           }
  99:         }
 100:         
 101:         await tx.runAsync(`
 102:           INSERT INTO transactions (
 103:             id, operation_id, loan_id, transaction_type, is_cash, payment_method, 
 104:             amount_paise, allocated_principal_paise, allocated_markup_paise, 
 105:             allocated_penalty_paise, unallocated_surplus_paise, effective_date, created_at
 106:           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 107:         `, [
 108:           transactionId, operationId, loanId, 'COLLECTION', 1, 'CASH',
 109:           paymentAmount, allocatedPrincipal, allocatedMarkup, allocatedPenalty,
 110:           result.unallocatedFunds, effectiveDate, createdAt
 111:         ]);
 112:         
 113:         // Update repayment schedules
 114:         const updateStmt = await tx.prepareAsync(`
 115:           UPDATE repayment_schedules
 116:           SET principal_paid_paise = ?, markup_paid_paise = ?, status = ?
 117:           WHERE loan_id = ? AND installment_number = ?
 118:         `);
 119:         
 120:         try {
 121:           for (const k of result.updatedKists) {
 122:             // Only update if changed
 123:             const orig = kists.find(o => o.kistNumber === k.kistNumber)!;
 124:             if (k.amountPaid !== orig.amountPaid || k.status !== orig.status) {
 125:                await updateStmt.executeAsync([
 126:                  k.principalPaid, k.markupPaid, k.status || 'PENDING', loanId, k.kistNumber
 127:                ]);
 128:             }
 129:           }
 130:         } finally {
 131:           await updateStmt.finalizeAsync();
 132:         }
 133:         // Check if loan should be closed
 134:         let allKistsPaid = true;
 135:         for (const k of result.updatedKists) {
 136:           if (k.status !== 'PAID') {
 137:             allKistsPaid = false;
 138:             break;
 139:           }
 140:         }
 141:         
 142:         if (loan.product_type === 'instalment') {
 143:           if (allKistsPaid && result.remainingPenalty <= 0) {
 144:              await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
 145:           }
 146:         } else if (loan.product_type === 'bullet') {
 147:           if (bulletPrincipalPaid >= loan.principal_paise && allKistsPaid && result.remainingPenalty <= 0) {
 148:              await tx.runAsync(`UPDATE loans SET status = 'SETTLED' WHERE id = ?`, [loanId]);
 149:           }
 150:         }
 151:         
 152:         returnResult = { success: true, transactionId, result };
 153:       });
 154:       
 155:       return returnResult;
 156:   }
 157: 
 158:   async previewPenalties(loanId: string, currentDate: string): Promise<number> {
 159:     const loan = await this.db.getFirstAsync<any>(`SELECT * FROM loans WHERE id = ?`, [loanId]);
 160:     if (!loan || loan.status !== 'ACTIVE') return 0;
 161: 
 162:     const { LoanRepository } = require('./loanRepository');
 163:     const loanRepo = new LoanRepository(this.db);
 164:     await loanRepo.extendScheduleIfNeeded(loanId);
 165: 
 166:     const dbKists = await this.db.getAllAsync<any>(
 167:       `SELECT * FROM repayment_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
 168:       [loanId]
 169:     );
 170: 
  75:   
  76:   async getSchedule(loanId: string) {
  77:     await this.extendScheduleIfNeeded(loanId);
  78:     return await this.db.getAllAsync(`
  79:       SELECT * FROM repayment_schedules 
  80:       WHERE loan_id = ? 
  81:       ORDER BY installment_number ASC
  82:     `, [loanId]);
  83:   }
  84: 
  85:   async extendScheduleIfNeeded(loanId: string, tx: any = this.db) {
  86:     const loan = await tx.getFirstAsync(`SELECT * FROM loans WHERE id = ?`, [loanId]);
  87:     if (!loan || loan.product_type !== 'bullet' || loan.status !== 'ACTIVE') return;
  88: 
  89:     const kists = await tx.getAllAsync(`
  90:       SELECT * FROM repayment_schedules 
  91:       WHERE loan_id = ? 
  92:       ORDER BY installment_number ASC
  93:     `, [loanId]);
  94:     
  95:     if (kists.length === 0) return;
  96:     const lastKist = kists[kists.length - 1];
  97:     const currentDate = new Date().toISOString().split('T')[0];
  98:     
  99:     // If the last kist's due date is in the past, generate new ones until we pass currentDate
 100:     if (lastKist.effective_due_date < currentDate) {
 101:       // dynamic import for schedule util if needed, but it's not exported yet? Wait, I exported it.
 102:       const { calculateNextDueDate } = require('../domain/schedule');
 103:       const { toPaise } = require('../domain/money');
 104:       
 105:       const totalMarkup = loan.principal_paise * loan.markup_factor;
 106:       const markupDuePerMonth = Math.floor(totalMarkup / loan.term_months);
 107:       
 108:       let nextInstalmentNumber = lastKist.installment_number + 1;
 109:       let monthsToAddFromStart = nextInstalmentNumber;
 110:       
 111:       let nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
 112:       
 113:       const statement = await tx.prepareAsync(`
 114:         INSERT INTO repayment_schedules 
 115:         (id, loan_id, installment_number, original_due_date, effective_due_date, principal_component_paise, markup_component_paise, total_due_paise)
 116:         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
 117:       `);
 118:       
 119:       try {
 120:         while (nextDueDate <= currentDate || nextInstalmentNumber === lastKist.installment_number + 1 /* always add at least one if we entered */) {
 121:           await statement.executeAsync([
 122:             crypto.randomUUID(),
 123:             loanId,
 124:             nextInstalmentNumber,
 125:             nextDueDate,
 126:             nextDueDate,
 127:             0,
 128:             markupDuePerMonth,
 129:             markupDuePerMonth
 130:           ]);
 131:           
 132:           if (nextDueDate > currentDate) break;
 133:           
 134:           nextInstalmentNumber++;
 135:           monthsToAddFromStart++;
 136:           nextDueDate = calculateNextDueDate(loan.start_date, monthsToAddFromStart, loan.due_day);
 137:         }
 138:       } finally {
 139:         await statement.finalizeAsync();
 140:       }
 141:     }
 142:   }
 143: }
   1: import { generateSchedule } from './schedule';
   2: import { toPaise } from './money';
   3: 
   4: describe('Schedule Generation', () => {
   5:   describe('Instalment loans', () => {
   6:     it('�,120,000 + 30% = �,126,000, Ten instalments of �,12,600', () => {
   7:       const schedule = generateSchedule({
   8:         principal: toPaise(20000),
   9:         markupFactor: 0.3,
  10:         termMonths: 10,
  11:         startDate: '2026-01-01',
  12:         dueDay: 1,
  13:         productType: 'instalment'
  14:       });
  15:       expect(schedule.length).toBe(10);
  16:       expect(schedule[0].amountDue).toBe(toPaise(2600));
  17:       expect(schedule[0].dueDate).toBe('2026-02-01');
  18:       expect(schedule[9].amountDue).toBe(toPaise(2600));
  19:     });
  20: 
  21:     it('�,124,000 + 30% = �,131,200, Twelve instalments of �,12,600', () => {
  22:       const schedule = generateSchedule({
  23:         principal: toPaise(24000),
  24:         markupFactor: 0.3,
  25:         termMonths: 12,
  26:         startDate: '2026-01-01',
  27:         dueDay: 1,
  28:         productType: 'instalment'
  29:       });
  30:       expect(schedule.length).toBe(12);
  31:       expect(schedule[0].amountDue).toBe(toPaise(2600));
  32:       expect(schedule[0].markupDue).toBe(toPaise(600));
  33:       expect(schedule[0].principalDue).toBe(toPaise(2000));
  34:       
  35:       const totalAmountDue = schedule.reduce((sum, k) => sum + k.amountDue, 0);
  36:       expect(totalAmountDue).toBe(toPaise(31200));
  37:     });
  38: 
  39:     it('allocates non-divisible totals exact paise', () => {
  40:       const schedule = generateSchedule({
  41:         principal: toPaise(26000),
  42:         markupFactor: 0.0,
  43:         termMonths: 3,
  44:         startDate: '2026-01-01',
  45:         dueDay: 1,
  46:         productType: 'instalment'
  47:       });
  48:       expect(schedule.length).toBe(3);
  49:       expect(schedule[0].amountDue).toBe(866667);
  50:       expect(schedule[1].amountDue).toBe(866667);
  51:       expect(schedule[2].amountDue).toBe(866666);
  52:     });
  53:   });
  54: 
  55:   describe('Bullet loans', () => {
  56:     it('monthly fixed-charge bullet schedules, principal due at maturity', () => {
  57:       // Principal 10,000, markup 20% (1.2), total 12,000
  58:       // Markup is 2,000. Across 3 months, markup is 666.67, 666.67, 666.66.
  59:       // Month 1: 666.67
  60:       // Month 2: 666.67
  61:       // Month 3: 666.66 (principal is paid separately)
  62:       const schedule = generateSchedule({
  63:         principal: toPaise(10000),
  64:         markupFactor: 0.2,
  65:         termMonths: 3,
  66:         startDate: '2026-01-15',
  67:         dueDay: 15,
  68:         productType: 'bullet'
  69:       });
  70:       
  71:       expect(schedule.length).toBe(3);
  72:       expect(schedule[0].amountDue).toBe(66667);
  73:       expect(schedule[1].amountDue).toBe(66667);
  74:       expect(schedule[2].amountDue).toBe(66666);
  75:     });
  76:   });
  77: 
  78:   describe('Date handling', () => {
  79:     it('due-day 31 correctly handles February and March (month-end clamping)', () => {
  80:       const schedule = generateSchedule({
  81:         principal: toPaise(10000),
  82:         markupFactor: 0.0,
  83:         termMonths: 3,
  84:         startDate: '2026-01-01',
  85:         dueDay: 31,
  86:         productType: 'instalment'
  87:       });
  88:       
  89:       expect(schedule[0].dueDate).toBe('2026-02-28'); // Non-leap year
  90:       expect(schedule[1].dueDate).toBe('2026-03-31');
  91:       expect(schedule[2].dueDate).toBe('2026-04-30');
  92:     });
  93: 
  94:     it('leap-year handling for February 29', () => {
  95:       const schedule = generateSchedule({
  96:         principal: toPaise(10000),
  97:         markupFactor: 0.0,
  98:         termMonths: 1,
  99:         startDate: '2024-01-01', // 2024 is leap year
 100:         dueDay: 31,
 101:         productType: 'instalment'
 102:       });
 103:       
 104:       expect(schedule[0].dueDate).toBe('2024-02-29');
 105:     });
 106:   });
 107: });

hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; rg -n 'jest|cacheDirectory|cache' package.json app.json jest.config.*; npx eslint . --no-cache" in F:\personal projects\credkeep
 exited 1 in 15859ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
rg: jest.config.*: The filename, directory name, or volume label syntax is incorrect. (os error 123)
package.json:28:    "@react-native/jest-preset": "^0.86.3",
package.json:30:    "@types/jest": "29.5.14",
package.json:34:    "jest": "^29.7.0",
package.json:35:    "jest-expo": "^57.0.5",
package.json:44:    "test": "jest"

F:\personal projects\credkeep\fetch_screens.js
  19:23  error  '__dirname' is not defined  no-undef

F:\personal projects\credkeep\src\__tests__\bullet-loan.test.ts
  7:7  warning  'loanRepo' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\__tests__\cross-loan.test.ts
   7:7  warning  'loanRepo' is assigned a value but never used           @typescript-eslint/no-unused-vars
  11:7  warning  'runAsyncCallbacks' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\__tests__\loans.test.tsx
  1:8   warning  'React' is defined but never used  @typescript-eslint/no-unused-vars
  2:10  warning  'View' is defined but never used   @typescript-eslint/no-unused-vars
  2:16  warning  'Text' is defined but never used   @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\app\(tabs)\borrowers.tsx
  13:22  warning  'loans' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\app\(tabs)\loans.tsx
   2:114  warning  'TextInput' is defined but never used  @typescript-eslint/no-unused-vars
  74:16   warning  'e' is defined but never used          @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\app\loan\[id]\index.tsx
  3:32  warning  'useRouter' is defined but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\app\settings\backup.tsx
  151:16  warning  'e' is defined but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\core\database\loanRepository.test.ts
  43:11  warning  'loan' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\core\database\loanRepository.ts
  102:40  warning  A `require()` style import is forbidden       @typescript-eslint/no-require-imports
  103:15  warning  'toPaise' is assigned a value but never used  @typescript-eslint/no-unused-vars
  103:27  warning  A `require()` style import is forbidden       @typescript-eslint/no-require-imports

F:\personal projects\credkeep\src\core\database\transactionRepository.ts
   29:36  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  162:32  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  179:39  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  180:25  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  203:32  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  220:36  warning  'LoanPenaltyState' is assigned a value but never used  @typescript-eslint/no-unused-vars
  220:57  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports
  221:25  warning  A `require()` style import is forbidden                @typescript-eslint/no-require-imports

F:\personal projects\credkeep\src\core\domain\backupUtil.test.ts
  35:23  warning  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

F:\personal projects\credkeep\src\core\domain\backupUtil.ts
  13:12  warning  'e' is defined but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\core\domain\penalty.ts
  1:17  warning  'toPaise' is defined but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\core\domain\schedule.ts
   1:45  warning  'subtractPaise' is defined but never used            @typescript-eslint/no-unused-vars
  43:9   warning  'totalRepayment' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\src\ui\PinLock.tsx
  13:10  warning  'hasPin' is assigned a value but never used  @typescript-eslint/no-unused-vars

F:\personal projects\credkeep\test-bug.js
   2:7  warning  'crypto' is assigned a value but never used                 no-unused-vars
   3:9  warning  'initDatabase' is assigned a value but never used           no-unused-vars
   4:9  warning  'runMigrations' is assigned a value but never used          no-unused-vars
   5:9  warning  'LoanRepository' is assigned a value but never used         no-unused-vars
   6:9  warning  'TransactionRepository' is assigned a value but never used  no-unused-vars
   7:9  warning  'toPaise' is assigned a value but never used                no-unused-vars
  14:9  warning  'sqlite3' is assigned a value but never used                no-unused-vars

✖ 37 problems (1 error, 36 warnings)


hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; npx jest src/__tests__/bullet-loan.test.ts src/__tests__/cross-loan.test.ts --runInBand --cacheDirectory=NUL' in F:\personal projects\credkeep
 exited 1 in 2696ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
Error: EPERM: operation not permitted, mkdir 'F:\personal projects\credkeep\NUL'
    at Object.mkdirSync (node:fs:1364:26)
    at createDirectory (F:\personal projects\credkeep\node_modules\jest-util\build\createDirectory.js:63:10)
    at F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:249:13)
    at _run10000 (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:327:47)
    at runCLI (F:\personal projects\credkeep\node_modules\@jest\core\build\cli\index.js:198:9)
    at async Object.run (F:\personal projects\credkeep\node_modules\jest-cli\build\run.js:130:37)

collab: Wait
codex
The static checks expose a real coverage gap: the “full settlement” mock uses a due date one month before the payment, which would accrue penalties in real storage, but the mock hard-codes penalty sums to zero. It therefore asserts `SETTLED` for a state that genuine SQLite-backed execution would not settle. The same file has no six-month lifecycle, recurring-charge, waiver, rollback, duplicate-operation, or two-loan scenario.
collab: Wait
collab: Wait
collab: Wait
hook: PreToolUse
hook: PreToolUse Completed
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content -Raw AGENTS.md | Out-Null; Get-Content -Raw .workflow/STATE.md | Out-Null; rg -n "PENALTY_WAIVER|forgiven_penalty_paise|waive|Waiver" src/core src/__tests__; git branch --show-current; git branch -a --contains e98f281; git status --short' in F:\personal projects\credkeep
 succeeded in 691ms:
C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1 : Cannot dot-source this command because it was 
defined in a different language mode. To invoke this command without importing its contents, omit the '.' operator.
At line:1 char:1
+ . 'C:\Users\Sagar\OneDrive\Documents\WindowsPowerShell\profile.ps1'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [profile.ps1], NotSupportedException
    + FullyQualifiedErrorId : DotSourceNotSupported,profile.ps1
 
src/core\database\transactionRepository.ts:288:        SUM(t.forgiven_principal_paise) as principal_waived,
src/core\database\transactionRepository.ts:289:        SUM(t.forgiven_markup_paise) as markup_waived,
src/core\database\transactionRepository.ts:290:        SUM(t.forgiven_penalty_paise) as penalty_waived
src/core\database\transactionRepository.ts:307:    const penaltyWaived = collectedQuery?.penalty_waived || 0;
src/core\database\transactionRepository.ts:314:      principalWaived: collectedQuery?.principal_waived || 0,
src/core\database\transactionRepository.ts:315:      markupWaived: collectedQuery?.markup_waived || 0,
src/core\database\schema.ts:67:        forgiven_penalty_paise INTEGER NOT NULL DEFAULT 0,
src/core\database\schema.ts:103:        waived_penalty_paise INTEGER NOT NULL DEFAULT 0,
feat/settlement/ck-p0-002
* feat/settlement/ck-p0-002
 M .workflow/HANDOFF.md
?? .workflow/plans/CK-P0-003-QA.md


# QA Gate & Review Policy (Token-Optimized Policy)

## Independence Rule
Codex reviews committed changes independently; Gemini must not approve its own implementation as release-ready.

## Token-Optimized QA Policy (Zero-Loop & Token Conservation)
1. **Single Milestone Invocation:** Run Codex at most ONCE per completed milestone (e.g. End of Phase 1), never after small changes, individual tasks, or routine commits.
2. **No Fix-Review Loops:** Automatic recursive reviews, retries, and re-review loops are strictly DISABLED. Do not automatically re-invoke Codex after remediating findings.
3. **Local Quality Gates First:** Local TypeScript verification (`npx tsc --noEmit`), linting (`npx expo lint`), unit tests (Jest), and integration tests (pytest) must pass BEFORE any Codex invocation.
4. **Permitted High-Risk Triggers Only:** Only invoke Codex when the milestone diff touches:
   - Financial calculations, money math, schedule generators, or waterfall allocations (`src/core/domain/`)
   - Payment corrections, idempotency, or transaction conservation (`src/core/database/`, `backend/credkeep/`)
   - Multi-tenant isolation, row-level security (RLS), or tenancy middleware (`backend/tenants/`)
   - SQLCipher encryption or schema migrations (`migrations/`)
   - Authentication or device security (`auth`)
   - Offline sync protocol integrity (`sync`, `SyncOutbox`)
5. **Strict Scope Exclusions:** NEVER invoke Codex for formatting, UI polish, documentation, asset updates, or simple style changes.
6. **Diff & Dependency Scoping:** Reviews inspect ONLY the changed files in the commit range ($BaseSha...$HeadSha) and immediate dependencies. Broad repo indexing is forbidden.
7. **Actionable Findings Cap:** Findings are capped at at most 5 actionable issues, strictly ordered by severity (P0 critical first).
8. **Configured Model & Sandbox:** Explicitly configure `-Model "gpt-6.1-sol" -ReasoningEffort "medium"` in a read-only sandbox (`--sandbox read-only`).
9. **Duplicate Invocation Guard:** Identical commit ranges and review scopes are automatically blocked by the `.workflow/qa-codex.ps1` guard to eliminate wasted runs.

## QA Outcomes
- **APPROVED / SKIPPED_BY_SCOPE:** Milestone review passed or non-critical scope safely validated by local test suite.
- **REWORK:** Up to 5 prioritized findings to remediate locally. Remediation is verified via local automated tests and static checks without an automated Codex re-review loop.


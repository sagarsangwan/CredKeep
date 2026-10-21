# Model Selection Policy

## Philosophy
Optimize engineering output per model invocation to respect token quotas and minimize weekly consumption.

## Operating Policy
- **No Routine Planning Calls:** Do not require Codex planning for individual tasks. Rely on the existing `V2_TASKS.md` backlog and architecture documents.
- **Implementation:** Use the current Antigravity model (Gemini) for all implementation.
- **Independent QA Model Configuration:**
  - **Model:** `gpt-6.1-sol` explicitly passed via `-Model "gpt-6.1-sol"`. Do not rely on ambient account defaults.
  - **Reasoning Effort:** `medium` explicitly passed via `-ReasoningEffort "medium"` (`-c model_reasoning_effort="medium"`).
  - **Sandbox:** Always read-only (`--sandbox read-only`).
- **Milestone Invocation Cadence:** Codex runs at most ONCE per completed milestone boundary (e.g. End of Phase 1), never after small changes, tickets, or bug fixes.
- **Zero Loop Policy:** Automatic recursive reviews, retries, and fix-review loops are strictly disabled. Do not invoke Codex automatically after remediating findings.
- **Local Quality Gates First:** Local static checks (`npx tsc --noEmit`, `npx expo lint`) and test suites (Jest / pytest) must pass before requesting Codex review.
- **Allowed Scope Only:** Only invoke Codex when changes touch financial math, payment corrections, tenant isolation, SQLCipher, auth, migrations, or sync integrity. Skip Codex for formatting, UI polish, docs, and styles.
- **Review Scoping & Token Capping:** Reviews inspect ONLY the changed files in the diff and immediate dependencies. Findings are capped at at most 5 actionable issues, ordered by severity.
- **Duplicate Prevention:** `.workflow/qa-codex.ps1` enforces an invocation guard against duplicate runs for the same commit range.
- **Capabilities:** Never claim automatic model switching unless an actual supported interface performs it.

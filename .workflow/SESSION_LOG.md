# Session Log

## 2026-10-10
- **Incident**: Task CK-P0-002 stuck in Codex Planning. The process was waiting for stdin (`Reading additional input from stdin...`) because it was not run in a completely non-interactive way.
- **Recovery Action**: Killed stalled `codex` process (PID 34196). Rewrote `run-codex.ps1` to handle parameterized arguments, use strict timeouts (300s), and handle exit codes properly to prevent silent hangs. Re-triggered planning for CK-P0-002.
- **Incident**: Codex QA for CK-P0-003 hit sandbox execution error `helper_unknown_error: setup refresh had errors`.
- **Diagnostic Action**: Confirmed Codex shell helper on Windows failed to initialize inside `workspace-write` and `read-only` sandbox modes due to `windows.sandbox="elevated"` default config mismatch with standard user execution.
- **Recovery Action**: Updated `run-codex.ps1` and `qa-codex.ps1` to pass `-c windows.sandbox='unelevated'`. Tested and confirmed this allows Codex to execute sandbox commands correctly.
- **Incident**: Codex QA timed out for CK-P0-003 after 300s wrapper limit while reviewing the diff, despite fixing the sandbox bug. Preserved as `REVIEW_BLOCKED` per instructions and moved on to `Stale Home and earnings`.

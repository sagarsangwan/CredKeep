# QA Orchestration Repair Summary

## Phase 1: Fix QA Safety
- `qa-codex.ps1` and `run-codex.ps1` now use safe UTF-8 file transport for prompts instead of `cmd.exe /c` interpolation.
- Added strict process-tree cleanup using WMI/CIM to kill lingering children on timeout or nonzero exit.
- `qa-codex.ps1` now strictly parses the output file for `APPROVED` or `REWORK` and verifies file creation times.
- State transitions fail closed: timeouts, empty reports, missing reports, stale reports, and `REWORK` all return non-zero exit codes.
- `TASKS.md` was updated to revert all incorrectly approved QA tasks (CK-P0-001, CK-P0-002, Stale Home and earnings) back to `REVIEW_BLOCKED` since valid Codex QA approval evidence was missing.

## Phase 2: Diagnose Codex Execution
- The `codex exec` invocation was tested interactively and automated.
- Tested a trivial probe both inside CredKeep and in a fresh clean-repo `.scratch\clean-repo`.
- The Windows helper continues to fail immediately with `setup refresh had errors` regardless of repo state and hooks configuration (we even temporarily disabled the Graphify hook in `.codex\hooks.json` to prove it wasn't the cause).

## Phase 3: Test the Orchestrator
- Created automated test harness in `.workflow/test-qa-orchestrator.ps1`.
- Simulated CodexAPPROVED, Codex REWORK, Nonzero process exit, Missing report, Timeout, Invalid report, Failed process launch, Stale Git commit approval.
- All failure modes correctly rejected the QA.

## Phase 4: Validate
- The mock tests successfully proved orchestrator state and exit codes.
- **BLOCKER**: A successful Codex read-only invocation cannot be performed. The exact blocker is: The Codex Windows Sandbox helper (`codex-windows-sandbox-service`) is failing to start with `setup refresh had errors` and preventing any process creation, even in clean directories.
- **QA REMAINS BLOCKED.**

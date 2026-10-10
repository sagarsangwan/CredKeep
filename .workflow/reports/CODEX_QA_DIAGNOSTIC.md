# Codex QA Orchestration Diagnostic

Date: 2026-10-10  
Scope: `.workflow/run-codex.ps1`, `.workflow/qa-codex.ps1`, workflow state/gate files, `.codex/hooks.json`, and recent committed QA logs. No application financial logic was modified.

## Executive finding

**Underlying cause: UNKNOWN. Immediate failure locus: CONFIRMED.**

Codex's Windows command-execution helper fails while refreshing sandbox/setup state, before PowerShell, `cmd.exe`, Git, tests, or the requested QA command can start:

```text
Failed to create unified exec process: helper_unknown_error: setup refresh had errors
```

The failure is below the repository scripts. It reproduced in this independent diagnostic and in the committed QA transcript. In both cases, an initial command succeeded and subsequent commands failed at process creation, including trivial commands and alternate shells. The available error lacks the nested setup-refresh diagnostic needed to identify whether the internal trigger is a stale Windows sandbox helper, a malformed generated permission refresh, or a hook side effect.

Separately, the repository orchestration has confirmed correctness defects that turn infrastructure failures into hangs and false QA success:

1. `.workflow/qa-codex.ps1` does not inspect `$LASTEXITCODE` and unconditionally exits `0`.
2. `.workflow/qa-codex.ps1` has no timeout.
3. `.workflow/run-codex.ps1` times out after 300 seconds but kills only the `cmd.exe` wrapper, not the entire descendant process tree.
4. The committed QA report ends in `REWORK`, but `.workflow/TASKS.md` records CK-P0-001 as `SOURCE_QA_APPROVED - PENDING DEVICE_VERIFIED`. This is a confirmed false approval-state transition.

## Evidence and exact failing commands

### Independent reproduction in this diagnostic

The first file-read command succeeded. The following read-only command then failed before PowerShell launched:

```powershell
Get-Content -Raw AGENTS.md; Get-Content -Raw .workflow/STATE.md; rg --files .workflow .codex | Sort-Object; if (Test-Path GLOSSARY.md) { Get-Content -Raw GLOSSARY.md }
```

Observed result:

```text
exec_command failed: CreateProcess { message: "Rejected(\"Failed to create unified exec process: helper_unknown_error: setup refresh had errors\")" }
```

The same result occurred with:

```powershell
Get-Content -Raw AGENTS.md; Get-Content -Raw .workflow/STATE.md; Write-Output 'CODEX_SETUP_PROBE_OK'
```

and with login-shell setup disabled for both PowerShell and `cmd.exe`. Therefore PowerShell profiles, command contents, Git, Graphify queries, and application tests are not required to reproduce this failure.

### Committed QA transcript

`.workflow/reports/codex_qa_report.md` records Codex v0.162.0. Its first repository read succeeded. The next command failed at 0 ms:

```powershell
$null = Get-Content -Raw AGENTS.md; git status --short; git branch --show-current; git rev-parse HEAD; git diff --stat HEAD; git diff --name-status HEAD; Get-Content -Raw docs/agents/issue-tracker.md
```

Relevant log:

```text
exited -1 in 0ms:
Failed to create unified exec process: helper_unknown_error: setup refresh had errors
2026-10-09T18:23:25.537348Z ERROR codex_core::tools::router: error=exec_command failed: CreateProcess { message: "Rejected(\"Failed to create unified exec process: helper_unknown_error: setup refresh had errors\")" }
```

The transcript then shows the same 0 ms failure for:

```powershell
Write-Output ok
```

as well as `powershell.exe -NoProfile`, `bash.exe -c pwd`, Git commands, sub-agent attempts, and repeated retries. The QA verdict was:

```text
REWORK — QA could not be completed or honestly approved.
```

### Prior hang/orphan evidence

`.workflow/SESSION_LOG.md` records:

```text
Task CK-P0-002 stuck in Codex Planning.
Killed stalled codex process (PID 34196).
```

This confirms at least one lingering/stalled Codex process historically. Current OS process inventory could not be read because the same setup-refresh failure prevented all local process creation. Current orphan presence is therefore unverified.

## Findings by investigation question

### 1. Are the scripts invoking Codex correctly?

**Partially.** Both use `codex exec --sandbox read-only`, which is the correct headless entry point and preserves sandboxing. Redirecting stdin from `NUL` prevents an approval prompt from reading the console. However:

- Passing the full prompt through nested PowerShell -> `cmd.exe /c` quoting is fragile for quotes and `cmd` metacharacters (`&`, `|`, `<`, `>`, `^`, `%`, `!`) and is subject to Windows command-line length limits.
- The QA prompt says "diff since HEAD". `git diff HEAD` only covers uncommitted changes; it does not review an already committed ticket. QA should receive an explicit base and head SHA and review that immutable range.
- The committed QA transcript reports `sandbox: workspace-write` even though the wrapper requests `--sandbox read-only`. The effective policy must be asserted from Codex startup output; the script currently does not validate it.

Recommended invocation pattern: write the prompt to a UTF-8 file, pipe that file to `codex exec ... -`, request a structured/final output file, set `--ask-for-approval never`, and pass explicit base/head SHAs. Do not interpolate the prompt into `cmd.exe /c`.

### 2. Is the Windows sandbox configuration valid?

**Not proven valid; the effective configuration is suspect.** `workspace-write` is an officially supported Windows sandbox mode, and the visible allowed roots are syntactically reasonable. Nevertheless, the helper fails specifically during setup refresh before child creation. The public-facing error contains no inner validation error, so the exact invalid/stale item cannot be named safely.

The correction should preserve sandbox protections: restart/refresh the Codex executor, validate the current Codex configuration, and rerun a trivial command in a clean repository and then CredKeep. Do not use an unrestricted or bypass-sandbox mode as a workaround.

### 3. Are Graphify hooks interfering?

**No direct failure confirmed; side effects remain unexcluded.** `.codex/hooks.json` is valid JSON and configures:

```text
C:/Users/Sagar/AppData/Roaming/Python/Python313/Scripts/graphify.EXE hook-check
```

The QA log shows `hook: PreToolUse Completed` before both the successful first exec and the failing later execs. The failing `CreateProcess` is the requested tool process, not the hook process. This argues against Graphify being the direct failing command. It does not prove that `hook-check` has no state-changing side effect.

Use a controlled A/B verification after the helper is healthy: same trivial `codex exec`, first in a clean repository without project hooks, then in CredKeep with the trusted hook. Capture hook exit code, duration, stdout/stderr, and the following tool launch. Do not disable sandboxing.

### 4. Does subprocess output handling deadlock?

**Classic redirected-pipe deadlock: not supported by evidence.** Output is redirected by `cmd.exe` directly to a file, not captured into undrained .NET `RedirectStandardOutput`/`RedirectStandardError` pipes. The confirmed helper error occurs before any subprocess exists.

The current design is still weak operationally: no live heartbeat is visible, `qa-codex.ps1` has no timeout, and the planning timeout kills only the wrapper. Use direct process APIs with asynchronous output draining or direct file output, periodic heartbeat logging, and descendant-tree termination on timeout.

### 5. Is Codex waiting for approval or interactive input?

**Not for the reproduced setup-refresh failure.** The committed QA header states `approval: never`, and `< NUL` supplies EOF to stdin. The line `Reading additional input from stdin...` is consistent with Codex accepting stdin and is followed by normal startup output in the successful transcript; it is not evidence by itself of a blocked prompt.

Make noninteractive intent explicit with `--ask-for-approval never` and retain stdin EOF/file input. Treat any `action_required`/approval state as a distinct non-success outcome.

### 6. Are timeouts too short?

**300 seconds is too short for full independent QA, but increasing it alone is unsafe.** The QA transcript used about 36,956 tokens and included skill loading, independent review attempts, and retries. Five minutes can be insufficient for diff inspection plus typecheck, lint, tests, and review. Conversely, the confirmed helper error is immediate and should fail fast rather than wait longer.

Recommendation: a 30-60 second startup/first-tool deadline plus a separate 15-30 minute overall QA deadline, with heartbeat/progress monitoring. Abort immediately on the repeated setup-refresh signature.

### 7. Is the QA prompt unnecessarily large?

**No.** The hard-coded QA prompt is roughly 318 characters. The large run came from repository instructions and selected review skills, not the wrapper prompt. Reduce redundant instruction loading where possible, but prompt size is not a causal explanation for the 0 ms process-creation failure.

### 8. Are orphaned Codex processes left running?

**Historically yes; currently unknown.** PID 34196 had to be killed according to the session log. `Stop-Process` on the `cmd.exe` wrapper does not guarantee termination of the nested Codex/Node process tree. Add job-object/process-tree cleanup and verify no descendants remain after success, failure, and timeout.

### 9. Are exit codes detected correctly?

**Planning wrapper: mostly; QA wrapper: no.**

- `run-codex.ps1` waits for the `cmd.exe` process and checks its exit code. `cmd /c` normally propagates the final command's exit code. Its timeout cleanup is incomplete.
- `qa-codex.ps1` invokes `cmd.exe`, ignores `$LASTEXITCODE`, prints "Saved output", and executes `exit 0` unconditionally. Any Codex authentication failure, helper failure, crash, or nonzero QA exit is reported as wrapper success.

### 10. Can failed independent QA be recorded as VERIFIED/approved?

**Yes; confirmed.** The committed report ends `REWORK — QA could not be completed`, while `.workflow/TASKS.md` marks CK-P0-001 complete with `SOURCE_QA_APPROVED - PENDING DEVICE_VERIFIED`. `QA_GATE.md` defines `APPROVED` and `REWORK`, but there is no machine-enforced state transition tying the ledger update to a successfully parsed independent QA artifact.

No task should transition to `APPROVED`, `VERIFIED`, or an equivalent checked state unless all of the following are true:

1. Codex process exit code is zero.
2. The result artifact is fresh and tied to exact base/head SHAs.
3. The artifact contains a machine-parseable verdict of `APPROVED`.
4. Required quality gates completed successfully and are recorded.
5. Infrastructure failures, timeouts, missing artifacts, malformed verdicts, and `REWORK` map to `REVIEW_BLOCKED` or `REWORK`, never approval.

## Recommended correction

1. **Fail closed immediately.** Change `qa-codex.ps1` to propagate the Codex exit code, reject missing/stale/empty reports, and never print success after failure.
2. **Use direct, safe prompt transport.** Store the prompt in a UTF-8 file and pipe it to `codex exec ... -`; avoid nested `cmd.exe` prompt interpolation.
3. **Make automation explicit.** Include `--ask-for-approval never --sandbox read-only` and verify the effective startup header matches.
4. **Pin the review range.** Pass immutable `BaseSha` and `HeadSha`; require Codex to review `git diff <base>...<head>` and record both in the report.
5. **Split deadlines.** Use a short startup/first-tool deadline and a longer overall QA deadline with heartbeat monitoring.
6. **Terminate the whole process tree.** On timeout, close the Windows job object or use an equivalent descendant-tree termination mechanism, then verify no Codex/Node descendant remains.
7. **Quarantine invalid state transitions.** Centralize QA state updates in one script that parses a structured verdict and enforces the five fail-closed conditions above. Correct the CK-P0-001 ledger contradiction; do not mark it verified based on the existing report.
8. **Diagnose the Windows helper without bypassing it.** Restart the Codex executor/app, validate configuration, and compare a clean-repository trivial exec with CredKeep. If only CredKeep fails, A/B the trusted Graphify hook and collect the hook's own logs. If both fail, capture the Codex helper/executor diagnostic log and report the issue with Codex v0.162.0 and the exact 0 ms error signature.
9. **Pin and intentionally update Codex CLI.** Record `codex --version` in every artifact. Test a current supported release in the sandboxed path; roll forward only after the minimal probe and QA smoke test pass.

Official OpenAI examples for headless Codex automation use `codex exec`, an explicit sandbox, `--ask-for-approval never`, stdin prompt input, captured output, and a caller-enforced timeout: <https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex>. OpenAI's sandbox guidance documents native Windows sandbox enforcement and the separation between sandbox and approval policy: <https://developers.openai.com/docs/sandboxing>. Hook guidance confirms that hook commands run around tool events and should have explicit timeouts: <https://developers.openai.com/docs/hooks>.

## Verification steps

Run these only after the Codex executor/helper has been refreshed; keep the sandbox enabled.

1. **Minimal helper probe, three consecutive runs**

   ```powershell
   codex exec --sandbox read-only --ask-for-approval never "Run exactly one read-only shell command: Write-Output CODEX_SETUP_PROBE_OK"
   ```

   Pass condition: all three runs exit `0`, contain the marker, and contain no `setup refresh had errors`.

2. **Hook A/B probe**

   Run the same probe in a clean repository with no project hook, then in CredKeep with `.codex/hooks.json` unchanged. Pass condition: both launch three times; hook completion and duration are logged. If only CredKeep fails, capture Graphify hook stdout/stderr and exit code before changing hook configuration.

3. **Wrapper failure propagation**

   Invoke the wrapper with a deliberately invalid Codex option in a throwaway diagnostic mode. Pass condition: wrapper exits nonzero, no success message is emitted, and workflow state is unchanged.

4. **Timeout and cleanup**

   Use a controlled long-running dummy child under the same process wrapper. Pass condition: timeout returns the designated nonzero code and no descendant process remains. Do not use a real QA run for this test.

5. **Immutable-range QA smoke test**

   Run QA against a small known base/head pair. Pass condition: report records both SHAs, Codex version, effective sandbox/approval policies, completed checks, and one structured verdict.

6. **State-machine tests**

   Verify mappings:

   - exit 0 + fresh structured `APPROVED` + all gates pass -> source QA approved
   - `REWORK` -> rework
   - timeout, helper error, approval request, missing report, stale SHAs, malformed verdict, or nonzero exit -> review blocked
   - none of the failure cases -> verified/approved

7. **Full rerun of affected QA**

   Rerun CK-P0-001 and CK-P0-003 against their exact commits. Until those independent runs complete, retain `REVIEW_BLOCKED`/`REWORK`; do not infer approval from prior test counts.

## Diagnostic limitations

The local execution helper became unusable during this diagnostic, so current OS process inventory and live uncommitted versions of every requested file could not be inspected after the first successful command. The script and log analysis above uses the repository's current recorded HEAD (`c2b85c0`) artifacts, fetched read-only from the connected GitHub repository, plus the live `.workflow/STATE.md` read before the helper failed. No sandbox protection was disabled and no EAS build, remote push, or verification-state change was performed.

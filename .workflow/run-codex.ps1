$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex CLI Planner for CK-P0-001..."

$prompt = "Analyze task CK-P0-001: Payment Crash and Cross-Loan Collection Isolation. Inspect the source code and relevant Git history using Graphify or direct file reads. Trace borrower/loan selection, payment screen, allocation engine, SQLite transaction, success navigation and state refresh. Determine root-cause hypotheses for the native crash and cross-loan payment issue (do not claim native root cause without logs). Provide acceptance criteria and recommended tests. Output detailed diagnostic findings and tests."

cmd.exe /c "codex exec `"$prompt`" < NUL > .workflow\plans\CK-P0-001.md 2>&1"
Write-Host "Saved output to .workflow/plans/CK-P0-001.md"
exit 0

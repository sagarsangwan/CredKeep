$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex QA invocation..."
cmd.exe /c "codex exec `"Perform a QA check on the current task ledger in TASKS.md to see if P0 and P1 formatting is correct, then report.`" < NUL > .workflow\reports\codex_qa_report.md 2>&1"
Write-Host "Saved output to .workflow/reports/codex_qa_report.md"
exit 0

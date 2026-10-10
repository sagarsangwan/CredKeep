$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex QA invocation..."
$prompt = "Perform QA on CK-P0-001. Review the ACTUAL Git diff since HEAD. Verify loan-ID isolation, atomic financial mutations (use of tx object in withExclusiveTransactionAsync instead of this.db), payment idempotency, transaction conservation and error handling. Check the regression test. Return APPROVED or REWORK with concrete file-level findings."
cmd.exe /c "codex exec --sandbox read-only `"$prompt`" < NUL > .workflow\reports\codex_qa_report.md 2>&1"
Write-Host "Saved output to .workflow/reports/codex_qa_report.md"
exit 0

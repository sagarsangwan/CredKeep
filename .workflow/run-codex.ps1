$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Attempting to invoke Codex CLI..."
$codexPath = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexPath) {
    Write-Error "Codex CLI is not installed or not in PATH."
    exit 1
}
Write-Host "Running Codex CLI..."
cmd.exe /c "codex exec `"Read AGENTS.md, .workflow/STATE.md, and .workflow/HANDOFF.md and produce a diagnostic plan.`" < NUL > .workflow\reports\codex_diagnostic_plan.md 2>&1"
Write-Host "Saved output to .workflow/reports/codex_diagnostic_plan.md"
exit 0

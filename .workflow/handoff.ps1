$ErrorActionPreference = "Stop"

$handoffFile = Join-Path $PSScriptRoot "HANDOFF.md"

if (Test-Path $handoffFile) {
    Write-Host "--- HANDOFF ---"
    Get-Content $handoffFile
} else {
    Write-Host "HANDOFF.md not found. Cannot validate handoff."
    exit 1
}

$content = Get-Content $handoffFile -Raw
if ($content -match "<none>") {
    Write-Host "Validation Failed: HANDOFF.md contains incomplete fields (<none>)."
    exit 1
}

Write-Host "Validation Passed: Handoff is ready."
exit 0

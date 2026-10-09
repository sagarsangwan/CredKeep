$ErrorActionPreference = "Stop"

$stateFile = Join-Path $PSScriptRoot "STATE.md"
$tasksFile = Join-Path $PSScriptRoot "TASKS.md"

if (Test-Path $stateFile) {
    Write-Host "--- STATE ---"
    Get-Content $stateFile
} else {
    Write-Host "STATE.md not found."
}

Write-Host ""
if (Test-Path $tasksFile) {
    Write-Host "--- TASKS ---"
    Get-Content $tasksFile
} else {
    Write-Host "TASKS.md not found."
}

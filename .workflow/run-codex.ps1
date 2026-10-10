param (
    [Parameter(Mandatory=$true)]
    [string]$TaskId,
    
    [Parameter(Mandatory=$true)]
    [string]$Prompt
)

$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex CLI Planner for $TaskId..."

$OutputDir = ".workflow\plans"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}
$OutputFile = "$OutputDir\$TaskId.md"

# Use Start-Process with cmd.exe to ensure proper output redirection and a real process handle
$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"codex exec --sandbox read-only `"$Prompt`" < NUL > $OutputFile 2>&1`"" -PassThru -NoNewWindow
if (-not $process) {
    throw "Failed to start Codex process"
}

try {
    # 5-minute timeout for planning (300 seconds)
    $process | Wait-Process -Timeout 300
    if ($process.ExitCode -ne 0) {
        Write-Error "Codex exited with code $($process.ExitCode)"
        exit $process.ExitCode
    }
} catch [System.TimeoutException] {
    Write-Error "Codex timed out after 300 seconds. Killing process."
    $process | Stop-Process -Force
    exit 1
}

Write-Host "Saved output to $OutputFile"
exit 0

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
$PromptFile = "$OutputDir\${TaskId}_prompt.txt"

Set-Content -Path $PromptFile -Value $Prompt -Encoding UTF8

# Use Start-Process with wsl.exe to invoke native Linux Codex
$PromptFileWsl = (wsl.exe -e wslpath -a $PromptFile).Trim()
$OutputFileWsl = (wsl.exe -e wslpath -a $OutputFile).Trim()
$process = Start-Process -FilePath "wsl.exe" -ArgumentList "-e bash -c `". ~/.nvm/nvm.sh && cat '$PromptFileWsl' | codex exec --sandbox read-only - > '$OutputFileWsl' 2>&1`"" -PassThru -NoNewWindow
if (-not $process) {
    throw "Failed to start Codex process via WSL"
}

function Kill-ProcessTree($pidToKill) {
    $children = Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq $pidToKill
    foreach ($child in $children) { Kill-ProcessTree $child.ProcessId }
    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
}

try {
    # 5-minute timeout for planning (300 seconds)
    $process | Wait-Process -Timeout 300
    if ($process.ExitCode -ne 0) {
        Write-Error "Codex exited with code $($process.ExitCode)"
        Kill-ProcessTree $process.Id
        exit $process.ExitCode
    }
} catch [System.TimeoutException] {
    Write-Error "Codex timed out after 300 seconds. Killing process."
    Kill-ProcessTree $process.Id
    exit 1
}

Write-Host "Saved output to $OutputFile"
exit 0

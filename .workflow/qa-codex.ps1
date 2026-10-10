param (
    [Parameter(Mandatory=$true)][string]$BaseSha,
    [Parameter(Mandatory=$true)][string]$HeadSha,
    [Parameter(Mandatory=$true)][string]$TaskName,
    [Parameter(Mandatory=$false)][string]$PromptOverride,
    [Parameter(Mandatory=$false)][string]$CmdPath = "cmd.exe",
    [Parameter(Mandatory=$false)][int]$TimeoutSeconds = 900
)

$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex QA invocation for $TaskName ($BaseSha...$HeadSha)..."

$OutputDir = ".workflow\reports"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }
$OutputFile = "$OutputDir\${TaskName}_qa_report.md"
$PromptFile = "$OutputDir\${TaskName}_qa_prompt.txt"

$prompt = if ($PromptOverride) { $PromptOverride } else { "Perform QA on $TaskName. Review the git diff between $BaseSha and $HeadSha. Verify cross-loan isolation, atomic financial mutations, payment idempotency, transaction conservation, and error handling. Check the regression test. Return APPROVED or REWORK with concrete file-level findings." }
Set-Content -Path $PromptFile -Value $prompt -Encoding UTF8

$StartTime = Get-Date

$PromptFileWsl = (wsl.exe -e wslpath -a $PromptFile).Trim()
$OutputFileWsl = (wsl.exe -e wslpath -a $OutputFile).Trim()
$process = Start-Process -FilePath "wsl.exe" -ArgumentList "-e bash -c `". ~/.nvm/nvm.sh && cat '$PromptFileWsl' | codex exec --sandbox read-only - > '$OutputFileWsl' 2>&1`"" -PassThru -NoNewWindow
if (-not $process) { throw "Failed to start Codex process via WSL" }

function Kill-ProcessTree($pidToKill) {
    $children = Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq $pidToKill
    foreach ($child in $children) { Kill-ProcessTree $child.ProcessId }
    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
}

try {
    # Use configurable timeout (default 900s)
    $process | Wait-Process -Timeout $TimeoutSeconds
    if ($process.ExitCode -ne 0) {
        Write-Error "Codex exited with nonzero code $($process.ExitCode). QA rejected."
        Kill-ProcessTree $process.Id
        exit $process.ExitCode
    }
} catch [System.TimeoutException] {
    Write-Error "Codex timed out after $TimeoutSeconds seconds. Killing process tree. QA rejected."
    Kill-ProcessTree $process.Id
    exit 1
}

if (-not (Test-Path $OutputFile)) {
    Write-Error "QA Report missing. QA rejected."
    exit 1
}

$FileTime = (Get-Item $OutputFile).LastWriteTime
if ($FileTime -lt $StartTime) {
    Write-Error "QA Report is stale. QA rejected."
    exit 1
}

$content = Get-Content $OutputFile -Raw
if (-not $content) {
    Write-Error "QA Report is empty. QA rejected."
    exit 1
}

if ($content -match "REWORK") {
    Write-Error "QA Rework required. QA rejected."
    exit 1
} elseif ($content -match "APPROVED") {
    Write-Host "QA Approved successfully."
    exit 0
} else {
    Write-Error "No valid verdict (APPROVED/REWORK) found in report. QA rejected."
    exit 1
}


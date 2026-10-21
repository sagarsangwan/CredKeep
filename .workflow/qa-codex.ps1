param (
    [Parameter(Mandatory=$true)][string]$BaseSha,
    [Parameter(Mandatory=$true)][string]$HeadSha,
    [Parameter(Mandatory=$true)][string]$TaskName,
    [Parameter(Mandatory=$false)][string]$PromptOverride,
    [Parameter(Mandatory=$false)][string]$CmdPath = "cmd.exe",
    [Parameter(Mandatory=$false)][int]$TimeoutSeconds = 900,
    [Parameter(Mandatory=$false)][string]$Model = "gpt-6.1-sol",
    [Parameter(Mandatory=$false)][string]$ReasoningEffort = "medium",
    [Parameter(Mandatory=$false)][switch]$Force
)

$ErrorActionPreference = "Stop"
$env:Path += ";$env:APPDATA\npm;$env:USERPROFILE\AppData\Roaming\Python\Python313\Scripts"
Write-Host "Running Codex QA invocation for $TaskName ($BaseSha...$HeadSha)..."
Write-Host "Config: Model=$Model, ReasoningEffort=$ReasoningEffort, Sandbox=read-only"

$OutputDir = ".workflow\reports"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }
$OutputFile = "$OutputDir\${TaskName}_qa_report.md"
$PromptFile = "$OutputDir\${TaskName}_qa_prompt.txt"
$GuardFile  = "$OutputDir\${TaskName}_qa_guard.json"

# 1. Clean up orphaned guard if report was removed
if (-not (Test-Path $OutputFile) -and (Test-Path $GuardFile)) {
    Remove-Item $GuardFile -Force -ErrorAction SilentlyContinue
}

# 1. Invocation Guard: Prevent duplicate QA runs for identical commit & scope
if (-not $Force -and (Test-Path $OutputFile) -and (Test-Path $GuardFile)) {
    try {
        $guardContent = Get-Content $GuardFile -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($guardContent -and $guardContent.BaseSha -eq $BaseSha -and $guardContent.HeadSha -eq $HeadSha -and $guardContent.TaskName -eq $TaskName) {
            $reportTime = (Get-Item $OutputFile).LastWriteTime
            $guardTime = [DateTime]::Parse($guardContent.Timestamp)
            if ($reportTime -ge $guardTime.AddSeconds(-2)) {
                Write-Host "Codex QA skipped: Duplicate QA run for $TaskName ($BaseSha...$HeadSha). Existing report preserved."
                $existingContent = Get-Content $OutputFile -Raw
                if ($existingContent -match "APPROVED|SKIPPED_BY_SCOPE") {
                    Write-Host "Prior verdict: APPROVED / SKIPPED. Exiting cleanly."
                    exit 0
                } elseif ($existingContent -match "REWORK") {
                    Write-Host "Prior verdict: REWORK. Review findings already present in $OutputFile."
                    exit 1
                }
            }
        }
    } catch {
        # Fall through on parse errors
    }
}

# 2. Scope Filter: Skip Codex review for purely low-risk/UI/formatting/doc changes
$isRealGitRange = $false
try {
    $baseCheck = git rev-parse --verify "$BaseSha^{commit}" 2>$null
    $headCheck = git rev-parse --verify "$HeadSha^{commit}" 2>$null
    if ($baseCheck -and $headCheck) { $isRealGitRange = $true }
} catch {
    $isRealGitRange = $false
}

if ($isRealGitRange -and -not $Force) {
    $changedFiles = git diff --name-only $BaseSha $HeadSha
    $criticalRegex = '^(src/core/domain/|src/core/database/|backend/tenants/|backend/api/|backend/credkeep/|.*/migrations/|.*sqlcipher.*|.*auth.*|.*sync.*)'
    $hasCriticalChanges = $false
    foreach ($file in $changedFiles) {
        if ($file -match $criticalRegex) {
            $hasCriticalChanges = $true
            break
        }
    }

    if (-not $hasCriticalChanges) {
        Write-Host "Scope Filter: Diff ($BaseSha...$HeadSha) contains no critical domain, financial, auth, tenant, sync, or migration changes."
        Write-Host "Skipping Codex review to minimize weekly token consumption. Local static checks and unit tests are authoritative."

        $skipSummary = @"
# Codex QA Report for $TaskName
**Status:** SKIPPED_BY_SCOPE
**Base SHA:** $BaseSha
**Head SHA:** $HeadSha
**Reason:** Changes are restricted to low-risk files (UI polish, formatting, docs, or non-financial components).
**Verdict:** APPROVED (Static checks and unit tests sufficient)
"@
        Set-Content -Path $OutputFile -Value $skipSummary -Encoding UTF8

        $guardData = @{
            TaskName   = $TaskName
            BaseSha    = $BaseSha
            HeadSha    = $HeadSha
            Model      = $Model
            Reasoning  = $ReasoningEffort
            Verdict    = "APPROVED"
            Timestamp  = (Get-Date).ToString("o")
        } | ConvertTo-Json
        Set-Content -Path $GuardFile -Value $guardData -Encoding UTF8
        exit 0
    }
}

# 3. Construct Token-Optimized Prompt (Max 5 findings, ordered by severity)
$defaultPrompt = @"
Perform focused, read-only QA review on milestone $TaskName.
Review ONLY the git diff between $BaseSha and $HeadSha and directly impacted dependencies.
Scope: Verify financial calculation correctness, payment idempotency, tenant isolation, SQLCipher/database mutations, migrations, or sync integrity.

Token-Optimization & Review Invariants:
1. Review only the changed files in the commit range ($BaseSha...$HeadSha). Do not perform broad repository indexing.
2. Limit your findings to at most 5 actionable issues, ordered strictly by severity (P0 Critical first, down to P2 Minor).
3. If no critical or high severity defects are found, return: APPROVED.
4. If blocking defects exist, provide concise file/line references and return: REWORK.
5. Do NOT suggest broad architectural rewrites or stylistic nitpicks.
"@

$prompt = if ($PromptOverride) { $PromptOverride } else { $defaultPrompt }
Set-Content -Path $PromptFile -Value $prompt -Encoding UTF8

$StartTime = Get-Date

# 4. Process Launch (Honors custom mock/cmd harness or WSL Codex)
$process = $null
if ($CmdPath -and ($CmdPath -notmatch "cmd(\.exe)?$")) {
    if (-not (Test-Path $CmdPath)) {
        Write-Error "Command path not found: $CmdPath"
        exit 1
    }
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$CmdPath`"" -PassThru -NoNewWindow
} else {
    $PromptFileWsl = (wsl.exe -e wslpath -a $PromptFile).Trim()
    $OutputFileWsl = (wsl.exe -e wslpath -a $OutputFile).Trim()
    $wslCmd = ". ~/.nvm/nvm.sh && cat '$PromptFileWsl' | codex exec -m '$Model' -c model_reasoning_effort='$ReasoningEffort' --sandbox read-only - > '$OutputFileWsl' 2>&1"
    $process = Start-Process -FilePath "wsl.exe" -ArgumentList "-e bash -c `"$wslCmd`"" -PassThru -NoNewWindow
}

if (-not $process) { throw "Failed to start Codex process" }

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

# 5. Persist invocation guard state
$verdict = "UNKNOWN"
$lines = $content -split "`r?`n" | Where-Object { $_ -match "\S" }
$lastLines = ($lines | Select-Object -Last 10) -join "`n"
if ($lastLines -match "\bAPPROVED\b") {
    $verdict = "APPROVED"
} elseif ($lastLines -match "\bREWORK\b") {
    $verdict = "REWORK"
} elseif ($content -match "APPROVED") {
    $verdict = "APPROVED"
}

$guardData = @{
    TaskName   = $TaskName
    BaseSha    = $BaseSha
    HeadSha    = $HeadSha
    Model      = $Model
    Reasoning  = $ReasoningEffort
    Verdict    = $verdict
    Timestamp  = (Get-Date).ToString("o")
} | ConvertTo-Json
Set-Content -Path $GuardFile -Value $guardData -Encoding UTF8

if ($verdict -eq "REWORK") {
    Write-Error "QA Rework required. QA rejected."
    exit 1
} elseif ($verdict -eq "APPROVED") {
    Write-Host "QA Approved successfully."
    exit 0
} else {
    Write-Error "No valid verdict (APPROVED/REWORK) found in report. QA rejected."
    exit 1
}


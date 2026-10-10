$ErrorActionPreference = "Continue"
Write-Host "Running Orchestrator Tests..."

$mockCmd = ".workflow\mock-cmd.bat"
$reportFile = ".workflow\reports\mock-task_qa_report.md"

$global:failures = 0

function Run-Test {
    param($Name, $SetupScript, $ExpectedExitCode, $Timeout = 900)
    Write-Host "`nTest: $Name"
    
    if (Test-Path $reportFile) { Remove-Item $reportFile -Force }
    
    & $SetupScript
    
    $p = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File .workflow\qa-codex.ps1 -BaseSha base -HeadSha head -TaskName mock-task -CmdPath `"$mockCmd`" -TimeoutSeconds $Timeout" -PassThru -NoNewWindow -Wait
    
    if ($p.ExitCode -eq $ExpectedExitCode) {
        Write-Host "PASS: $Name" -ForegroundColor Green
    } else {
        Write-Host "FAIL: $Name (Expected $ExpectedExitCode, got $($p.ExitCode))" -ForegroundColor Red
        $global:failures++
    }
}

Set-Content $mockCmd "@echo off`necho APPROVED > `".workflow\reports\mock-task_qa_report.md`"`nexit 0"
Run-Test "Codex APPROVED" {} 0

Set-Content $mockCmd "@echo off`necho REWORK > `".workflow\reports\mock-task_qa_report.md`"`nexit 0"
Run-Test "Codex REWORK" {} 1

Set-Content $mockCmd "@echo off`necho APPROVED > `".workflow\reports\mock-task_qa_report.md`"`nexit 1"
Run-Test "Nonzero process exit" {} 1

Set-Content $mockCmd "@echo off`nexit 0"
Run-Test "Missing report" {} 1

Set-Content $mockCmd "@echo off`necho SOMETHING ELSE > `".workflow\reports\mock-task_qa_report.md`"`nexit 0"
Run-Test "Invalid report" {} 1

Run-Test "Failed process launch" { $global:mockCmd = "non_existent_cmd.bat" } 1
$global:mockCmd = ".workflow\mock-cmd.bat"

Set-Content $mockCmd "@echo off`nexit 0"
Run-Test "Stale Git commit approval" {
    New-Item -ItemType File -Force -Path $reportFile | Out-Null
    Set-Content $reportFile "APPROVED"
    (Get-Item $reportFile).LastWriteTime = (Get-Date).AddMinutes(-5)
    Start-Sleep -Seconds 1
} 1

Set-Content $mockCmd "@echo off`ntimeout /t 5 /nobreak >nul`nexit 0"
Run-Test "Timeout" {} 1 2

if ($global:failures -eq 0) {
    Write-Host "`nALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n$global:failures TESTS FAILED" -ForegroundColor Red
    exit 1
}

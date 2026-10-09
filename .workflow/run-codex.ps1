$ErrorActionPreference = "Continue"

Write-Host "Attempting to invoke Codex CLI..."

# The orchestrator will try to run codex
try {
    # Check if codex is available
    $codexPath = Get-Command codex -ErrorAction SilentlyContinue
    if (-not $codexPath) {
        Write-Error "Codex CLI is not installed or not in PATH."
        exit 1
    }
    
    # Run codex non-interactively
    Write-Host "Running Codex CLI..."
    codex --version
    
    # Example logic to run a plan
    # codex run --task "Read workflow files and produce diagnostic plan" > .workflow/reports/codex_plan.txt
} catch {
    Write-Error "Failed to run Codex: $_"
    exit 1
}

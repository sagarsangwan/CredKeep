# QA Gate

## Independence Rule
Codex must review the actual committed changes, not Gemini's completion summary.
Gemini must not approve its own implementation as release-ready.

## Required Codex Checks
- Financial invariant tests
- Cross-loan isolation
- Correct loan status transitions
- Real-data UI and navigation
- SQLite transaction integrity
- Android crash and install diagnosis
- Regression coverage
- TypeScript/lint/Expo Doctor
- Security-sensitive changes

## QA Outcomes
- **REWORK:** Task returns to Gemini with concrete findings.
- **APPROVED:** Source-level QA has passed. (Does not mean Android acceptance is automatically complete).

# QA Gate & Review Policy (Lightweight V2 Policy)

## Independence Rule
Codex reviews committed changes independently; Gemini must not approve its own implementation as release-ready.

## Lightweight QA Policy (Strict Loop Prevention)
1. **No Full-Range Loops:** Automatic full-range Codex review from base SHA is removed from correction cycles.
2. **Cap on Reviews:** Maximum of ONE initial review and ONE targeted re-review per milestone.
3. **Explicit Approval Gate:** Never run Codex automatically a third time for the same milestone without explicit Product Owner approval.
4. **Targeted Re-reviews:** Re-reviews must inspect only the latest fixes and their dependencies, using prior findings as context (scoped commit range).
5. **Testing Discipline:** Run targeted tests during corrections; run full suites only at milestone boundaries or when a broad regression is suspected.
6. **Grouped Fixes:** Group related findings logically before implementing fixes.
7. **Severity Separation:** Distinguish critical P0/P1 functional/financial defects from optional P2 refactoring suggestions.
8. **Hard Circuit Breaker (`REVIEW_BLOCKED`):** If an issue survives two correction attempts, mark `REVIEW_BLOCKED` with concrete evidence rather than looping.
9. **Verdict Integrity:** Never convert `REWORK` or a timeout into `APPROVED`.
10. **Signal-to-Noise:** Do not emit repeated operational status messages that lack new diagnostic or verification information.

## QA Outcomes
- **APPROVED:** Scoped review has passed all criteria.
- **REWORK:** Targeted correction required (maximum 1 automatic cycle).
- **REVIEW_BLOCKED:** Blocked after 2 cycles; escalated to Product Owner with evidence.


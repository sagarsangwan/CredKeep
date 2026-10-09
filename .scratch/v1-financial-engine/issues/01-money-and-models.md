# 01-money-and-models

Status: `ready-for-agent`

## Overview
Implement pure TypeScript integer `Paise` branded type and base loan/kist domain models without external runtime dependencies.

## Acceptance Criteria
- `Paise` branded type with `toPaise(rupees)` and `fromPaise(paise)` conversion functions.
- Validates against `Number.isSafeInteger()`.
- Pure types for `LoanContract`, `ScheduledKist`, `OverduePeriod`, `PaymentAllocation`, and `TransactionJournalRow`.
- 100% unit test coverage via pure TS tests.

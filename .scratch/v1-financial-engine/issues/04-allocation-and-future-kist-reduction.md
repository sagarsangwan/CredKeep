# 04-allocation-and-future-kist-reduction

Status: `ready-for-agent`

## Overview
Implement the cash collection allocation engine, routing funds through overdue obligations and sequentially reducing future kists without advance-wallet complexity.

## Acceptance Criteria
- Allocates cash across penalties (if applicable by policy) and chronological past-due kists.
- Routes extra payments to reduce the earliest unpaid future scheduled kists directly.
- Updates future kist paid components without changing contractual due dates.
- Routes any excess beyond total loan face value to unallocated surplus for refunding.
- Supports single latest-payment LIFO reversal, restoring kist balances and DPD cleanly.

# 02-schedule-and-anchor-days

Status: `ready-for-agent`

## Overview
Implement schedule generation for Upfront Fixed Markup and Monthly Bullet loans with support for monthly anchor days (1–31) and calendar month clamping.

## Acceptance Criteria
- Supports anchor days 1–31.
- Clamps to last calendar date for shorter months (e.g., Feb 28 or 29 leap year, Apr 30) while preserving original anchor day for subsequent months.
- Allocates principal and markup components per kist with exact zero-paise remainder adjustment on first installment.
- Previews full schedule before confirmation.

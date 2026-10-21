# CredKeep — Generate All Remaining Screens

Use this entire document as one Stitch prompt in project **CredKeep V1 — Mobile Design System** (`8106667901868227815`) with design system **CredKeep Neutral Precision v1** (`9280003817496754250`).

Create exactly **19 separate Android mobile screens**, one screen per frame. Each frame must be native **390 × 884 logical pixels** (a 780 × 1768 render is valid). Do not create a desktop canvas, presentation board, overview sheet, device shell, embedded phone mockup, multi-screen frame, or elongated scroll mockup. Keep primary content and controls within the upper 390 × 844 content target where practical, while respecting dynamic Android status/navigation insets. Do not hardcode a 40dp bottom inset.

Use the existing neutral CredKeep visual language: white/off-white surfaces, near-black text, 1dp cool-gray borders, compact spacing, crisp small icons, restrained semantic green/amber/red, and no gradients or decorative illustration. Use the existing verified component families; do not generate components or regenerate any other screens. Each output frame name and visible app-bar title must exactly match the specification below. Show only the normal state requested, not alternate states side-by-side.

Financial rules are non-negotiable: deterministic calculations; payments never cross loans; corrections use immutable reversal plus replacement entries; no invented balances. Monthly Kist canonical example is ₹50,000 principal at 24% p.a. for 10 months = ₹10,000 interest, ₹60,000 total, ten installments of ₹6,000. One-Time canonical example is ₹10,000 at 30% p.a. for 3 months = ₹750 interest and ₹10,750 due. Extension collects ₹750 completed-term interest, adds ₹1,500 for six months, keeps ₹10,000 principal unchanged, shows ₹2,250 cumulative interest, and ₹11,500 new maturity due.

Generate these frames in this order:

1. **AUTH-01 — Welcome**: first-time entry; CredKeep mark, short privacy promise, Create Account, Log In. Primary CTA Create Account → AUTH-02.
2. **AUTH-02 — Register**: lender/business name, verified mobile or username, password, consent. Primary CTA Create Account → AUTH-04.
3. **AUTH-03 — Login**: identifier, password, show/hide, forgot password if supported. Primary CTA Log In → AUTH-04/HOME-01.
4. **HOME-01 — Dashboard**: outstanding, due today, collected, overdue, compact follow-ups, add borrower/loan. Primary CTA Open Collections → COL-01.
5. **HOME-02 — Offline Dashboard**: locally saved figures, pending count, last server sync, retry when connected. Primary CTA View Local Loans → LOAN-01. Never imply unsynced data is remotely saved.
6. **BOR-04 — Borrower Profile**: contact, active loans, balance, history, notes, Add Loan. Primary CTA Add Loan → LOAN-02.
7. **LOAN-01 — All Loans**: search, product/status chips, rows with amount due and date. Primary CTA Open Loan → KIST-01 or ONCE-01.
8. **LOAN-02 — Select Borrower**: searchable borrower sheet, selected identity, add-new option. Primary CTA Continue → LOAN-03.
9. **LOAN-03 — Select Product**: distinct Monthly Kist and One-Time Repayment cards with concise descriptions. Primary CTA Continue → LOAN-04A or LOAN-04B.
10. **KIST-02 — Installment Schedule**: rows #1–#10 with due date, ₹6,000 amount, paid/unpaid/partial status, and penalty shown separately. Primary CTA Open Payment → KIST-03. App-bar title must be “Installment Schedule”, never “Security Documents”.
11. **ONCE-02 — Extend — Collect Interest**: original term 3 months, due interest ₹750, amount received ₹750, receipt method. Primary CTA Continue → ONCE-03. App-bar title must be “Collect Term Interest”.
12. **ONCE-07 — Close Loan Review**: itemized ₹10,000 principal + ₹750 interest = ₹10,750 settlement, journal summary, duplicate/double-confirm protection. Primary CTA Confirm Close → ONCE-01. App-bar title must be “Close Loan Review”.
13. **DOC-01 — Document Picker**: Camera, Gallery, PDF if supported, and permission explainer. Primary CTA Open Camera/Gallery → DOC-02. App-bar title must be “Attach Document”.
14. **DOC-02 — Photo Preview**: document photo preview, rotate/crop controls if supported, document type and notes. Primary CTA Save Document → DOC-03. App-bar title must be “Photo Preview”.
15. **DOC-03 — Loan Documents**: cheque/affidavit/collateral rows, notes, honest local/cloud state. Primary CTA View Document → DOC-04. App-bar title must be “Loan Documents”.
16. **SET-01 — Settings**: workspace, security, sync, supported backups, sign out. Primary CTA Open Security → SET-02. App-bar title must be “Settings”.
17. **SYS-01 — App Initialization**: CredKeep logo, short restore-session progress label, no fake success. Continue automatically → AUTH-01 or HOME-01. App-bar may be omitted; if present it must say “App Initialization”, never “Security Setup”.
18. **SYS-02 — Database Loading**: quiet progress opening encrypted tenant database, initializing local ledger, safe-wait language. Continue automatically → HOME-01. App-bar may be omitted; if present it must say “Database Loading”, never “Security Setup”.
19. **SYS-06 — Session Expired**: session-expired explanation, zero-data-loss reassurance, Log In → AUTH-03, optional quick PIN only if already enrolled. App-bar title must be “Session Expired”, never “Security Setup”.

Before returning results, verify all 19 outputs are individual MOBILE frames at the native 390 × 884 logical size, have the exact screen names and app-bar titles above, contain no desktop boards or phone mockups, and preserve all stated financial totals and navigation targets. Return the 19 screen IDs in the same order.

# CredKeep Domain Glossary

Field lending ledger vocabulary for single-financier informal and semi-formal Indian credit systems.

## Language

### Monetary Units & Calculations

**Paise**:
The canonical integer monetary unit (1 INR = 100 Paise) used for all internal calculations, storage, and ledger operations to eliminate floating-point rounding errors.
_Avoid_: Rupees (in domain models), float, decimal

**Contractual Face Value**:
The total monetary obligation legally agreed upon at loan origination, defined as Principal Disbursed plus Contractual Markup.
_Avoid_: Total debt, maturity sum, loan amount

**Principal Disbursed**:
The actual net capital handed over to the Borrower at loan origination.
_Avoid_: Base amount, capital advance, net loan

**Contractual Markup**:
The fixed monetary fee or profit charged for financing over the loan tenure, determined either as an upfront flat charge or as a monthly fixed charge.
_Avoid_: Interest, margin, service cut

### Loan Products & Schedules

**Borrower**:
An individual or micro-enterprise receiving funds and obligated to repay according to an agreed schedule.
_Avoid_: Client, customer, user, debtor

**Loan Account**:
An active contract between the single financier and a Borrower governing a specific disbursement, markup, schedule, and collateral.
_Avoid_: File, case, deal

**Upfront Markup Loan**:
A financing model where total markup is fixed upfront and added to principal, with the combined face value divided across equal scheduled Kists.
_Avoid_: Flat EMI, installment loan

**Monthly Bullet Loan**:
A financing model where the Borrower pays a fixed monthly service charge/markup periodically, and repays the entire principal in a single bullet payment at maturity.
_Avoid_: Interest-only loan, balloon loan

**Kist**:
A scheduled periodic installment due on an agreed calendar date.
_Avoid_: EMI, installment, payment slice

**Original Due Date**:
The immutable contractual calendar date on which a Kist was scheduled at loan origination.
_Avoid_: Contract date, anchor date

**Effective Due Date**:
The active operational calendar date on which a Kist is due, modified via formal schedule modification without altering the original contractual date.
_Avoid_: Revised date, dynamic due date

**Tenure**:
The agreed duration of the Loan Account expressed as the total count of monthly cycles.
_Avoid_: Term, period, duration

**Schedule Modification**:
An auditable record altering the Effective Due Date of a single specific Kist with an explicit penalty treatment decision.
_Avoid_: Reschedule, date shift, deferral

### Repayments, Penalties & Overdue Collections

**Collection Receipt**:
An immutable record of money received from a Borrower against a Loan Account, issued with a unique receipt number and timestamp.
_Avoid_: Payment slip, voucher, credit slip

**Waterfall Allocation**:
The deterministic sequence used to apply incoming collection funds across accrued Late Penalties, due Markup, and Principal.
_Avoid_: Payment splitting, balance deduction

**Partial Payment**:
A collection where the amount received is less than the currently due Kist plus accrued penalties.
_Avoid_: Half kist, split payment

**Future Kist Reduction**:
The immediate automatic allocation of excess collection cash toward the earliest unpaid future scheduled Kists without creating a separate advance wallet.
_Avoid_: Advance payment, wallet credit, overpayment buffer

**Unallocated Surplus**:
Cash collected in excess of the entire remaining contractual face value of a loan, held strictly for refunding.
_Avoid_: Excess balance, float, change

**Overdue Status**:
The state of a Loan Account having at least one unpaid Kist whose Effective Due Date has passed.
_Avoid_: Default term, aging bucket, overdue cycle

**Late Penalty**:
A flat fee of ₹100 per calendar day assessed once per overdue Loan Account starting the day after the earliest unpaid due date. Cleared upon payment and never carried into future months.
_Avoid_: Compounding fine, overdue charge, per-kist penalty

**Penalty Waiver**:
An explicit, recorded noncash action by the financier to forgive an accrued Late Penalty without modifying principal, markup, or cash collections.
_Avoid_: Discount, write-off

**Foreclosure**:
The early closure of a Loan Account prior to contractual maturity, settling outstanding principal and any agreed early-settlement markup.
_Avoid_: Pre-closure, early settlement

**Settlement (OTS)**:
A negotiated compromise where the financier accepts a lump sum lower than the total outstanding receivable and legally extinguishes the debt.
_Avoid_: Haircut, write-off, compromise

**Bad Debt Write-Off**:
An accounting impairment marking an unpaid loan as uncollectible, which removes it from active portfolio balance without extinguishing legal debt claims.
_Avoid_: Settlement, cancellation, waiver

### Security & Collateral

**CTS Cheque**:
A Cheque Truncation System standard cheque (blank or dated) logged as a security instrument under Section 138 Negotiable Instruments Act.
_Avoid_: Security cheque, bank slip

**Promissory Note**:
An executed legal undertaking on stamp paper affirming the Borrower's debt obligation.
_Avoid_: IOU, stamp paper, bond

**Guarantor**:
A third party who affirms personal responsibility for a Borrower's debt obligation.
_Avoid_: Surety, reference, co-signer

**Collateral Asset**:
A tangible asset, property document, or vehicle RC book held or pledged as security.
_Avoid_: Pledge, pawn, mortgage

### Storage & Security

**Database Master Key**:
A cryptographically secure 256-bit key generated locally and stored in the Android Keystore to encrypt the SQLite database at rest.
_Avoid_: Passcode, hardcoded key

**Backup Passphrase**:
A user-provided passphrase used to derive a Key Encryption Key (KEK) via PBKDF2 for encrypting portable export archives.
_Avoid_: App password, login pin

**Audit Correction**:
An immutable compensating ledger entry recording a manual adjustment, correction, or reversal with an explicit timestamp and reason.
_Avoid_: Edit, DB update, overwrite

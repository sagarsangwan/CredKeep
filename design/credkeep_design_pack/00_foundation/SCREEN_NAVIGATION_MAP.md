# App flow map

AUTH-01 Welcome -> AUTH-02 Register OR AUTH-03 Login -> AUTH-04 Optional Security -> HOME-01 Dashboard; returning locked sessions -> AUTH-05; recovery -> AUTH-06.
HOME-01 -> BOR-01 Directory -> BOR-03 Add -> BOR-04 Profile -> BOR-05 Edit.
HOME-01 -> LOAN-01 All loans -> KIST-01 or ONCE-01.
BOR-04 -> LOAN-02 borrower select -> LOAN-03 product -> LOAN-04A / LOAN-04B terms -> LOAN-05 docs -> LOAN-06A / LOAN-06B review -> LOAN-07 success.
COL-01 collections -> COL-02 loan select -> KIST-01 -> KIST-03 payment -> KIST-04 review -> KIST-05 receipt.
COL-01 -> ONCE-01 -> ONCE-02 settle interest -> ONCE-03 new term -> ONCE-04 review -> ONCE-05 success; or ONCE-06 close -> ONCE-07 review. ONCE-08 term history from details.
KIST-05 -> COL-03 payment details -> COL-04 correct -> COL-05 review -> COL-06 audit trail.
Loan details -> DOC-03 docs -> DOC-01 picker -> DOC-02 preview -> DOC-04 viewer.
More -> REP-01 reports -> REP-02 report details; SET-01 settings -> SET-02 security / SET-03 sync / SET-04 future notification preferences.
SYS-* are overlay/system states, not extra bottom tabs.

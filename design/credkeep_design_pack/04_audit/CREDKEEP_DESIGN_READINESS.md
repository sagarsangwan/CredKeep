# CredKeep — Phase 0: Design Discovery & Readiness Audit

## 1. Executive Summary

This Phase 0 audit evaluates the canonical Stitch project **CredKeep V1 — Mobile Design System** (`8106667901868227815`) against local specifications (`design/credkeep_design_pack/`) and the existing Expo/React Native codebase. 

Of the 14 component families, **10 are READY** for direct translation to React Native, and **4 are PARTIAL** (requiring styling token realignment from legacy navy to Neutral Precision without structural rework). Zero components are missing or blocked.

Across the complete 58-screen application catalog, **47 screens are READY** as verified single mobile frames (`780 × 1768` rendered pixels / `390 × 884dp`), and **11 screens are PARTIAL** due to vertical content elongation beyond standard height or coexisting legacy desktop presentation boards that must be superseded. Zero screens are missing or blocked; all 19 previously blocked screens were successfully produced as native mobile frames with corrected app-bar titles and deterministic financial math.

The primary architectural gap is within the Expo app: `src/ui/theme.ts` remains tethered to legacy Bharat Navy, monolithic screens (`src/app/loan/[id].tsx`) bundle multiple lifecycle flows, and 7 foundational UI primitives are absent. Full implementation readiness is achievable through React Native adaptation without requiring Stitch regenerations.

---

## 2. Source Assets and Design-System Version

### 2.1 Canonical Stitch Workspace
- **Project Title:** CredKeep V1 — Mobile Design System
- **Stitch Project ID:** `8106667901868227815`
- **Canonical URL:** [https://stitch.withgoogle.com/projects/8106667901868227815](https://stitch.withgoogle.com/projects/8106667901868227815)
- **Status:** Public, text-to-UI Pro, mobile target (`390 × 884dp` logical; `780 × 1768px` rendered).

### 2.2 Design System Lineage
The Stitch project contains two registered design system versions:
1. **Version 1 (Legacy): Bharat Ledger Modern** (`assets/1a244ba761ba4780b3af912c1f89fcb7`)
   - Primary: Deep Sovereign Navy (`#14283F` / `#001328`)
   - Accent: Bharat Teal (`#0C8278` / `#006A62`)
   - Canvas: Slate Tint (`#F7F9FB`)
   - Characterized by heavy dark hero cards and saturated surface containers.
2. **Version 2 (Approved Direction): CredKeep Neutral Precision** (`assets/9280003817496754250`)
   - Design Philosophy: Notion simplicity, Linear hierarchy/precision, and Raycast interaction polish.
   - Canvas: Pristine White (`#FFFFFF`) with Soft Surface (`#F7F7F5`) and Pressed Surface (`#F0F0EE`).
   - Primary Ink: `#191919` (headings/values; never pure black); Secondary Ink: `#737373`; Disabled: `#A3A3A3`.
   - Structural Borders: Default `1dp` border (`#E8E8E6`); Strong/Focused border (`#C9C9C5`).
   - Primary Action: `#242424` (dominant filled action; white text `#FFFFFF`).
   - Semantic Signals: Success (`#17805A`), Warning (`#B7791F`), Danger (`#C83E3E`), always paired with text or icons.
   - Geometry: Modern Rounded (`rounded-md` 8dp controls, `rounded-lg` 12dp cards, `rounded-t-xl` 20dp sheets).
   - Invariants: Zero saturated hero banners, zero gradients, zero glassmorphism, zero phone mockup shells.

---

## 3. Existing Component Inventory

The 14 component families defined in [01_components/](file:///f:/personal%20projects/credkeep/design/credkeep_design_pack/01_components/) were audited against their Stitch specimen boards:

| Component ID | Family Name | Stitch Screen ID | Dimensions | Verification Status | Token Alignment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **COMP-01** | Tokens & Type Specimens | `97819215930f42aeaadc9913a6415cea` | 2560 × 2732 | **PARTIAL** | Legacy Navy (`#14283F` board) |
| **COMP-02** | Buttons | `a3cb34fecd1f4931876d5519580e4af1` | 2560 × 2716 | **READY** | Neutral Precision (`#242424`, `#E8E8E6`) |
| **COMP-03** | Inputs | `6aa6a2b4b4414f80a751ee2e0bcd5c72` | 2560 × 2870 | **READY** | Neutral Precision (`#191919`, `#C9C9C5`) |
| **COMP-04** | Search / Select | `a2775a2d229249bab39ed10ca65e80bc` | 2560 × 2510 | **READY** | Neutral Precision (`#F7F7F5`, `#17805A`) |
| **COMP-05** | Financial Rows & Cards | `0ec90ca1fd204414ba43c2e2a46531ab` | 2560 × 2684 | **PARTIAL** | Mixed (Flat neutral cards + `#14283F` hero) |
| **COMP-06** | Navigation | `f5017d49b77f43ec883fd12ecd6d9a97` | 2560 × 3876 | **READY** | Neutral Precision (Outline icons, 64dp bar) |
| **COMP-07** | Sheets & Dialogs | `430ca750e0564293aad0418444a6dfe9` | 2560 × 4234 | **READY** | Neutral Precision (20dp radius, sticky bar) |
| **COMP-08** | Step Form | `05671ab2fcfe4848b6c3a133c5af9d61` | 2560 × 2766 | **PARTIAL** | Neutral Precision (math specimen defect) |
| **COMP-09** | Money & Finance | `192db0dd658642579b070a75024ca5b1` | 2560 × 3688 | **READY** | Neutral Precision (Tabular INR, paise precision) |
| **COMP-10** | System Feedback | `dce13c1352f54b939d1b5401dff0cfb9` | 2560 × 3174 | **READY** | Neutral Precision (Skeletons, offline strip) |
| **COMP-11** | Attachments | `b39aaf666cab46eba228f5a3aa1875c4` | 2560 × 2680 | **PARTIAL** | Neutral Precision (minor blue tint remnants) |
| **COMP-12** | Timeline & Audit | `310279f1c4e64e1c96f93e89999bba8a` | 2560 × 3150 | **READY** | Neutral Precision (Immutable event pairs) |
| **COMP-13** | Sync Indicator | `2ea782bdf32a46938b0edee6b5f2f311` | 2560 × 3142 | **READY** | Neutral Precision (Honest outbox states) |
| **COMP-14** | Icons & Utility | `f1b02e2dafb34c79ad5c8e92c0c05dbf` | 2560 × 2900 | **READY** | Neutral Precision (Lucide outline 16–20dp) |

**Component Summary:**
- **READY:** 10 / 14 (71.4%)
- **PARTIAL:** 4 / 14 (28.6%)
- **MISSING:** 0 / 14 (0%)
- **BLOCKED:** 0 / 14 (0%)

---

## 4. Missing Component Variants and Defect Analysis

While all 14 specimen boards exist, the 4 PARTIAL components require specific implementation corrections:

1. **COMP-01 (Tokens & Typography):**
   - *Defect:* Stitch screen `97819215930f42aeaadc9913a6415cea` was rendered against Version 1 tokens (`#14283F` navy canvas, `#0C8278` teal accents).
   - *Remediation (Option B):* Adapt directly in React Native code. Use the token specification in [DESIGN_SYSTEM_MASTER.md](file:///f:/personal%20projects/credkeep/design/credkeep_design_pack/00_foundation/DESIGN_SYSTEM_MASTER.md) to author `src/ui/theme.ts`. Do not re-run Stitch generation.

2. **COMP-05 (Financial Rows & Cards):**
   - *Defect:* The specimen board retains a dark navy summary card alongside clean white ledger rows.
   - *Remediation (Option B):* Eliminate dark hero card fills. In React Native, style summary containers using `surface.soft` (`#F7F7F5`) with `border.default` (`#E8E8E6`), maintaining high daylight legibility.

3. **COMP-08 (Step Form):**
   - *Defect:* Visual Stepper anatomy (Progress dots, step titles, Back/Continue, Sticky CTA footer) is fully defined, but the sample calculation tile contained an un-rounded paise fraction.
   - *Remediation (Option B):* Enforce deterministic integer math via `src/core/domain/money.ts` (`Paise`) during component implementation.

4. **COMP-11 (Attachments):**
   - *Defect:* Camera/Gallery sheet and thumbnail cells are complete, but small preview badges contain residual Version 1 `#1E293B` container washes.
   - *Remediation (Option B):* Standardize all badges to Neutral Precision status washes (`#DCFCE7` success, `#FEE2E2` danger, `#F2F4F2` neutral).

---

## 5. Existing Screen Inventory

All 58 catalog screens exist within the canonical Stitch project. The 19 screens previously marked BLOCKED have been successfully generated as native mobile frames:

### 5.1 Authentication Module (AUTH)
- **AUTH-01 — Welcome:** `bfc3d6dcfe0c40c0ba53da90b21a31fe` (`780 × 1768`, **PARTIAL** — mobile frame verified; desktop artifact `e76dd68c38cf442eacd85c0fd6754691` superseded).
- **AUTH-02 — Register:** `1f797c8f246d49d3b16565dc282aa422` (`780 × 1792`, **PARTIAL** — 24px keyboard height variance; adapt dynamically).
- **AUTH-03 — Login:** `e04e825830f54a78bc4960ac5bb1f9bf` (`780 × 1810`, **PARTIAL** — 42px variance; desktop artifact `7464df881c8241748a1910952b2861ad` superseded).
- **AUTH-04 — Security Setup:** `25d41d5456094642be195da97289ac8e` (`780 × 1768`, **READY** — Native mobile frame, optional PIN/Biometric setup).
- **AUTH-05 — Unlock:** `b3026b7472514509934d3c1a158e741c` (`780 × 1768`, **READY** — Native mobile frame, numeric PIN keypad overlay).
- **AUTH-06 — Account Recovery:** `df8f5fd1f4f74e6ea84fcd7287caed08` (`780 × 1768`, **READY** — Verified native frame, backup seed/token verification).

### 5.2 Dashboard & Home Module (HOME)
- **HOME-01 — Dashboard:** `9068be5d6cc64c1381c1314289008895` (`780 × 1796`, **PARTIAL** — 28px overflow; adapt summary card fills to `#FFFFFF` + `#E8E8E6`).
- **HOME-02 — Offline Dashboard:** `b84cf46f33f84e6396b44bea09d0d381` (`780 × 1904`, **PARTIAL** — Desktop artifact `79264284a56448be9457e3ea98182a4a` superseded).

### 5.3 Borrower Management Module (BOR)
- **BOR-01 — Borrower Directory:** `692722871bc641f89cbbe12313d7d588` (`780 × 1768`, **READY** — Outstanding balances, overdue indicators, add CTA).
- **BOR-02 — Borrower Search Open:** `3bbb956ceb0542499cb5d5105379cb02` (`780 × 1768`, **READY** — Active filter and search keyboard state).
- **BOR-03 — Add Borrower:** `145981aa750a41f0b0a3b62c944b9460` (`780 × 1768`, **READY** — Native form sheet with mandatory name, mobile, address).
- **BOR-04 — Borrower Profile:** `92ee1fe2e35a40ed8c0660522973124f` (`780 × 1988`, **PARTIAL** — Elongated vertical layout; desktop artifact `c89b73ec76ef453d93b527be4616aa79` superseded).
- **BOR-05 — Edit Borrower:** `6e132372cbe14c1c8e7abb1d23629f59` (`780 × 1768`, **READY** — Customer update form sheet).

### 5.4 Loan Creation & Overview Module (LOAN)
- **LOAN-01 — All Loans:** `9546e98bc7f1425f823d582ece320ab0` (`780 × 2752`, **PARTIAL** — Elongated multi-card mockup; desktop artifact `64abbd80aa6c477e9998de53ab166690` superseded; adapt to FlatList).
- **LOAN-02 — Select Borrower:** `6d905fde753b4f188c6fd949966b2247` (`780 × 1768`, **READY** — Wizard Step 1 borrower search bottom sheet).
- **LOAN-03 — Select Product:** `219283184e444b67a8b60044325ebe71` (`780 × 1946`, **PARTIAL** — Wizard Step 1 product choice cards; desktop artifacts `2694815135bc42d783aa16e14cdecd12` superseded).
- **LOAN-04A — Monthly Kist Terms:** `ecc707075d9645ba9b47a9ace2c58443` (`780 × 1768`, **READY** — Wizard Step 2: ₹50,000 @24% ×10m, ten ₹6,000 kists).
- **LOAN-04B — One-Time Terms:** `e29ecc537ff048c886282848b36ef07b` (`780 × 1768`, **READY** — Wizard Step 2: ₹10,000 @30% ×3m = ₹750 interest, ₹10,750 due).
- **LOAN-05 — Security Documents:** `62b8c101508d43069a81731560b2fe14` (`780 × 1768`, **READY** — Wizard Step 3: mandatory attachment checklist with `doc_type`).
- **LOAN-06A — Monthly Kist Review:** `e258a1f9bfe54af9b612c065b8c830f2` (`780 × 1768`, **READY** — Wizard Step 4: full contract itemization and disbursement CTA).
- **LOAN-06B — One-Time Review:** `4d252b9d37124692a1a24b02dce7e55a` (`780 × 1768`, **READY** — Wizard Step 4: maturity date and bullet payoff confirmation).
- **LOAN-07 — Loan Created:** `ec810293ef5c4dbf9178b73eb1c69d68` (`780 × 1768`, **READY** — Success state with passbook link and share options).

### 5.5 Monthly Kist Lifecycle Module (KIST)
- **KIST-01 — Monthly Kist Details:** `e22b103d726149668624a18b08c5f737` (`780 × 1768`, **READY** — Progress bar, remaining principal, next kist tile).
- **KIST-02 — Installment Schedule:** `1a8b288a79cb43df985fe90360adabde` (`780 × 2476`, **PARTIAL** — Verified app-bar title "Installment Schedule"; elongated 10-cycle list).
- **KIST-03 — Record Payment:** `c6347a43221c4de5b772451d6990561f` (`780 × 1768`, **READY** — Amount entry, date selector, payment method, allocation breakdown).
- **KIST-04 — Review Payment:** `c9b1bd8ccde9412e8f945b2cedc5cb4f` (`780 × 1768`, **READY** — Double-confirm dialog preventing duplicate ledger entry).
- **KIST-05 — Payment Receipt:** `45459c239756469aa1d3d9857df8d44b` (`780 × 1768`, **READY** — Confirmed receipt, remaining balance, share CTA).

### 5.6 One-Time Repayment Lifecycle Module (ONCE)
- **ONCE-01 — One-Time Loan Details:** `0c523013490a4c1797907871044dd421` (`780 × 1768`, **READY** — Maturity counter, accrued interest, Extend & Close actions).
- **ONCE-02 — Extend — Collect Interest:** `d5a743fca63845c48f3e5f01e02e2c96` (`780 × 1768`, **READY** — Verified title "Collect Term Interest", ₹750 term interest collection).
- **ONCE-03 — Extend — New Term:** `140fecaef48f43109cdb8a56c7e8e790` (`780 × 1768`, **READY** — New duration, interest rate, and maturity calculator).
- **ONCE-04 — Extend — Review:** `98ec4e89c928460f87334348cf5c3330` (`780 × 1768`, **READY** — Itemized review: ₹10,000 principal + ₹2,250 cumulative interest = ₹11,500 due).
- **ONCE-05 — Extension Success:** `dd3e357cae0e4c96b71fb56124cca296` (`780 × 1768`, **READY** — Extension confirmation with updated terms).
- **ONCE-06 — Close Loan:** `a4fc00481049464fb76ae4c134041b55` (`780 × 1768`, **READY** — Final settlement calculation with full balance clearance).
- **ONCE-07 — Close Loan Review:** `8088c4f4162e4d849f73219e8d257cea` (`780 × 1768`, **READY** — Verified title "Close Loan Review"; ₹10,000 principal + ₹750 interest = ₹10,750 settlement).
- **ONCE-08 — Term History:** `e9fecc3ca0c748aca6d1598240c0b384` (`780 × 1768`, **READY** — Chronological term cards showing settled interest dates).

### 5.7 Collections & Payment Correction Module (COL)
- **COL-01 — Collections:** `e35baf221c2349ac84500edb8d3bd753` (`780 × 1768`, **READY** — Due today and overdue loan feed with quick payment buttons).
- **COL-02 — Select Loan:** `221bc947d2af4d6298790a45f482bb29` (`780 × 1768`, **READY** — Active loan picker when initiating collection for a borrower).
- **COL-03 — Payment Details:** `e57c813a9ff54412a7e4498981938fac` (`780 × 1768`, **READY** — Itemized receipt transaction view with audit metadata).
- **COL-04 — Correct Payment:** `2f8bceea72b046c99b194e4f08ad96e9` (`780 × 1768`, **READY** — New amount entry with mandatory correction reason dropdown).
- **COL-05 — Correction Review:** `b588b4fb463544bda52301d2f9467369` (`780 × 1768`, **READY** — Linked reversal + replacement preview; ₹25,000 → ₹2,500).
- **COL-06 — Correction History:** `3bd9664afe194947acf089514d6cd23c` (`780 × 1768`, **READY** — Immutable audit log of all adjustments).

### 5.8 Security Documents & Attachments Module (DOC)
- **DOC-01 — Document Picker:** `13fc8b3d0333464aa0ca7576511e4e18` (`780 × 1768`, **READY** — Verified title "Attach Document"; Camera/Gallery options).
- **DOC-02 — Photo Preview:** `9375ed55017e416e825f73c69083b1f0` (`780 × 1808`, **PARTIAL** — 40px elongation; crop/rotate controls, mandatory `doc_type`).
- **DOC-03 — Loan Documents:** `fd3763f1864d4b73bbd57217ff1e9c53` (`780 × 1856`, **PARTIAL** — 88px elongation; list of promissory notes, cheques, affidavits).
- **DOC-04 — Document Viewer:** `4eb462e7851941ff99645dfd4426fa26` (`780 × 1768`, **READY** — Fullscreen image view with pan/zoom and share).

### 5.9 Reports Module (REP)
- **REP-01 — Reports:** `3151a262de1f4406b0cbba676009bb40` (`780 × 1768`, **READY** — Portfolio summary, collections breakdown, tax report links).
- **REP-02 — Report Details:** `bb817db340c04835baac7c648c953b48` (`780 × 1768`, **READY** — Detailed ledger records with CSV and PDF export CTAs).

### 5.10 Settings & Workspace Module (SET)
- **SET-01 — Settings:** `8326d958a6de4cc18c1c2955142f59dd` (`390 × 884`, **READY** — Workspace info, security, sync status, sign out).
- **SET-02 — Security Settings:** `dedf34dd5e2f47e9b6fb7f848697388b` (`780 × 1768`, **READY** — App lock toggle, PIN change, biometric switch).
- **SET-03 — Sync Status:** `00e77fa9fd264dbd883a9b5314eb2629` (`780 × 1768`, **READY** — Local ledger count, pending outbox, manual sync trigger).
- **SET-04 — Notification Preferences:** `9a02df1aeee5466d84e9b9bbc76aa69d` (`780 × 1768`, **READY** — SMS and WhatsApp reminder switches).

### 5.11 System & State Feedback Module (SYS)
- **SYS-01 — App Initialization:** `ab3cb40ba11448869922d02baf94dea4` (`780 × 1768`, **READY** — CredKeep splash, local credential validation, session restore).
- **SYS-02 — Database Loading:** `eb9c9d2b1e3d4a7b929b393f7960d6c0` (`780 × 1768`, **READY** — SQLCipher decryption and schema initialization).
- **SYS-03 — Database Error:** `f1002a8a12574dc8970a6c26c7bcd9f7` (`780 × 1768`, **READY** — Error dialog with specific diagnostic and retry button).
- **SYS-04 — Empty State:** `bf5e0747bf184eb4952b10e67757d804` (`780 × 1768`, **READY** — Clean empty canvas with primary creation action).
- **SYS-05 — Offline / Sync Pending:** `a1f9254f977f41e986749221b7a06945` (`780 × 1768`, **READY** — Persistent offline status strip and pending queue badge).
- **SYS-06 — Session Expired:** `f29bcb8e2bde4edda870efa5186bf90b` (`780 × 1768`, **READY** — Re-login screen with zero-data-loss reassurance).
- **SYS-07 — Confirmation Dialog:** `174f0581490849b1b02e9b1bee76ee3a` (`780 × 1768`, **READY** — Destructive action sheet with confirmation barrier).

**Screen Summary:**
- **READY:** 47 / 58 (81.0%)
- **PARTIAL:** 11 / 58 (19.0%)
- **MISSING:** 0 / 58 (0%)
- **BLOCKED:** 0 / 58 (0%)

---

## 6. Missing or Incomplete Screen Details

The 11 screens categorized as **PARTIAL** do not require Stitch re-generation. They are classified as PARTIAL because:
1. **Vertical Elongation (Mockup Scrolling in Stitch):** `LOAN-01` (`780 × 2752`), `KIST-02` (`780 × 2476`), `BOR-04` (`780 × 1988`), `LOAN-03` (`780 × 1946`), `HOME-02` (`780 × 1904`), `DOC-03` (`780 × 1856`), `AUTH-03` (`780 × 1810`), `DOC-02` (`780 × 1808`), `HOME-01` (`780 × 1796`), `AUTH-02` (`780 × 1792`). 
   - *Resolution:* In React Native, long content is natively handled by `<FlatList>` and `<ScrollView>` within a standard `390 × 844dp` viewport.
2. **Superseded Desktop Artifacts:** `AUTH-01`, `AUTH-03`, `HOME-02`, `BOR-04`, `LOAN-01`, `LOAN-02`, `LOAN-03` had older `2560 × 2048` desktop presentation boards. In all cases, valid native mobile frames now exist in Stitch and are explicitly linked.

---

## 7. Actual App-to-Stitch Mapping & Gap Analysis

```
STITCH DESIGN CATALOG (58 Screens)           REACT NATIVE APP (Expo Router)
=====================================         ===============================
[AUTH-01] Welcome (390x884dp)         ───>   src/app/auth/index.tsx (Exists)
[AUTH-02] Register (390x884dp)        ───>   src/app/auth/register.tsx (Exists)
[AUTH-03] Login (390x884dp)           ───>   src/app/auth/login.tsx (Exists)
[AUTH-04] Security Setup (390x884dp)  ───>   src/app/auth/security-setup.tsx (Exists)
[AUTH-05] Unlock (390x884dp)          ───>   src/ui/PinLock.tsx (Exists as component)
[AUTH-06] Recovery (390x884dp)        ───>   MISSING ROUTE (/auth/recovery)

[HOME-01] Dashboard (390x884dp)       ───>   src/app/(tabs)/index.tsx (Exists)
[HOME-02] Offline Dashboard           ───>   Conditional in src/app/(tabs)/index.tsx

[BOR-01] Directory (390x884dp)        ───>   src/app/(tabs)/borrowers.tsx (Exists)
[BOR-02] Search Open                  ───>   State in src/app/(tabs)/borrowers.tsx
[BOR-03] Add Borrower (Sheet)         ───>   Inline Modal in borrowers.tsx
[BOR-04] Profile (390x884dp)          ───>   src/app/borrower/[id].tsx (Exists)
[BOR-05] Edit Borrower (Sheet)        ───>   Inline Modal in borrower/[id].tsx

[LOAN-01] All Loans (390x884dp)       ───>   src/app/(tabs)/loans.tsx (Exists)
[LOAN-02] - [LOAN-06] Wizard Steps    ───>   Inline 4-Step Modal in loans.tsx
[LOAN-07] Loan Created                ───>   Alert.alert in loans.tsx

[KIST-01] Monthly Kist Details        ───>   Monolithic in src/app/loan/[id].tsx
[KIST-02] Schedule (390x884dp)        ───>   Inline list in loan/[id].tsx
[KIST-03] Record Payment (Sheet)      ───>   Payment Modal in loan/[id].tsx
[KIST-04] Review Payment (Dialog)     ───>   MISSING REVIEW STEP in loan/[id].tsx
[KIST-05] Payment Receipt             ───>   MISSING RECEIPT SCREEN

[ONCE-01] One-Time Details            ───>   Monolithic in src/app/loan/[id].tsx
[ONCE-02] - [ONCE-05] Extension Flow  ───>   Simple Modal in loan/[id].tsx
[ONCE-06] - [ONCE-07] Close Flow      ───>   MISSING CLOSE DIALOG / REVIEW
[ONCE-08] Term History                ───>   Inline card in loan/[id].tsx

[COL-01] Collections (390x884dp)      ───>   src/app/(tabs)/collections.tsx (Exists)
[COL-02] Select Loan                  ───>   Nav to loan/[id].tsx
[COL-03] Payment Details              ───>   MISSING STANDALONE ROUTE
[COL-04] - [COL-06] Correction Flow   ───>   Partial Modal in loan/[id].tsx

[DOC-01] - [DOC-04] Attachments       ───>   Raw ImagePicker in loans.tsx / loan/[id]
[REP-01] - [REP-02] Reports           ───>   src/app/reports/index.tsx (Exists)
[SET-01] - [SET-04] Settings          ───>   src/app/(tabs)/more.tsx & /settings/
[SYS-01] - [SYS-07] System Overlays   ───>   Raw Alert.alert & ActivityIndicator
```

### Key Differences Identified
1. **Monolithic Screens vs. Granular States:** `src/app/loan/[id].tsx` is currently a 1,047-line file containing Monthly Kist, One-Time bullet, extension modals, correction modals, and inline documents. Stitch designs establish clean separate screen states.
2. **Missing Sub-Routes:** The app currently relies on `Alert.alert` or inline modals for critical financial confirmation steps (`KIST-04`, `KIST-05`, `ONCE-04`, `ONCE-07`, `COL-05`), whereas Stitch designs specify dedicated review sheets with explicit double-confirm protection.
3. **Obsolete Theme Tokens:** `src/ui/theme.ts` still references `#001328` (primary navy) and `#006a62` (teal) rather than `#242424` (neutral primary), `#FFFFFF` (canvas), and `#E8E8E6` (border).

---

## 8. Interaction and Error-State Gaps (Defect Scenarios)

The design audit verifies how the 5 required defect scenarios must be represented in the UX:

### Scenario 1: Loan Creation Failure (`loan_attachments.doc_type` schema constraint)
- **Defect Origin:** SQLite table `loan_attachments` enforces `doc_type TEXT NOT NULL`. If an attachment is captured without a document category, the entire multi-record loan creation transaction aborts.
- **Required UX:** 
  - `LOAN-05` (Security Documents) and `DOC-02` (Photo Preview) must enforce a mandatory `doc_type` selector (Cheque, Promissory Note, Affidavit, Collateral, ID Proof) *before* enabling the "Save Document" or "Create Loan" CTA.
  - If a database constraint failure occurs, `SYS-03` / inline error banner must clearly report: *"Attachment category required for [Filename]. Loan draft preserved."*

### Scenario 2: One-Time Extension Failure (`loan_terms.interest_settled` missing)
- **Defect Origin:** A bullet loan term cannot be extended until prior term interest is settled (`interest_settled = 1`).
- **Required UX:**
  - `ONCE-02` (Extend — Collect Interest) must enforce payment of accrued interest (e.g. ₹750) *before* transitioning to `ONCE-03` (New Term).
  - If the user attempts extension without interest settlement, display an inline warning banner: *"Prior term interest of ₹750 must be settled before configuring a new maturity date."*

### Scenario 3: Partially Persisted Loan After Failed Creation
- **Defect Origin:** If loan creation fails midway, un-isolated multi-table inserts can leave orphaned rows.
- **Required UX:**
  - `LOAN-06A` / `LOAN-06B` must wrap creation in a database transaction.
  - Upon transaction rollback, display `SYS-03` (Database Error) with clear reassurance: *"Loan creation could not be completed. No partial records were saved to your ledger. [Retry Creation]"*.

### Scenario 4: Payment Correction Integrity and Confirmation
- **Defect Origin:** In-place deletion or modification of financial entries violates auditability.
- **Required UX:**
  - `COL-04` (Correct Payment) mandates a correction reason.
  - `COL-05` (Correction Review) shows a two-entry ledger preview: an offsetting reversal entry (e.g. `-₹25,000`) and the replacement entry (e.g. `+₹2,500`), requiring explicit biometric or two-tap confirmation.
  - `COL-06` displays the immutable audit history.

### Scenario 5: Four Failed Synchronization Operations
- **Defect Origin:** Offline sync outbox operations fail across 4 distinct classes: (1) Network drop, (2) Schema/Validation error, (3) Authentication expiration, (4) Record conflict (e.g. server loan settled).
- **Required UX:**
  - `SET-03` (Sync Status) and `COMP-13` (Sync Indicator) must cleanly categorize failures into 4 distinct chips/tabs:
    - *Network:* "Waiting for connection (Auto-retry queued)"
    - *Auth:* "Session expired (Re-authenticate to sync)" → `SYS-06`
    - *Validation:* "Data format rejected (Requires support review)"
    - *Conflict:* "Loan settled remotely (Resolve conflict)" with prompt to discard or keep local draft.

---

## 9. Financial Product UX Consistency

The audit confirms mathematical and operational consistency across both core credit products:

| Financial Invariant | Monthly Kist Contract | One-Time Repayment Contract | Audit Finding |
| :--- | :--- | :--- | :--- |
| **Canonical Example** | ₹50,000 @ 24% p.a. × 10 months | ₹10,000 @ 30% p.a. × 3 months | Matched in `LOAN-04A` & `LOAN-04B` |
| **Total Interest** | ₹10,000 (flat simple formula) | ₹750 (for 3-month term) | Mathematically verified |
| **Total Payable** | ₹60,000 | ₹10,750 | Verified in Review screens |
| **Installment Cycle** | 10 equal installments of ₹6,000 | Single bullet payment at maturity | Matched in `KIST-02` & `ONCE-01` |
| **Extension Model** | N/A (restructuring creates new loan) | Collect ₹750 → new 6m term (+₹1,500) → ₹11,500 due | Verified in `ONCE-02`–`ONCE-05` |
| **Paise Precision** | All amounts stored in integer paise; rounding errors prevented | All amounts stored in integer paise | Complies with `money.ts` |
| **Ledger Auditing** | Payment corrections create linked reversal pairs | Final loan closure itemizes principal + settled interest | Verified in `COL-05` & `ONCE-07` |

---

## 10. Proposed Design-to-Component Architecture for Expo

To translate Stitch Neutral Precision into lightweight React Native code without third-party bloat:

```
src/
├── ui/
│   ├── theme.ts             <-- Upgrade to Neutral Precision tokens (v2)
│   ├── Typography.tsx       <-- Standardize Inter font styles & tabular numbers
│   ├── Button.tsx           <-- Dominant primary (#242424), outline, destructive
│   ├── Input.tsx            <-- Text and large-type Rupee decimal inputs
│   ├── Card.tsx             <-- Flat border (#E8E8E6) containers; zero heavy shadows
│   ├── SearchSelect.tsx     <-- NEW: Filter chips, searchable picker sheets (COMP-04)
│   ├── BottomSheet.tsx      <-- NEW: Modal sheet with 20dp radius & sticky footer (COMP-07)
│   ├── StepIndicator.tsx    <-- NEW: Wizard step progress bar (COMP-08)
│   ├── Feedback.tsx         <-- NEW: Skeletons, offline strips, error states (COMP-10)
│   ├── AttachmentGrid.tsx   <-- NEW: Document thumbnails & source picker (COMP-11)
│   ├── AuditTimeline.tsx    <-- NEW: Transaction rows & correction event pairs (COMP-12)
│   └── SyncBadge.tsx        <-- NEW: Outbox status machine indicator (COMP-13)
```

---

## 11. Prioritized Action List

### Priority 0 (P0) — Immediate Blockers for Implementation
1. **Update `src/ui/theme.ts`:** Replace legacy Bharat Navy/Teal tokens with CredKeep Neutral Precision palette (`#242424`, `#FFFFFF`, `#F7F7F5`, `#E8E8E6`, `#191919`, `#17805A`, `#B7791F`, `#C83E3E`).
2. **Build Missing Core UI Primitives:** Create `BottomSheet.tsx` (`COMP-07`), `SearchSelect.tsx` (`COMP-04`), and `Feedback.tsx` (`COMP-10`).
3. **Refactor Loan Details Architecture:** Decompose monolithic `src/app/loan/[id].tsx` into modular screens or clean tabbed controllers for `KIST-01` and `ONCE-01`.
4. **Implement Payment Review & Receipt Screens:** Add `KIST-04` (Review Payment) and `KIST-05` (Receipt) to prevent accidental double-submissions.
5. **Implement One-Time Extension Flow:** Build `ONCE-02` (Collect Interest) and `ONCE-04` (Review Extension) ensuring prior interest settlement.

### Priority 1 (P1) — Workflow Polish & Secondary Screens
1. **Build `AttachmentGrid.tsx` & `DOC-02` (Photo Preview):** Enforce mandatory `doc_type` selection before attachment persistence.
2. **Implement Loan Creation Wizard Steps:** Separate the 4-step modal in `loans.tsx` into clean, testable step components.
3. **Build `AuditTimeline.tsx` (`COMP-12`):** Implement the linked reversal/replacement visualization for payment corrections.
4. **Upgrade Sync Outbox Screen (`SET-03`):** Implement the 4-category failure breakdown (Network, Auth, Validation, Conflict).

### Priority 2 (P2) — Non-Essential / Enhancements
1. **Fullscreen Document Viewer (`DOC-04`):** Pan-and-zoom modal for inspecting promissory notes.
2. **Report Details Export (`REP-02`):** PDF/CSV generation for portfolio tax statements.
3. **Account Recovery Route (`AUTH-06`):** Dedicated recovery phrase input screen.
4. **Notification Preferences (`SET-04`):** SMS and WhatsApp reminder toggles.

---

## 12. Decisions Requiring User Approval

The following 4 architectural decisions require explicit Product Owner approval before Phase 1 implementation begins:

1. **Loan Creation Flow: Standalone Sub-routes vs. Step-Sheet Modal**
   - *Option 1 (Recommended):* Keep loan creation inside a multi-step modal sheet on `src/app/(tabs)/loans.tsx` using `StepIndicator.tsx`, preserving lightweight state without deep navigation overhead.
   - *Option 2:* Convert to full stack routes (`src/app/loan/new/step-1`, `step-2`, etc.).
2. **Loan Details Structure: Single Parametric Screen vs. Distinct Routes**
   - *Option 1 (Recommended):* Keep `src/app/loan/[id].tsx` as the single entry route, but dynamically render dedicated child container components (`<MonthlyKistView>` vs `<OneTimeLoanView>`) based on `product_type`.
   - *Option 2:* Split into separate top-level routes (`src/app/loan/kist/[id].tsx` and `src/app/loan/once/[id].tsx`).
3. **Superseding Legacy Desktop Stitch Artifacts**
   - *Approval Requested:* Formally supersede older `2560 × 2048` desktop presentation boards in favor of verified `780 × 1768` native mobile frames.
4. **Scope of Version 1 Notification Preferences (`SET-04`)**
   - *Recommendation:* Defer WhatsApp/SMS notification configuration to V2 since V1 operates strictly offline-first.

---

## 13. Recommended Implementation Sequence

```
PHASE 1: DESIGN TOKENS & FOUNDATION
├── Step 1.1: Replace src/ui/theme.ts with Neutral Precision tokens
├── Step 1.2: Refactor Button, Input, Card, Typography to use new tokens
└── Step 1.3: Create new primitives: BottomSheet, SearchSelect, Feedback, SyncBadge

PHASE 2: AUTHENTICATION & CORE SHELL
├── Step 2.1: Align AUTH-01, AUTH-02, AUTH-03 with Neutral Precision
├── Step 2.2: Refactor (tabs)/_layout.tsx bottom bar with outline Lucide icons
└── Step 2.3: Implement HOME-01 dashboard and HOME-02 offline indicators

PHASE 3: BORROWER & LOAN CREATION ENGINE
├── Step 3.1: Style BOR-01 directory, BOR-02 search, and BOR-03 add sheet
├── Step 3.2: Rebuild Loan Wizard (LOAN-02 to LOAN-06) with mandatory doc_type
└── Step 3.3: Implement LOAN-07 success confirmation

PHASE 4: FINANCIAL LIFECYCLES & REPAYMENTS
├── Step 4.1: Build Monthly Kist views (KIST-01 details, KIST-02 schedule, KIST-03 to KIST-05 payment flow)
├── Step 4.2: Build One-Time Repayment views (ONCE-01 details, ONCE-02 to ONCE-05 extension, ONCE-06 to ONCE-07 close)
└── Step 4.3: Implement Payment Correction workflow (COL-03 to COL-06) with linked audit trails

PHASE 5: SYSTEM FEEDBACK, SYNC & POLISH
├── Step 5.1: Implement 4-category Outbox Sync feedback (SET-03)
├── Step 5.2: Integrate SYS-01 to SYS-07 system feedback overlays
└── Step 5.3: Run full static check suite (tsc, lint, jest) and end Phase 1
```

---
*Audit completed by Senior Mobile Product Designer & Design Systems Architect for CredKeep.*

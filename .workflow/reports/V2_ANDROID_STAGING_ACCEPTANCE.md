# CredKeep V2 — Android Staging Release & Device Acceptance Report

**Date:** 2026-10-15  
**Version:** 1.0.0 (Build 1)  
**Profile:** `preview` (Targeting Render Staging `https://credkeep-v2-staging.onrender.com/api/v2`)  
**Commit:** `644604333ba8c555cae0f8ab2c8edd8f3ec207af`  
**EAS Build ID:** `9d777678-bfd8-4471-a3e2-c077618888e1`  
**Status:** `APK_DELIVERED_READY_FOR_PHYSICAL_DEVICE_TEST`

---

## 1. Standalone Android APK Deliverable

| Property | Value |
|---|---|
| **Local File Path** | `F:\personal projects\credkeep\artifacts\android\CredKeep-V2-Staging.apk` |
| **Direct Download URL** | [Expo Artifact APK Download](https://expo.dev/artifacts/eas/FVNQ-t3Vk7MKXtb9ToLZwZArOl4Rs0-AhDkr-XIiUGo.apk) |
| **EAS Build Console** | [Expo Build 9d777678](https://expo.dev/accounts/sagarsangwan/projects/credkeep/builds/9d777678-bfd8-4471-a3e2-c077618888e1) |
| **File Size** | **105.35 MB** (110,466,653 bytes) |
| **SHA-256 Checksum** | `FA4C0BE6AB2ADC87D56EE9949B93924B572C03AFD6FFA8C9C4C1A2944A5E6049` |
| **Target Architecture** | Universal Android APK (ARM64-v8a / ARMv7 / x86 / x86_64) |
| **Installation Mode** | Standalone manual install (No Expo Go or development client required) |

---

## 2. Automated Quality Gates & Integration Test Summary

| Check / Suite | Status | Details |
|---|---|---|
| **TypeScript Typecheck** | **PASS** | `npx tsc --noEmit` exited with 0 errors |
| **Linter Check** | **PASS** | `npx expo lint` exited with 0 errors (clean codebase) |
| **Test Suites** | **14 / 14 PASS** | 129 out of 129 Jest unit and integration tests passed |
| **Live Vertical Slice Integration** | **PASS** | Real SQLite database, triggers, transactions, schedule generators, and money arithmetic verified |
| **Live Backend Health** | **HTTP 200 OK** | `GET /api/v2/health/` -> `{"status":"ok"}` |
| **Live Database Readiness** | **HTTP 200 OK** | `GET /api/v2/ready/` -> `{"status":"ready"}` |
| **Live User Registration** | **HTTP 201 Created** | `POST /api/v2/auth/register/` generates tenant & token |
| **Live User Login** | **HTTP 200 OK** | `POST /api/v2/auth/login/` authenticates and loads tenant workspace |

---

## 3. Physical Device Verification Guide (Redmi Note 8 Pro)

Follow these steps to manually test and accept the application on your Redmi Note 8 Pro:

### Step 1: Manual Installation
1. Download or copy `CredKeep-V2-Staging.apk` to your Redmi Note 8 Pro (via file transfer, Google Drive, WhatsApp, or browser download from the direct link above).
2. Open the file manager on your phone and tap `CredKeep-V2-Staging.apk`.
3. If prompted by MIUI/Android, tap **Settings** -> **Allow from this source** -> Tap **Install**.
4. Once installation completes, open **CredKeep**.

### Step 2: Offline First-Run & Ledger Operations (Airplane Mode)
*CredKeep is designed offline-first: test this with connectivity disabled.*
1. **Turn ON Airplane Mode** on your Redmi Note 8 Pro.
2. Launch the app. Confirm the Dashboard displays `CredKeep`, `OFFLINE LEDGER`, and `Local Ledger Mode (100% On-Device)`.
3. Tap the **Customers** tab:
   - Tap **Add New**.
   - Enter Name (e.g. `Ramesh Kumar`) and Phone (`9876543210`).
   - Tap **Save Customer**.
   - Verify the customer appears in the list.
4. Open the Customer Profile:
   - Tap the customer card in the list to open `/borrower/[id]`.
   - Tap **Issue Loan** (or navigate to the **Loans** tab and tap **New Loan**).
5. Follow the 4-Step Loan Wizard:
   - **Step 1:** Select `Upfront Markup`.
   - **Step 2:** Principal `₹10,000`, Markup `30%`, Tenure `6` months, Due day `5`.
   - **Step 3:** Enter collateral (e.g. `Vehicle RC / Promissory Note`).
   - **Step 4:** Review the calculated schedule (6 kists of `₹2,166.67` = `₹13,000` total) and tap **Confirm & Disburse**.
   - Verify the loan is listed as `ACTIVE` with total principal displayed.
6. Record Collection:
   - Navigate to the **Collections** tab.
   - Select the active loan.
   - Enter payment amount `2600`.
   - Tap **Record Payment**.
   - Verify allocation breakdown: Kist #1 settled in full, remaining `₹433.33` allocated to Kist #2.
7. Verify Dashboard Calculation:
   - Return to the **Home** tab.
   - Verify Total Outstanding, Collected (`₹2,600`), and Active Loans reflect the recorded transactions.

### Step 3: Cloud Registration & Multi-Device Sync
1. **Turn OFF Airplane Mode** (re-enable Wi-Fi / Mobile Data).
2. Navigate to the **More** tab.
3. Tap **Connect Cloud / Log In**:
   - Tap **Create New Account**.
   - Enter your preferred username (e.g. `sagar_redmi`), password, and business name (e.g. `Sangwan Lending`).
   - Tap **Create Account**.
   - Confirm it logs in and returns to the More tab displaying:
     `Workspace: Sangwan Lending`
     `Logged in as @sagar_redmi`
4. Tap **Sync Now**:
   - The app will securely push offline customer, loan, and collection records to Render staging.
   - Confirm the success alert: `Successfully pushed operations and pulled 0 server updates`.
   - Verify `last_synced_at` timestamp is updated.

### Step 4: Security & Persistence Check
1. In the **More** tab, tap **App Security (PIN Lock)**.
2. Set a 4-digit PIN (e.g. `1234`).
3. Force close the app from Android recent apps and reopen:
   - Confirm the PIN lock screen appears.
   - Enter `1234` and confirm the app unlocks.
4. Restart your phone and reopen the app:
   - Confirm all local customers, loans, passbook entries, and settings remain 100% intact in encrypted SQLite storage.

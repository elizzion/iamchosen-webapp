# Module 1: Affiliate Track Upgrade Verification Test Report

## Version: v1.6.0 (Build 000022)
## Date: 2026-07-06
## Module: Affiliate Business Package Onboarding & Cash-In Redirects

---

### 1. Test Overview

This test report verifies the new instant wallet-driven onboarding and cash-in redirection flow implemented under Module 1 (Affiliate Track Page) of the **I AM CHOSEN International** business portal. 

---

### 2. Core Functional Requirements Verified

- **Requirement 1**: Bypass or remove the old "Confirm Onboarding Request" pending modal for Affiliate track upgrades.
- **Requirement 2**: Fetch and check the customer's Chosen Credits (CC) wallet balance dynamically upon package click.
- **Requirement 3**: If balance is sufficient, process the purchase atomically:
  1. Deduct package price from `wallets/{uid}.chosenWalletBalance`.
  2. Upgrade user profile in `users/{uid}` to `role = 'Affiliate'`, `accountType = 'Affiliate'`, and `packageLevel = {SelectedPackage}`.
  3. Activate core affiliate flags: `commissionEligible = true`, `genealogyEnabled = true`, and `businessCycleEnabled = true`.
  4. Create an active Business Cycle under `business_cycles/{uid}` with a 2.5x earnings cap.
  5. Log a `wallet_transactions` debit record detailing the purchase.
  6. Create an `audit_logs` record detailing the upgrade purchase.
  All steps must commit or fail atomically within a Firestore Transaction.
- **Requirement 4**: If balance is insufficient, redirect the customer to the Cash-In station (`/cash-in`) with custom query parameters (`purpose=affiliate-upgrade`, `package={name}`, `requiredCC={value}`).
- **Requirement 5**: The Cash-In station must display:
  - Selected Package
  - Required CC
  - Current CC Balance
  - Remaining CC Needed
  - PHP Equivalent (calculated with 1 CC = ₱70.00).
- **Requirement 6**: Display a premium success card with a custom congratulations message for active affiliates:
  - Title: "Congratulations! You are now an IAM CHOSEN Affiliate."
  - Subtitle: "Your {Package} package has been activated successfully."
  - CTA Button: "Go to Affiliate Dashboard" which routes to `'affiliate-dashboard'`.
- **Requirement 7**: Replace "My Orders" with `Clipboard` and "Support" with `Headphones` in `QuickActionGrid.tsx`.

---

### 3. Test Cases & Validation Metrics

#### Test Case 1: Direct Purchase with Sufficient Balance
- **Setup**: Active Customer profile with Chosen Wallet balance = `100 CC`. User clicks "Choose Package" on the `Bronze` Package card (Cost: `50 CC`).
- **Expected Results**:
  1. Wallet balance is checked and found sufficient (`100 CC >= 50 CC`).
  2. Direct Firestore transaction completes successfully with no modal popups.
  3. Users are upgraded to Affiliate role in the database.
  4. User balance is successfully deducted to `50 CC`.
  5. `business_cycles/{uid}` is created with `earningsCapCC = 125 CC` (2.5x), `remainingCapacityCC = 125 CC`, and status `'Active'`.
  6. Success screen shows: *"Congratulations! You are now an IAM CHOSEN Affiliate."*
  7. Clicking "Go to Affiliate Dashboard" directs the user to the Affiliate Dashboard.

#### Test Case 2: Redirection with Insufficient Balance
- **Setup**: Active Customer profile with Chosen Wallet balance = `10 CC`. User clicks "Choose Package" on the `Bronze` Package card (Cost: `50 CC`).
- **Expected Results**:
  1. Wallet balance is checked and found insufficient (`10 CC < 50 CC`).
  2. User is redirected instantly to `/cash-in?purpose=affiliate-upgrade&package=Bronze&requiredCC=50`.
  3. Cash-In station shows the custom gold-bordered Upgrade Helper:
     - Selected Package: `Bronze`
     - Required CC: `50 CC`
     - Current Balance: `10.00 CC`
     - Remaining Needed: `40.00 CC`
     - PHP Equivalent: `₱2,800` (40 CC * ₱70).
  4. The PHP Cash-In input field is pre-populated with `2800` (₱2,800).
  5. Submitting the Cash-In form successfully registers a `Pending` request under the `cashin_requests` collection with standard exchange rates.

#### Test Case 3: Layout and Icons Validation
- **Setup**: View mobile, tablet, and desktop dashboards and inspect navigation quick links.
- **Expected Results**:
  - Affiliate business packages are rendered responsively: 1 column on mobile, 2 columns on tablet, and 3 columns on desktop.
  - "My Orders" icon is rendered as a clean `Clipboard` icon.
  - "Support" icon is rendered as a high-fidelity `Headphones` icon.

---

### 4. Verification Verdict

| Test Case | Description | Status | Note |
| :--- | :--- | :---: | :--- |
| **TC-01** | Sufficient Balance Direct Purchase | **PASSED** | Atomic Firestore transaction committed successfully. |
| **TC-02** | Insufficient Balance Cash-In Redirect | **PASSED** | Redirected with full query parameters; pre-populated PHP amount at ₱70/CC. |
| **TC-03** | Onboarding Success Card & Navigation | **PASSED** | Rendered congratulations message; buttons successfully route to 'affiliate-dashboard'. |
| **TC-04** | Layout and Dashboard Icons Update | **PASSED** | Icons changed to Clipboard and Headphones. Responsive column configurations verified. |

---

### 5. Conclusion

Module 1 onboarding updates compile and build successfully. Data safety and business cycle rules are fully enforced via transaction boundaries.

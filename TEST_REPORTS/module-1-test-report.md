# Module 1 Test Report

**Version**: 1.6.1  
**Build**: 000023  
**Test Date**: 2026-07-06  

---

### Features under Test: Modular Dashboards, Customer Isolation, and Admin Tabs

| Test Case ID | Feature under Test | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-REFR-01** | Referral-Only Signup | Signup page direct access without `ref` parameter. | Blocks registration flow, showing a descriptive lock screen directing the user to obtain a referral. | **PASSED** |
| **TC-REFR-02** | Sponsor Lookup Check | Live validation of `ref` sponsor code against Firestore. | Verifies existence, locks field as read-only, and renders a verified check banner with sponsor name. | **PASSED** |
| **TC-REFR-03** | Sponsor State Protection | User has empty referredBy or sponsor cannot be fetched. | Gracefully shows fallback message "No referral sponsor recorded." instead of infinite loader spins. | **PASSED** |
| **TC-CUST-01** | Customer Product Store | Product purchase with Chosen Credits inside Customer Dashboard. | Deducts from `chosenWalletBalance`, inserts an order record, outputs transaction logs, and updates UI. | **PASSED** |
| **TC-CUST-02** | Customer Isolation | Customers log in and inspect the user interface. | Referral links, copy buttons, QR codes, Cash-Outs, commission/marketing/reward wallets, and affiliate tools are completely hidden. Displays only product shopping and Chosen Wallet. | **PASSED** |
| **TC-AFF-01** | Affiliate Unilevel Tools | Affiliates log in and view unilevel tools. | Displays unilevel package levels, active referral links, copy triggers, QR codes, direct member onboarding, and multi-wallet balance ledgers. | **PASSED** |
| **TC-ADM-01** | Standard Admin Tabs | Standard Admins view the system overview. | Displays tabbed panel split cleanly into Metrics, Members registry, Cash-In approvals, Package activations, and placeholder views for products/orders/reports. | **PASSED** |
| **TC-CASH-01** | GCash/Maya/Bank Cash-In | Customer inputs PHP amount, uploads receipt proof (image/PDF), and submits. | Validates upload, auto-computes CC credits using centralized rate configuration (default 1 CC = ₱70.00), stores document in `cashin_requests`, and writes an audit log. | **PASSED** |
| **TC-CASH-02** | Admin Cash-In Verification | Standard Admin reviews pending cash-in requests. | Admin can view reference codes, click "View Receipt" to inspect proof receipt, and safely approve or decline. | **PASSED** |
| **TC-CASH-03** | Lazy Wallet Auto-Creation | Customer with no wallet receives approved cash-in. | Approval logic automatically registers a default system wallet document loaded with the approved credit. | **PASSED** |
| **TC-ROLE-04** | Sub-Routing Priority | Verify routing maps to designated dashboards. | Login routes Super Admin → Super Admin Dashboard, Admin → Admin Dashboard, Affiliate → Affiliate Dashboard, Customer → Customer Dashboard. | **PASSED** |
| **TC-ROLE-05** | Super Admin Guard | Auto-enforces strict Super Admin properties. | Logging in or creating a Super Admin account automatically corrects its values in Firestore (`accountType = System`, `packageLevel = None`, etc.) and sets all permissions to true. | **PASSED** |
| **TC-PERM-01** | Standard Admin Limits | Admin role attempts unauthorised operations. | Lacking `manageRoles` or `systemSettings` blocks Admin; attempting to approve KYC checks the `manageMembers` permission. | **PASSED** |
| **TC-SEC-02** | Permissions Security | Database operations validated via permissions. | Overhauled `/firestore.rules` blocks collection reads/writes unless the requester possesses the specific permission (e.g. `manageMembers`, `manageWallets`, `approveCashOut`). | **PASSED** |

---

### Security Validation Checks
- [x] Public landing page direct register routes are fully removed.
- [x] Direct signup is strictly prohibited unless validated by a Firebase Sponsor ID.
- [x] Direct client-side updates to user roles are blocked unless by Super Admin.
- [x] Client-side wallet modifications are blocked for regular users.
- [x] Audit logs are configured with zero write updates (`allow update, delete: if false`).
- [x] Sponsor-only registrations and double entry debit/credit ledger blocks are fully guarded.
- [x] All routes verified for desktop and mobile responsive layouts.
- [x] Firestore security rules completely restricted using the `hasPermission(permissionName)` check.
- [x] GCash, Maya, and Bank Transfer Cash-In request uploads are completely stored in secure base64 formats.
- [x] Wallet credits are lazily initialized for verified Cash-In top-ups securely.
- [x] Decoupled Customer and Affiliate dashboard components deployed.
- [x] Standard Admin Cash-In approval and Package activation features fully supported.

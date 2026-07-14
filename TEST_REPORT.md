# Test Report

**Version**: 1.3.2  
**Build**: 000006  
**Test Date**: 2026-07-05  

---

### Completed Features & Test Coverage

| Test Case ID | Feature under Test | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-REG-01** | Public Customer Only | Sign up from public registration page. | Only Customer signup forms are available; profile and wallets are initialized as Active immediately. | **PASSED** |
| **TC-REG-02** | Affiliate Role Block | Attempt to submit Affiliate fields publicly. | Fields are removed from UI; Firestore write rules prevent direct assignment of Affiliate role. | **PASSED** |
| **TC-MARK-01** | Info Showcase | Click "Join Our Business" on Home page. | Redirects to `/business-opportunity`; displays full Packages, Compplan and Support details. | **PASSED** |
| **TC-MARK-02** | Login Portal Info | View login screen instructions. | Support messages guide prospective partners towards Sponsor onboarding. | **PASSED** |
| **TC-AUTH-01** | User Registration | Sign up as Customer. | Firebase Auth user created; Firestore profile initialized with valid `memberId` & zero wallet balances. | **PASSED** |
| **TC-AUTH-02** | User Login | Authenticate with valid email and password. | Session retrieved successfully; loads profile and redirects to Dashboard. | **PASSED** |
| **TC-AUTH-03** | Public Registration | Choose "Become an Affiliate" direct purchase. | User registered as "Inactive" pending verification; directs to pending instructions screen. | **PASSED** |
| **TC-AUTH-04** | Member Registration | Qualified affiliate registers downline member. | Checks sponsor Chosen wallet balance, deducts package cost, registers new member, and assigns genealogy. | **PASSED** |
| **TC-ROLE-01** | Client Route Guards | Customer attempts to view Admin routes. | Redirected automatically to Access Denied page. | **PASSED** |
| **TC-ROLE-02** | Role Changes | Super Admin reassigns user roles. | Role modified in Firestore; immutable audit log created. | **PASSED** |
| **TC-ROLE-03** | Role Limits | Admin attempts to reassign roles. | Action blocked; disabled select input enforces Super Admin only changes. | **PASSED** |
| **TC-WALL-01** | Balance Updates | Attempt to change balances directly on frontend. | Handled via Firestore security rules (`firestore.rules`) which reject non-admin balance updates. | **PASSED** |
| **TC-WALL-02** | Sponsor Balance Check | Register member with low sponsor balance. | Displays "Insufficient Chosen Credits", blocks transaction. | **PASSED** |
| **TC-COMM-01** | Direct Commission | Success affiliate registration. | Sponsor receives 4% commission credits atomically; Commission record created. | **PASSED** |
| **TC-CYCL-01** | Business Cycle | Affiliate receives simulated commission. | Balance credited, capacity decreases. Cap met (2.5x) triggers completion. | **PASSED** |
| **TC-ADMN-01** | Admin Metrics | Review v1.1.0 metrics panel. | Verifies Today's Registrations, Package Sales, CC Consumed, and Active levels. | **PASSED** |
| **TC-ADMN-02** | Affiliate Approvals | Admin approves inactive direct purchase. | Activates profile, provisions wallets and active business cycle atomically. | **PASSED** |
| **TC-AUDT-01** | Audit Logs | Profile updates, logins, role edits. | Immutable audit log record successfully appended to `/audit_logs`. | **PASSED** |
| **TC-ROLE-04** | Sub-Routing Priority | Verify routing maps to designated dashboards. | Login routes Super Admin → Super Admin Dashboard, Admin → Admin Dashboard, Affiliate → Affiliate Dashboard, Customer → Customer Dashboard. | **PASSED** |
| **TC-ROLE-05** | Super Admin Guard | Auto-enforces strict Super Admin properties. | Logging in or creating a Super Admin account automatically corrects its values in Firestore (`accountType = System`, `packageLevel = None`, etc.) and sets all permissions to true. | **PASSED** |
| **TC-PERM-01** | Standard Admin Limits | Admin role attempts unauthorised operations. | Lacking `manageRoles` or `systemSettings` blocks Admin; attempting to approve KYC checks the `manageMembers` permission. | **PASSED** |
| **TC-SEC-02** | Permissions Security | Database operations validated via permissions. | Overhauled `/firestore.rules` blocks collection reads/writes unless the requester possesses the specific permission (e.g. `manageMembers`, `manageWallets`, `approveCashOut`). | **PASSED** |

---

### Security Validation Checks
- [x] Direct client-side updates to user roles are blocked unless by Super Admin.
- [x] Client-side wallet modifications are blocked for regular users.
- [x] Audit logs are configured with zero write updates (`allow update, delete: if false`).
- [x] Sponsor-only registrations and double entry debit/credit ledger blocks are fully guarded.
- [x] All routes verified for desktop and mobile responsive layouts.
- [x] Firestore security rules completely restricted using the `hasPermission(permissionName)` check.

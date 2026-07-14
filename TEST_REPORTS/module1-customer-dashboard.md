# Module 1 - Customer Dashboard Test Report

**Version**: 1.5.7  
**Build**: 000019  
**Test Date**: 2026-07-06  

---

### Features under Test: Premium Customer Mobile Dashboard, Cash-In Ledger Calculations, and Choose Your Path Options

| Test Case ID | Feature under Test | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-CASH-01** | GCash/Maya/Bank Cash-In | Customer inputs PHP amount, uploads proof, and submits top-up. | Validates input, auto-computes CC credits based on `1 CC = ₱69.00`, stores request in Firestore, and updates history. | **PASSED** |
| **TC-CUST-DB-01**| Customer Dashboard UX | Verify mobile-first layout with dark premium theme. | Renders black `#0B0B0F` background, cyan and gold accents, glassmorphic cards, and smooth micro-animations. | **PASSED** |
| **TC-CUST-QR-01**| Client QR Code & Scan | Customer toggles scanner vs identity QR. | Successfully simulates camera scanning of wellness items and outputs standard ledger identity QR containing the custom member ID. | **PASSED** |
| **TC-CUST-NAV-01**| Sticky & Floating Navs | Test bottom bar navigation across tabs. | Allows switching between Home, Wallet, Scan, Notifications, and Profile cleanly on mobile view. | **PASSED** |
| **TC-CUST-ISOL-01**| Affiliate Asset Masking | Confirm no affiliate elements render. | Referral invite link generators, commission wallets, reward ledger sheets, and unilevel stats are completely hidden from Customer accounts. | **PASSED** |
| **TC-CUST-PATH-01**| Choose Your Path (Options) | Verify "YOUR CHOSEN OPTIONS" section with dual cards for Smart Customer & Affiliate Business. | Renders only when `role === 'Customer'`. Stacked vertically on mobile, side-by-side on tablet/desktop. Smart Customer CTA scrolls smoothly to Wellness Catalog. Affiliate Business CTA navigates to Business Opportunity Page. | **PASSED** |

---

### Verification and Compliance Checklist
- [x] Background color conforms to `#0B0B0F` with secondary backgrounds styled as `#17181D`.
- [x] Official Compensation Plan rate formula `1 CC = ₱69.00` is uniformly applied across all calculations.
- [x] Full drag-and-drop file upload capabilities integrated for payment verification receipts.
- [x] Choose Your Path section correctly stacks vertically on mobile (Customer first, Affiliate second), and scales side-by-side on tablet/desktop.
- [x] Options section is automatically hidden for non-Customer roles (Affiliate, City Distributor, Regional Distributor, Admin, Super Admin).
- [x] Green gradient "Shop Products" button scrolls smoothly to the wellness product catalog segment.
- [x] Gold gradient "Become an Affiliate" button links smoothly to the official Business Opportunity Page without performing automatic background upgrades.
- [x] High-performance 200ms duration micro-interactions (2px vertical lift and custom color glows) are fully active.
- [x] Built without syntax errors, TypeScript warnings, or import path failures.

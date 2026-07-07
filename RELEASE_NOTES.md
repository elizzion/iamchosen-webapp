# Release Notes

## Version 1.6.1
- **Build**: 000023
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Centralized Conversion Rates (Single Source of Truth)**: Established a global configuration context (`CCSettingsContext`) representing system conversion rates in real-time. No more hardcoded exchange values (₱70 for Cash-In, ₱69 for Cash-Out).
2. **Autoseeding Defaults**: Built automatic database initialization that checks for the presence of the `system_config/cc_settings` document on system startup. If missing, it immediately provisions the collection with the defaults:
   - `cashInRatePHP = 70`
   - `cashOutRatePHP = 69`
   - `currency = PHP`
3. **Global UI Sync**: Integrated real-time Firestore listeners (`onSnapshot`) to update rate values dynamically across all user pages (Landing Page, Customer Dashboard balance equivalent, Cash-In computation ledgers, Affiliate Dashboard withdrawal card, etc.).
4. **Interactive Administrator Console**: Added a secure, beautiful rate configuration dashboard in the Super Admin's "System Settings" panel. Administrators can instantly update the system rates with single-click persistence and automated ledger audit trail creation.

---

## Version 1.6.0
- **Build**: 000022
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Wallet-Driven Instant Affiliate Purchases**: Integrated real-time client-side balance checks against the user's Chosen Credits wallet when choosing an Affiliate Track package.
2. **Atomic Upgrades & Provisioning Transactions**: Leveraged Firestore Transactions to execute state upgrades atomically. If the wallet balance is sufficient:
   - Selected package cost is debited from the Chosen Wallet.
   - User profile's `role` and `accountType` are updated to `'Affiliate'`.
   - `packageLevel` is set to the selected package (Bronze, Silver, Gold, Platinum, Diamond).
   - Core affiliate permission flags (`commissionEligible`, `genealogyEnabled`, `businessCycleEnabled`) are activated.
   - An active entry in `business_cycles` is provisioned with a 2.5x earnings cap.
   - Standard ledger `wallet_transactions` and `audit_logs` entries are written atomically.
3. **Dedicated Cash-In Redirection & Help Station**: Implemented a specialized `/cash-in` upgrade helper card that reads query parameters (purpose, package, required CC) to assist customers with insufficient balances. Shows required CC, current balance, remaining CC needed, and calculates the equivalent fiat in PHP at 1 CC = ₱70.00.
4. **Interactive Form Polish**: Re-styled customer dashboard quick-action grid icons to replace "My Orders" with `Clipboard` and "Support" with `Headphones` for high-end professional appearance.

---

## Version 1.5.7
- **Build**: 000019
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Choose Your Path Section ("YOUR CHOSEN OPTIONS")**: Introduced a brand new onboarding section on the Customer Dashboard designed to inspire active customers to choose between preferred customer and affiliate paths.
2. **Dual Premium Glassmorphism Options**:
   - **Smart Customer Card**: Highlighting a green emerald theme, `ShoppingBag` icon, structured discount benefits, and a high-performance Green Gradient CTA button scrolling straight to the Wellness Catalog.
   - **Affiliate Business Card**: Highlighting a Gold/Amber theme, `Crown` icon, business/income structure, and a premium Gold Gradient CTA button navigating safely to the Business Opportunity Page.
3. **Responsive Stack & Grid Alignment**: Structured cards to stack vertically on mobile (Smart Customer first, Affiliate second), display side-by-side on tablet, and present as dual luxury glass columns in desktop layout main viewports.
4. **Interactive 2px Lift Transitions**: Crafted 200ms duration interactive state transitions with a subtle 2px card lift and a soft glowing border effect to maximize click engagements.

---

## Version 1.5.6
- **Build**: 000018
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Premium Affiliate Promotion Card**: Added an elegant "Become an Affiliate" invitation card to the Customer Dashboard. This is only visible to active Customers, and automatically disappears for other roles. It features a gold crown icon, elegant dark glass background, subtle 2px vertical lift hover animation, and a gold-to-amber gradient CTA button.
2. **Business Opportunity Navigation**: Bound the CTA button directly to the official Business Opportunity Page, avoiding auto-upgrades and fully complying with the official registration process.
3. **Adaptive Grid Multi-Placement**: Placed the promotion card in the right sidebar on desktop viewports, centered half-width (`md:w-1/2`) below the featured promo banner on tablets, and full-width on mobile viewports.
4. **Premium Fixed Bottom Mobile Navigation**: Replaced the floating mobile navigation container with a fixed, full-width, permanently attached bar (`#0B0D12`) featuring a refined 1px solid top border (`rgba(0,255,255,0.10)`) and integrated safe-area bottom padding.
2. **Vertically Embedded Center Primary Action**: Embedded the central Scan (`QrCode`) primary button completely within the 5-column navigation grid inside a 48px size container with 16px rounded corners (`rounded-2xl`) and a soft, gorgeous cyan glow.
3. **Dynamic Notification Badge**: Integrated a red dynamic alert count badge pointing to active unread elements directly reflecting changes across dashboards.
4. **Content Spacing Overlap Prevention**: Added a custom `pb-[100px]` bottom padding on the main viewport containers of Customer, Affiliate, and Distributor views to guarantee no dashboard content is hidden behind the bottom bar.
5. **Aesthetic Transitions & Micro-interactions**: Programmed premium 200ms non-bouncing active tab bottom indicators alongside a subtle 1.05x maximum scale factor for hover feedback on inactive controls.

---

## Version 1.5.5
- **Build**: 000017
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Official PNG Illustration Integration**: Integrated the official, high-fidelity `iamchosenwallet.png` directly into the Chosen Wallet Balance cards using standard `<img />` markup as strictly specified, replacing the temporary inline vector SVG representation.
2. **Strict Sizing & Position Integrity**: Constrained the responsive wallet artwork to exactly `125px` on mobile viewports, `160px` on tablet viewports, and `210px` on desktop layouts to completely avoid overlapping the left-aligned available assets text or the action buttons below.
3. **Smooth Micro-Animations & Glow**: Re-anchored the image inside a motion-wrapped wrapper (`motion.div`) with a smooth floating loop effect and added a neon-cyan drop shadow (`drop-shadow-[0_0_30px_rgba(0,229,210,0.45)]`) to retain glassmorphism elegance.

---

## Version 1.5.3
- **Build**: 000015
- **Release Date**: 2026-07-06
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Premium Chosen Wallet Redesign**: Re-designed and upgraded the Chosen Wallet Card on the Customer Dashboard and the standalone `WalletCard` component to a gorgeous glassmorphism layout featuring deep dark gradients, custom neon cyan bounding glows, rounded corners, and drop shadows.
2. **Interactive 3D Floating Illustration**: Created `ChosenWalletIllustration.tsx` - an inline animated vector illustration of the official Chosen Wallet with three metallic "C" coins floating smoothly at different depths using staggered motion effects.
3. **Dedicated Asset Directory Structure**: Structured all static media folders (`src/assets/illustrations/`, `backgrounds/`, `logos/`, and `icons/`) with pre-compiled transparent 1x1 PNG files ensuring 100% build system validation.
4. **Local Asset Obfuscation**: Added a secure balance visibility eye-toggle state, allowing users to conceal both CC balances and computed PHP equivalent amounts cleanly with secure dot placeholders.

---

## Version 1.5.1
- **Build**: 000013
- **Release Date**: 2026-07-05
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Premium Customer Mobile Dashboard Redesign**: Deployed a fully rewritten premium Customer Dashboard with high-contrast Neon Cyan and IAMCHOSEN Gold accents, deep black (#0B0B0F) and dark gray backgrounds, glassmorphism cards, and smooth navigation animations.
2. **Official Formula Alignment**: Adjusted calculations to use the correct `1 CC = ₱69.00` conversion rate for Cash-In inputs, computed credits ledger, and wallet equivalent balances.
3. **Smart QR & Scanner Integration**: Created a dedicated center "Scan" tab allowing customers to view their Client Identity QR Code or run a simulated scanner to query product codes and verify ledgers in real-time.

---

## Version 1.4.0
- **Build**: 000010
- **Release Date**: 2026-07-05
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Decoupled Customer & Affiliate Dashboards**: Split the multi-purpose dashboard code path into two separate, fully encapsulated visual files: `CustomerDashboard.tsx` and `AffiliateDashboard.tsx`. This avoids conditional clutter and ensures strict scope boundaries.
2. **Absolute Customer Isolation**: Standardized customer views to hide referral invites, link-copiers, QR codes, Cash-Out forms, affiliate tools, commission wallets, marketing support wallets, and reward wallets. Added focused widgets for product shopping catalog, Chosen Wallet CC balance, order ledger, and verified sponsor details.
3. **Affiliate Business Interface**: Restored full unilevel partner features for affiliates: active referral invite links, copy widgets, scannable QR codes, direct member onboarding forms, and a complete multi-wallet ledger tracking Chosen, Commission, Marketing, and Reward wallets.
4. **Standard Admin Tabbed Panel**: Fully re-designed `AdminDashboard.tsx` to include modular tabs for metrics, registered users, Cash-In approvals/declines, Package activation approval triggers, and beautiful placeholder modules for products, orders, and reports.
5. **v3.0 Manual Alignment**: Aligned Module 1 architecture with the "Official Business System & Compensation Plan Manual v3.0", enforcing Firestore roles as the definitive routing source of truth rather than package levels.

---

## Version 1.3.4
- **Build**: 000008
- **Release Date**: 2026-07-05
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Interactive Proof of Payment Uploads**: Built a professional drag-and-drop and manual file click selection area supporting GCash, Maya, and Bank receipt images or PDF files on the Cash-In modal.
2. **PHP-First Cash-In Calculations**: Re-engineered the Cash-In modal to support direct PHP input amounts (minimum ₱70.00), automatically converting and presenting computed Chosen Credits (CC) in real-time at a rate of 1 CC = ₱70.00.
3. **Admin Verification Receipt Viewer**: Integrated an `Eye` icon action column inside the Super Admin Cash-In Verification Queue, allowing administrators to click and safely inspect the uploaded receipts in a modal popup.
4. **Lazy Wallet Initialization**: Upgraded the backend cash-in approval transaction sequence to lazily initialize a zero-balanced multi-sub-wallet document for new customers if one does not exist at approval time.
5. **Customer Security Filters**: Wrapped the dashboard referral section in strict role-based checks, preventing the referral links and promotion codes from rendering for Customer accounts.
6. **Sponsor State Spinner Safeguards**: Protected the referral sponsor lookup logic with robust state blocks, showing proper messages for users without referrers and avoiding infinite spinner loading states.

---

## Version 1.3.3
- **Build**: 000007
- **Release Date**: 2026-07-05
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Strict Referral-gated Signups**: Restructured customer onboarding by requiring a valid sponsor code in the URI query (`?ref=SPONSORCODE`). Directly typing `/register` outputs a clean error view.
2. **Sponsor Lookup & Verification**: Implemented debounced sponsor checks to fetch full name matching of the referrer from Firestore database, locking the input field as read-only.
3. **Affiliate Invitation Hub**: Added a responsive bento-box panel inside the Affiliate dashboard comprising ready-made link copiers, social sharing options (Messenger, Facebook, WhatsApp), and responsive real-time QR Codes.
4. **Product Shop & Order Ledgers**: Embedded a shopping catalog directly inside the Customer dashboard, enabling users to execute Chosen Credit purchases, record secure Firestore order receipts, log transactions, and inspect history.
5. **Customer Interface Clean-up**: Masked secondary wallets and cashout triggers for Customer role users. Replaced upgrade components with an intuitive sponsor activation banner.
6. **Cash-In Request & Verification Queue**: Programmed Cash-In top-up requests in Customer Dashboard with complete fields (payment channel, sender info, reference number, PHP amount) and a dedicated Super Admin cash-in verification approval queue with direct wallet credit and transaction audit logging.

---

## Version 1.3.2
- **Build**: 000006
- **Release Date**: 2026-07-05
- **Environment**: Development / Production

---

### Features Added & Changed
1. **Multi-Dashboard Sub-Routing Architecture**: Built role-based dashboard routers redirecting Super Admin → Super Admin Dashboard, Admin → Admin Dashboard, Affiliate → Affiliate Dashboard, and Customer → Customer Dashboard seamlessly.
2. **Strict Super Admin Constraints**: Formulated and locked mandatory defaults for Super Admin users: `accountType = 'System'`, `packageLevel = 'None'`, `commissionEligible = false`, `walletEnabled = false`, `genealogyEnabled = false`, and `businessCycleEnabled = false`.
3. **Interactive Permissions Control**: Programmed a granular boolean permission matrix across the user document containing 10 fields for secure access limits (`manageMembers`, `manageProducts`, etc.).
4. **Enhanced Security Hardening**: Completely overhauled `/firestore.rules` to check permission objects directly before permitting document modifications, lists, or deletes.

---

## Version 1.2.0
- **Build**: 000003
- **Release Date**: 2026-07-04
- **Environment**: Development / Production

---

### Features Added
1. **Protected Affiliate Onboarding**: Closed the public signup page to affiliate accounts to secure unilevel placements. Affiliate registration is now exclusively available through Sponsor-directed Member Registration or Admin Creation.
2. **Customer Registration Focus**: Redesigned the public register route to handle Customer profiles only, immediately activating their access with default zero-balance wallets.
3. **Interactive Business Presentation**: Added a dedicated, premium information page under `/business-opportunity` outlining corporate packages, unilevel compensation benefits, and clear partnership onboarding options.
4. **Login Support Widget**: Added instructional widgets inside the login interface to guide interested partners toward sponsor-initiated activations.

---

## Version 1.1.0
- **Build**: 000002
- **Release Date**: 2026-07-04
- **Environment**: Development / Production

---

### Features Added
1. **Simplified Public Registrations**: Cleaned public route into simple options: regular Customer and pending Direct Company Purchase Affiliate.
2. **Direct Purchase Activations**: Allows prospective affiliates to register, input receipt details, and wait for an administrator to activate them.
3. **Internal Member Registrations**: Empowers Bronze-Diamond affiliates and administrators to register new members immediately using their Chosen Credits (CC).
4. **Instant Commission Engine**: Computes and transfers 4% Direct Referral Commission to the sponsor's Commission Wallet instantly upon registration.
5. **Real-time Metrics Widgets**: Adds premium analytics boxes tracking today's registered members, package sales, total consumed credits, and direct commissions generated.
6. **Admin Purchase Approval panel**: Grants administrative accounts review options to activate pending purchases, generate wallets, and build active cycles atomically.

---

## Version 1.0.0
- **Build**: 000001
- **Release Date**: 2026-07-04
- **Environment**: Development / Production

---

### Features Added
1. **Secure Landing Page**: High-contrast, black, gold, and white premium product showcase displaying retail prices in Chosen Credits (CC) and PHP equivalents.
2. **Dynamic Register System**: Creates credentials with Firebase Auth, automatically generating Member IDs like `IAM-1000123` and validated referral mappings.
3. **Role-Based Guards**: Restricts client actions. Regular customers cannot view business cycle caps, and regular users are restricted from the administrative dashboards.
4. **Digital Wallets**: Prepares zero-balanced sub-wallets (Chosen, Commission, Marketing, and Reward) directly in Firestore.
5. **Simulated Commission Engine**: Client-side interactive trigger adding commission to wallets, reducing remaining capacity, and completing business cycles when the 2.5x cap is met.
6. **Immutable Audit Logs**: Writes system entries on logins, register events, and kyc updates that can never be updated or deleted.

---

### Developer Notes
- Built using **React 19** and **Vite** bundled with Tailwind CSS utility classes.
- Zero-trust security applied directly in `firestore.rules` to prevent direct wallet or role tampering from client-side modules.

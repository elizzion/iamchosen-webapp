# Version History

This documents the build releases and major feature landmarks of the **I AM CHOSEN International** business systems platform.

## [v1.7.4] - Build 000030 (2026-07-08)
### Core Updates
- **Flush Out Business Cycle Corporate Card**: Deployed the high-priority "Flush Out Business Cycle" card inside the Financial Aggregates & Volume dashboard panel of the Super Admin Corporate Console.
- **Dynamic Conversion Calculations**: Renders aggregated flushed Business Cycle CC amounts as the primary value with dynamic PHP conversion ≈ ₱{amount} calculated below it using `system_config/cc_settings` rates (with a default fallback of ₱70 per 1 CC).
- **Secure Collection Queries**: Implemented relational queries prioritizing the `flushed_commissions` collection where `reason == "BUSINESS_CYCLE_COMPLETED"` and `status == "Flushed"`, falling back dynamically to `commissions` with identical filtering if the primary collection does not contain logs.
- **Enhanced Role Protection Controls**: Guarded card rendering to strictly enforce display limits only to authenticated users containing `role == "Super Admin"`.
- **Flush Out Business Cycle Monitoring**: Implemented Flush Out Business Cycle monitoring with audit trails for commissions blocked by completed Business Cycles.

## [v1.7.3] - Build 000029 (2026-07-08)
### Core Updates
- **Corporate Security Audit Trail Row Limits**: Enabled row capping configurations supporting `50`, `100`, `250`, or `500` entries.
- **Searchable Audit Logs**: Added instantaneous client-side text searching across operator emails, event types, and detail logs.
- **Action & Operational Email Dropdowns**: Built dual self-generating selector dropdowns that fetch unique log properties dynamically to simplify management.
- **Dynamic Count Analytics**: Implemented helpful matching counters informing executives of active filters and total events.

## [v1.7.2] - Build 000028 (2026-07-08)
### Core Updates
- **Dynamic Firebase Config imports**: Swapped hardcoded client configurations in `src/firebase.ts` with direct imports of `/firebase-applet-config.json` to automatically match database-specific registration keys.
- **Fixed auth/invalid-credential errors**: Resolved credential failures triggered by stale or mismatched configuration keys during sign-in or downline creation.
- **Compiler JSON modules**: Enabled `"resolveJsonModule": true` in `tsconfig.json` for type-safe static file loading.

## [v1.7.1] - Build 000027 (2026-07-07)
### Core Updates
- **Direct Downline Simulator Re-engineering**: Redesigned the commission simulator to compute calculations directly in Chosen Credits (CC) package values using the formula: `directDownlineBonusCC = packageValueCC * directReferralRate`.
- **Dynamic Rules Context Subscription**: Connected the simulator to Firestore config at `system_config/business_rules.directReferralRate` with automatic fallback to 4% (0.04 multiplier).
- **All Affiliate & Distributor Packages Included**: Added rows to simulate all 7 tiers (Bronze: 50 CC, Silver: 350 CC, Gold: 1500 CC, Platinum: 3000 CC, Diamond: 5000 CC, and custom values for City & Regional Distributors).
- **Safe State Fallbacks and Missing Config Check**: Programmed distributor packages to show "Config required" if they are not yet configured in the Firestore `packages` collection, and provided fallback values for the standard Bronze-Diamond packages if firestore documents are missing.
- **PHP Sale Value Removal**: Cleaned up the user interface layout to hide and completely exclude PHP fiat values in compliance with security requirements.
- **Fixed-Point Formatting**: Ensured CC calculations inside the simulator output are strictly limited to 2 decimal places.
- **Unilevel Business Analytics Card Overhaul**: Overhauled the card metrics (Personal Sales and Monthly Earnings) to display values in Chosen Credits (CC) formatted with thousand separators, completely omitting PHP fiat currency. Fixed Bronze Dashboard analytics to ensure all sales, commissions, and cycle values are calculated and displayed in CC, not mislabeled PHP values. Programmed these metrics to dynamically compute from the live active downline members list (`downlineList`) for perfect, real-time consistency. Filtered the counting logic to strictly include only active affiliate packages ("Bronze", "Silver", "Gold", "Platinum", "Diamond", "City Distributor", "Regional Distributor") where role is "Affiliate" and status is "Active", preventing "None" packages, customers, or pending/inactive referrals from inflating affiliate figures.
- **Dynamic Affiliate Metrics & Naming**: Replaced the label "Referral Count" / "Direct Members" with "DIRECT AFFILIATE" showing "1 Member" / "X Members" dynamically with the subtitle "Direct Business Network".
- **Zero-Safe Cycle Progress Calculations**: Implemented clean calculation bounds and fallback handling for "Cycle Progress" to guarantee 0% output instead of undefined% or NaN% when data is missing or invalid.

## [v1.6.1] - Build 000023 (2026-07-06)
### Core Updates
- **Global Centralized Exchange Configuration**: Replaced all hardcoded Chosen Credits (CC) conversion rates across the codebase with a single centralized source of truth (`CCSettingsContext`). 
- **Real-time Synchronization**: Programmed a live listener (`onSnapshot`) to track the Firestore settings doc `system_config/cc_settings` and update rates across all user dashboards instantly.
- **Auto-seeding Defaults**: Built self-repairing database bootstrapping that automatically checks and seeds default rates (`cashInRatePHP = 70` and `cashOutRatePHP = 69`) if the collection or settings document is missing.
- **Dynamic Valuation Calculations**: Updated landing footer, Customer/Affiliate wallet cards, Cash-In procurement guides, and withdrawal panels to calculate PHP values and credits output dynamically.
- **Super Admin Exchange Manager**: Implemented an interactive rate configuration console in the Super Admin's "System Settings" panel, with single-click persistence and dynamic audit log creation.

## [v1.6.0] - Build 000022 (2026-07-06)
### Core Updates
- **Instant Wallet-Driven Package Purchases**: Fully redesigned the Affiliate Track onboarding process to check the customer's `Chosen Wallet` balance dynamically upon selecting a package.
- **Atomic Upgrade Transactions**: Programmed a robust Firestore transaction handler that deducts the package price (Bronze: 50 CC, Silver: 350 CC, Gold: 1500 CC, Platinum: 3000 CC, Diamond: 5000 CC), upgrades the user's role/accountType to Affiliate, initializes an active Business Cycle with a 2.5x earnings cap, generates debit transaction logs, and creates secure audit logs atomically.
- **Direct Cash-In Redirection Helper**: Designed an elegant routing fallback that intercepts customers with insufficient balances and redirects them to a specialized Cash-In Portal (`/cash-in?purpose=affiliate-upgrade&package={Package}&requiredCC={Cost}`).
- **Interactive Upgrade Top-Up Box**: Formatted a premium, gold-bordered information card showing the selected package, required credits, current balance, remaining credits needed, and the exact PHP equivalent calculation (calculated using 1 CC = ₱70.00).
- **Navigation Asset Polishing**: Updated customer dashboard quick-action grid icons to replace "My Orders" with a professional `Clipboard` and "Support" with `Headphones` for improved user clarity.

## [v1.5.7] - Build 000019 (2026-07-06)
### Core Updates
- **Choose Your Path Section**: Introduced a beautifully crafted onboarding experience on the Customer Dashboard titled "YOUR CHOSEN OPTIONS" (Choose the path that fits your goals) displayed specifically for `role === 'Customer'`.
- **Dual Option Tracks**: Programmed Option 1 (Smart Customer) highlighting exclusive discounts and member promotions with a green-gradient CTA that scrolls dynamically to the Wellness Catalog. Programmed Option 2 (Affiliate Business) highlighting retail profit, AI business coaching, and unilevel statistics with a gold-gradient CTA that safely navigates to the Business Opportunity Page.
- **Responsive Stack and Grid Systems**: Responsive layouts automatically stack cards vertically on mobile (Customer first, Affiliate second), display side-by-side on tablet, and present as two premium side-by-side glass panels on desktop.
- **Luxury Aesthetic Touches**: Enhanced cards with soft green and gold glow halos, 24px rounded corners (`rounded-[24px]`), and a custom 2px lift transition taking exactly 200ms.

## [v1.5.6] - Build 000018 (2026-07-06)
### Core Updates
- **Become an Affiliate Promotion Card**: Integrated a premium invitation card to the Customer Dashboard for `role === 'Customer'`. Styled with a dark glass background, 24px rounded corners (`rounded-[24px]`), soft cyan glow, gold Crown icon, and an interactive 2px vertical lift animation.
- **Corporate Registration Flow Alignment**: Directed the gold-to-amber gradient CTA button to navigate users to the official Business Opportunity Page, avoiding automatic background upgrades to respect the official activation process.
- **Responsive Dynamic Multi-Placement**: Configured the promotion card dynamically inside the right sidebar on desktop, centered half-width (`md:w-1/2`) below the promotional banner on tablets, and full-width on mobile.
- **Fixed Premium Mobile Bottom Navigation**: Re-architected the mobile bottom navigation bar into a fully attached, fixed bottom bar with a width of 100% and background color of `#0B0D12` with a 1px solid `rgba(0,255,255,0.10)` top border and a height of `72px`.
- **Vertical Embedded Center Action**: Integrated the central primary action Scan button (`QrCode` icon) directly inside the 5-column navigation grid to prevent it from floating above the bar, complete with a 48px size, 16px rounded corners (`rounded-2xl`), cyan-to-teal gradient background, and a soft ambient glow.
- **Dynamic Alerts Badge**: Implemented a dynamic notification badge for the ALERTS tab directly queryable from the Firestore database count with a deep red background and white counter.
- **Safe Area & Bottom Spacing Padding**: Optimized layout margins on iOS/Android device screens using CSS variable `padding-bottom: env(safe-area-inset-bottom)` and added a standard viewport padding of `100px` to prevent layout overlaps.
- **Smooth 200ms Transitions**: Added non-bouncing, high-performance tab-switching active indicator animations limited to 1.05x maximum hover scaling.

## [v1.5.5] - Build 000017 (2026-07-06)
### Core Updates
- **Official PNG Illustration Integration**: Integrated the exact high-fidelity uploaded `iamchosenwallet.png` directly into the Chosen Wallet Balance cards using native `<img />` tags, as strictly required, replacing the temporary inline vector SVG illustration.
- **Strict Sizing & Position Integrity**: Styled the image with specific responsive widths (exactly `125px` on mobile viewports, `160px` on tablet viewports, and `210px` on desktop layouts) to prevent overlaps with balance text or action buttons.
- **Visual Glow and Animations**: Layered the PNG inside a `motion.div` floating loop animation and added a premium soft cyan drop shadow (`drop-shadow-[0_0_30px_rgba(0,229,210,0.45)]`) to retain glassmorphism elegance.

## [v1.5.3] - Build 000015 (2026-07-06)
### Core Updates
- **Premium Chosen Wallet Redesign**: Re-engineered Customer and modular Wallet Card views to support standard dark glassmorphism gradients, cyan glowing outer borders, and responsive flexbox layouts.
- **Animated Vector Illustration**: Deployed a fully-animated vector graphic (`ChosenWalletIllustration`) under `/src/components/customer/ChosenWalletIllustration.tsx` featuring 3D-effect floating metallic "C" coins and glowing semi-transparent cyan reflections.
- **Static Assets Directory Setup**: Created complete subdirectories for illustrations, backgrounds, logos, and icons under `/src/assets` and pre-rendered compiling 1x1 transparent PNG fallbacks.
- **Balance Masking Capability**: Integrated a secure balance visibility toggle (using custom Eye & EyeOff indicators) that conceals assets instantly behind secure placeholders.

## [v1.5.1] - Build 000013 (2026-07-05)
### Core Updates
- **Premium Customer Mobile Dashboard Redesign**: Deployed a fully rewritten premium Customer Dashboard with high-contrast Neon Cyan and IAMCHOSEN Gold accents, deep black (#0B0B0F) and dark gray backgrounds, glassmorphism cards, and smooth navigation animations.
- **Official Formula Alignment**: Adjusted calculations to use the correct `1 CC = ₱69.00` conversion rate for Cash-In inputs, computed credits ledger, and wallet equivalent balances.
- **Smart QR & Scanner Integration**: Created a dedicated center "Scan" tab allowing customers to view their Client Identity QR Code or run a simulated scanner to query product codes and verify ledgers in real-time.

## [v1.4.0] - Build 000010 (2026-07-05)
### Core Updates
- **Decoupled Customer & Affiliate Dashboards**: Split the multi-purpose dashboard code path into two separate, fully encapsulated visual files: `CustomerDashboard.tsx` and `AffiliateDashboard.tsx`.
- **Absolute Customer Isolation**: Standardized customer views to hide referral invites, link-copiers, QR codes, Cash-Out forms, affiliate tools, commission wallets, marketing support wallets, and reward wallets. Added focused widgets for product shopping catalog, Chosen Wallet CC balance, order ledger, and verified sponsor details.
- **Affiliate Business Interface**: Restored full unilevel partner features for affiliates: active referral invite links, copy widgets, scannable QR codes, direct member onboarding forms, and a complete multi-wallet ledger tracking Chosen, Commission, Marketing, and Reward wallets.
- **Standard Admin Tabbed Panel**: Fully re-designed `AdminDashboard.tsx` to include modular tabs for metrics, registered users, Cash-In approvals/declines, Package activation approval triggers, and beautiful placeholder modules for products, orders, and reports.
- **v3.0 Manual Alignment**: Aligned Module 1 architecture with the "Official Business System & Compensation Plan Manual v3.0", enforcing Firestore roles as the definitive routing source of truth rather than package levels.

## [v1.3.4] - Build 000008 (2026-07-05)
### Core Updates
- **GCash, Maya, and Bank Receipt Uploads**: Built a professional drag-and-drop file upload container with interactive device browsing supporting image and PDF proof of payment receipts on top-ups.
- **PHP Cash-In & Real-time CC Conversion**: Re-designed top-up requests to accept input in PHP directly, auto-computing and showing the equivalent credit dynamically at a rate of 1 CC = ₱70.00.
- **Admin Verification Receipt Window**: Built an interactive receipt verification module using Lucide's `Eye` icon inside the Super Admin panel to inspect proof receipts before verifying requests.
- **Lazy Wallet Auto-Provisioning**: Programmed approval logic to lazily instantiate a zero-balanced system wallet document for any customer who hasn't registered a wallet previously.
- **Customer Section Referral Masking**: Enforced role-based constraints to strictly hide referral link generators, promotional codes, copy triggers, and social invites from Customer accounts.
- **Sponsor Lookup State Safeguards**: Upgraded sponsor data fetching routines with try-catch loaders, showing proper fallbacks when no sponsor is present and avoiding infinite loading.

## [v1.3.3] - Build 000007 (2026-07-05)
### Core Updates
- **Referral Enforcement Framework**: Blocked public uninvited registration across `/register`. Requires referral query parameter `ref=SPONSORCODE` with automated database existence checks on Firebase.
- **Sponsor Validation Checkpoints**: Implemented read-only sponsor fields, active sponsor verification checkmark cards, and customized invalid referral error views.
- **Affiliate Share Center**: Programmed unique Customer Referral Link generators, click-to-copy, social shares (Facebook, Messenger, WhatsApp), and customized live QR Codes.
- **Exclusive Customer Dashboard**: Overhauled Customer experience showing products catalog shop with Chosen Credit (CC) purchasing integration, live order history trackers, verified sponsor info boards, and custom upgrade activation help banners.

## [v1.3.2] - Build 000006 (2026-07-05)
### Core Updates
- **RBAC & Redirections Refactor**: Mapped distinct dashboards based on user roles (Super Admin → Super Admin Dashboard, Admin → Admin Dashboard, Affiliate → Affiliate Dashboard, Customer → Customer Dashboard).
- **Strict Super Admin Attributes**: Constrained Super Admin to have `accountType = System`, `packageLevel = None`, `commissionEligible = false`, `walletEnabled = false`, `genealogyEnabled = false`, and `businessCycleEnabled = false` with all permissions enabled.
- **Granular Permissions Block**: Attached a boolean object mapping 10 administrative privileges to secure access across routes, actions, and collections.
- **Enterprise Firestore Security Rules**: Fully refactored `/firestore.rules` to parse granular permissions dynamically via a newly-integrated helper.

## [v1.2.0] - Build 000003 (2026-07-04)
### Core Updates
- **Onboarding Streamlining**: Completely removed public affiliate registrations to protect the network unilevel structure.
- **Customer Public Portal**: Configured public signup strictly for Customer profiles, establishing active users with zero CC wallets.
- **Business Opportunity Showcase**: Integrated an interactive, high-end "Join Our Business" presentation details page.
- **Secure System Onboarding**: Restricted affiliate creations strictly to Sponsor-directed Member Registration and Admin validations.

## [v1.1.0] - Build 000002 (2026-07-04)
### Core Updates
- **Affiliate Registration Overhaul**: Streamlined public signups into Customer vs Pending Affiliate.
- **Sponsor-Initiated Registrations**: Enabled real-time downline registrations funded with Chosen Credits (CC).
- **Direct Referral Commission**: Immediate 4% payouts to Commission Wallets on successful downline creations.
- **Admin Activations**: Enabled admin approvals for pending Affiliate direct-purchase registrations.
- **Metrics Dashboard**: Implemented widgets tracking today's user entries, packages, and credit consumption totals.

## [v1.0.0] - Build 000001 (2026-07-04)
### Core Updates
- **Platform Genesis**: Established primary authentication, basic user profiles, digital wallets, unilevel cycle simulators, and real-time administrative panels.
- **Firebase Integrations**: Implemented Firestore rules, authentication triggers, and audit logging databases.

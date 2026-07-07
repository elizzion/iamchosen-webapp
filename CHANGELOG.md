# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2026-07-06 (Build 000023)

### Added
- **Centralized Conversion Rates Config**: Established a single source of truth for Chosen Credit (CC) exchange rates. Created `CCSettingsContext` which subscribes in real-time to the Firestore `system_config/cc_settings` document.
- **Autoseeding Database Defaults**: Added automatic seeding of the Firestore settings document on application initialization with default system rates (Cash-In: 70.00 PHP, Cash-Out: 69.00 PHP).
- **Global Rate Propagation**: Integrated dynamic exchange rates across all key sections including the Landing Page footer, Cash-In procurement guides, withdrawal calculators, and the Customer/Affiliate dashboards.
- **Super Admin Rates Manager**: Implemented an interactive dashboard section inside the System Settings tab allowing administrators with necessary permissions to view and update the global Cash-In and Cash-Out rates, generating persistent audit logs on change.

## [1.6.0] - 2026-07-06 (Build 000022)

### Added
- **Direct Wallet-Based Upgrade Flow**: Added live wallet balance checks when clicking "Choose Package" on the Affiliate track. 
- **Atomic Transactions Logic**: Integrated a Firestore `runTransaction` execution path that deducts Selected Package CC from the user's Chosen Wallet, upgrades the user profile's role to 'Affiliate', creates an active `business_cycles` entry with 2.5x cap limits, writes standard debit ledger transaction logs, and creates audit logs synchronously.
- **Dedicated Cash-In Upgrade station**: Designed `/cash-in` with custom parameters to support the package upgrade redirection path, complete with a specialized "Upgrade Procurement Helper" showing required CC, current CC balance, remaining CC needed, and its exact 1:70 PHP equivalent.
- **Dashboard Quick-Actions Polish**: Changed "My Orders" icon to a professional `Clipboard` and "Support" to `Headphones` inside the customer `QuickActionGrid`.

## [1.5.7] - 2026-07-06 (Build 000019)

### Added
- **Your Chosen Options Section**: Added a new "YOUR CHOSEN OPTIONS" (Choose Your Path) block containing two beautifully crafted glassmorphism cards: Option 1 (Smart Customer) and Option 2 (Affiliate Business).
- **Responsive Stack and Side-by-Side Grid Layouts**: Integrated full-width stacking on mobile (Customer card first, Affiliate card second) and responsive dual columns (`md:grid-cols-2`) on tablet/desktop layouts.
- **Micro-interactions & Aesthetics**: Styled with premium 2px vertical lift animations, subtle 200ms duration glows, and high contrast typography paired with emerald and gold custom gradient CTA buttons.

## [1.5.6] - 2026-07-06 (Build 000018)

### Added
- **Premium Affiliate Promotion Card**: Added a custom gold-accented "Become an Affiliate" promotion card on the Customer Dashboard to motivate active customers to explore the business opportunity.
- **Responsive Layout Multi-Placement**: Placed the promotion card dynamically; rendering inside the right sidebar on desktop, and centered half-width (`md:w-1/2`) below the promotional slider on tablets, and full-width on mobile.
- **Seamless Navigation CTA**: Directed users smoothly to the official Business Opportunity Page upon clicking without performing automatic background upgrades, fully respecting corporate registration guidelines.
- **Fixed Premium Mobile Bottom Navigation**: Redesigned the mobile bottom navigation bar into a fully attached, fixed bottom bar with a width of 100% and background color of `#0B0D12` with a 1px solid `rgba(0,255,255,0.10)` top border and a height of `72px`.
- **Vertical Embedded Center Action**: Integrated the central primary action Scan button (`QrCode` icon) directly inside the 5-column navigation grid to prevent it from floating above the bar, complete with a 48px size, 16px rounded corners (`rounded-2xl`), cyan-to-teal gradient background, and a soft ambient glow.
- **Dynamic Alerts Badge**: Implemented a dynamic notification badge for the ALERTS tab directly queryable from the Firestore database count with a deep red background and white counter.
- **Safe Area & Bottom Spacing Padding**: Optimized layout margins on iOS/Android device screens using CSS variable `padding-bottom: env(safe-area-inset-bottom)` and added a standard viewport padding of `100px` to prevent layout overlaps.
- **Smooth 200ms Transitions**: Added non-bouncing, high-performance tab-switching active indicator animations limited to 1.05x maximum hover scaling.

## [1.5.5] - 2026-07-06 (Build 000017)

### Added
- **Official PNG Illustration Integration**: Deployed the exact uploaded `iamchosenwallet.png` file as the Chosen Wallet illustration inside the Chosen Wallet Balance card on both the Customer Dashboard and the modular `WalletCard`.
- **Responsive Sizing Constraints**: Styled the image with strict responsive width specifications: exactly `125px` on mobile, `160px` on tablet, and `210px` on desktop layouts, preventing any balance text or action button overlaps.
- **Visual Glow and Animations**: Enhanced the PNG with motion-based floating animations (Framer Motion) and a premium soft cyan drop-shadow glow (`drop-shadow-[0_0_30px_rgba(0,229,210,0.45)]`) to maintain visual luxury.

## [1.5.3] - 2026-07-06 (Build 000015)

### Added
- **Premium Chosen Wallet Redesign**: Deployed a fully responsive, modern glassmorphic Chosen Wallet card with deep black/dark-blue gradients, outer cyan halos, soft shadows, and clean margins.
- **Animated Chosen Wallet Illustration**: Created a beautiful vector graphic (`ChosenWalletIllustration`) under `/src/components/customer/ChosenWalletIllustration.tsx` depicting a semi-transparent, cyan-glowing glass wallet alongside 3 metallic cyan "C" coins floating smoothly using CSS/motion.
- **Static Asset Structure**: Configured the complete project directories for illustrations (`src/assets/illustrations/`, `backgrounds/`, `logos/`, `icons/`) containing valid, 1x1 transparent PNG compiler fallback assets including `chosen-wallet.png`.
- **High-Resolution Vector SVG**: Saved a crisp, scalable, high-resolution vector artwork in SVG format under `/public/images/chosen-wallet.svg`.
- **Local Asset Hiding Toggle**: Integrated an eye-toggle button onto both the main Customer Dashboard wallet card and the modular `WalletCard` component to easily obfuscate available asset balances.

## [1.5.1] - 2026-07-05 (Build 000013)

### Changed
- **Official Conversion Rate**: Corrected cash-in conversion rate formula to `1 CC = ₱69.00` in Customer Wallet and Cash-In ledger calculations.
- **Customer Mobile Dashboard UI/UX**: Redesigned and deployed the Customer Dashboard to follow a world-class, premium mobile-first dark theme inspired by modern digital wallets and wellness platforms.
- **Glassmorphism & Branding**: Integrated IAMCHOSEN Gold and Neon Cyan highlights onto glassmorphic cards, including a futuristic simulated QR portal for quick client identity scans.

## [1.4.0] - 2026-07-05 (Build 000010)

### Added
- **Decoupled Customer and Affiliate Dashboards**: Developed dedicated `/src/components/CustomerDashboard.tsx` and `/src/components/AffiliateDashboard.tsx` components to completely separate visual code paths and enforce strict data visibility.
- **Strict Role-Based Security Enforcement**:
  - **Customers**: Restructured to completely isolate and hide affiliate assets (referral link builders, copy link widgets, QR codes, Cash-Out forms, affiliate tools, commission wallets, marketing support wallets, and reward wallets). Added focused views for product catalog shopping, Chosen Wallet CC balance, order ledger, and verified sponsor details.
  - **Affiliates**: Provided full unilevel dashboard with active referral invite links, copy widgets, scannable QR codes, direct member onboarding forms, and a complete multi-wallet ledger tracking Chosen, Commission, Marketing, and Reward wallets.
- **Standard Admin Panel Tabs**: Redesigned standard `AdminDashboard.tsx` to support distinct tabs for metric summaries, comprehensive user registries, Cash-In approval and decline management, direct-company package activation triggers, and placeholder views for products, orders, and reports.
- **Compliance Alignment**: Fully aligned Module 1 (Foundation & Identity System) with the Official Business System & Compensation Plan Manual v3.0, prioritizing Firestore roles as the definitive routing source of truth rather than package levels.

## [1.3.4] - 2026-07-05 (Build 000008)

### Added
- **Drag-and-Drop + Click Proof of Payment**: Added a responsive file upload region supporting drag-and-drop or manual click selecting for GCash, Maya, or Bank Transfer receipt documents (images/PDFs) on Cash-In requests.
- **Cash-In Verification Modal**: Added a secure verification modal in the Super Admin Console allowing administrators to examine the uploaded receipt image or document preview before approving/declining.
- **Lazy-Initialized Customer Wallets**: Upgraded the cash-in approval system to automatically initialize a default wallet document with the approved credit if the customer has not registered a wallet previously.
- **Sponsor State Loading Manager**: Added explicit try-catch-finally loading indicators for Referral Sponsor details inside Customer views to prevent infinite loader spins.

### Changed
- **PHP-to-Credits Conversion**: Shifted Cash-In input from CC to PHP directly (minimum ₱70.00), automatically computing and displaying the converted Chosen Credits (CC) real-time (at 1 CC = ₱70.00).
- **Referral Section Role Check**: Tightened visibility constraints for referral links and promotional share utilities to ensure they never display for Customer accounts, reserving them solely for Affiliate and Distributor levels.

## [1.3.3] - 2026-07-05

### Added
- **Referral-Locked Onboarding**: Restricted public customer registration strictly to referral-based URL query parameters (`/register?ref=SPONSORCODE`). Direct public access to the registration page is blocked with a professional access restriction interface.
- **Sponsor Validation and Locking**: Automatically extracts and upper-cases sponsor referral codes on mount, verifying sponsor profiles in Firestore (`users.sponsorCode`) and locking the input field as read-only.
- **Sponsor Verification Banner**: Displays sponsor name in a verified checkmark banner if found in Firestore, and shows a descriptive error banner if the referral code is invalid.
- **Invite Members Section for Affiliates**: Integrated a prominent referral invitations center for active Affiliates showing their Sponsor Code, Customer Referral Link, quick click-to-copy, sharing widgets (Facebook, Messenger, WhatsApp), and an instantly-scannable QR Code.
- **Customer Shopping Portal**: Embedded an elegant product shopping catalog grid inside the Customer Dashboard. Enabled Customer users to purchase products using Chosen Credits (CC), with real-time Firestore wallet balance updates, transaction logging, order writing, and security logging.
- **Order History & Sponsor widgets**: Added orders list trackers, product recommendations, and detailed sponsor profile cards inside the Customer Dashboard.

### Changed
- **Customer Dashboard Optimization**: Overhauled Customer dashboard visibility to hide cashout triggers, Commission, Marketing Support, and Reward wallets, replacing unneeded upgrade elements with a welcoming "Welcome Customer" activation support notice.

## [1.3.2] - 2026-07-05

### Added
- **Permissions Framework**: Introduced granular `UserPermissions` model with 10 fields for secure operations (`manageMembers`, `manageProducts`, `manageInventory`, `manageWallets`, `approveCashOut`, `manageCommissions`, `viewAnalytics`, `systemSettings`, `manageRoles`, `viewAuditLogs`).
- **Default Permissions Config**: Pre-configured defaults for Super Admin (all true), Admin (operational true, role management & system settings false), and Customer/Affiliates (all false).
- **Role-Based Redirections**: Configured automatic sub-routing mapping distinct views (Super Admin → `super-admin-dashboard`, Admin → `admin-dashboard`, Affiliate → `affiliate-dashboard`, Customer → `customer-dashboard`).
- **Enterprise-Gated Security Rules**: Rewrote `/firestore.rules` to check roles and the active permissions block dynamically (`hasPermission` helper function).

### Changed
- **Super Admin Strict Model Enforcement**: Enforced immutable characteristics on the Super Admin role (`role = 'Super Admin'`, `accountType = 'System'`, `packageLevel = 'None'`, `commissionEligible = false`, `walletEnabled = false`, `genealogyEnabled = false`, `businessCycleEnabled = false`, and all permissions enabled).
- **Auto-Recovery Profile Management**: Refactored `ensureUserProfile` in `src/firebase.ts` and `RegisterPage.tsx` to automatically set the default role-based variables.

## [1.2.0] - 2026-07-04

### Removed
- **Public Affiliate Registration**: Completely removed the "Become an Affiliate" tab, package selections, Chosen Credits (CC) prices, and direct payment forms from the public register page.

### Added
- **Customer Only Registrations**: Public signup page is now dedicated exclusively to Customer creation. Upon successful registration, the customer profile is active immediately with empty wallets (Chosen, Commission, Reward, Marketing Support) and no network cycles.
- **Business Opportunity Portal**: Added a high-end showcase route (`/business-opportunity`) detailing the business model, onboarding packages, network compensation benefits, 2.5x caps, and activation contact options.
- **Login Portal Updates**: Implemented informational widgets on the sign in page instructing prospective partners on the secure sponsor-onboarding processes.

## [1.1.0] - 2026-07-04

### Added
- **Public Registration Overhaul**: Streamlined public registering into only Customer Registration and Become an Affiliate options.
- **Affiliate Direct Company Purchase**: Pending approval state with direct-to-company cash/payout reference processing.
- **Member Registration**: Dedicated, role-gated page for active Affiliates (Bronze to Diamond) and Admins to register new members in real-time.
- **Sponsor Wallet Deductions**: Automatic package value deduction from the sponsor's Chosen Credits (CC) with full balance checks and confirmation modals.
- **Direct Referral Commission**: Immediate 4% referral bonus computed and paid to the sponsor on success.
- **Genealogy & Cycle Setup**: Automatic configuration of sponsor code references, initial zero-balanced wallets, and active 2.5x cap business cycles.
- **Double Entry Transactions**: Secure dual audit records tracking both the sponsor's debit and the new member's package registration event.
- **Enhanced Admin Dashboard**: Widgets showing Today's Registrations, Package Sales, CC Consumed, Referral Bonuses, and Active Package levels.
- **Direct Purchase Approvals**: Admin interface to approve direct affiliate purchases, activate accounts, and provision initial structures.

## [1.0.0] - 2026-07-04

### Added
- **Authentication**: Fully functional Firebase Authentication with Register, Login, and Forgot Password features.
- **Roles & RBAC**: Real-time role-based authorization for Super Admin, Admin, Customer, Affiliate, City Distributor, and Regional Distributor.
- **Profiles**: Personalized profile pages with fields like Full Name, Sponsor Code, and KYC status indicators.
- **KYC Upload**: Simulated secure Know-Your-Customer documentation submission to upgrade user verification.
- **Initial Wallets**: Configured initial digital wallets containing balances for Chosen Credits (CC), commissions, and marketing allocations.
- **Business Cycles**: Integrated earning cap status trackers for Affiliates with automated 2.5x caps.
- **Admin Dashboard**: Live statistics dashboard counting members, distributors, and pending KYC requests.
- **User & Role Managers**: Searchable registry for admins to review users, verify KYC, and reassign platform roles.
- **Audit Logs**: Immutable system-wide logging of authentication, role modifications, and profile changes.

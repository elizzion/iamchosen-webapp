import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, createAuditLog, ensureUserProfile } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, PageRoute } from './types';

// Views
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import Dashboard from './components/Dashboard';
import AffiliateDashboard from './components/AffiliateDashboard';
import CustomerDashboard from './components/CustomerDashboard';
import ProfilePage from './components/ProfilePage';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import UserManagementPage from './components/UserManagementPage';
import RoleManagementPage from './components/RoleManagementPage';
import AccessDeniedPage from './components/AccessDeniedPage';
import MemberRegistrationPage from './components/MemberRegistrationPage';
import BusinessOpportunityPage from './components/BusinessOpportunityPage';
import PackageSelectionPage from './components/PackageSelectionPage';
import CashInPage from './components/CashInPage';
import P2PTransferPage from './components/P2PTransferPage';
import AdminP2PTransfersPage from './components/AdminP2PTransfersPage';
import ECommercePage from './components/ECommercePage';
import AffiliateAppShell from './components/layout/AffiliateAppShell';

import ChosenLogo from './components/ChosenLogo';

import { CCSettingsProvider } from './context/CCSettingsContext';
import GlobalModal from './components/GlobalModal';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('login');
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Monitor Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          let profile: UserProfile;

          if (userDocSnap.exists()) {
            profile = userDocSnap.data() as UserProfile;
            if (!profile.uid) {
              profile.uid = firebaseUser.uid;
            }
          } else {
            console.warn("No profile document found for UID, performing auto-recovery:", firebaseUser.uid);
            profile = await ensureUserProfile(firebaseUser);
          }

          // Strict Super Admin configuration guard
          if (profile.email === 'nifled.kenjaktrading@gmail.com' || profile.role === 'Super Admin') {
            let updated = false;
            if (profile.role !== 'Super Admin') {
              profile.role = 'Super Admin';
              updated = true;
            }
            if (profile.accountType !== 'System') {
              profile.accountType = 'System';
              updated = true;
            }
            if (profile.packageLevel !== 'None') {
              profile.packageLevel = 'None';
              updated = true;
            }
            if (profile.commissionEligible !== false) {
              profile.commissionEligible = false;
              updated = true;
            }
            if (profile.walletEnabled !== false) {
              profile.walletEnabled = false;
              updated = true;
            }
            if (profile.genealogyEnabled !== false) {
              profile.genealogyEnabled = false;
              updated = true;
            }
            if (profile.businessCycleEnabled !== false) {
              profile.businessCycleEnabled = false;
              updated = true;
            }

            const superAdminPermissions = {
              manageMembers: true,
              manageProducts: true,
              manageInventory: true,
              manageWallets: true,
              approveCashOut: true,
              manageCommissions: true,
              viewAnalytics: true,
              systemSettings: true,
              manageRoles: true,
              viewAuditLogs: true
            };

            if (!profile.permissions || JSON.stringify(profile.permissions) !== JSON.stringify(superAdminPermissions)) {
              profile.permissions = superAdminPermissions;
              updated = true;
            }

            if (updated) {
              console.log("Enforcing strict Super Admin enterprise properties in Firestore...");
              await updateDoc(userDocRef, {
                role: 'Super Admin',
                accountType: 'System',
                packageLevel: 'None',
                commissionEligible: false,
                walletEnabled: false,
                genealogyEnabled: false,
                businessCycleEnabled: false,
                permissions: superAdminPermissions
              });
            }
          }

          setUserProfile(profile);
          
          // Log successful login audit
          await createAuditLog(
            profile.uid,
            profile.email,
            'USER_LOGIN',
            `User logged in successfully under role: ${profile.role}`
          );

          // Redirect authenticated users based on Firestore role as the source of truth
          if (['landing', 'login', 'register', 'forgot-password'].includes(currentPage)) {
            if (profile.role === 'Super Admin') {
              setCurrentPage('super-admin-dashboard');
            } else if (profile.role === 'Admin') {
              setCurrentPage('admin-dashboard');
            } else if (profile.role === 'Affiliate') {
              setCurrentPage('affiliate-dashboard');
            } else {
              setCurrentPage('customer-dashboard');
            }
          }
        } catch (e) {
          console.error("Error retrieving user profile on auth state change:", e);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        if (['dashboard', 'profile', 'admin-dashboard', 'super-admin-dashboard', 'user-management', 'role-management', 'affiliate-dashboard', 'customer-dashboard', 'package-selection', 'cash-in'].includes(currentPage)) {
          setCurrentPage('landing');
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [currentPage]);

  const handleLoginSuccess = async (authenticatedUser: any, profile: UserProfile) => {
    setUser(authenticatedUser);
    
    // Refresh/fetch the latest user profile from Firestore to be 100% sure the role is fresh
    let freshProfile = profile;
    try {
      const userDocRef = doc(db, 'users', authenticatedUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        freshProfile = userDocSnap.data() as UserProfile;
        
        // Strict Super Admin promotion and configuration check
        if (freshProfile.email === 'nifled.kenjaktrading@gmail.com' || freshProfile.role === 'Super Admin') {
          let updated = false;
          if (freshProfile.role !== 'Super Admin') { freshProfile.role = 'Super Admin'; updated = true; }
          if (freshProfile.accountType !== 'System') { freshProfile.accountType = 'System'; updated = true; }
          if (freshProfile.packageLevel !== 'None') { freshProfile.packageLevel = 'None'; updated = true; }
          if (freshProfile.commissionEligible !== false) { freshProfile.commissionEligible = false; updated = true; }
          if (freshProfile.walletEnabled !== false) { freshProfile.walletEnabled = false; updated = true; }
          if (freshProfile.genealogyEnabled !== false) { freshProfile.genealogyEnabled = false; updated = true; }
          if (freshProfile.businessCycleEnabled !== false) { freshProfile.businessCycleEnabled = false; updated = true; }
          
          const superAdminPermissions = {
            manageMembers: true,
            manageProducts: true,
            manageInventory: true,
            manageWallets: true,
            approveCashOut: true,
            manageCommissions: true,
            viewAnalytics: true,
            systemSettings: true,
            manageRoles: true,
            viewAuditLogs: true
          };

          if (!freshProfile.permissions || JSON.stringify(freshProfile.permissions) !== JSON.stringify(superAdminPermissions)) {
            freshProfile.permissions = superAdminPermissions;
            updated = true;
          }

          if (updated) {
            await updateDoc(userDocRef, {
              role: 'Super Admin',
              accountType: 'System',
              packageLevel: 'None',
              commissionEligible: false,
              walletEnabled: false,
              genealogyEnabled: false,
              businessCycleEnabled: false,
              permissions: superAdminPermissions
            });
          }
        }
      }
    } catch (e) {
      console.error("Error refreshing role on login success:", e);
    }
    
    setUserProfile(freshProfile);
    if (freshProfile.role === 'Super Admin') {
      setCurrentPage('super-admin-dashboard');
    } else if (freshProfile.role === 'Admin') {
      setCurrentPage('admin-dashboard');
    } else if (freshProfile.role === 'Affiliate') {
      setCurrentPage('affiliate-dashboard');
    } else {
      setCurrentPage('customer-dashboard');
    }
  };

  const handleRegisterSuccess = async (registeredUser: any, profile: UserProfile) => {
    setUser(registeredUser);
    
    // Refresh/fetch the latest user profile from Firestore to be 100% sure the role is fresh
    let freshProfile = profile;
    try {
      const userDocRef = doc(db, 'users', registeredUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        freshProfile = userDocSnap.data() as UserProfile;
      }
    } catch (e) {
      console.error("Error refreshing role on register success:", e);
    }
    
    setUserProfile(freshProfile);
    if (freshProfile.role === 'Super Admin') {
      setCurrentPage('super-admin-dashboard');
    } else if (freshProfile.role === 'Admin') {
      setCurrentPage('admin-dashboard');
    } else if (freshProfile.role === 'Affiliate') {
      setCurrentPage('affiliate-dashboard');
    } else {
      setCurrentPage('customer-dashboard');
    }
  };

  const handleLogout = async () => {
    if (userProfile) {
      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'USER_LOGOUT',
        `User logged out successfully`
      );
    }
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setCurrentPage('landing');
  };

  const isAuthorizedForRegistration = (profile: UserProfile) => {
    const allowedRoles = ['Super Admin', 'Admin', 'City Distributor', 'Regional Distributor'];
    const allowedPackages = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return allowedRoles.includes(profile.role) || allowedPackages.includes(profile.packageLevel);
  };

  // Safe navigation with Role-Based Access Control (RBAC) guards
  const handleNavigate = (targetPage: string) => {
    let route = targetPage as PageRoute;

    // Resolve general dashboard request to specific dashboards based on roles
    if (route === 'dashboard') {
      if (userProfile) {
        if (userProfile.role === 'Super Admin') {
          route = 'super-admin-dashboard';
        } else if (userProfile.role === 'Admin') {
          route = 'admin-dashboard';
        } else if (userProfile.role === 'Affiliate') {
          route = 'affiliate-dashboard';
        } else {
          route = 'customer-dashboard';
        }
      }
    }

    // Guest limits
    if (!user && ['dashboard', 'profile', 'admin-dashboard', 'super-admin-dashboard', 'user-management', 'role-management', 'member-registration', 'affiliate-dashboard', 'customer-dashboard', 'package-selection', 'cash-in'].includes(route)) {
      setCurrentPage('login');
      return;
    }

    // Authenticated user limits
    if (user && ['login', 'register', 'forgot-password'].includes(route)) {
      if (userProfile) {
        if (userProfile.role === 'Super Admin') setCurrentPage('super-admin-dashboard');
        else if (userProfile.role === 'Admin') setCurrentPage('admin-dashboard');
        else if (userProfile.role === 'Affiliate') setCurrentPage('affiliate-dashboard');
        else setCurrentPage('customer-dashboard');
      } else {
        setCurrentPage('dashboard');
      }
      return;
    }

    // Member registration guard
    if (route === 'member-registration') {
      if (!userProfile || !isAuthorizedForRegistration(userProfile)) {
        setCurrentPage('access-denied');
        return;
      }
    }

    // Administrative guards
    if (['admin-dashboard', 'super-admin-dashboard', 'user-management', 'role-management'].includes(route)) {
      if (!userProfile) {
        setCurrentPage('access-denied');
        return;
      }
      if (userProfile.role === 'Super Admin') {
        // Super Admin has access
      } else if (userProfile.role === 'Admin') {
        // Standard admin checks
        if (route === 'role-management' && !(userProfile.permissions?.manageRoles)) {
          setCurrentPage('access-denied');
          return;
        }
        if (route === 'super-admin-dashboard') {
          setCurrentPage('access-denied');
          return;
        }
      } else {
        setCurrentPage('access-denied');
        return;
      }
    }

    setCurrentPage(route);
  };

  // Update profile details locally
  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
  };

  if (authLoading) {
    return (
      <div className="bg-black min-h-screen text-white flex flex-col items-center justify-center selection:bg-gold selection:text-black">
        <div className="relative mb-8 animate-pulse">
          <ChosenLogo size="lg" />
        </div>
        <div className="text-center">
          <div className="font-black tracking-[0.25em] text-xl uppercase gold-text">
            I AM CHOSEN
          </div>
          <div className="text-[10px] tracking-[0.45em] text-zinc-500 font-medium uppercase mt-2">
            INTERNATIONAL
          </div>
        </div>
        <div className="mt-8 flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 px-4 py-2 rounded-full">
          <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono">
            Initializing Premium Ecosystem...
          </span>
        </div>
      </div>
    );
  }

  // Route switcher
  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />;
      case 'login':
        return <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />;
      case 'register':
        return <RegisterPage onNavigate={handleNavigate} onRegisterSuccess={handleRegisterSuccess} />;
      case 'forgot-password':
        return <ForgotPasswordPage onNavigate={handleNavigate} />;
      case 'business-opportunity':
        return <BusinessOpportunityPage onNavigate={handleNavigate} />;
      case 'affiliate-dashboard':
        return userProfile && userProfile.role === 'Affiliate' ? (
          <AffiliateDashboard userProfile={userProfile} onLogout={handleLogout} onNavigate={handleNavigate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'customer-dashboard':
        return userProfile && userProfile.role === 'Customer' ? (
          <CustomerDashboard userProfile={userProfile} onLogout={handleLogout} onNavigate={handleNavigate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'package-selection':
        return userProfile ? (
          <PackageSelectionPage onNavigate={handleNavigate} userProfile={userProfile} onProfileUpdate={handleProfileUpdate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'cash-in':
        return userProfile ? (
          <CashInPage onNavigate={handleNavigate} userProfile={userProfile} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'p2p-transfer':
        return userProfile ? (
          <P2PTransferPage onNavigate={handleNavigate} userProfile={userProfile} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'admin-p2p-transfers':
        return userProfile && (userProfile.role === 'Super Admin' || userProfile.role === 'Admin') ? (
          <AdminP2PTransfersPage onNavigate={handleNavigate} currentUserProfile={userProfile} />
        ) : (
          <AccessDeniedPage onNavigate={handleNavigate} />
        );
      case 'dashboard':
        return userProfile ? (
          userProfile.role === 'Super Admin' ? (
            <SuperAdminDashboard onNavigate={handleNavigate} currentUserProfile={userProfile} onLogout={handleLogout} />
          ) : userProfile.role === 'Admin' ? (
            <AdminDashboard onNavigate={handleNavigate} currentUserProfile={userProfile} />
          ) : userProfile.role === 'Affiliate' ? (
            <AffiliateDashboard userProfile={userProfile} onLogout={handleLogout} onNavigate={handleNavigate} />
          ) : (
            <CustomerDashboard userProfile={userProfile} onLogout={handleLogout} onNavigate={handleNavigate} />
          )
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'profile':
        return userProfile ? (
          <ProfilePage userProfile={userProfile} onNavigate={handleNavigate} onProfileUpdate={handleProfileUpdate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'admin-dashboard':
        return userProfile ? (
          userProfile.role === 'Super Admin' ? (
            <SuperAdminDashboard onNavigate={handleNavigate} currentUserProfile={userProfile} onLogout={handleLogout} />
          ) : (
            <AdminDashboard onNavigate={handleNavigate} currentUserProfile={userProfile} />
          )
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'super-admin-dashboard':
        return userProfile ? (
          userProfile.role === 'Super Admin' ? (
            <SuperAdminDashboard onNavigate={handleNavigate} currentUserProfile={userProfile} onLogout={handleLogout} />
          ) : (
            <AccessDeniedPage onNavigate={handleNavigate} />
          )
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'user-management':
        return userProfile ? (
          <UserManagementPage onNavigate={handleNavigate} currentUserProfile={userProfile} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'role-management':
        return userProfile ? (
          <RoleManagementPage onNavigate={handleNavigate} currentUserProfile={userProfile} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'member-registration':
        return userProfile && isAuthorizedForRegistration(userProfile) ? (
          <MemberRegistrationPage currentUserProfile={userProfile} onNavigate={handleNavigate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'e-commerce':
        return userProfile ? (
          <ECommercePage userProfile={userProfile} onLogout={handleLogout} onNavigate={handleNavigate} />
        ) : (
          <LoginPage onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />
        );
      case 'access-denied':
        return <AccessDeniedPage onNavigate={handleNavigate} />;
      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  const isAffiliate = userProfile?.accountType === "Affiliate";
  const unauthenticatedPages = ['landing', 'login', 'register', 'forgot-password', 'business-opportunity', 'access-denied'];
  const isAuthPage = !unauthenticatedPages.includes(currentPage);

  const renderedContent = renderPage();

  return (
    <CCSettingsProvider>
      {isAffiliate && isAuthPage ? (
        <AffiliateAppShell
          userProfile={userProfile}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        >
          {renderedContent}
        </AffiliateAppShell>
      ) : (
        renderedContent
      )}
      <GlobalModal />
    </CCSettingsProvider>
  );
}

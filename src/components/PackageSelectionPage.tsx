import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Crown, 
  Check, 
  Sparkles, 
  ShieldAlert, 
  FileText, 
  Clock, 
  DollarSign, 
  Activity, 
  Award, 
  UserCheck,
  Wallet as WalletIcon,
  TrendingUp,
  Network
} from 'lucide-react';
import { db, createAuditLog, auth } from '../firebase';
import { doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { UserProfile, Wallet } from '../types';
import ChosenLogo from './ChosenLogo';

interface PackageSelectionPageProps {
  onNavigate: (page: string) => void;
  userProfile: UserProfile | null;
  onProfileUpdate?: (profile: UserProfile) => void;
}

interface SmartCustomerPackage {
  name: string;
  cc: number;
  php: number;
  description: string;
  benefits: string[];
}

interface AffiliatePackage {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  cc: number;
  php: number;
  cap: number;
  description: string;
  benefits: string[];
}

export default function PackageSelectionPage({ onNavigate, userProfile, onProfileUpdate }: PackageSelectionPageProps) {
  const [typeParam, setTypeParam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ path: string; packageName: string; amountPHP: number } | null>(null);
  const [selectedPackageToConfirm, setSelectedPackageToConfirm] = useState<SmartCustomerPackage | AffiliatePackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User wallet state
  const [userWallet, setUserWallet] = useState<Wallet | null>(null);
  const [fetchingWallet, setFetchingWallet] = useState(true);

  const getPackageStyle = (name: string) => {
    switch (name) {
      case 'Bronze':
        return {
          accentText: 'text-amber-600',
          badgeBg: 'bg-amber-600/10 text-amber-500 border-amber-600/20',
          btnGradient: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black shadow-[0_4px_12px_rgba(245,158,11,0.15)] focus:ring-amber-500/30',
          accentBorder: 'hover:border-amber-600/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.08)]',
          watermarkIcon: WalletIcon,
          highlighted: false,
        };
      case 'Silver':
        return {
          accentText: 'text-zinc-400',
          badgeBg: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
          btnGradient: 'from-zinc-500 to-slate-600 hover:from-zinc-400 hover:to-slate-500 text-white shadow-[0_4px_12px_rgba(156,163,175,0.15)] focus:ring-zinc-500/30',
          accentBorder: 'hover:border-zinc-500/40 hover:shadow-[0_0_25px_rgba(156,163,175,0.08)]',
          watermarkIcon: TrendingUp,
          highlighted: false,
        };
      case 'Gold':
        return {
          accentText: 'text-[#D4AF37]',
          badgeBg: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30',
          btnGradient: 'from-amber-500 to-[#D4AF37] hover:from-amber-400 hover:to-[#E5C158] text-black shadow-[0_4px_15px_rgba(212,175,55,0.25)] focus:ring-amber-500/30',
          accentBorder: 'border-[#D4AF37]/30 hover:border-[#D4AF37]/60 hover:shadow-[0_0_35px_rgba(212,175,55,0.15)]',
          watermarkIcon: Network,
          highlighted: true,
        };
      case 'Platinum':
        return {
          accentText: 'text-sky-400',
          badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
          btnGradient: 'from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-[0_4px_12px_rgba(56,189,248,0.15)] focus:ring-sky-500/30',
          accentBorder: 'hover:border-sky-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)]',
          watermarkIcon: Award,
          highlighted: false,
        };
      case 'Diamond':
        return {
          accentText: 'text-cyan-400',
          badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          btnGradient: 'from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-black shadow-[0_4px_12px_rgba(6,182,212,0.25)] focus:ring-cyan-500/30',
          accentBorder: 'hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.08)]',
          watermarkIcon: Crown,
          highlighted: false,
        };
      default:
        return {
          accentText: 'text-zinc-300',
          badgeBg: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
          btnGradient: 'from-zinc-500 to-slate-600 hover:from-zinc-400 hover:to-slate-500 text-white shadow-[0_4px_12px_rgba(156,163,175,0.15)] focus:ring-zinc-500/30',
          accentBorder: 'hover:border-zinc-500/40 hover:shadow-[0_0_25px_rgba(156,163,175,0.08)]',
          watermarkIcon: WalletIcon,
          highlighted: false,
        };
    }
  };

  // Parse type parameter from URL or sessionStorage fallback, and fetch user wallet
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let type = searchParams.get('type');
    
    if (!type) {
      type = sessionStorage.getItem('selectedPath');
    }
    
    setTypeParam(type);

    const fetchWallet = async () => {
      const uid = userProfile?.uid || auth.currentUser?.uid;
      if (!uid) return;
      try {
        const walletDocSnap = await getDoc(doc(db, 'wallets', uid));
        if (walletDocSnap.exists()) {
          setUserWallet(walletDocSnap.data() as Wallet);
        }
      } catch (err) {
        console.error("Error fetching wallet in PackageSelectionPage:", err);
      } finally {
        setFetchingWallet(false);
      }
    };

    fetchWallet();
  }, [userProfile]);

  if (!userProfile) {
    return (
      <div className="bg-black min-h-screen text-white flex flex-col items-center justify-center p-6">
        <p className="text-zinc-400 mb-4">Please log in to choose a package.</p>
        <button onClick={() => onNavigate('login')} className="px-5 py-2.5 bg-gold text-black font-bold rounded-xl">
          Go to Login
        </button>
      </div>
    );
  }

  // 1 CC = 70 PHP for Affiliate Business package conversions as explicitly instructed
  const affiliatePackages: AffiliatePackage[] = [
    { 
      name: 'Bronze', 
      cc: 50, 
      php: 3500, 
      cap: 125, 
      description: 'Starter membership for personal wellness advocates.',
      benefits: [
        'Exclusive Premium Products',
        'Retail Profit up to 50%',
        'Commission Income',
        'Ecommerce Platform',
        'Supportive Community'
      ]
    },
    { 
      name: 'Silver', 
      cc: 350, 
      php: 24500, 
      cap: 875, 
      description: 'Professional tier with upgraded capacity.',
      benefits: [
        'Exclusive Premium Products',
        'Retail Profit up to 50%',
        'Commission Income',
        'Ecommerce Platform',
        'Supportive Community',
        'Business Analytics',
        'Business Growth Opportunities'
      ]
    },
    { 
      name: 'Gold', 
      cc: 1500, 
      php: 105000, 
      cap: 3750, 
      description: 'Leader tier with high volume bonus multipliers.',
      benefits: [
        'Exclusive Premium Products',
        'Retail Profit up to 50%',
        'Commission Income',
        'Leadership Rewards',
        'Ecommerce Platform',
        'AI Business Coach',
        'Business Analytics',
        'Business Growth Opportunities',
        'Supportive Community'
      ]
    },
    { 
      name: 'Platinum', 
      cc: 3000, 
      php: 210000, 
      cap: 7500, 
      description: 'Executive level with expanded reward pools.',
      benefits: [
        'Exclusive Premium Products',
        'Retail Profit up to 50%',
        'Commission Income',
        'Leadership Rewards',
        'Ecommerce Platform',
        'AI Business Coach',
        'Business Analytics',
        'Marketing Support Allocation',
        'Business Growth Opportunities',
        'Supportive Community'
      ]
    },
    { 
      name: 'Diamond', 
      cc: 5000, 
      php: 350000, 
      cap: 12500, 
      description: 'Ultimate founder tier with maximum privileges.',
      benefits: [
        'Exclusive Premium Products',
        'Retail Profit up to 50%',
        'Commission Income',
        'Leadership Rewards',
        'Ecommerce Platform',
        'AI Business Coach',
        'Business Analytics',
        'Marketing Support Allocation',
        'Business Growth Opportunities',
        'Supportive Community',
        'Executive Global Pool Allocation'
      ]
    }
  ];

  const smartCustomerPackages: SmartCustomerPackage[] = [
    {
      name: 'Wellness Starter Kit',
      cc: 20,
      php: 1400,
      description: 'Ideal for individuals starting their premium wellness journey.',
      benefits: [
        'Exclusive Member Discounts (up to 25% off)',
        'Access to Premium Wellness Products',
        'Direct Ordering via Personal Account',
        'Fast delivery and receipt updates'
      ]
    },
    {
      name: 'Family Health Essentials',
      cc: 60,
      php: 4200,
      description: 'Best for families seeking consistent nutrition and lifestyle support.',
      benefits: [
        'Exclusive Member Discounts (up to 30% off)',
        'Access to Premium Wellness Products',
        'Access to Seasonal Promotions & Flash Deals',
        'Priority Customer Support',
        'Ecosystem Community Group access'
      ]
    },
    {
      name: 'Ultimate Longevity System',
      cc: 150,
      php: 10500,
      description: 'Our most complete bundle of specialized concentrates and extracts.',
      benefits: [
        'Maximum Member Discounts (up to 35% off)',
        'Access to Premium Wellness Products',
        'Seasonal Promotions & Priority Flash Deals',
        'VIP Direct Shipping perks',
        'Ecosystem Community Group access',
        'Free virtual product coaching consultations'
      ]
    }
  ];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

  const handleCreateRequest = async () => {
    if (!selectedPackageToConfirm) return;
    setLoading(true);
    setError(null);

    const isAffiliate = typeParam === 'affiliate-business';
    const requestId = `REQ-${isAffiliate ? 'AFF' : 'CUST'}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const targetUid = userProfile.uid || auth.currentUser?.uid || '';
    const targetEmail = userProfile.email || auth.currentUser?.email || '';

    try {
      if (isAffiliate) {
        const pkg = selectedPackageToConfirm as AffiliatePackage;
        const colPath = 'affiliate_activation_requests';
        try {
          await setDoc(doc(db, colPath, requestId), {
            uid: targetUid,
            memberId: userProfile.memberId || '',
            fullName: userProfile.fullName || '',
            email: targetEmail,
            selectedPath: 'affiliate-business',
            selectedPackage: pkg.name,
            packageValueCC: pkg.cc,
            amountPHP: pkg.php,
            earningsCapCC: pkg.cap,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reviewedBy: null,
            approvedAt: null,
            rejectedReason: null
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, colPath);
        }

        await createAuditLog(
          targetUid,
          targetEmail,
          'AFFILIATE_ACTIVATION_REQUEST_SUBMITTED',
          `Submitted activation request for ${pkg.name} package worth ₱${pkg.php.toLocaleString()}`
        );

        setSuccessData({
          path: 'Affiliate Business',
          packageName: pkg.name,
          amountPHP: pkg.php
        });
      } else {
        const pkg = selectedPackageToConfirm as SmartCustomerPackage;
        const colPath = 'customer_package_requests';
        try {
          await setDoc(doc(db, colPath, requestId), {
            uid: targetUid,
            memberId: userProfile.memberId || '',
            fullName: userProfile.fullName || '',
            email: targetEmail,
            selectedPath: 'smart-customer',
            selectedPackage: pkg.name,
            amountCC: pkg.cc,
            amountPHP: pkg.php,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, colPath);
        }

        await createAuditLog(
          targetUid,
          targetEmail,
          'CUSTOMER_PACKAGE_REQUEST_SUBMITTED',
          `Submitted package request for ${pkg.name} worth ₱${pkg.php.toLocaleString()}`
        );

        setSuccessData({
          path: 'Smart Customer',
          packageName: pkg.name,
          amountPHP: pkg.php
        });
      }
      setSelectedPackageToConfirm(null);
    } catch (e: any) {
      console.error("Error creating package request:", e);
      let errMsg = "Failed to submit request. Please try again.";
      try {
        const parsed = JSON.parse(e.message);
        if (parsed && parsed.error) {
          errMsg = `Submission rejected: ${parsed.error}`;
        }
      } catch (_) {
        errMsg = e.message || errMsg;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAffiliatePackage = async (pkg: AffiliatePackage) => {
    setLoading(true);
    setError(null);

    const targetUid = userProfile?.uid || auth.currentUser?.uid || '';
    const targetEmail = userProfile?.email || auth.currentUser?.email || '';

    if (!targetUid) {
      setError("No authenticated user profile found.");
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch fresh wallet document from Firestore (source of truth)
      const walletDocRef = doc(db, 'wallets', targetUid);
      const walletDocSnap = await getDoc(walletDocRef);
      if (!walletDocSnap.exists()) {
        throw new Error("Wallet record not found on file.");
      }
      
      const walletData = walletDocSnap.data() as Wallet;
      const currentBalance = walletData.chosenWalletBalance || 0;

      // 2. Compare with selected package value
      if (currentBalance < pkg.cc) {
        // INSUFFICIENT BALANCE -> REDIRECT TO CASH-IN with query parameters
        const queryParams = `?purpose=affiliate-upgrade&package=${encodeURIComponent(pkg.name)}&requiredCC=${pkg.cc}`;
        window.history.pushState({}, '', `/cash-in${queryParams}`);
        onNavigate('cash-in');
        return;
      }

      // 3. SUFFICIENT BALANCE -> EXECUTE ATOMIC TRANSACTION
      const userRef = doc(db, 'users', targetUid);
      const businessCycleRef = doc(db, 'business_cycles', targetUid);
      const earningsCapCC = pkg.cc * 2.5;

      await runTransaction(db, async (transaction) => {
        // Re-read wallet inside transaction to prevent double spend
        const walletSnapTrans = await transaction.get(walletDocRef);
        if (!walletSnapTrans.exists()) {
          throw new Error("Wallet record does not exist.");
        }
        
        const walletTransData = walletSnapTrans.data() as Wallet;
        const transBalance = walletTransData.chosenWalletBalance || 0;

        if (transBalance < pkg.cc) {
          throw new Error("Insufficient Chosen Credits. Please cash-in to continue.");
        }

        // Action 1: Deduct packageValueCC from chosenWalletBalance
        transaction.update(walletDocRef, {
          chosenWalletBalance: transBalance - pkg.cc,
          updatedAt: new Date().toISOString()
        });

        // Action 2 & 3 & 4 & 5 & 6 & 7: Upgrade user role, set accountType, packageLevel, commissionEligible, genealogyEnabled, businessCycleEnabled
        const updatedProfileFields = {
          role: 'Affiliate' as const,
          accountType: 'Affiliate' as const,
          packageLevel: pkg.name,
          commissionEligible: true,
          genealogyEnabled: true,
          businessCycleEnabled: true,
          updatedAt: new Date().toISOString()
        };
        transaction.update(userRef, updatedProfileFields);

        // Action 8: Create business_cycles/{uid}
        transaction.set(businessCycleRef, {
          uid: targetUid,
          packageLevel: pkg.name,
          packageValueCC: pkg.cc,
          earningsCapCC: earningsCapCC,
          currentQualifiedEarningsCC: 0,
          remainingCapacityCC: earningsCapCC,
          status: 'Active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Action 9: Create wallet_transactions record
        const txId = `TX-DEBIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        transaction.set(doc(db, 'wallet_transactions', txId), {
          id: txId,
          uid: targetUid,
          amount: pkg.cc,
          type: 'DEBIT',
          walletType: 'Chosen',
          description: `Affiliate Package Activation - ${pkg.name} Package`,
          status: 'Completed',
          createdAt: new Date().toISOString()
        });

        // Action 10: Create audit_logs record
        const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        transaction.set(doc(db, 'audit_logs', logId), {
          id: logId,
          actorUid: targetUid,
          actorEmail: targetEmail,
          action: 'AFFILIATE_UPGRADE_PURCHASE',
          details: `Upgraded account immediately by purchasing ${pkg.name} package for ${pkg.cc} CC.`,
          timestamp: new Date().toISOString()
        });
      });

      // Update parent component profile state locally so other routes can use it immediately!
      if (onProfileUpdate && userProfile) {
        onProfileUpdate({
          ...userProfile,
          role: 'Affiliate',
          accountType: 'Affiliate',
          packageLevel: pkg.name,
          commissionEligible: true,
          genealogyEnabled: true,
          businessCycleEnabled: true,
        });
      }

      // Action 11: Show success message
      setSuccessData({
        path: 'Affiliate Business',
        packageName: pkg.name,
        amountPHP: pkg.php
      });

    } catch (err: any) {
      console.error("Error in direct purchase flow:", err);
      setError(err.message || "Failed to process package purchase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('selectedPath');
    onNavigate('customer-dashboard');
  };

  // If path is unknown or query string is missing/corrupt
  if (typeParam !== 'smart-customer' && typeParam !== 'affiliate-business') {
    return (
      <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
        {/* Top Header */}
        <div className="p-6 max-w-7xl mx-auto w-full">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>
        </div>

        {/* Main error layout */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
            Selection Required
          </h1>
          <p className="text-zinc-400 text-sm max-w-md leading-relaxed mb-8">
            Please choose your path first before proceeding to package selection.
          </p>

          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleBack}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg cursor-pointer"
          >
            Back to Dashboard
          </motion.button>
        </div>

        <div className="p-6 text-center text-[10px] text-zinc-600 font-mono tracking-wider">
          IAM CHOSEN INTERNATIONAL • PORTAL V1.5.8
        </div>
      </div>
    );
  }

  const isAffiliateFlow = typeParam === 'affiliate-business';

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
      
      {/* HEADER SECTION */}
      <div className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-zinc-900/60">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Wallet Balance:</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-900 text-gold border border-gold/20 font-mono">
            {fetchingWallet ? '...' : `${userWallet?.chosenWalletBalance?.toFixed(2) || '0.00'} CC`}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Role:</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-800 uppercase tracking-wider">
            {userProfile.role}
          </span>
        </div>
      </div>

      {/* MAIN BODY FLOW */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        
        <AnimatePresence mode="wait">
          {successData ? (
            /* SUCCESS FEEDBACK LAYOUT */
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto bg-[#0B0D12]/90 border border-zinc-800/80 rounded-[28px] p-8 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-amber-500" />
              
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 mx-auto">
                <UserCheck className="w-8 h-8 text-emerald-400 animate-bounce" />
              </div>

              {successData.path === 'Affiliate Business' ? (
                <>
                  <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-[0.25em] block mb-2">
                    Upgrade Successful
                  </span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                    Congratulations! You are now an IAM CHOSEN Affiliate.
                  </h2>
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto mb-8 font-medium">
                    Your <strong className="text-white">{successData.packageName}</strong> package has been activated successfully.
                  </p>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-[0.25em] block mb-2">
                    Request Registered
                  </span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                    Onboarding Request Submitted!
                  </h2>
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto mb-8 font-medium">
                    Your request has been filed successfully under collection <strong className="text-zinc-200">customer_package_requests</strong>. An Admin or Super Admin will review your selection shortly.
                  </p>
                </>
              )}

              {/* Package Details */}
              <div className="bg-zinc-950/60 rounded-2xl border border-zinc-900/80 p-5 mb-8 text-left space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-mono">SELECTED PATH</span>
                  <span className="font-extrabold text-white uppercase">{successData.path}</span>
                </div>
                <div className="h-px bg-zinc-900" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-mono">PACKAGE</span>
                  <span className="font-extrabold text-white uppercase">{successData.packageName}</span>
                </div>
                <div className="h-px bg-zinc-900" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-mono">AMOUNT (PHP)</span>
                  <span className="font-extrabold text-gold text-sm">₱{successData.amountPHP.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (successData.path === 'Affiliate Business') {
                      onNavigate('affiliate-dashboard');
                    } else {
                      handleBack();
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 text-black font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg font-extrabold"
                >
                  {successData.path === 'Affiliate Business' ? 'Go to Affiliate Dashboard' : 'Return to Dashboard'}
                </button>
              </div>
            </motion.div>
          ) : (
            /* DYNAMIC FORM AND SELECTION FLOW */
            <motion.div
              key="selection-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* HEADER INTRO */}
              <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
                <ChosenLogo size="md" className="mb-4" />
                
                {isAffiliateFlow ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-[#D4AF37] border border-[#D4AF37]/20 mb-4 uppercase tracking-widest font-mono">
                      <Crown className="w-3 h-3" /> Affiliate Track
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                      Affiliate Business <span className="gold-text">Packages</span>
                    </h1>
                    <p className="text-zinc-400 text-xs sm:text-sm mt-3 max-w-2xl font-semibold leading-relaxed">
                      Choose your business package and begin your IAM CHOSEN Affiliate journey.
                    </p>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 mb-4 uppercase tracking-widest font-mono">
                      <ShoppingBag className="w-3 h-3" /> Smart Customer Track
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                      Smart Customer <span className="text-emerald-400">Packages</span>
                    </h1>
                    <p className="text-zinc-400 text-xs sm:text-sm mt-3 max-w-2xl font-semibold leading-relaxed">
                      Choose a customer package and enjoy exclusive discounts, rebates, and premium wellness benefits.
                    </p>
                  </>
                )}
              </div>

              {/* ERROR ALERT DISPLAY */}
              {error && (
                <div className="max-w-2xl mx-auto bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold text-center">
                  {error}
                </div>
              )}

              {/* GRID SELECTIONS */}
              {isAffiliateFlow ? (
                /* AFFILIATE PACKAGE CARD GRID */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  {affiliatePackages.map((pkg) => {
                    const style = getPackageStyle(pkg.name);
                    const IconComponent = style.watermarkIcon;
                    return (
                      <motion.div
                        key={pkg.name}
                        whileHover={{ y: -4 }}
                        className={`relative rounded-[24px] bg-gradient-to-b from-[#12151D] to-[#0B0D12] p-6 flex flex-col justify-between h-full transition-all duration-250 ease-out select-none group overflow-hidden
                          ${style.highlighted 
                            ? 'border-2 border-[#D4AF37]/50 shadow-[0_8px_30px_rgba(212,175,55,0.15)] lg:scale-[1.03] lg:z-10 hover:border-[#D4AF37]/80 hover:shadow-[0_15px_40px_rgba(212,175,55,0.22)]' 
                            : 'border border-[rgba(0,255,255,0.10)] shadow-[0_4px_20px_rgba(0,255,255,0.03)] hover:border-[rgba(0,255,255,0.30)] hover:shadow-[0_12px_30px_rgba(0,255,255,0.08)]'
                          }`}
                      >
                        {/* Gold Badge for Gold tier / recommended */}
                        {style.highlighted && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 via-yellow-400 to-[#D4AF37] text-black text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest shadow-[0_4px_12px_rgba(212,175,55,0.4)] animate-pulse z-20 whitespace-nowrap">
                            🔥 MOST POPULAR
                          </div>
                        )}

                        {/* Premium watermark illustration in the top-right corner */}
                        <IconComponent className="absolute top-4 right-4 text-cyan-400/5 w-24 h-24 pointer-events-none transform translate-x-2 -translate-y-2 group-hover:scale-110 group-hover:text-cyan-400/10 transition-all duration-500" />

                        <div className="flex-1 flex flex-col">
                          {/* Package Badge */}
                          <div className="flex items-center justify-between mb-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-mono border ${style.badgeBg}`}>
                              {pkg.name} Tier
                            </span>
                          </div>

                          {/* Price Tag with large typography */}
                          <div className="mb-5 text-left">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-4xl font-extrabold text-white tracking-tight">{pkg.cc}</span>
                              <span className={`text-sm font-black uppercase tracking-wider ${style.accentText}`}>CC</span>
                            </div>
                            <div className="text-xs font-semibold text-zinc-500 tracking-tight mt-1">
                              ≈ ₱{pkg.php.toLocaleString()}
                            </div>
                          </div>

                          <p className="text-xs text-zinc-400 leading-relaxed mb-6 text-left">{pkg.description}</p>

                          {/* Business Benefits - premium checklist */}
                          <div className="border-t border-zinc-900/80 pt-5 mb-6 text-left flex-1 flex flex-col">
                            <span className="block uppercase font-mono text-[9px] text-zinc-500 tracking-wider mb-3">Core Membership Privileges</span>
                            <div className="space-y-3 flex-1">
                              {pkg.benefits.map((benefit, bIdx) => (
                                <div key={bIdx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 bg-emerald-500/10 p-0.5 rounded-full" />
                                  <span className="leading-snug">{benefit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Business Cycle & Button Actions */}
                        <div className="mt-auto space-y-4">
                          <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl py-3 px-4 text-center">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-mono tracking-wider text-[10px] uppercase">Earnings Limit (2.5x)</span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-zinc-900 border border-zinc-800 ${style.accentText}`}>
                                Active Cap
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1 mt-1.5 justify-start">
                              <span className="text-[10px] text-zinc-400 font-medium mr-1">Maximum Earnings:</span>
                              <span className="text-sm font-black text-white">{pkg.cap} CC</span>
                            </div>
                          </div>

                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelectAffiliatePackage(pkg)}
                            disabled={loading}
                            className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-widest cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black bg-gradient-to-r ${style.btnGradient} disabled:opacity-50`}
                          >
                            {loading ? 'Processing...' : 'Choose Package'}
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* SMART CUSTOMER PACKAGE CARD GRID */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {smartCustomerPackages.map((pkg) => (
                    <motion.div
                      key={pkg.name}
                      whileHover={{ y: -3 }}
                      className="bg-[#0B0D12]/90 border border-emerald-500/10 hover:border-emerald-500/40 rounded-[22px] p-6 hover:shadow-[0_0_25px_rgba(16,185,129,0.08)] transition-all duration-250 flex flex-col justify-between text-center relative overflow-hidden group"
                    >
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10" />

                      <div>
                        <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-black mb-1 font-mono">Customer Tier</span>
                        <h3 className="text-xl font-black text-white uppercase group-hover:text-emerald-400 transition-colors">{pkg.name}</h3>

                        {/* CC and Price Tag */}
                        <div className="bg-zinc-950/60 py-3.5 rounded-xl border border-zinc-900 my-4">
                          <span className="block text-base text-emerald-400 font-black">{pkg.cc} CC</span>
                          <span className="block text-xs text-zinc-400 font-mono mt-0.5">₱{pkg.php.toLocaleString()}</span>
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed mb-6">{pkg.description}</p>

                        <div className="border-t border-zinc-900/80 pt-4 mb-6 text-left">
                          <span className="block uppercase font-mono text-[9px] text-zinc-500 mb-2.5">Key Benefits</span>
                          <div className="space-y-2.5">
                            {pkg.benefits.map((benefit, bIdx) => (
                              <div key={bIdx} className="flex items-start gap-2 text-xs text-zinc-300">
                                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-snug">{benefit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedPackageToConfirm(pkg)}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl cursor-pointer transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)] border border-emerald-400/20"
                        >
                          Select Package
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION DIALOG / MODAL */}
      <AnimatePresence>
        {selectedPackageToConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B0D12] border border-zinc-800/95 rounded-[24px] max-w-md w-full overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 relative"
            >
              <div className="flex items-center gap-3.5 mb-4 border-b border-zinc-900/60 pb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isAffiliateFlow ? 'bg-amber-500/10 border border-amber-500/20 text-[#D4AF37]' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  {isAffiliateFlow ? <Crown className="w-5 h-5 animate-pulse" /> : <ShoppingBag className="w-5 h-5 animate-pulse" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-tight">Confirm Membership</h3>
                  <span className="block text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                    {isAffiliateFlow ? 'Affiliate Track Onboarding' : 'Smart Customer Procurement'}
                  </span>
                </div>
              </div>

              {/* Package Confirmation Specs */}
              <div className="space-y-4 mb-6">
                <div className="bg-zinc-950/80 rounded-2xl border border-zinc-900/60 p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wider">Membership</span>
                    <span className="font-extrabold text-white uppercase">{selectedPackageToConfirm.name} Package</span>
                  </div>
                  <div className="h-px bg-zinc-900" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wider">Package Value</span>
                    <span className="font-black text-white font-mono">{selectedPackageToConfirm.cc} CC</span>
                  </div>
                  <div className="h-px bg-zinc-900" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wider">PHP Equivalent</span>
                    <span className="font-black text-gold text-sm">₱{selectedPackageToConfirm.php.toLocaleString()}</span>
                  </div>
                  {isAffiliateFlow && 'cap' in selectedPackageToConfirm && (
                    <>
                      <div className="h-px bg-zinc-900" />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wider">2.5× Earnings Cap</span>
                        <span className="font-black text-emerald-400 font-mono">{selectedPackageToConfirm.cap} CC Max</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Benefits Summary checklist */}
                <div className="border-t border-zinc-900/60 pt-4">
                  <span className="block uppercase font-mono text-[9px] text-zinc-500 tracking-wider mb-2">Benefits Summary</span>
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {selectedPackageToConfirm.benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 bg-emerald-500/10 p-0.5 rounded-full" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg mb-5 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  disabled={loading}
                  onClick={() => setSelectedPackageToConfirm(null)}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  onClick={handleCreateRequest}
                  className={`flex-1 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${isAffiliateFlow ? 'bg-gradient-to-r from-amber-500 to-[#D4AF37] text-black hover:from-amber-400' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400'} disabled:opacity-50 shadow-lg`}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Filing...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER NOTE */}
      <div className="p-6 text-center text-[10px] text-zinc-600 font-mono tracking-widest">
        I AM CHOSEN INTERNATIONAL • PORTAL V1.5.8
      </div>

    </div>
  );
}

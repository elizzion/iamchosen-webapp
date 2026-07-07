import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, UserPlus, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, generateMemberId, generateSponsorCode, verifySponsorCode, createAuditLog } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { UserRole } from '../types';
import ChosenLogo from './ChosenLogo';

interface RegisterPageProps {
  onNavigate: (page: string) => void;
  onRegisterSuccess: (user: any, userProfile: any) => void;
}

export default function RegisterPage({ onNavigate, onRegisterSuccess }: RegisterPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sponsorInput, setSponsorInput] = useState('');

  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [sponsorUid, setSponsorUid] = useState<string | null>(null);
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [refParam, setRefParam] = useState<string | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(true);
  const [referralError, setReferralError] = useState<string | null>(null);

  // Parse and check referral on mount
  useEffect(() => {
    const checkReferral = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      setCheckingReferral(true);

      if (!ref) {
        setReferralError("Registration requires a valid referral link. Please contact your sponsor.");
        setCheckingReferral(false);
        return;
      }

      setRefParam(ref);
      setSponsorInput(ref);

      const sponsorProfile = await verifySponsorCode(ref.toUpperCase().trim());
      if (sponsorProfile) {
        setSponsorName(sponsorProfile.fullName);
        setSponsorUid(sponsorProfile.uid);
        setReferralError(null);
      } else {
        setSponsorName(null);
        setSponsorUid(null);
        setReferralError("Invalid referral link. Please contact your sponsor.");
      }
      setCheckingReferral(false);
    };
    checkReferral();
  }, []);

  // Debounced check for sponsor code (in case it is not pre-filled/read-only, but it is locked now, so we skip if refParam is set)
  useEffect(() => {
    if (refParam) return;

    if (sponsorInput.trim().length < 4) {
      setSponsorName(null);
      setSponsorUid(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSponsorChecking(true);
      const sponsorProfile = await verifySponsorCode(sponsorInput.toUpperCase().trim());
      if (sponsorProfile) {
        setSponsorName(sponsorProfile.fullName);
        setSponsorUid(sponsorProfile.uid);
      } else {
        setSponsorName(null);
        setSponsorUid(null);
      }
      setSponsorChecking(false);
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [sponsorInput, refParam]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Form validations
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!sponsorUid || !sponsorName) {
      setError("A valid referral sponsor is required for registration.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Generate unique ids
      const memberId = generateMemberId();
      const sponsorCode = generateSponsorCode(fullName);

      // 3. Setup user details & wallet
      const userDocRef = doc(db, 'users', user.uid);
      const walletDocRef = doc(db, 'wallets', user.uid);
      const timestamp = new Date().toISOString();

      const isSuperAdmin = email.trim().toLowerCase() === 'nifled.kenjaktrading@gmail.com';

      const userProfileData: any = {
        uid: user.uid,
        memberId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim(),
        role: (isSuperAdmin ? 'Super Admin' : 'Customer') as UserRole,
        accountType: isSuperAdmin ? 'System' : 'Customer',
        sponsorCode,
        referredBy: sponsorUid,
        referralCodeUsed: sponsorInput.toUpperCase().trim(),
        status: 'Active',
        kycStatus: 'Unverified' as const,
        packageLevel: 'None',
        commissionEligible: false,
        walletEnabled: true,
        genealogyEnabled: false,
        businessCycleEnabled: false,
        permissions: isSuperAdmin ? {
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
        } : {
          manageMembers: false,
          manageProducts: false,
          manageInventory: false,
          manageWallets: false,
          approveCashOut: false,
          manageCommissions: false,
          viewAnalytics: false,
          systemSettings: false,
          manageRoles: false,
          viewAuditLogs: false
        },
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const walletData = {
        uid: user.uid,
        chosenWalletBalance: 0,
        commissionWalletBalance: 0,
        marketingSupportWalletBalance: 0,
        rewardWalletBalance: 0,
        cashWalletStatus: 'Active',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const batch = writeBatch(db);
      batch.set(userDocRef, userProfileData);
      batch.set(walletDocRef, walletData);
      await batch.commit();

      // 4. Create initial Audit Log
      await createAuditLog(
        user.uid,
        user.email || '',
        'USER_REGISTRATION',
        `Registered as Customer with Member ID ${memberId}. Status: Active`
      );

      setSuccess("Customer account registered successfully! Redirecting...");
      setTimeout(() => {
        onRegisterSuccess(user, userProfileData);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email address is already in use by another account.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid email address format.");
      } else if (err.code === 'auth/weak-password') {
        setError("The password is too weak. Must be at least 6 characters.");
      } else if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/operation-not-allowed' ||
        (err.message && (err.message.includes('invalid-credential') || err.message.includes('operation-not-allowed')))
      ) {
        setError("Authentication Setup Required: Please ensure that the 'Email/Password' provider is enabled under the 'Sign-in method' tab in your Firebase Console (Authentication section) for this project.");
      } else {
        setError(err.message || "An error occurred during registration. Please check your network connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingReferral) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Verifying referral link...</p>
        </div>
      </div>
    );
  }

  if (referralError) {
    return (
      <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
        <div className="p-6 max-w-7xl mx-auto w-full">
          <button
            onClick={() => onNavigate('landing')}
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to home
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 p-8 rounded-2xl shadow-2xl relative text-center">
            <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" />
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-6" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-2">
              Registration Blocked
            </h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              {referralError}
            </p>
            <button
              onClick={() => onNavigate('login')}
              className="w-full bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 font-bold py-3.5 px-4 rounded-xl text-xs transition-colors uppercase tracking-widest"
            >
              Go to Login
            </button>
          </div>
        </div>

        <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 font-mono">
            I AM CHOSEN • Version 1.3.3 • Build 000007
          </span>
        </footer>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
      {/* Top navigation option */}
      <div className="p-6 max-w-7xl mx-auto w-full">
        <button
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to home
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative">
          {/* Top golden border */}
          <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />

          <div className="text-center mb-8 flex flex-col items-center">
            <ChosenLogo size="md" className="mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight gold-text">
              Customer Registration
            </h2>
            <p className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-medium">
              Start building your health and wealth
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start gap-2.5 text-sm mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-start gap-2.5 text-sm mb-6 animate-pulse">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Input fields */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                Full Name (Legal)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Enter full legal name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +639123456789"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Password (8+ chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>
            </div>

            {/* Sponsor Code */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                Sponsor Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  placeholder="Sponsor code"
                  value={sponsorInput}
                  className="w-full bg-zinc-900/40 border border-zinc-850 text-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none uppercase cursor-not-allowed font-semibold"
                />
              </div>
              {sponsorChecking && (
                <p className="text-xs text-zinc-500 mt-1">Verifying sponsor link...</p>
              )}
              {sponsorName && (
                <p className="text-xs text-gold font-bold mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-gold" /> Sponsor Verified: {sponsorName}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gold-gradient hover:brightness-110 text-black py-3.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-gold/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Sign Up as Customer
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-zinc-400">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-gold font-bold hover:text-gold-bright transition-colors cursor-pointer"
            >
              Log in
            </button>
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.3.3 • Build 000007
        </span>
      </footer>
    </div>
  );
}

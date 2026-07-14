import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  ArrowLeft,
  Wallet,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Lock,
  User,
  Mail,
  Phone,
  ShieldAlert
} from 'lucide-react';
import { db, registerNewMemberBySponsor } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType, PageRoute } from '../types';
import ChosenLogo from './ChosenLogo';

interface MemberRegistrationPageProps {
  currentUserProfile: UserProfile;
  onNavigate: (page: string) => void;
}

export default function MemberRegistrationPage({ currentUserProfile, onNavigate }: MemberRegistrationPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [packageLevel, setPackageLevel] = useState<'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'>('Bronze');

  const [sponsorWallet, setSponsorWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      window.showError?.(error, "Registration Error");
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      window.showSuccess?.(success, "Registration Success");
    }
  }, [success]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Package pricing
  const packages = {
    Bronze: { cc: 50, php: 3500, cap: 125 },
    Silver: { cc: 350, php: 24500, cap: 875 },
    Gold: { cc: 1500, php: 105000, cap: 3750 },
    Platinum: { cc: 3000, php: 210000, cap: 7500 },
    Diamond: { cc: 5000, php: 350000, cap: 12500 }
  };

  // Listen to Sponsor Wallet in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'wallets', currentUserProfile.uid), (snap) => {
      if (snap.exists()) {
        setSponsorWallet(snap.data() as WalletType);
      }
    });
    return () => unsub();
  }, [currentUserProfile.uid]);

  const selectedPkgCost = packages[packageLevel].cc;
  const currentBalance = sponsorWallet?.chosenWalletBalance || 0;
  const remainingBalance = currentBalance - selectedPkgCost;
  const isBalanceInsufficient = currentBalance < selectedPkgCost;

  const handleSubmitAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic Validations
    if (!fullName.trim() || !email.trim() || !mobileNumber.trim()) {
      setError("Please fill in all the required fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    // Check Wallet balance
    if (isBalanceInsufficient) {
      setError("Insufficient Chosen Credits. You cannot register a new member.");
      return;
    }

    // Show Confirmation Modal
    setShowConfirmModal(true);
  };

  const handleConfirmedRegistration = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setError(null);

    try {
      await registerNewMemberBySponsor({
        fullName,
        email,
        mobileNumber,
        password,
        packageLevel,
        sponsorUid: currentUserProfile.uid,
        sponsorEmail: currentUserProfile.email
      });

      setSuccess(`Successfully registered ${fullName} under Member ID IAM-... and package ${packageLevel}! Wallet debited.`);
      
      // Clear form
      setFullName('');
      setEmail('');
      setMobileNumber('');
      setPassword('');
      setConfirmPassword('');
      setPackageLevel('Bronze');

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      const code = (err?.code || '').toLowerCase();
      const msg = (err?.message || '').toLowerCase();
      const errStr = String(err).toLowerCase();

      if (
        code.includes('invalid-credential') ||
        code.includes('operation-not-allowed') ||
        msg.includes('invalid-credential') ||
        msg.includes('operation-not-allowed') ||
        errStr.includes('invalid-credential') ||
        errStr.includes('operation-not-allowed')
      ) {
        setError("Sponsor Registration Error: Please ensure that the 'Email/Password' provider is enabled under the 'Sign-in method' tab in your Firebase Console (Authentication section) before registering new downline members.");
      } else {
        setError(err?.message || "Failed to complete member registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen selection:bg-gold selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ChosenLogo size="sm" className="w-11 h-11" />
            <div>
              <span className="font-extrabold text-lg tracking-wider text-zinc-100 uppercase gold-text leading-none block">
                I AM CHOSEN
              </span>
              <span className="block text-[8px] tracking-[0.3em] text-zinc-400 font-bold uppercase mt-1">
                INTERNATIONAL
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3.5 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-8 mb-10 relative overflow-hidden">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-gold text-xs font-extrabold uppercase tracking-widest mb-2">
                <Sparkles className="w-4 h-4 text-gold animate-pulse" /> Official Member Registration v1.1.0
              </div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                Register Affiliate Member
              </h1>
              <p className="text-zinc-400 text-sm font-light">
                Securely register a new member into your downline genealogy using your Chosen Wallet balance.
              </p>
            </div>
            
            {/* Sponsor Wallet Balance Widget */}
            <div className="bg-zinc-950/90 border border-zinc-800/80 px-6 py-4 rounded-xl flex items-center gap-4 shadow-2xl relative shrink-0 w-full md:w-auto">
              <div className="absolute top-0 inset-x-0 h-[1.5px] gold-gradient" />
              <div className="w-10 h-10 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-gold" />
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">
                  Sponsor Chosen Wallet Balance
                </span>
                <span className="text-xl font-black text-white tracking-tight">
                  {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-gold text-sm font-extrabold">CC</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Panels */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6 animate-shake">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6 animate-pulse">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Main Grid form + packages */}
        <form onSubmit={handleSubmitAttempt} className="space-y-8">
          
          {/* Section 1: Package Selection Cards */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 relative">
            <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient rounded-t-2xl" />
            <h3 className="font-extrabold text-base text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" /> Step 1: Select Affiliate Business Package
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(packages).map(([level, details]) => {
                const isSelected = packageLevel === level;
                return (
                  <div
                    key={level}
                    onClick={() => setPackageLevel(level as any)}
                    className={`cursor-pointer border rounded-xl p-5 transition-all text-left relative ${
                      isSelected
                        ? 'border-gold bg-gold/5 shadow-lg shadow-gold/5'
                        : 'border-zinc-800/80 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/30'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-black" />
                      </div>
                    )}
                    <span className="block font-black text-white text-base tracking-tight mb-1">{level}</span>
                    <span className="block text-gold font-extrabold text-sm mb-2">{details.cc} CC</span>
                    
                    <div className="border-t border-zinc-900 my-2.5 pt-2.5 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Value PHP:</span>
                        <span className="text-white font-semibold">₱{details.php.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Earnings Cap:</span>
                        <span className="text-gold/80 font-semibold">{details.cap} CC</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Wallet Deductions Breakdown */}
            <div className="mt-6 border-t border-zinc-900 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/20 p-4 rounded-xl border border-zinc-800/50">
              <div>
                <span className="block text-xs uppercase tracking-wider text-zinc-500 font-bold">
                  Wallet Deduction Breakdown
                </span>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs text-zinc-400">
                    Package Cost: <strong className="text-white">{selectedPkgCost} CC</strong>
                  </span>
                  <span className="text-zinc-700">•</span>
                  <span className="text-xs text-zinc-400">
                    Remaining: <strong className={remainingBalance < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{remainingBalance} CC</strong>
                  </span>
                </div>
              </div>

              {isBalanceInsufficient ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2 rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Insufficient Chosen Credits
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-2 rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Ready to Purchase
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Form Input Fields */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 relative">
            <h3 className="font-extrabold text-base text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-gold" /> Step 2: Account Holder Details
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                  Full Name (Legal Account Holder Name)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter legal full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3.5 text-sm focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. member@chosen.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3.5 text-sm focus:outline-none transition-colors text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3.5 text-sm focus:outline-none transition-colors text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-zinc-900 pt-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                    Temporary Password (8+ characters)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      placeholder="Create password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3.5 text-sm focus:outline-none transition-colors text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      placeholder="Verify password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3.5 text-sm focus:outline-none transition-colors text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading || isBalanceInsufficient}
            className="w-full gold-gradient hover:brightness-110 text-black py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-gold/10 flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Execute Affiliate Registration
              </>
            )}
          </button>
        </form>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />
            <h3 className="text-lg font-extrabold uppercase tracking-tight text-white mb-3 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gold" /> Confirm Wallet Deduction
            </h3>
            
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              You are about to register <strong className="text-white">{fullName}</strong> with the <strong className="text-gold">{packageLevel} Package</strong>.
            </p>

            <div className="bg-zinc-900 border border-zinc-800/60 rounded-lg p-4 space-y-2 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Sponsor Account:</span>
                <span className="text-white font-bold">{currentUserProfile.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Deduction Cost:</span>
                <span className="text-red-400 font-extrabold">-{selectedPkgCost} CC</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
                <span className="text-zinc-500 font-medium">Remaining Wallet:</span>
                <span className="text-emerald-400 font-extrabold">{remainingBalance} CC</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedRegistration}
                className="px-5 py-2 gold-gradient text-black rounded-lg text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
              >
                Confirm & Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center mt-20">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.1.0 • Build 000002
        </span>
      </footer>
    </div>
  );
}

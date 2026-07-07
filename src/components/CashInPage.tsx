import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Upload, 
  Check, 
  AlertTriangle, 
  Wallet, 
  ArrowUpRight, 
  Sparkles,
  DollarSign,
  FileText
} from 'lucide-react';
import { db, createAuditLog, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType } from '../types';
import ChosenLogo from './ChosenLogo';
import { useCCSettings } from '../context/CCSettingsContext';

interface CashInPageProps {
  onNavigate: (page: string) => void;
  userProfile: UserProfile | null;
}

export default function CashInPage({ onNavigate, userProfile }: CashInPageProps) {
  const { ccSettings } = useCCSettings();
  // Parsing parameters from URL search query
  const [purpose, setPurpose] = useState<string | null>(null);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [requiredCC, setRequiredCC] = useState<number | null>(null);

  // States for user wallet balance
  const [userWallet, setUserWallet] = useState<WalletType | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Form states
  const [cashinAmountPhp, setCashinAmountPhp] = useState<number>(3500);
  const [cashinChannel, setCashinChannel] = useState<'GCash' | 'Maya' | 'Bank'>('GCash');
  const [cashinReference, setCashinReference] = useState('');
  const [cashinAccountName, setCashinAccountName] = useState('');
  const [cashinAccountNumber, setCashinAccountNumber] = useState('');
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('');
  const [cashinNotes, setCashinNotes] = useState('');

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Retrieve URL Search parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPurpose = searchParams.get('purpose');
    const urlPackage = searchParams.get('package');
    const urlRequiredCC = searchParams.get('requiredCC');

    setPurpose(urlPurpose);
    setPackageName(urlPackage);
    if (urlRequiredCC) {
      setRequiredCC(Number(urlRequiredCC));
    }
  }, []);

  // Fetch current user's wallet balance
  useEffect(() => {
    const fetchWallet = async () => {
      const uid = userProfile?.uid || auth.currentUser?.uid;
      if (!uid) return;

      try {
        const walletSnap = await getDoc(doc(db, 'wallets', uid));
        if (walletSnap.exists()) {
          setUserWallet(walletSnap.data() as WalletType);
        }
      } catch (err) {
        console.error("Error fetching wallet in CashInPage:", err);
      } finally {
        setLoadingWallet(false);
      }
    };

    fetchWallet();
  }, [userProfile]);

  // Derive package-related specs
  const currentCCBalance = userWallet?.chosenWalletBalance || 0;
  const remainingCCNeeded = requiredCC ? Math.max(0, requiredCC - currentCCBalance) : 0;
  const phpEquivalent = remainingCCNeeded * ccSettings.cashInRatePHP; // 1 CC = 70 PHP as requested

  // Pre-populate cash-in amount based on PHP equivalent of remaining needed CC
  useEffect(() => {
    if (phpEquivalent > 0) {
      setCashinAmountPhp(Math.ceil(phpEquivalent));
    }
  }, [phpEquivalent]);

  // Handle back navigation
  const handleBack = () => {
    // Clear query parameters from URL elegantly
    window.history.pushState({}, '', window.location.pathname);
    if (purpose === 'affiliate-upgrade') {
      onNavigate('package-selection');
    } else {
      onNavigate('customer-dashboard');
    }
  };

  // Proof upload handler
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError("Invalid file type. Please upload an image or PDF proof of payment receipt.");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Please upload an image smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofOfPaymentUrl(reader.result);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Submit cash-in form
  const handleCashinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetUid = userProfile?.uid || auth.currentUser?.uid;
    if (!targetUid) {
      setError("No authenticated user profile found.");
      return;
    }

    if (cashinAmountPhp <= 0) {
      setError("Amount in PHP must be greater than zero.");
      return;
    }
    if (!cashinReference.trim()) {
      setError("Reference number is required.");
      return;
    }
    if (!proofOfPaymentUrl) {
      setError("Please upload a proof of payment receipt.");
      return;
    }

    setLoading(true);

    try {
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const requestDocRef = doc(db, 'cashin_requests', requestId);
      
      // Centralized corporate rate for Cash-In crediting
      const computedCC = Number((cashinAmountPhp / ccSettings.cashInRatePHP).toFixed(4));
      const timestamp = new Date().toISOString();

      const requestData = {
        requestId,
        uid: targetUid,
        memberId: userProfile?.memberId || '',
        fullName: userProfile?.fullName || '',
        email: userProfile?.email || auth.currentUser?.email || '',
        amountPHP: Number(cashinAmountPhp),
        computedCC: computedCC,
        ratePHPPerCC: ccSettings.cashInRatePHP,
        paymentMethod: cashinChannel === 'Bank' ? 'Bank Transfer' : cashinChannel,
        referenceNumber: cashinReference.trim(),
        proofOfPaymentUrl: proofOfPaymentUrl,
        notes: cashinNotes.trim(),
        status: 'Pending',
        requestedAt: timestamp,
        updatedAt: timestamp,
        reviewedBy: null,
        approvedAt: null,
        rejectedReason: null,
        amountCC: computedCC,
        amountPhp: Number(cashinAmountPhp),
        paymentChannel: cashinChannel,
        requestDate: timestamp,
        senderAccountName: cashinAccountName.trim(),
        senderAccountNumber: cashinAccountNumber.trim(),
        accountName: cashinAccountName.trim(),
        accountNumber: cashinAccountNumber.trim()
      };

      await setDoc(requestDocRef, requestData);

      await createAuditLog(
        targetUid,
        userProfile?.email || auth.currentUser?.email || '',
        'CASHIN_REQUEST',
        `Submitted cash-in request of ₱${Number(cashinAmountPhp).toLocaleString()} (${computedCC} CC) via ${cashinChannel}. Ref: ${cashinReference}`
      );

      setSuccess(`Successfully requested cash-in of ₱${Number(cashinAmountPhp).toLocaleString()} (${computedCC} CC)! Please wait for admin approval.`);
      setCashinReference('');
      setCashinAccountName('');
      setCashinAccountNumber('');
      setProofOfPaymentUrl('');
      setCashinNotes('');

      // Redirect after a brief moment
      setTimeout(() => {
        // Clear query parameters and route back
        window.history.pushState({}, '', window.location.pathname);
        if (purpose === 'affiliate-upgrade') {
          onNavigate('package-selection');
        } else {
          onNavigate('customer-dashboard');
        }
      }, 3500);

    } catch (err: any) {
      setError(err.message || "Failed to submit cash-in request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col font-sans selection:bg-gold selection:text-black">
      {/* HEADER SECTION */}
      <div className="p-6 max-w-4xl mx-auto w-full flex items-center justify-between border-b border-zinc-900/60">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Status:</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#D4AF37]/10 text-gold border border-gold/20 uppercase tracking-wider">
            Upgrade Station
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        
        {/* TITLE */}
        <div className="text-center max-w-xl mx-auto flex flex-col items-center">
          <ChosenLogo size="sm" className="mb-3" />
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
            Cash-In <span className="gold-text">Station</span>
          </h1>
          <p className="text-zinc-500 text-xs mt-1.5 font-medium">
            Top up your Chosen Credits securely via company certified payment routes.
          </p>
        </div>

        {/* AFFILIATE UPGRADE HELPER INFO BOX */}
        {purpose === 'affiliate-upgrade' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0B0D12] border border-gold/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-900/80 pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[#D4AF37] flex items-center justify-center font-bold">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Upgrade Procurement Helper</h3>
                <span className="block text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">Affiliate Activation Required Specs</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-zinc-950/40 border border-zinc-900 p-3 rounded-xl text-center">
                <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-500 font-bold mb-1">Selected Package</span>
                <span className="text-xs font-extrabold text-white uppercase">{packageName || 'Bronze'}</span>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-900 p-3 rounded-xl text-center">
                <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-500 font-bold mb-1">Required CC</span>
                <span className="text-xs font-black text-white font-mono">{requiredCC || 50} CC</span>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-900 p-3 rounded-xl text-center">
                <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-500 font-bold mb-1">Current CC Balance</span>
                <span className="text-xs font-black text-amber-500 font-mono">{currentCCBalance.toFixed(2)} CC</span>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-900 p-3 rounded-xl text-center">
                <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-500 font-bold mb-1">Remaining CC Needed</span>
                <span className="text-xs font-black text-red-400 font-mono">{remainingCCNeeded.toFixed(2)} CC</span>
              </div>
              <div className="bg-[#D4AF37]/5 border border-gold/20 p-3 rounded-xl text-center">
                <span className="block text-[8px] uppercase tracking-wider font-mono text-[#D4AF37] font-bold mb-1">PHP Equivalent (1:70)</span>
                <span className="text-xs font-black text-gold">₱{Math.ceil(phpEquivalent).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* MAIN FORM */}
        <div className="bg-[#0B0D12]/90 border border-zinc-800/80 rounded-[28px] p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold to-zinc-900" />

          <div>
            <h2 className="text-lg font-extrabold uppercase tracking-tight text-white">Deposit Details</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">
              Cash-In Rate: 1 CC = ₱{ccSettings.cashInRatePHP.toFixed(2)}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 bg-emerald-500/20 rounded-full p-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleCashinSubmit} className="space-y-5">
            
            {/* Amount PHP */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                Amount in Philippine Pesos (PHP)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono font-bold">₱</span>
                <input
                  type="number"
                  required
                  min="70"
                  step="1"
                  value={cashinAmountPhp}
                  onChange={(e) => setCashinAmountPhp(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl pl-8 pr-4 py-3 text-sm font-mono text-white font-bold transition-colors"
                  placeholder="e.g. 3500"
                />
              </div>
            </div>

            {/* Computed CC Output Display */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-1.5">
              <span className="block font-bold text-zinc-500 uppercase tracking-widest text-[8px] font-mono">Credited Credits Output Display</span>
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-zinc-500">Crediting Exchange Rate:</span>
                <span className="text-zinc-300">1 CC = ₱{ccSettings.cashInRatePHP.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-900 pt-2 mt-1.5 text-xs font-bold">
                <span className="text-gold">Estimated Credited Output:</span>
                <span className="text-gold font-mono">{(cashinAmountPhp / ccSettings.cashInRatePHP).toFixed(4)} CC</span>
              </div>
            </div>

            {/* Target Payment channel */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                Company Payment Target Channel
              </label>
              <select
                value={cashinChannel}
                onChange={(e: any) => setCashinChannel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl px-3 py-3 text-xs text-white font-semibold cursor-pointer"
              >
                <option value="GCash">GCash (Company Account: 0917-111-2222)</option>
                <option value="Maya">Maya (Company Account: 0917-111-2222)</option>
                <option value="Bank">Bank Transfer (BDO Account: 00123-4567-890)</option>
              </select>
            </div>

            {/* Sender Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                  Your Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan dela Cruz"
                  value={cashinAccountName}
                  onChange={(e) => setCashinAccountName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl px-4 py-3 text-xs text-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                  Your Account Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0917-123-4567"
                  value={cashinAccountNumber}
                  onChange={(e) => setCashinAccountNumber(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl px-4 py-3 text-xs text-white transition-colors"
                />
              </div>
            </div>

            {/* Reference code */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                Transaction Reference Number
              </label>
              <input
                type="text"
                required
                placeholder="Paste reference or receipt transaction code"
                value={cashinReference}
                onChange={(e) => setCashinReference(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl px-4 py-3 text-xs text-white font-mono transition-colors"
              />
            </div>

            {/* Proof receipt upload container */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                Upload Proof of Payment Receipt (Required)
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-gold bg-gold/5' 
                    : proofOfPaymentUrl 
                      ? 'border-emerald-500/40 bg-emerald-500/5' 
                      : 'border-zinc-850 hover:border-zinc-700 bg-zinc-950'
                }`}
                onClick={() => document.getElementById('cashin-file-upload')?.click()}
              >
                <input
                  type="file"
                  id="cashin-file-upload"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
                
                {proofOfPaymentUrl ? (
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">Proof of Payment Attached</span>
                    <span className="block text-[9px] text-zinc-500 font-mono">Click or drag new file to replace</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-bold text-zinc-300">Drag & Drop receipt or click to browse</span>
                    <span className="block text-[9px] text-zinc-500 font-mono uppercase tracking-wide">Supports PNG, JPG, PDF up to 5MB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extra notes */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                Extra Notes (Optional)
              </label>
              <textarea
                value={cashinNotes}
                onChange={(e) => setCashinNotes(e.target.value)}
                placeholder="Write any extra details for admin reference"
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-gold focus:outline-none rounded-xl px-4 py-3 text-xs text-white h-20 resize-none transition-colors"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleBack}
                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 text-black font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Filing Request...</span>
                  </>
                ) : (
                  <span>Submit Cash-In Request</span>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* FOOTER */}
      <div className="p-6 text-center text-[10px] text-zinc-600 font-mono tracking-widest">
        I AM CHOSEN INTERNATIONAL • PORTAL V1.6.0
      </div>
    </div>
  );
}

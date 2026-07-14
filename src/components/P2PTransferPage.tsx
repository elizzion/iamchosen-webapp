import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  AlertTriangle, 
  Wallet, 
  ArrowUpRight, 
  Sparkles,
  Search,
  UserCheck,
  FileText
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType } from '../types';
import { WalletService } from '../services/wallet/wallet.service';
import { P2PTransferService } from '../services/p2pTransferService';
import { useCCSettings } from '../context/CCSettingsContext';
import ChosenLogo from './ChosenLogo';

interface P2PTransferPageProps {
  onNavigate: (page: string) => void;
  userProfile: UserProfile | null;
}

export default function P2PTransferPage({ onNavigate, userProfile }: P2PTransferPageProps) {
  const { ccSettings } = useCCSettings();
  // Wallet states
  const [userWallet, setUserWallet] = useState<WalletType | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Form states
  const [recipientMemberId, setRecipientMemberId] = useState('');
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<{ uid: string; memberId: string; fullName: string } | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [transferAmountCC, setTransferAmountCC] = useState<string>('10');
  const [transferNote, setTransferNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // UI / Action states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);

  useEffect(() => {
    if (error) {
      window.showError?.(error, "Transfer Error");
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      window.showSuccess?.(
        `Successfully transferred ${success.amountCC} CC to ${success.recipientName} (ID: ${success.recipientId}) with Reference ID: ${success.referenceId}!`,
        "Transfer Successful"
      );
    }
  }, [success]);

  // Configuration limits
  const MIN_TRANSFER = 1;
  const MAX_TRANSFER = 50000;
  const TRANSFER_FEE = ccSettings.transferFeeEnabled !== false ? (ccSettings.transferFeeAmountCC ?? 1.0) : 0;

  // Generate unique idempotency key on load
  const generateIdempotencyKey = () => {
    const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
    const key = `P2P-TX-${Date.now()}-${randomHex}`;
    setIdempotencyKey(key);
  };

  useEffect(() => {
    generateIdempotencyKey();
  }, []);

  // Fetch sender's wallet balance
  const fetchWallet = async () => {
    const uid = userProfile?.uid || auth.currentUser?.uid;
    if (!uid) return;

    try {
      const walletSnap = await getDoc(doc(db, 'wallets', uid));
      if (walletSnap.exists()) {
        setUserWallet(walletSnap.data() as WalletType);
      }
    } catch (err) {
      console.error("Error fetching wallet in P2PTransferPage:", err);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [userProfile]);

  // Recipient real-time validation / lookup
  useEffect(() => {
    if (!recipientMemberId.trim()) {
      setVerifiedRecipient(null);
      setRecipientError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsVerifyingRecipient(true);
      setRecipientError(null);
      setVerifiedRecipient(null);

      try {
        const cleanId = recipientMemberId.trim().toUpperCase();
        
        // Prevent sending to oneself
        if (userProfile && userProfile.memberId === cleanId) {
          setRecipientError("You cannot transfer credits to your own member ID.");
          setIsVerifyingRecipient(false);
          return;
        }

        const recipient = await WalletService.findRecipientByMemberId(cleanId);
        if (recipient) {
          setVerifiedRecipient(recipient);
        } else {
          setRecipientError("Member ID not found. Please verify and try again.");
        }
      } catch (err) {
        console.error("Error resolving recipient:", err);
        setRecipientError("Unable to verify member ID at this time.");
      } finally {
        setIsVerifyingRecipient(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [recipientMemberId, userProfile]);

  const currentCCBalance = userWallet?.chosenWalletBalance || 0;
  const parsedAmount = parseFloat(transferAmountCC) || 0;
  const totalDebit = parsedAmount > 0 ? Number((parsedAmount + TRANSFER_FEE).toFixed(4)) : 0;
  const remainingBalance = Number((currentCCBalance - totalDebit).toFixed(4));

  const handleBack = () => {
    onNavigate('dashboard');
  };

  // Submit transfer handler
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const senderUid = userProfile?.uid || auth.currentUser?.uid;
    if (!senderUid) {
      setError("Sender authentication session not found.");
      return;
    }

    if (!verifiedRecipient) {
      setError("Please specify a valid, verified recipient member ID.");
      return;
    }

    if (parsedAmount < MIN_TRANSFER) {
      setError(`Minimum transfer amount is ${MIN_TRANSFER} CC.`);
      return;
    }

    if (parsedAmount > MAX_TRANSFER) {
      setError(`Maximum transfer amount is ${MAX_TRANSFER} CC.`);
      return;
    }

    if (currentCCBalance < totalDebit) {
      setError(`Insufficient balance. You need ${totalDebit} CC (Transfer + 1 CC fee) but currently have ${currentCCBalance} CC.`);
      return;
    }

    setLoading(true);

    try {
      const result = await P2PTransferService.executeTransfer({
        recipientMemberId: verifiedRecipient.memberId,
        amountCC: parsedAmount,
        idempotencyKey,
        memo: transferNote
      });

      const successPayload = {
        ...result,
        senderMemberId: userProfile?.memberId || '',
        recipientMemberId: verifiedRecipient.memberId
      };

      setSuccess(successPayload);
      
      // Refresh wallet balances
      await fetchWallet();

    } catch (err: any) {
      setError(err.message || "Failed to complete P2P transfer.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to mask recipient full name for privacy but allow recognition
  const maskName = (name: string) => {
    if (!name) return "";
    const parts = name.split(" ");
    return parts.map(part => {
      if (part.length <= 2) return part;
      return part[0] + "*".repeat(part.length - 2) + part[part.length - 1];
    }).join(" ");
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col font-sans selection:bg-gold selection:text-black" id="p2p-transfer-page">
      {/* Header Bar */}
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all text-xs font-mono tracking-wider uppercase group"
          id="back-to-wallet-btn"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Wallet
        </button>
        <div className="flex items-center gap-2">
          <ChosenLogo size="sm" />
          <div className="text-right">
            <span className="text-[9px] text-zinc-500 font-mono tracking-widest block leading-none">I AM CHOSEN</span>
            <span className="text-[8px] text-gold font-mono tracking-[0.3em] block mt-0.5 uppercase leading-none">TRANSFER GATE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div 
              key="transfer-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Form Details */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-white gold-text flex items-center gap-2">
                    <ArrowUpRight className="w-6 h-6 text-gold" /> Transfer Chosen Credits
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1 font-light">
                    Instantly transfer Chosen Credits (CC) to other registered community members. All transfers are protected by cryptographic ledger atomicity and processed instantly.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-start gap-2 animate-fadeIn" id="transfer-error">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleTransferSubmit} className="space-y-6 bg-zinc-950/40 border border-zinc-900/60 rounded-2xl p-6">
                  {/* Step 1: Recipient Search */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                      1. Recipient Member ID
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="e.g. IAM-100224"
                        value={recipientMemberId}
                        onChange={(e) => setRecipientMemberId(e.target.value)}
                        disabled={loading}
                        className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 pl-10 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                        required
                        id="recipient-member-id-input"
                      />
                      <Search className="w-4 h-4 text-zinc-600 absolute left-3.5 top-3.5" />
                      
                      {isVerifyingRecipient && (
                        <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
                          <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-zinc-500 font-mono">Verifying...</span>
                        </div>
                      )}
                    </div>

                    {/* Verification Indicators */}
                    {verifiedRecipient && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between animate-fadeIn" id="recipient-verified-panel">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="text-[10px] text-zinc-500 font-mono block leading-none">RECIPIENT CONFIRMED</span>
                            <span className="text-xs font-bold text-emerald-400 font-sans block mt-1">
                              {maskName(verifiedRecipient.fullName)}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                          Active User
                        </span>
                      </div>
                    )}

                    {recipientError && (
                      <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 text-xs text-red-400 animate-fadeIn" id="recipient-verify-error">
                        {recipientError}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Amount */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                        2. Transfer Amount (CC)
                      </label>
                      <span className="text-[9px] text-zinc-500 font-mono">Min: {MIN_TRANSFER} CC | Max: {MAX_TRANSFER.toLocaleString()} CC</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.0001"
                        min={MIN_TRANSFER}
                        max={MAX_TRANSFER}
                        placeholder="0.00"
                        value={transferAmountCC}
                        onChange={(e) => setTransferAmountCC(e.target.value)}
                        disabled={loading}
                        className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 pl-12 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all"
                        required
                        id="transfer-amount-input"
                      />
                      <span className="text-zinc-500 font-mono text-sm absolute left-4 top-3.5">CC</span>
                    </div>
                  </div>

                  {/* Step 3: Optional Memo */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                      3. Transfer Memo / Note (Optional)
                    </label>
                    <textarea 
                      placeholder="Add a reference message or note for the recipient..."
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      disabled={loading}
                      maxLength={100}
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 text-xs font-sans text-white placeholder-zinc-600 focus:outline-none focus:border-gold transition-all resize-none"
                      id="transfer-note-input"
                    />
                    <div className="text-right text-[9px] text-zinc-600 font-mono">
                      {transferNote.length}/100 characters
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !verifiedRecipient || parsedAmount <= 0}
                      className="w-full gold-gradient text-black font-bold uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:active:scale-100 flex items-center justify-center gap-2 cursor-pointer"
                      id="submit-transfer-btn"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Securing Funds...</span>
                        </>
                      ) : (
                        <>
                          <span>Execute P2P Transfer</span>
                          <ArrowUpRight className="w-4 h-4 text-black" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Ledger Audit Summary */}
              <div className="lg:col-span-5 space-y-6">
                {/* Balance & Quote Summary */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-zinc-900">
                    <div className="p-2.5 bg-gold/10 border border-gold/20 rounded-xl text-gold">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 font-mono tracking-wider block">CHOSEN WALLET BALANCE</span>
                      {loadingWallet ? (
                        <div className="w-20 h-4 bg-zinc-800 animate-pulse rounded mt-1" />
                      ) : (
                        <span className="text-xl font-black font-mono text-white leading-none mt-1 block">
                          {currentCCBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-mono tracking-widest uppercase text-zinc-400 font-bold">
                      Ledger Reconciliation
                    </h3>

                    <div className="space-y-2.5 font-mono text-xs text-zinc-400">
                      <div className="flex justify-between">
                        <span>Transfer Amount:</span>
                        <span className="text-white font-bold">{parsedAmount.toFixed(2)} CC</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          Platform Transfer Fee:
                          <span className="px-1.5 py-0.5 bg-gold/10 text-gold text-[8px] rounded border border-gold/20 font-bold">1 CC</span>
                        </span>
                        <span className="text-white font-bold">{TRANSFER_FEE.toFixed(2)} CC</span>
                      </div>
                      
                      <div className="border-t border-zinc-900 my-2 pt-2.5 flex justify-between text-sm text-white font-bold">
                        <span>Total Debit amount:</span>
                        <span className="gold-text font-black">{totalDebit.toFixed(2)} CC</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Remaining Balance:</span>
                        <span className={remainingBalance < 0 ? "text-red-500 font-bold" : "font-semibold text-zinc-300"}>
                          {remainingBalance.toFixed(2)} CC
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Idempotency Audit */}
                  <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-gold text-[9px] font-mono font-bold tracking-widest uppercase">
                      <Sparkles className="w-3.5 h-3.5" /> Idempotency Trail
                    </div>
                    <p className="text-[10px] text-zinc-500 font-light leading-relaxed">
                      Every transaction is linked to a pre-generated, unique idempotency key. This ensures that even if you double-click or lose connection, your funds are protected from double debits.
                    </p>
                    <div className="text-[9px] text-zinc-400 font-mono bg-zinc-950 px-2 py-1.5 rounded border border-zinc-900 overflow-hidden text-ellipsis whitespace-nowrap">
                      {idempotencyKey || 'GEN_PENDING'}
                    </div>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="bg-zinc-950/30 border border-zinc-900/50 rounded-2xl p-5 text-[11px] text-zinc-500 leading-relaxed font-light space-y-2">
                  <div className="text-white uppercase font-bold tracking-wider text-[10px] font-mono">
                    Security Notice
                  </div>
                  <p>
                    Once executed, P2P credit transfers are **irreversible and final**. Please double-check the recipient's member ID and verified masked name before submitting.
                  </p>
                  <p>
                    The 1.00 CC transfer fee is deducted directly from your Chosen Wallet balance upon successful settlement.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Success Receipt view */
            <motion.div 
              key="success-receipt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8 space-y-6 text-center shadow-2xl relative overflow-hidden"
              id="transfer-success-receipt"
            >
              {/* Gold light ring effect */}
              <div className="absolute top-0 inset-x-0 h-1 gold-gradient" />

              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-scaleUp">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-black uppercase text-white tracking-tight">
                  Transfer Successful
                </h2>
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  REFERENCE: {success.transferId}
                </p>
              </div>

              {/* Receipt Data Box */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 text-left font-mono text-xs space-y-3 text-zinc-400">
                <div className="flex justify-between">
                  <span>Sender Account:</span>
                  <span className="text-white">IAM-{success.senderMemberId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recipient Account:</span>
                  <span className="text-white">IAM-{success.recipientMemberId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recipient Name:</span>
                  <span className="text-white text-right font-sans font-bold">{success.recipientName}</span>
                </div>
                <div className="border-t border-zinc-900 my-2 pt-2.5 flex justify-between text-sm text-white font-bold">
                  <span>Amount Transferred:</span>
                  <span className="gold-text font-black">{success.amountCC.toFixed(2)} CC</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Platform Transfer Fee:</span>
                  <span>{success.feeCC.toFixed(2)} CC</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Total Debit Amount:</span>
                  <span>{success.totalDebitCC.toFixed(2)} CC</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 pt-1">
                  <span>Completed At:</span>
                  <span>{new Date(success.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBack}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
                  id="done-receipt-btn"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  Award,
  RefreshCw,
  TrendingUp,
  User,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Clock,
  LogOut,
  Send,
  DollarSign,
  Sparkles,
  Copy,
  Share2,
  Home as HomeIcon,
  Bell,
  Globe,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType, BusinessCycle } from '../types';
import ChosenLogo from './ChosenLogo';
import BottomNavigation, { CustomerTabType } from './customer/BottomNavigation';
import { useCCSettings } from '../context/CCSettingsContext';

interface AffiliateDashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export default function AffiliateDashboard({ userProfile, onLogout, onNavigate }: AffiliateDashboardProps) {
  const { ccSettings } = useCCSettings();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [businessCycle, setBusinessCycle] = useState<BusinessCycle | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sponsor & Copy States
  const [sponsor, setSponsor] = useState<any | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sponsorLoading, setSponsorLoading] = useState(false);

  // Cashout Modal form state
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmountCC, setCashoutAmountCC] = useState<number>(100);
  const [payoutChannel, setPayoutChannel] = useState<'Bank' | 'GCash' | 'Maya'>('GCash');
  const [accountNumber, setAccountName] = useState('');
  const [cashoutError, setCashoutError] = useState<string | null>(null);
  const [cashoutSuccess, setCashoutSuccess] = useState<string | null>(null);

  // Cashin Modal form state
  const [showCashinModal, setShowCashinModal] = useState(false);
  const [cashinAmountPhp, setCashinAmountPhp] = useState<number>(3500);
  const [cashinChannel, setCashinChannel] = useState<'GCash' | 'Maya' | 'Bank'>('GCash');
  const [cashinReference, setCashinReference] = useState('');
  const [cashinAccountName, setCashinAccountName] = useState('');
  const [cashinAccountNumber, setCashinAccountNumber] = useState('');
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('');
  const [cashinNotes, setCashinNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [cashinError, setCashinError] = useState<string | null>(null);
  const [cashinSuccess, setCashinSuccess] = useState<string | null>(null);
  const [cashinHistory, setCashinHistory] = useState<any[]>([]);

  // Simulation state
  const [simulating, setSimulating] = useState(false);

  // Mobile navigation and view States
  const [activeMobileTab, setActiveMobileTab] = useState<CustomerTabType>('home');
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'ZH' | 'ES'>('EN');

  // Notifications mock data
  const notifications = [
    { id: 1, title: 'Commission Payout Cleared', desc: 'Your unilevel referral matching bonus has been successfully credited to your Commission Wallet.', date: 'Just now', unread: true },
    { id: 2, title: 'Business Cycle Reset Alert', desc: 'You are on Cycle 1 of 4. Finish 4 cycles to receive additional package bonuses.', date: '3 hours ago', unread: false },
    { id: 3, title: 'Member Registered Successfully', desc: 'A new affiliate has successfully registered using your sponsor code.', date: '1 day ago', unread: false },
    { id: 4, title: 'Weekly Leaderboard Open', desc: 'The top referring affiliates receive bonus reward points on Friday.', date: '2 days ago', unread: false }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [userProfile.uid]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Wallet
      const walletRef = doc(db, 'wallets', userProfile.uid);
      const walletSnap = await getDoc(walletRef);
      if (walletSnap.exists()) {
        setWallet(walletSnap.data() as WalletType);
      }

      // 2. Fetch Business Cycle (if Affiliate)
      const cycleRef = doc(db, 'business_cycles', userProfile.uid);
      const cycleSnap = await getDoc(cycleRef);
      if (cycleSnap.exists()) {
        setBusinessCycle(cycleSnap.data() as BusinessCycle);
      }

      // 3. Fetch Transactions
      const txQuery = query(
        collection(db, 'wallet_transactions'),
        where('uid', '==', userProfile.uid)
      );
      const txSnap = await getDocs(txQuery);
      const txList = txSnap.docs.map(doc => doc.data());
      txList.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
      setTransactions(txList);

      // 4. Fetch Sponsor details if present
      if (userProfile.referredBy) {
        setSponsorLoading(true);
        try {
          const sponsorDocRef = doc(db, 'users', userProfile.referredBy);
          const sponsorSnap = await getDoc(sponsorDocRef);
          if (sponsorSnap.exists()) {
            setSponsor(sponsorSnap.data());
          } else {
            const q = query(collection(db, 'users'), where('sponsorCode', '==', userProfile.referredBy));
            const snap = await getDocs(q);
            if (!snap.empty) {
              setSponsor(snap.docs[0].data());
            } else {
              setSponsor(null);
            }
          }
        } catch (err) {
          console.error("Error fetching sponsor:", err);
          setSponsor(null);
        } finally {
          setSponsorLoading(false);
        }
      } else {
        setSponsor(null);
      }

      // 5. Fetch Cashin requests
      const cashinQuery = query(
        collection(db, 'cashin_requests'),
        where('uid', '==', userProfile.uid)
      );
      const cashinSnap = await getDocs(cashinQuery);
      const cashinList = cashinSnap.docs.map(doc => doc.data());
      cashinList.sort((a, b) => new Date(b.requestDate || b.requestedAt).getTime() - new Date(a.requestDate || a.requestedAt).getTime());
      setCashinHistory(cashinList);

    } catch (e) {
      console.error("Error loading dashboard details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/register?ref=${userProfile.sponsorCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleShare = () => {
    const link = `${window.location.origin}/register?ref=${userProfile.sponsorCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join I AM CHOSEN',
        text: 'Become a part of my I AM CHOSEN unilevel success network!',
        url: link
      }).catch(console.error);
    } else {
      handleCopyLink();
    }
  };

  // Simulation: Receive Direct Commissions (4%)
  const handleSimulateCommission = async (amountCC: number, bonusType: string) => {
    if (!wallet) return;
    setSimulating(true);

    try {
      let cycleCompleted = false;
      let newEarnings = amountCC;

      const batch = writeBatch(db);

      if (businessCycle) {
        if (businessCycle.status === 'Completed') {
          alert("Your Business Cycle is completed! You cannot earn commissions until you renew your cycle.");
          setSimulating(false);
          return;
        }

        const currentEarnings = businessCycle.currentQualifiedEarningsCC;
        const capacity = businessCycle.remainingCapacityCC;

        if (amountCC >= capacity) {
          newEarnings = capacity;
          cycleCompleted = true;
        }

        const updatedCycle: Partial<BusinessCycle> = {
          currentQualifiedEarningsCC: Number((currentEarnings + newEarnings).toFixed(2)),
          remainingCapacityCC: Number((capacity - newEarnings).toFixed(2)),
          status: cycleCompleted ? 'Completed' : 'Active',
          updatedAt: new Date().toISOString()
        };

        const cycleRef = doc(db, 'business_cycles', userProfile.uid);
        batch.update(cycleRef, updatedCycle);
        setBusinessCycle(prev => prev ? { ...prev, ...updatedCycle } : null);
      }

      batch.update(doc(db, 'wallets', userProfile.uid), {
        commissionWalletBalance: Number((wallet.commissionWalletBalance + newEarnings).toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      const txId = `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: userProfile.uid,
        amount: newEarnings,
        type: 'CREDIT',
        walletType: 'Commission',
        description: `Direct Commission: ${bonusType}`,
        status: 'Completed',
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      if (cycleCompleted) {
        batch.update(doc(db, 'users', userProfile.uid), { 
          status: 'Completed', 
          updatedAt: new Date().toISOString() 
        });
      }

      await batch.commit();

      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'COMMISSION_SIMULATED',
        `Simulated receipt of ${newEarnings} CC ${bonusType}. Business Cycle update: ${cycleCompleted ? 'COMPLETED' : 'ACTIVE'}`
      );

      await fetchDashboardData();

    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  // Submit Cashout
  const handleCashoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashoutError(null);
    setCashoutSuccess(null);

    if (!wallet) return;

    if (cashoutAmountCC <= 0) {
      setCashoutError("Amount must be greater than zero.");
      return;
    }

    if (wallet.commissionWalletBalance < cashoutAmountCC) {
      setCashoutError(`Insufficient balance. Your Commission Wallet balance is ${wallet.commissionWalletBalance} CC.`);
      return;
    }

    setLoading(true);

    try {
      const grossPhp = cashoutAmountCC * ccSettings.cashOutRatePHP;
      const withholdingTax = grossPhp * 0.10;
      const adminFeePhp = 70;
      const netPhp = grossPhp - withholdingTax - adminFeePhp;

      const batch = writeBatch(db);

      // Deduct from wallet
      const walletRef = doc(db, 'wallets', userProfile.uid);
      batch.update(walletRef, {
        commissionWalletBalance: Number((wallet.commissionWalletBalance - cashoutAmountCC).toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      // Write Cashout Request
      const requestId = `CW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const requestDocRef = doc(db, 'cashout_requests', requestId);
      batch.set(requestDocRef, {
        requestId,
        uid: userProfile.uid,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        amountCC: cashoutAmountCC,
        grossPhp,
        withholdingTax,
        adminFeePhp,
        netPhp,
        payoutChannel,
        destinationDetails: accountNumber,
        status: 'Submitted',
        requestDate: new Date().toISOString(),
        expectedReleaseDate: getUpcomingFriday().toISOString()
      });

      // Add to transaction log
      const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: userProfile.uid,
        amount: cashoutAmountCC,
        type: 'DEBIT',
        walletType: 'Commission',
        description: `Cash-Out Request: ${payoutChannel}`,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      await batch.commit();

      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'CASHOUT_REQUEST',
        `Submitted cashout of ${cashoutAmountCC} CC (Net: ₱${netPhp.toLocaleString()}) to ${payoutChannel}`
      );

      setCashoutSuccess(`Successfully requested cashout of ${cashoutAmountCC} CC! Net: ₱${netPhp.toLocaleString()} scheduled for release this Friday.`);
      setAccountName('');
      setTimeout(() => {
        setShowCashoutModal(false);
        fetchDashboardData();
      }, 3000);

    } catch (e: any) {
      setCashoutError(e.message || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setCashinError("Invalid file type. Please upload an image or PDF proof of payment receipt.");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setCashinError("File is too large. Please upload an image smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofOfPaymentUrl(reader.result);
        setCashinError(null);
      }
    };
    reader.onerror = () => {
      setCashinError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCashinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashinError(null);
    setCashinSuccess(null);

    if (cashinAmountPhp <= 0) {
      setCashinError("Amount in PHP must be greater than zero.");
      return;
    }
    if (!cashinReference.trim()) {
      setCashinError("Reference number is required.");
      return;
    }
    if (!proofOfPaymentUrl) {
      setCashinError("Please upload a proof of payment receipt.");
      return;
    }

    setLoading(true);

    try {
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const requestDocRef = doc(db, 'cashin_requests', requestId);
      
      const computedCC = Number((cashinAmountPhp / 70).toFixed(4));
      const timestamp = new Date().toISOString();

      const requestData = {
        requestId,
        uid: userProfile.uid,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        email: userProfile.email || '',
        amountPHP: Number(cashinAmountPhp),
        computedCC: computedCC,
        ratePHPPerCC: 70,
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
        userProfile.uid,
        userProfile.email,
        'CASHIN_REQUEST',
        `Submitted cash-in request of ₱${Number(cashinAmountPhp).toLocaleString()} (${computedCC} CC) via ${cashinChannel}. Ref: ${cashinReference}`
      );

      setCashinSuccess(`Successfully requested cash-in of ₱${Number(cashinAmountPhp).toLocaleString()} (${computedCC} CC)! Please wait for admin approval.`);
      setCashinReference('');
      setCashinAccountName('');
      setCashinAccountNumber('');
      setProofOfPaymentUrl('');
      setCashinNotes('');
      
      setTimeout(() => {
        setShowCashinModal(false);
        fetchDashboardData();
      }, 3000);

    } catch (err: any) {
      setCashinError(err.message || "Failed to submit cash-in request.");
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingFriday = () => {
    const today = new Date();
    const resultDate = new Date(today);
    resultDate.setDate(today.getDate() + (5 + 7 - today.getDay()) % 7);
    return resultDate;
  };

  const currentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const handleMobileTabChange = (tab: CustomerTabType) => {
    setActiveMobileTab(tab);
    if (tab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'wallet') {
      const el = document.querySelector('.grid-cols-1');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (tab === 'scan') {
      onNavigate('member-registration');
    } else if (tab === 'notifications') {
      alert('All system alerts are currently cleared.');
    } else if (tab === 'profile') {
      onNavigate('profile');
    }
  };

  return (
    <div className="bg-[#030611] text-zinc-100 min-h-screen font-sans selection:bg-gold selection:text-black relative overflow-x-hidden">
      <style>{`
        .glass-card {
          background: rgba(10, 15, 30, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(6, 182, 212, 0.15);
        }
        .gold-border-card {
          background: rgba(10, 15, 30, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .neon-glow-btn {
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.35);
        }
        .gold-glow-btn {
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.25);
        }
      `}</style>

      {/* Premium Dark-Neon Header */}
      <header className="border-b border-cyan-950/30 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ChosenLogo size="sm" className="w-12 h-12" />
            <div>
              <span className="font-extrabold text-md tracking-wider text-zinc-100 uppercase gold-text leading-none block">
                I AM CHOSEN
              </span>
              <span className="block text-[8px] tracking-[0.3em] text-cyan-400 font-bold uppercase mt-1">
                INTERNATIONAL
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-cyan-400 font-mono">
              {userProfile.memberId}
            </span>

            {/* Language Selector */}
            <div className="relative hidden sm:block">
              <select
                value={selectedLanguage}
                onChange={(e: any) => setSelectedLanguage(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold rounded-lg pl-2 pr-6 py-1.5 focus:outline-none text-zinc-400 appearance-none select-none"
              >
                <option value="EN">EN</option>
                <option value="ZH">ZH</option>
                <option value="ES">ES</option>
              </select>
              <Globe className="w-2.5 h-2.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Notification Bell */}
            <button
              className="p-1.5 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-zinc-400 relative hover:text-cyan-400 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
            </button>

            <button
              onClick={() => onNavigate('profile')}
              className="text-xs font-semibold text-zinc-400 hover:text-gold transition-colors cursor-pointer"
            >
              Profile
            </button>
            <button
              onClick={() => onNavigate('member-registration')}
              className="hidden md:inline-flex items-center gap-1.5 bg-gold hover:brightness-110 text-black px-4 py-2 rounded-lg text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-black" /> Register Member
            </button>
            <button
              onClick={onLogout}
              className="text-zinc-400 hover:text-red-400 p-2 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-[100px] lg:pb-10">
        {/* Welcome Affiliate Banner */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-8 mb-10 relative overflow-hidden">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                Welcome back, {userProfile.fullName}!
              </h1>
              <p className="text-zinc-400 font-light flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                Active Account | {userProfile.role}
              </p>
              <p className="text-xs text-zinc-500 mt-2 uppercase tracking-wide">
                Build and track your network downline earnings in real-time.
              </p>
            </div>
            
            <button
              onClick={() => setShowCashoutModal(true)}
              className="bg-zinc-950 border border-zinc-800 hover:border-gold/60 hover:text-gold px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all duration-300 shadow-lg cursor-pointer text-white flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Request Cash-Out
            </button>
          </div>
        </div>

        {/* Wallets Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          
          {/* Chosen Wallet */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gold" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Chosen Wallet</span>
              <div className="w-7 h-7 bg-gold/10 rounded-lg flex items-center justify-center border border-gold/25 text-gold">
                <WalletIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-white mb-1">
              {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'} CC
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              ≈ ₱{wallet ? (wallet.chosenWalletBalance * 70).toLocaleString() : '0'}
            </div>
            <span className="block text-[9px] text-zinc-500 uppercase font-bold mt-2">Usable Credits</span>
            <button
              onClick={() => setShowCashinModal(true)}
              className="mt-4 w-full bg-zinc-900 border border-zinc-800 hover:border-gold/40 text-white hover:text-gold font-bold text-xs py-1.5 rounded transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <ArrowUpRight className="w-3 h-3" /> Top Up CC
            </button>
          </div>

          {/* Commission Wallet */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-amber-500" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Commission Wallet</span>
              <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/25 text-amber-500">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-white mb-1">
              {wallet ? wallet.commissionWalletBalance.toFixed(2) : '0.00'} CC
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              ≈ ₱{wallet ? (wallet.commissionWalletBalance * ccSettings.cashOutRatePHP).toLocaleString() : '0'}
            </div>
            <span className="block text-[9px] text-zinc-500 uppercase font-bold mt-2">Earnings Balance</span>
            <button
              onClick={() => setShowCashoutModal(true)}
              className="mt-4 w-full bg-zinc-900 border border-zinc-800 hover:border-gold/40 text-white hover:text-gold font-bold text-xs py-1.5 rounded transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Send className="w-3 h-3" /> Withdraw Earnings
            </button>
          </div>

          {/* Marketing Support Wallet */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-blue-500" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Marketing Support</span>
              <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/25 text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-white mb-1">
              {wallet ? wallet.marketingSupportWalletBalance.toFixed(2) : '0.00'} CC
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              ≈ ₱{wallet ? (wallet.marketingSupportWalletBalance * 70).toLocaleString() : '0'}
            </div>
            <span className="block text-[9px] text-zinc-500 uppercase font-bold mt-2">Co-op Funds</span>
            <div className="mt-4 h-8 flex items-center justify-center text-[10px] text-zinc-500 uppercase tracking-wider border border-zinc-900 bg-zinc-950 rounded">
              Locked Support Balance
            </div>
          </div>

          {/* Reward Wallet */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-500" />
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Reward Wallet</span>
              <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/25 text-emerald-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-white mb-1">
              {wallet ? wallet.rewardWalletBalance.toFixed(2) : '0.00'} CC
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              Points System Active
            </div>
            <span className="block text-[9px] text-zinc-500 uppercase font-bold mt-2">Gift & Incentive Tokens</span>
            <div className="mt-4 h-8 flex items-center justify-center text-[10px] text-zinc-500 uppercase tracking-wider border border-zinc-900 bg-zinc-950 rounded">
              Non-Withdrawable
            </div>
          </div>

        </div>

        {/* Affiliate Tool Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Business Cycle Panel */}
          <div className="lg:col-span-2 space-y-8">
            
            {businessCycle ? (
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
                <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gold" /> Unilevel Business Cycle (Safety Cap)
                  </h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold border uppercase ${
                    businessCycle.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                  }`}>
                    {businessCycle.status} Cycle
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Purchased Package</span>
                    <span className="block text-lg font-black text-white uppercase mt-1">{businessCycle.packageLevel}</span>
                    <span className="block text-xs text-gold font-mono mt-0.5">{businessCycle.packageValueCC} CC</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Earning Cap Limit</span>
                    <span className="block text-lg font-black text-white mt-1">{businessCycle.qualifiedEarningsLimitCC} CC</span>
                    <span className="block text-xs text-zinc-500 font-mono mt-0.5">2.5x Package Value</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Current Qualified Earnings</span>
                    <span className="block text-lg font-black text-gold mt-1">{businessCycle.currentQualifiedEarningsCC} CC</span>
                    <span className="block text-xs text-zinc-400 font-mono mt-0.5">{((businessCycle.currentQualifiedEarningsCC / businessCycle.qualifiedEarningsLimitCC) * 100).toFixed(0)}% Utilized</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Cycle Consumption:</span>
                    <span className="text-zinc-300 font-bold">{businessCycle.currentQualifiedEarningsCC} / {businessCycle.qualifiedEarningsLimitCC} CC</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="gold-gradient h-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (businessCycle.currentQualifiedEarningsCC / businessCycle.qualifiedEarningsLimitCC) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-mono">
                    <span>Remaining Headroom</span>
                    <span className="text-gold font-bold">{businessCycle.remainingCapacityCC} CC Capacity Left</span>
                  </div>
                </div>

                <div className="text-zinc-500 text-xs leading-relaxed font-light bg-zinc-900/30 p-4 rounded-xl border border-zinc-850">
                  <strong className="text-zinc-300">Sustainable Lifecycle Shield:</strong> In accordance with our official business structure, standard accounts have a strict 2.5x total commission earnings capacity. Once reached, you must repurchase or upgrade your pack to resume earning bonuses.
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative text-center py-10">
                <Award className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">No Business Package Cycle Active</h4>
                <p className="text-zinc-500 text-xs mt-2 max-w-sm mx-auto">
                  You are registered as an Affiliate, but do not have an active package tier cycle on file. Please purchase a Bronze, Silver, Gold, Platinum, or Diamond package.
                </p>
              </div>
            )}

            {/* Simulated Commission Tool - Highly request compliance testing */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gold" /> Unilevel Direct Referral Tester
              </h3>
              <p className="text-zinc-500 text-xs mb-6 uppercase tracking-wider font-mono">
                Simulate Direct Referral downline activations to test safety cap metrics
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  disabled={simulating || (businessCycle && businessCycle.status === 'Completed')}
                  onClick={() => handleSimulateCommission(140, 'Direct Referral Bronze (140 CC / ₱9,800)')}
                  className="bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs p-3 rounded-lg border border-zinc-800 transition-colors cursor-pointer text-center flex flex-col justify-center items-center gap-1 active:scale-95"
                >
                  <span className="font-extrabold text-gold uppercase text-[9px] tracking-widest block">Simulate Bronze</span>
                  <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">Direct Earn: 5.6 CC (4%)</span>
                </button>
                <button
                  disabled={simulating || (businessCycle && businessCycle.status === 'Completed')}
                  onClick={() => handleSimulateCommission(980, 'Direct Referral Silver (980 CC / ₱68,600)')}
                  className="bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs p-3 rounded-lg border border-zinc-800 transition-colors cursor-pointer text-center flex flex-col justify-center items-center gap-1 active:scale-95"
                >
                  <span className="font-extrabold text-gold uppercase text-[9px] tracking-widest block">Simulate Silver</span>
                  <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">Direct Earn: 39.2 CC (4%)</span>
                </button>
                <button
                  disabled={simulating || (businessCycle && businessCycle.status === 'Completed')}
                  onClick={() => handleSimulateCommission(4200, 'Direct Referral Gold (4,200 CC / ₱294,000)')}
                  className="bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs p-3 rounded-lg border border-zinc-800 transition-colors cursor-pointer text-center flex flex-col justify-center items-center gap-1 active:scale-95"
                >
                  <span className="font-extrabold text-gold uppercase text-[9px] tracking-widest block">Simulate Gold</span>
                  <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">Direct Earn: 168.0 CC (4%)</span>
                </button>
              </div>
            </div>

            {/* Transaction Ledger & Logs */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-6">
                <Clock className="w-4 h-4 text-gold" /> Transaction History & Wallet Ledgers
              </h3>

              {transactions.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-light">
                  No ledger records found for this account.
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {transactions.map((tx, i) => (
                    <div key={tx.id || i} className="bg-zinc-900/40 border border-zinc-850 p-3.5 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{tx.description || 'Wallet Transaction'}</span>
                          <span className={`text-[8px] px-2 py-0.2 rounded uppercase font-mono font-extrabold ${
                            tx.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
                          }`}>
                            {tx.type}
                          </span>
                        </div>
                        <span className="block text-[9px] text-zinc-500 font-mono mt-1">
                          {new Date(tx.timestamp || tx.createdAt).toLocaleString()} • ID: {tx.id} • Wallet: {tx.walletType}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-sm ${
                        tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-zinc-300'
                      }`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount} CC
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Invite tools, referral, sponsor details */}
          <div className="space-y-8">
            
            {/* Referral Links Section */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
              <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-gold" /> Invite & Refer Members
              </h3>

              <p className="text-zinc-500 text-xs font-light mb-4 leading-relaxed">
                Referral registrations must strictly be completed using sponsor links. Copy your referral link or display your personal QR code.
              </p>

              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl space-y-4">
                <div>
                  <span className="block text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-1.5">Sponsor Invite Link</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/register?ref=${userProfile.sponsorCode}`}
                      className="w-full bg-black border border-zinc-800 text-[10px] text-zinc-300 font-mono px-3 py-2 rounded focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="bg-zinc-950 border border-zinc-800 hover:border-gold/40 hover:text-gold p-2 rounded text-zinc-400 cursor-pointer transition-colors"
                      title="Copy Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {copySuccess && (
                    <span className="block text-[9px] text-emerald-400 font-bold uppercase mt-1 animate-pulse">Copied successfully!</span>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-850">
                  <span className="block text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-2">QR Code Badge</span>
                  <div className="bg-white p-3 rounded-xl max-w-[130px] mx-auto border border-zinc-300 shadow-sm">
                    {/* Generates a clean custom visual placeholder mockup representing the QR Code link */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/register?ref=${userProfile.sponsorCode}`)}`}
                      alt="Referral QR Code"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="block text-[8px] text-center text-zinc-500 font-mono uppercase mt-2">Scan to join I AM CHOSEN</span>
                </div>

                <button
                  onClick={handleShare}
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-gold/40 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Invite Badge
                </button>
              </div>
            </div>

            {/* Member Registration Placeholder */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <Zap className="w-8 h-8 text-gold/60 mx-auto mb-3" />
              <h4 className="font-bold text-white uppercase text-xs mb-1.5">Direct Member Onboarding</h4>
              <p className="text-zinc-400 text-xs font-light leading-relaxed mb-4">
                Sponsors can directly register downlines from their dashboard. Balance checks and automated wallet transactions are performed.
              </p>
              <button
                onClick={() => onNavigate('member-registration')}
                className="w-full bg-gold hover:brightness-110 text-black font-extrabold text-xs py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-gold/10"
              >
                Launch Onboarding Form
              </button>
            </div>

            {/* Sponsor details */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-gold" /> Referral Sponsor Info
              </h3>

              {!userProfile.referredBy ? (
                <div className="text-zinc-500 text-xs py-4 text-center">
                  Direct corporate position.
                </div>
              ) : sponsorLoading ? (
                <div className="text-zinc-500 text-xs py-4 text-center animate-pulse">
                  Fetching sponsor details...
                </div>
              ) : sponsor ? (
                <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">Sponsor Name:</span>
                    <span className="font-bold text-white">{sponsor.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">Member ID:</span>
                    <span className="font-mono text-zinc-300">{sponsor.memberId}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Sponsor Code:</span>
                    <span className="font-mono text-gold uppercase font-bold">{sponsor.sponsorCode}</span>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-xs py-4 text-center">
                  Direct corporate position.
                </div>
              )}
            </div>

            {/* Cash-In Requests History */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gold" /> Cash-In Requests
              </h3>

              {cashinHistory.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-light">
                  No cash-in requests recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {cashinHistory.map((req, i) => (
                    <div key={req.requestId || i} className="bg-zinc-900/40 border border-zinc-850 p-3.5 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-xs text-white">{req.amountCC} CC</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                            req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            req.status === 'Declined' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <span className="block text-[9px] text-zinc-500 font-mono">
                          {new Date(req.requestDate || req.requestedAt).toLocaleDateString()} • Ref: {req.referenceNumber}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-zinc-400 font-mono">₱{(req.amountPhp || req.amountPHP || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Cash-Out Modal */}
      {showCashoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 my-8 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />
            
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2 gold-text">Request Cash-Out / Withdrawal</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-6">
              Minimum cash-out is 100 CC | Withdrawal day is Monday
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3.5 rounded-xl text-[11px] mb-4 space-y-1">
              <span className="block font-bold uppercase tracking-wider text-xs">Official Plan Withdrawal Window</span>
              <p className="font-light leading-relaxed">
                Requests must be submitted strictly on Mondays for audit review. Releases are issued the upcoming Friday.
              </p>
              <span className="block font-bold uppercase mt-1 font-mono text-[9px]">Today: {currentDayName()} (Test Override Active)</span>
            </div>

            {cashoutError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs mb-4">
                {cashoutError}
              </div>
            )}

            {cashoutSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs mb-4">
                {cashoutSuccess}
              </div>
            )}

            <form onSubmit={handleCashoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Amount in Chosen Credits (CC) to Cash-Out
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono font-bold">CC</span>
                  <input
                    type="number"
                    required
                    min="100"
                    step="1"
                    value={cashoutAmountCC}
                    onChange={(e) => setCashoutAmountCC(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:outline-none transition-colors text-white"
                  />
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/40 p-4 rounded-xl text-xs space-y-2">
                <span className="block font-bold text-zinc-300 uppercase tracking-widest text-[10px] mb-1">Official Plan Calculations</span>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gross PHP (1 CC = ₱{ccSettings.cashOutRatePHP}):</span>
                  <span className="text-white font-mono">₱{(cashoutAmountCC * ccSettings.cashOutRatePHP).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Withholding Tax (10%):</span>
                  <span className="text-red-400 font-mono">- ₱{(cashoutAmountCC * ccSettings.cashOutRatePHP * 0.1).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Administrative Fee:</span>
                  <span className="text-red-400 font-mono">- ₱70.00 (1 CC)</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800/60 pt-2 mt-1 text-sm font-bold">
                  <span className="text-gold">Net Proceeds (PHP):</span>
                  <span className="text-gold font-mono">
                    ₱{Math.max(0, (cashoutAmountCC * ccSettings.cashOutRatePHP - (cashoutAmountCC * ccSettings.cashOutRatePHP * 0.1) - 70)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Payout Channel
                </label>
                <select
                  value={payoutChannel}
                  onChange={(e: any) => setPayoutChannel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
                >
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Account Name & Number / Details
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz - 09171234567"
                  value={accountNumber}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCashoutModal(false)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 gold-gradient hover:brightness-110 text-black py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Confirm & Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash-In Modal */}
      {showCashinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 my-8 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />
            
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2 gold-text">Request Cash-In / Top Up</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-6">
              1 CC = ₱70.00 | Add usable credits to your Chosen Wallet
            </p>

            {cashinError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs mb-4">
                {cashinError}
              </div>
            )}

            {cashinSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs mb-4">
                {cashinSuccess}
              </div>
            )}

            <form onSubmit={handleCashinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Amount in Philippine Pesos (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono font-bold">₱</span>
                  <input
                    type="number"
                    required
                    min="70"
                    step="1"
                    value={cashinAmountPhp}
                    onChange={(e) => setCashinAmountPhp(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-8 pr-4 py-2.5 text-sm font-mono focus:outline-none transition-colors text-white"
                    placeholder="e.g. 3500"
                  />
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/40 p-4 rounded-xl text-xs space-y-2">
                <span className="block font-bold text-zinc-300 uppercase tracking-widest text-[10px] mb-1">Auto-Computed Credits</span>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Rate:</span>
                  <span className="text-white font-mono">1 CC = ₱70.00</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800/60 pt-2 mt-1 text-sm font-bold">
                  <span className="text-gold">Computed CC:</span>
                  <span className="text-gold font-mono">
                    {(cashinAmountPhp / 70).toFixed(4)} CC
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Payment Method / Target Account
                </label>
                <select
                  value={cashinChannel}
                  onChange={(e: any) => setCashinChannel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
                >
                  <option value="GCash">GCash (Company: 0917-111-2222)</option>
                  <option value="Maya">Maya (Company: 0917-111-2222)</option>
                  <option value="Bank">Bank Transfer (BDO: 00123-4567-890)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                    Sender Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juan dela Cruz"
                    value={cashinAccountName}
                    onChange={(e) => setCashinAccountName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                    Sender Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567"
                    value={cashinAccountNumber}
                    onChange={(e) => setCashinAccountNumber(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Transaction Reference Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste reference / receipt transaction code"
                  value={cashinReference}
                  onChange={(e) => setCashinReference(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Drag-and-drop & Click to Upload Region */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Upload Proof of Payment Receipt (Required)
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-gold bg-gold/5' : proofOfPaymentUrl ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-gold/40'
                  }`}
                  onClick={() => document.getElementById('affiliate-cashin-file-upload')?.click()}
                >
                  <input
                    id="affiliate-cashin-file-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  
                  {proofOfPaymentUrl ? (
                    <div className="space-y-2">
                      {proofOfPaymentUrl.startsWith('data:application/pdf') ? (
                        <div className="text-xs font-semibold text-emerald-400">PDF Document Selected</div>
                      ) : (
                        <img
                          src={proofOfPaymentUrl}
                          alt="Proof of Payment Preview"
                          className="max-h-24 mx-auto rounded object-contain border border-zinc-800"
                        />
                      )}
                      <p className="text-[10px] text-zinc-500">Click or drag another file to replace receipt</p>
                    </div>
                  ) : (
                    <div className="py-2 space-y-1">
                      <div className="text-zinc-400 font-bold text-xs">Drag and Drop receipt image here</div>
                      <div className="text-[10px] text-zinc-500">or click to browse from device</div>
                      <div className="text-[9px] text-zinc-600 font-mono uppercase">Supports Images and PDFs</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Notes field */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Payment details, branch name, or any additional message..."
                  value={cashinNotes}
                  onChange={(e) => setCashinNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2 text-xs focus:outline-none transition-colors h-16 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCashinModal(false);
                    setProofOfPaymentUrl('');
                    setCashinNotes('');
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 gold-gradient hover:brightness-110 text-black py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Submit Cash-In"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <BottomNavigation
        activeTab={activeMobileTab}
        setActiveTab={handleMobileTabChange}
        unreadCount={notifications.filter(n => n.unread).length}
      />

      {/* Footer version indicator */}
      <footer className="py-8 border-t border-cyan-950/20 bg-zinc-950/40 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version v1.4.1 • Build 000011
        </span>
      </footer>
    </div>
  );
}

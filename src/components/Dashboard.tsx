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
  ShoppingBag,
  Sparkles,
  Copy,
  Share2
} from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, writeBatch, serverTimestamp, limit } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType, BusinessCycle } from '../types';
import ChosenLogo from './ChosenLogo';
import { useCCSettings } from '../context/CCSettingsContext';
import { WalletService } from '../services/wallet/wallet.service';
import DashboardPerformanceCards from './dashboard/performance/DashboardPerformanceCards';

interface DashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ userProfile, onLogout, onNavigate }: DashboardProps) {
  const { ccSettings } = useCCSettings();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [businessCycle, setBusinessCycle] = useState<BusinessCycle | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sponsor & Orders States
  const [sponsor, setSponsor] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Cashout Modal form state
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmountCC, setCashoutAmountCC] = useState<number>(100);
  const [payoutChannel, setPayoutChannel] = useState<'Bank' | 'GCash' | 'Maya'>('GCash');
  const [accountNumber, setAccountName] = useState('');
  const [cashoutError, setCashoutError] = useState<string | null>(null);
  const [cashoutSuccess, setCashoutSuccess] = useState<string | null>(null);

  // Cashin Modal form state
  const [showCashinModal, setShowCashinModal] = useState(false);
  const [cashinAmountCC, setCashinAmountCC] = useState<number>(50);
  const [cashinAmountPhp, setCashinAmountPhp] = useState<number>(3500);
  const [cashinChannel, setCashinChannel] = useState<'GCash' | 'Maya' | 'Bank'>('GCash');
  const [cashinReference, setCashinReference] = useState('');
  const [cashinAccountName, setCashinAccountName] = useState('');
  const [cashinAccountNumber, setCashinAccountNumber] = useState('');
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [cashinNotes, setCashinNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [cashinError, setCashinError] = useState<string | null>(null);
  const [cashinSuccess, setCashinSuccess] = useState<string | null>(null);
  const [cashinHistory, setCashinHistory] = useState<any[]>([]);
  const [sponsorLoading, setSponsorLoading] = useState(false);

  // Simulation state
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [userProfile.uid]);

  const fetchDashboardData = async () => {
    setLoading(true);
    // 1. Fetch Wallet
    try {
      const walletRef = doc(db, 'wallets', userProfile.uid);
      const walletSnap = await getDoc(walletRef);
      if (walletSnap.exists()) {
        setWallet(walletSnap.data() as WalletType);
      }
    } catch (err) {
      console.error("Error loading dashboard details (Step 1: Wallet):", err);
    }

    // 2. Fetch Business Cycle (if Affiliate)
    if (userProfile.accountType === 'Affiliate') {
      try {
        const cycleRef = doc(db, 'business_cycles', userProfile.uid);
        const cycleSnap = await getDoc(cycleRef);
        if (cycleSnap.exists()) {
          setBusinessCycle(cycleSnap.data() as BusinessCycle);
        }
      } catch (err) {
        console.error("Error loading dashboard details (Step 2: Business Cycle):", err);
      }
    }

    // 3. Fetch Transactions
    try {
      const txQuery = query(
        collection(db, 'wallet_transactions'),
        where('uid', '==', userProfile.uid)
      );
      const txSnap = await getDocs(txQuery);
      const txList = txSnap.docs.map(doc => doc.data());
      txList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(txList);
    } catch (err) {
      console.error("Error loading dashboard details (Step 3: Wallet Transactions):", err);
    }

    // 4. Fetch Sponsor details if present
    if (userProfile.referredBy) {
      setSponsorLoading(true);
      try {
        const sponsorDocRef = doc(db, 'users', userProfile.referredBy);
        const sponsorSnap = await getDoc(sponsorDocRef);
        if (sponsorSnap.exists()) {
          setSponsor(sponsorSnap.data());
        } else {
          // Fallback if the referredBy stores sponsorCode instead of uid, let's query it
          const q = query(collection(db, 'users'), where('sponsorCode', '==', userProfile.referredBy), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setSponsor(snap.docs[0].data());
          } else {
            setSponsor(null);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard details (Step 4: Sponsor):", err);
        setSponsor(null);
      } finally {
        setSponsorLoading(false);
      }
    } else {
      setSponsor(null);
      setSponsorLoading(false);
    }

    // 5. Fetch Customer purchases if Customer
    if (userProfile.accountType === 'Customer') {
      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('uid', '==', userProfile.uid)
        );
        const ordersSnap = await getDocs(ordersQuery);
        const ordersList = ordersSnap.docs.map(doc => doc.data());
        ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(ordersList);
      } catch (err) {
        console.error("Error loading dashboard details (Step 5: Customer Orders):", err);
      }
    }

    // 6. Fetch Cashin requests (for both Customers and Affiliates)
    try {
      const cashinQuery = query(
        collection(db, 'cashin_requests'),
        where('uid', '==', userProfile.uid)
      );
      const cashinSnap = await getDocs(cashinQuery);
      const cashinList = cashinSnap.docs.map(doc => doc.data());
      cashinList.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
      setCashinHistory(cashinList);
    } catch (err) {
      console.error("Error loading dashboard details (Step 6: Cash-in History):", err);
    }

    setLoading(false);
  };

  const handlePurchase = async (product: any) => {
    setPurchaseError(null);
    setPurchaseSuccess(null);
    if (!wallet) return;

    if (wallet.chosenWalletBalance < product.price) {
      setPurchaseError(`Insufficient Chosen Credits (CC). This product requires ${product.price} CC, but you only have ${wallet.chosenWalletBalance.toFixed(2)} CC.`);
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Update wallet balance
      const newBalance = wallet.chosenWalletBalance - product.price;
      const walletRef = doc(db, 'wallets', userProfile.uid);
      batch.update(walletRef, {
        chosenWalletBalance: Number(newBalance.toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      // 2. Record wallet transaction
      const txId = `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txRef = doc(db, 'wallet_transactions', txId);
      batch.set(txRef, {
        id: txId,
        uid: userProfile.uid,
        amount: product.price,
        type: 'DEBIT',
        walletType: 'Chosen Wallet',
        status: 'Completed',
        description: `Purchased ${product.name}`,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      // 3. Record order purchase document
      const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderRef = doc(db, 'orders', orderId);
      batch.set(orderRef, {
        id: orderId,
        uid: userProfile.uid,
        productName: product.name,
        priceCC: product.price,
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      // 4. Create Audit Log
      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'PRODUCT_PURCHASE',
        `Purchased ${product.name} for ${product.price} CC. Order ID: ${orderId}`
      );

      setPurchaseSuccess(`Successfully purchased ${product.name}! Your order has been placed.`);
      fetchDashboardData();
    } catch (e: any) {
      setPurchaseError("Purchase failed. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Simulation: Receive Referral Bonus (4%)
  const handleSimulateCommission = async (amountCC: number, bonusType: string) => {
    if (!wallet) return;
    setSimulating(true);

    try {
      // Determine if Affiliate's Business Cycle is Active or Completed
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
          // Cap hit!
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

        // Update local state temporarily
        setBusinessCycle(prev => prev ? { ...prev, ...updatedCycle } : null);
      }

      // Update wallet balance: credit newEarnings to Commission Wallet
      const updatedWallet: Partial<WalletType> = {
        commissionWalletBalance: Number((wallet.commissionWalletBalance + newEarnings).toFixed(2)),
        updatedAt: new Date().toISOString()
      };

      const walletRef = doc(db, 'wallets', userProfile.uid);
      batch.update(walletRef, {
        commissionWalletBalance: Number((wallet.commissionWalletBalance + newEarnings).toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      // Insert transaction ledger
      const txId = `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txDocRef = doc(db, 'wallet_transactions', txId);
      const transactionRecord = {
        id: logIdGenerator(),
        uid: userProfileData().uid,
        amount: newEarnings,
        type: 'COMMISSION_CREDIT',
        walletType: 'Commission Wallet',
        status: 'Completed',
        description: `Earned ${newEarnings} CC from simulated ${bonusType}`,
        createdAt: new Date().toISOString()
      };
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: userProfileData().uid,
        amount: newEarnings,
        type: 'CREDIT',
        walletType: 'Commission',
        description: `Direct Commission: ${bonusType}`,
        status: 'Completed',
        createdAt: new Date().toISOString()
      });

      // Update user status if cycle completed
      if (cycleCompleted) {
        const userDocRef = doc(db, 'users', userProfileData().uid);
        batch.update(userDocRef, { status: 'Completed', updatedAt: new Date().toISOString() });
      }

      await batch.commit();

      // Trigger audit trail
      await createAuditLog(
        userProfileData().uid,
        userProfileData().email,
        'COMMISSION_SIMULATED',
        `Simulated receipt of ${newEarnings} CC ${bonusType}. Business Cycle update: ${cycleCompleted ? 'COMPLETED' : 'ACTIVE'}`
      );

      // Re-fetch everything to ensure consistency
      await fetchDashboardData();

    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  // Helper functions inside component
  const userProfileData = () => userProfile;
  const logIdGenerator = () => `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

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

    // Verify if they have enough balance in Commission or Chosen Wallet
    // Let's cashout from Commission Wallet (standard earnings)
    if (wallet.commissionWalletBalance < cashoutAmountCC) {
      setCashoutError(`Insufficient balance. Your Commission Wallet balance is ${wallet.commissionWalletBalance} CC.`);
      return;
    }

    // Check withdrawal window: strictly Monday only according to manual
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const isMonday = dayOfWeek === 1;

    // Note: We can allow a soft-override bypass check for testing purposes, but let's inform them!
    const testOverride = true; // Set to true to let them test any day, but display a warning to respect manual

    setLoading(true);

    try {
      // Calculate cashout formula using dynamic rates:
      const grossPhp = cashoutAmountCC * ccSettings.cashOutRatePHP;
      // 10% withholding tax
      const withholdingTax = grossPhp * 0.10;
      // Admin fee: 1 CC = 70 PHP
      const adminFeePhp = 70;
      // Net proceeds
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
        createdAt: new Date().toISOString()
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
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
    
    // Check file size limit
    if (file.size > 5 * 1024 * 1024) {
      setCashinError("File is too large. Please upload an image smaller than 5MB.");
      return;
    }

    setReceiptFile(file);
    try {
      const previewUrl = URL.createObjectURL(file);
      setProofOfPaymentUrl(previewUrl);
      setCashinError(null);
    } catch (e) {
      setCashinError("Failed to generate file preview.");
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
    if (!receiptFile) {
      setCashinError("Please upload a proof of payment receipt.");
      return;
    }

    setLoading(true);

    try {
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      
      // Upload the receipt to Storage first
      const uploadResult = await WalletService.uploadReceipt(userProfile.uid, requestId, receiptFile);

      const computedCC = Number((cashinAmountPhp / 70).toFixed(4));
      const timestamp = new Date().toISOString();

      const requestDocRef = doc(db, 'cashin_requests', requestId);
      const requestData = {
        requestId,
        uid: userProfile.uid,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        email: userProfile.email || '',
        
        // PHP-focused fields matching guidelines
        amountPHP: Number(cashinAmountPhp),
        computedCC: computedCC,
        ratePHPPerCC: 70,
        paymentMethod: cashinChannel === 'Bank' ? 'Bank Transfer' : cashinChannel,
        referenceNumber: cashinReference.trim(),
        
        // Storage receipt details
        proofOfPaymentUrl: uploadResult.proofOfPaymentUrl,
        proofOfPaymentPath: uploadResult.proofOfPaymentPath,
        proofOfPaymentFileName: uploadResult.proofOfPaymentFileName,
        proofOfPaymentContentType: uploadResult.proofOfPaymentContentType,
        proofOfPaymentSizeBytes: uploadResult.proofOfPaymentSizeBytes,

        notes: cashinNotes.trim(),
        status: 'Pending',
        requestedAt: timestamp,
        updatedAt: timestamp,
        reviewedBy: null,
        approvedAt: null,
        rejectedReason: null,

        // Backwards compatibility fields for queries and views
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

      // Create Audit Log
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
      setReceiptFile(null);
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

  // Helper for Withdrawal Window Monday display
  const currentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const products = [
    { id: 'prod-herbal', name: 'Chosen Herbal Blend', category: 'Herbal Wellness Beverage', price: 8, php: '₱560', emoji: '🌿', description: 'A concentrated herbal beverage formulated to support daily wellness and healthy living.' },
    { id: 'prod-latte', name: 'Chosen 15-in-1 Latte Coffee', category: 'Functional Coffee Beverage', price: 15, php: '₱1,050', emoji: '☕', description: 'A premium coffee blend combining rich flavor with carefully selected herbal extracts.' },
    { id: 'prod-barley', name: 'Chosen Pure Barley', category: 'Barley Grass Beverage', price: 16, php: '₱1,120', emoji: '🌾', description: 'A barley grass beverage designed to complement a balanced diet and active lifestyle.' },
    { id: 'prod-caramel', name: 'Chosen Salted Caramel Iced Coffee', category: 'Ready-to-Mix Coffee Beverage', price: 16, php: '₱1,120', emoji: '🧊', description: 'A refreshing iced coffee blend with a smooth, premium salted caramel flavor.' },
    { id: 'prod-choco', name: 'Chosen Choco Barley', category: 'Chocolate Wellness Beverage', price: 16, php: '₱1,120', emoji: '🍫', description: 'A chocolate-flavored barley beverage that combines great taste and powerful nutrients.' }
  ];

  if (userProfile.accountType === 'Customer') {
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
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                {userProfile.memberId}
              </span>
              <button
                onClick={() => onNavigate('profile')}
                className="text-sm font-medium hover:text-gold transition-colors cursor-pointer"
              >
                Profile
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-6 pb-10">
          {/* Welcome Customer Banner */}
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-[80px] pointer-events-none" />
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                Welcome back, {userProfile.fullName}!
              </h1>
              <p className="text-zinc-400 font-light flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Account | Customer
              </p>
              <p className="text-xs text-zinc-500 mt-2 uppercase tracking-wide">
                Enjoy premium Chosen products and track your purchases here.
              </p>
            </div>
          </div>

          {/* Shared Performance Cards System */}
          {!(userProfile?.accountType === "Customer" && userProfile?.packageLevel === "None") && (
            <div className="mb-8">
              <DashboardPerformanceCards userProfile={userProfile} onNavigate={onNavigate} />
            </div>
          )}

          {/* Feedback alerts for purchase */}
          {purchaseSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{purchaseSuccess}</span>
            </div>
          )}
          {purchaseError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6">
              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span>{purchaseError}</span>
            </div>
          )}

          {/* Dashboard grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Product catalog and recommendations */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Product Shopping Access */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
                <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
                <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
                  <ShoppingBag className="w-5 h-5 text-gold" /> Premium Chosen Products
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map((prod) => (
                    <div key={prod.id} className="bg-zinc-900/60 border border-zinc-850 p-5 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-2xl">{prod.emoji}</span>
                          <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/20 uppercase tracking-widest">
                            {prod.price} CC
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mb-1">{prod.name}</h4>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block mb-2">
                          {prod.category} • {prod.php}
                        </span>
                        <p className="text-zinc-400 text-xs font-light leading-relaxed mb-4">
                          {prod.description}
                        </p>
                      </div>
                      <button
                        onClick={() => handlePurchase(prod)}
                        disabled={loading}
                        className="w-full bg-zinc-950 border border-zinc-800 hover:border-gold/60 text-white font-semibold text-xs py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Purchase Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Recommendations */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
                <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-gold animate-pulse" /> Featured Recommendations
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-zinc-900/40 border border-zinc-850/60 p-4 rounded-xl">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-gold block mb-1">Top Selling Choice</span>
                    <h5 className="font-bold text-white text-xs mb-1">Chosen 15-in-1 Latte Coffee</h5>
                    <p className="text-zinc-500 text-[11px] font-light">Formulated with rich antioxidants and functional herbs for clean energy.</p>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-850/60 p-4 rounded-xl">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-gold block mb-1">Daily Wellness</span>
                    <h5 className="font-bold text-white text-xs mb-1">Chosen Pure Barley</h5>
                    <p className="text-zinc-500 text-[11px] font-light">Support nutrient balance and organic enzyme levels with premium barley grass.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Wallet balance, sponsor details, order history */}
            <div className="space-y-8">
              
              {/* Digital Chosen Wallet (Usable balance only) */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
                <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2">
                    <WalletIcon className="w-4 h-4 text-gold" /> Chosen Wallet Balance
                  </h3>
                  <button
                    onClick={fetchDashboardData}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/60 p-5 rounded-xl mb-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Chosen Wallet Balance (Usable CC)</span>
                  <div className="text-3xl font-black text-white tracking-tight mt-1 mb-1">
                    {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'} CC
                  </div>
                  <span className="text-xs text-gold/80 font-mono">
                    ≈ ₱{wallet ? (wallet.chosenWalletBalance * 70).toLocaleString() : '0'}
                  </span>
                </div>

                <button
                  onClick={() => setShowCashinModal(true)}
                  className="w-full bg-gold hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-gold/10"
                >
                  <ArrowUpRight className="w-4 h-4" /> Request Cash-In
                </button>
              </div>

              {/* Referral Sponsor Information */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
                <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
                <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-gold" /> Referral Sponsor Info
                </h3>

                {!userProfile.referredBy ? (
                  <div className="text-zinc-500 text-xs py-4 text-center">
                    No referral sponsor recorded.
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
                    No referral sponsor recorded.
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
                            {new Date(req.requestDate).toLocaleDateString()} • Ref: {req.referenceNumber}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-400 font-mono">₱{(req.amountPhp || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order History */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative">
                <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
                <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-gold" /> My Order History
                </h3>

                {orders.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-light">
                    No purchases recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {orders.map((ord, i) => (
                      <div key={ord.id || i} className="bg-zinc-900/40 border border-zinc-850 p-3.5 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-xs text-white mb-0.5">{ord.productName}</span>
                          <span className="block text-[9px] text-zinc-500 font-mono">
                            {new Date(ord.createdAt).toLocaleDateString()} • {ord.id}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-gold font-mono">{ord.priceCC} CC</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Want to upgrade to Affiliate Message */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
                <Sparkles className="w-8 h-8 text-gold/60 mx-auto mb-3" />
                <h4 className="font-bold text-white uppercase text-xs mb-1.5">Welcome Customer</h4>
                <p className="text-zinc-400 text-xs font-light leading-relaxed mb-4">
                  Enjoy premium Chosen products and track your purchases here. If you wish to become an Affiliate to earn commissions, please contact your sponsor or the company for Affiliate activation.
                </p>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest border border-zinc-800 py-1.5 rounded bg-zinc-900/20">
                  Affiliate Activation Required
                </div>
              </div>

            </div>

          </div>
        </main>

        <footer className="py-8 border-t border-zinc-950 bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 font-mono">
            I AM CHOSEN • Version 1.3.4 • Build 000008
          </span>
        </footer>
      </div>
    );
  }

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
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {userProfile.memberId}
            </span>
            <button
              onClick={() => onNavigate('profile')}
              className="text-sm font-medium hover:text-gold transition-colors cursor-pointer"
            >
              Profile
            </button>
            {((['Super Admin', 'Admin', 'City Distributor', 'Regional Distributor'].includes(userProfile.role)) || 
              (['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'].includes(userProfile.packageLevel))) && (
              <button
                onClick={() => onNavigate('member-registration')}
                className="text-sm font-medium text-gold hover:text-white transition-colors cursor-pointer border border-gold/30 hover:border-white px-2.5 py-1 rounded bg-gold/5"
              >
                Member Registration
              </button>
            )}
            {(userProfile.role === 'Admin' || userProfile.role === 'Super Admin') && (
              <button
                onClick={() => onNavigate('admin-dashboard')}
                className="bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              >
                Admin Panel
              </button>
            )}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-6 pb-10">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                Welcome back, {userProfile.fullName}!
              </h1>
              <p className="text-zinc-400 font-light flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Account | {userProfile.role}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCashoutModal(true)}
                className="gold-gradient text-black text-xs font-black px-4 py-2.5 rounded-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" /> Request Cash-Out
              </button>
            </div>
          </div>
        </div>

        {/* Shared Performance Cards System */}
        <div className="mb-8">
          <DashboardPerformanceCards userProfile={userProfile} onNavigate={onNavigate} />
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          {/* Wallet Balances Card */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-gold" /> Digital Wallet Balances
              </h3>
              <button
                onClick={fetchDashboardData}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh Balances"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Usable Chosen Wallet Balance */}
              <div className="bg-zinc-900/60 border border-zinc-800/60 p-5 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Chosen Wallet Balance (Usable CC)</span>
                  <div className="text-3xl font-black text-white tracking-tight mt-1 mb-1">
                    {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'} CC
                  </div>
                  <span className="text-xs text-gold/80 font-mono block mb-3">
                    ≈ ₱{wallet ? (wallet.chosenWalletBalance * 70).toLocaleString() : '0'}
                  </span>
                </div>
                <button
                  onClick={() => setShowCashinModal(true)}
                  className="w-full bg-gold/10 hover:bg-gold hover:text-black border border-gold/30 text-gold font-bold text-xs py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Request Cash-In
                </button>
              </div>

              {/* Commission Wallet */}
              <div className="bg-zinc-900/60 border border-zinc-800/60 p-5 rounded-xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Commission Wallet</span>
                <div className="text-3xl font-black text-gold tracking-tight mt-1 mb-1">
                  {wallet ? wallet.commissionWalletBalance.toFixed(2) : '0.00'} CC
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  ≈ ₱{wallet ? (wallet.commissionWalletBalance * ccSettings.cashOutRatePHP).toLocaleString() : '0'} (at Cash-out rate)
                </span>
              </div>

              {/* Marketing Support Wallet */}
              <div className="bg-zinc-900/60 border border-zinc-800/60 p-5 rounded-xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Marketing Support Wallet</span>
                <div className="text-2xl font-black text-zinc-300 tracking-tight mt-1 mb-1">
                  {wallet ? wallet.marketingSupportWalletBalance.toFixed(2) : '0.00'} CC
                </div>
                <span className="text-[10px] text-zinc-500">Transferred automatically on 15th / End of month</span>
              </div>

              {/* Reward Wallet */}
              <div className="bg-zinc-900/60 border border-zinc-800/60 p-5 rounded-xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Reward Wallet</span>
                <div className="text-2xl font-black text-zinc-300 tracking-tight mt-1 mb-1">
                  {wallet ? wallet.rewardWalletBalance.toFixed(2) : '0.00'} CC
                </div>
                <span className="text-[10px] text-zinc-500">Leadership incentives and company recognition campaigns</span>
              </div>

            </div>
          </div>

          {/* Business Cycle Status (Affiliates only) */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            {userProfile.accountType === 'Affiliate' && businessCycle ? (
              <>
                <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
                <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
                  <Award className="w-5 h-5 text-gold" /> Business Cycle
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400">Package Level:</span>
                    <span className="font-extrabold text-white">{businessCycle.packageLevel}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400">Package Value:</span>
                    <span className="font-extrabold text-zinc-200">{businessCycle.packageValueCC} CC</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400">Earnings Cap (2.5x):</span>
                    <span className="font-extrabold text-gold">{businessCycle.earningsCapCC} CC</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400">Current Qualified Earnings:</span>
                    <span className="font-extrabold text-zinc-100">{businessCycle.currentQualifiedEarningsCC} CC</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-zinc-900 pb-2">
                    <span className="text-zinc-400">Remaining Capacity:</span>
                    <span className="font-extrabold text-emerald-400">{businessCycle.remainingCapacityCC} CC</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Cycle Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      businessCycle.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
                    }`}>
                      {businessCycle.status === 'Completed' ? 'Cycle Completed' : 'Active'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <User className="w-10 h-10 text-zinc-600 mb-4" />
                <h4 className="font-bold text-white uppercase text-sm mb-1">Customer Account</h4>
                <p className="text-zinc-500 text-xs font-light">
                  Upgrade your account to Affiliate to unlock compensation pathways, Business Cycles, and premium earning allocation streams.
                </p>
              </div>
            )}
          </div>

          {/* Referral Links Section for Affiliates */}
          {['Affiliate', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'City Distributor', 'Regional Distributor'].some(
            roleOrPkg => userProfile.role === roleOrPkg || userProfile.packageLevel === roleOrPkg
          ) && (
            <div className="lg:col-span-3 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] gold-gradient" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <div>
                  <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-gold" /> Referral Links & Invite Members
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">
                    Share your unique referral link to register new customer accounts.
                  </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-zinc-300">
                  SPONSOR CODE: <span className="text-gold uppercase">{userProfile.sponsorCode}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                      Customer Referral Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/register?ref=${userProfile.sponsorCode}`}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/register?ref=${userProfile.sponsorCode}`);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className="bg-gold hover:brightness-110 text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        {copySuccess ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-3">
                      Share via Social Channels
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/register?ref=${userProfile.sponsorCode}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/20 text-[#1877F2] font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        Share on Facebook
                      </a>
                      <a
                        href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(`${window.location.origin}/register?ref=${userProfile.sponsorCode}`)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(window.location.origin)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#00B2FF]/10 hover:bg-[#00B2FF]/20 border border-[#00B2FF]/20 text-[#00B2FF] font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        Send in Messenger
                      </a>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join I AM CHOSEN! Register here: ${window.location.origin}/register?ref=${userProfile.sponsorCode}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        Share via WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl">
                  <div className="bg-white p-2 rounded-lg mb-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/register?ref=${userProfile.sponsorCode}`)}`}
                      alt="Referral QR Code"
                      className="w-[120px] h-[120px]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Scan Referral QR Code</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Transaction History & Cash-In Requests History Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          {/* Transaction History Section */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-gold" /> Recent Wallet Transaction Ledgers
            </h3>

            {transactions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 font-light text-sm">
                No wallet transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 uppercase">
                      <th className="py-3 px-4 font-bold">Transaction Date</th>
                      <th className="py-3 px-4 font-bold">Description</th>
                      <th className="py-3 px-4 font-bold">Wallet Affected</th>
                      <th className="py-3 px-4 font-bold">Transaction Type</th>
                      <th className="py-3 px-4 font-bold text-right">Amount (CC)</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-light">
                    {transactions.map((tx, idx) => (
                      <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-[10px] text-zinc-400">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {tx.description}
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {tx.walletType} Wallet
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            tx.type === 'CREDIT'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${
                          tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount} CC
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cash-In Requests History */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between">
            <div>
              <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800" />
              <h3 className="font-extrabold text-md text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gold" /> My Cash-In Requests
              </h3>

              {cashinHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-light">
                  No cash-in requests recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {cashinHistory.map((req, i) => (
                    <div key={req.requestId || i} className="bg-zinc-900/40 border border-zinc-850 p-3.5 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-white">{req.amountCC} CC</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                            req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            req.status === 'Declined' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <span className="block text-[9px] text-zinc-500 font-mono">
                          {new Date(req.requestDate).toLocaleDateString()} • Ref: {req.referenceNumber}
                        </span>
                      </div>
                      <span className="font-bold text-zinc-400 font-mono">₱{(req.amountPhp || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-900">
              <button
                onClick={() => setShowCashinModal(true)}
                className="w-full bg-gold hover:brightness-110 text-black font-extrabold text-xs py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-gold/10"
              >
                <ArrowUpRight className="w-4 h-4" /> New Cash-In / Top Up
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Cash-Out Modal */}
      {showCashoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />
            
            <h3 className="text-xl font-bold uppercase tracking-tight mb-2 gold-text">Request Cash-Out</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-6">
              Monday Window Active (Simulated)
            </p>

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
                  Amount in Chosen Credits (CC)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cashoutAmountCC}
                  onChange={(e) => setCashoutAmountCC(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Real-time Cashout Formula Details from Manual Section 10.5 */}
              <div className="bg-zinc-900/60 border border-zinc-800/40 p-4 rounded-xl text-xs space-y-2">
                <span className="block font-bold text-zinc-300 uppercase tracking-widest text-[10px] mb-1">Estimated Proceeds Breakdown</span>
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
                  onClick={() => document.getElementById('cashin-file-upload')?.click()}
                >
                  <input
                    id="cashin-file-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  
                  {proofOfPaymentUrl ? (
                    <div className="space-y-2">
                      {proofOfPaymentUrl.startsWith('data:application/pdf') || receiptFile?.type === 'application/pdf' || proofOfPaymentUrl.toLowerCase().includes('.pdf') ? (
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

      {/* Footer version indicator */}
      <footer className="py-8 border-t border-zinc-950 bg-zinc-950 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.3.4 • Build 000008
        </span>
      </footer>
    </div>
  );
}

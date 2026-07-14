import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet as WalletIcon,
  RefreshCw,
  User,
  ArrowUpRight,
  ShieldCheck,
  HelpCircle,
  Clock,
  LogOut,
  ShoppingBag,
  Sparkles,
  Camera,
  Bell,
  Globe,
  ChevronRight,
  QrCode,
  CheckCircle,
  Home as HomeIcon,
  ChevronLeft,
  Mail,
  Phone,
  MessageSquare,
  Sparkle,
  Eye,
  EyeOff,
  Download,
  Upload,
  ArrowLeftRight
} from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch, limit } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType, Notification } from '../types';
import { NotificationService } from '../services/notification/notification.service';
import ChosenLogo from './ChosenLogo';
import { useCCSettings } from '../context/CCSettingsContext';
import { WalletService } from '../services/wallet/wallet.service';

// Import Reusable Sub-components
import StatusBadge from './customer/StatusBadge';
import LoadingSkeleton from './customer/LoadingSkeleton';
import EmptyState from './customer/EmptyState';
import AnimatedButton from './customer/AnimatedButton';
import SectionTitle from './customer/SectionTitle';
import AppHeader from './customer/AppHeader';
import WalletCard from './customer/WalletCard';
import ChosenWalletIllustration from './customer/ChosenWalletIllustration';
import QuickActionGrid from './customer/QuickActionGrid';
import PromoBanner from './customer/PromoBanner';
import ProductCard from './customer/ProductCard';
import RecentActivityCard from './customer/RecentActivityCard';
import BottomNavigation, { CustomerTabType } from './customer/BottomNavigation';
import UpgradeOptionsModal from './customer/UpgradeOptionsModal';
import DashboardPerformanceCards from './dashboard/performance/DashboardPerformanceCards';
import ChosenWalletCard from './wallet/ChosenWalletCard';

interface CustomerDashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export default function CustomerDashboard({ userProfile, onLogout, onNavigate }: CustomerDashboardProps) {
  const { ccSettings } = useCCSettings();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sponsor & Orders States
  const [sponsor, setSponsor] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Cashin Modal Form State
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

  // Custom modals state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgradeNavigating, setIsUpgradeNavigating] = useState(false);
  const [upgradeNavigationError, setUpgradeNavigationError] = useState<string | null>(null);

  const handleUpgradeSelect = (option: 'smart-customer' | 'affiliate-business') => {
    setIsUpgradeNavigating(true);
    setUpgradeNavigationError(null);

    try {
      // 1. Store in session storage to survive refresh
      sessionStorage.setItem('selectedPath', option);

      // 2. Set search params in current URL for routing to parse
      const url = new URL(window.location.href);
      url.searchParams.set('type', option);
      window.history.pushState({}, '', url.toString());

      // 3. Track analytics events
      try {
        const customEvent = new CustomEvent('upgrade_path_selected', {
          detail: {
            source: 'chosen_wallet_card',
            selectedPath: option,
            userRole: userProfile.role
          }
        });
        window.dispatchEvent(customEvent);
      } catch (ae) {
        console.error("Non-blocking analytics failure:", ae);
      }

      // 4. Navigate after a short transition delay to show loading state
      setTimeout(() => {
        setIsUpgradeNavigating(false);
        setIsUpgradeModalOpen(false);
        onNavigate('package-selection');
      }, 700);
    } catch (err: any) {
      console.error("Upgrade selection navigation error:", err);
      setIsUpgradeNavigating(false);
      setUpgradeNavigationError("We could not open the package selection page. Please try again.");
    }
  };

  // Mobile Navigation and View States
  const [activeMobileTab, setActiveMobileTab] = useState<CustomerTabType>('home');
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'ZH' | 'ES'>('EN');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showMyQr, setShowMyQr] = useState(false);

  // Notifications State linked to Firestore
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeToNotifications(
      userProfile.uid,
      'Customer',
      (data) => {
        setNotifications(data);
      }
    );
    return () => unsubscribe();
  }, [userProfile.uid]);

  // Camera Scanner simulation
  const startCameraScan = () => {
    setScanning(true);
    setScanProgress(0);
    setScanResult(null);
    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      setScanProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setScanning(false);
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        setScanResult(`Successfully scanned! Found Product: ${randomProduct.name} (${randomProduct.price} CC)`);
      }
    }, 300);
  };

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

      // 2. Fetch Transactions (Only for Chosen Wallet)
      const txQuery = query(
        collection(db, 'wallet_transactions'),
        where('uid', '==', userProfile.uid)
      );
      const txSnap = await getDocs(txQuery);
      const txList = txSnap.docs.map(doc => doc.data());
      // Filter out non-Chosen Wallet transactions for Customer
      const filteredTx = txList.filter(tx => 
        tx.walletType === 'Chosen Wallet' || tx.walletType === 'Chosen' || tx.walletType === 'Chosen Credits (CC)'
      );
      filteredTx.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
      setTransactions(filteredTx);

      // 3. Fetch Sponsor details if present
      if (userProfile.referredBy) {
        setSponsorLoading(true);
        try {
          const sponsorDocRef = doc(db, 'users', userProfile.referredBy);
          const sponsorSnap = await getDoc(sponsorDocRef);
          if (sponsorSnap.exists()) {
            setSponsor(sponsorSnap.data());
          } else {
            // Fallback query if stored as sponsorCode
            const q = query(collection(db, 'users'), where('sponsorCode', '==', userProfile.referredBy), limit(1));
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

      // 4. Fetch Customer purchases
      const ordersQuery = query(
        collection(db, 'orders'),
        where('uid', '==', userProfile.uid)
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersList = ordersSnap.docs.map(doc => doc.data());
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersList);

      // 5. Fetch Cash-in requests
      const cashinQuery = query(
        collection(db, 'cashin_requests'),
        where('uid', '==', userProfile.uid)
      );
      const cashinSnap = await getDocs(cashinQuery);
      const cashinList = cashinSnap.docs.map(doc => doc.data());
      cashinList.sort((a, b) => new Date(b.requestDate || b.requestedAt).getTime() - new Date(a.requestDate || a.requestedAt).getTime());
      setCashinHistory(cashinList);

    } catch (e) {
      console.error("Error loading customer dashboard:", e);
    } finally {
      setLoading(false);
    }
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

    setReceiptFile(file);
    try {
      const previewUrl = URL.createObjectURL(file);
      setProofOfPaymentUrl(previewUrl);
      setCashinError(null);
    } catch (e) {
      setCashinError("Failed to generate file preview.");
    }
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
    if (!receiptFile) {
      setCashinError("Please upload a proof of payment receipt.");
      return;
    }

    setLoading(true);

    try {
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      
      // Upload the receipt to Storage first
      const uploadResult = await WalletService.uploadReceipt(userProfile.uid, requestId, receiptFile);

      const computedCC = Number((cashinAmountPhp / ccSettings.cashInRatePHP).toFixed(4));
      const timestamp = new Date().toISOString();

      const requestDocRef = doc(db, 'cashin_requests', requestId);
      const requestData = {
        requestId,
        uid: userProfile.uid,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        email: userProfile.email || '',
        amountPHP: Number(cashinAmountPhp),
        computedCC: computedCC,
        ratePHPPerCC: ccSettings.cashInRatePHP,
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
      setReceiptFile(null);
      setCashinNotes('');
      
      setTimeout(() => {
        fetchDashboardData();
        setCashinSuccess(null);
      }, 3000);

    } catch (err: any) {
      setCashinError(err.message || "Failed to submit cash-in request.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (actionId: 'shop' | 'orders' | 'cashin' | 'profile' | 'support') => {
    switch (actionId) {
      case 'shop':
        onNavigate('e-commerce');
        break;
      case 'orders':
        setActiveMobileTab('wallet');
        setTimeout(() => {
          document.getElementById('orders-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        break;
      case 'cashin':
        setActiveMobileTab('wallet');
        setTimeout(() => {
          document.getElementById('cashin-form-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        break;
      case 'profile':
        setActiveMobileTab('profile');
        break;
      case 'support':
        setShowSupportModal(true);
        break;
    }
  };

  const products = [
    { id: 'prod-herbal', name: 'Chosen Herbal Blend', category: 'Herbal Wellness Beverage', price: 8, php: '₱560', emoji: '🌿', description: 'A concentrated herbal beverage formulated to support daily wellness and healthy living.' },
    { id: 'prod-latte', name: 'Chosen 15-in-1 Latte Coffee', category: 'Functional Coffee Beverage', price: 15, php: '₱1,050', emoji: '☕', description: 'A premium coffee blend combining rich flavor with carefully selected herbal extracts.' },
    { id: 'prod-barley', name: 'Chosen Pure Barley', category: 'Barley Grass Beverage', price: 16, php: '₱1,120', emoji: '🌾', description: 'A barley grass beverage designed to complement a balanced diet and active lifestyle.' },
    { id: 'prod-caramel', name: 'Chosen Salted Caramel Iced Coffee', category: 'Ready-to-Mix Coffee Beverage', price: 16, php: '₱1,120', emoji: '🧊', description: 'A refreshing iced coffee blend with a smooth, premium salted caramel flavor.' },
    { id: 'prod-choco', name: 'Chosen Choco Barley', category: 'Chocolate Wellness Beverage', price: 16, php: '₱1,120', emoji: '🍫', description: 'A chocolate-flavored barley beverage that combines great taste and powerful nutrients.' }
  ];

  const firstName = userProfile.fullName ? userProfile.fullName.split(' ')[0] : 'Member';

  return (
    <div className="bg-[#0B0B0F] text-zinc-100 min-h-screen font-sans selection:bg-gold selection:text-[#0B0B0F] relative overflow-x-hidden pb-24 lg:pb-8">
      
      {/* Background radial overlays */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-gold/5 rounded-full blur-[80px] pointer-events-none" />

      {/* DESKTOP SIDEBAR PANEL (Large screen visible) */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-[#17181D]/90 border-r border-cyan-950/20 z-40 p-6 justify-between backdrop-blur-md">
        <div className="space-y-8">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveMobileTab('home')}>
            <ChosenLogo size="sm" className="w-11 h-11" />
            <div>
              <span className="font-extrabold text-sm tracking-wider text-zinc-100 uppercase gold-text leading-none block">
                I AM CHOSEN
              </span>
              <span className="block text-[7px] tracking-[0.35em] text-cyan-400 font-bold uppercase mt-1">
                INTERNATIONAL
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'home' as const, label: 'Home', icon: HomeIcon },
              { id: 'wallet' as const, label: 'Wallet', icon: WalletIcon },
              { id: 'scan' as const, label: 'Scan / QR', icon: QrCode },
              { id: 'notifications' as const, label: 'Notifications', icon: Bell, badge: notifications.filter(n => n.unread).length },
              { id: 'profile' as const, label: 'Profile', icon: User },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeMobileTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMobileTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/40 to-transparent border-l-2 border-cyan-400 text-cyan-400 font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1D1F26]/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="bg-cyan-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-zinc-800/80 pt-4 space-y-3.5">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-[#0B0B0F] font-black text-sm uppercase">
              {userProfile.fullName ? userProfile.fullName[0] : 'C'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate leading-tight">{userProfile.fullName}</p>
              <p className="text-[9px] text-zinc-500 font-mono tracking-wider truncate uppercase mt-0.5">{userProfile.memberId}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-[#1D1F26] hover:bg-red-950/20 hover:text-red-400 border border-zinc-800 hover:border-red-500/20 text-zinc-400 py-3 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* STICKY COMPACT TOP HEADER */}
      <AppHeader
        userProfile={userProfile}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        hasUnreadNotifications={notifications.some(n => n.unread)}
        onNavigateToTab={setActiveMobileTab}
        onLogout={onLogout}
      />

      {/* MAIN VIEW CONTENT */}
      <div className="lg:pl-64 min-h-screen flex flex-col justify-between">
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:pt-4 lg:pb-8 lg:px-8 space-y-6 pb-[100px]">

          {/* Feedback alerts inside viewport */}
          <AnimatePresence>
            {purchaseSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl flex items-start gap-3 text-xs"
              >
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5">Purchase Confirmed</span>
                  <span className="font-light">{purchaseSuccess}</span>
                </div>
                <button onClick={() => setPurchaseSuccess(null)} className="text-zinc-400 hover:text-white font-extrabold cursor-pointer">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab switches */}
          {loading ? (
            <div className="p-4 bg-[#17181D]/40 border border-zinc-800/80 rounded-3xl">
              <LoadingSkeleton />
            </div>
          ) : (
            <>
              {activeMobileTab === 'home' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* CHOSEN WALLET BALANCE CARD - MOVED TO TOP POSITION */}
                  <ChosenWalletCard
                    uid={userProfile.uid}
                    accountType={userProfile.accountType as 'Customer' | 'Smart Customer' | 'Affiliate'}
                    packageLevel={userProfile.packageLevel || 'None'}
                    balanceCC={wallet?.chosenWalletBalance || 0}
                    displayReferenceRatePHP={ccSettings.displayReferenceRatePHP || 70}
                    isLoading={loading}
                    onCashIn={() => handleQuickAction('cashin')}
                    onUpgrade={() => setIsUpgradeModalOpen(true)}
                    onTransfer={() => onNavigate('p2p-transfer')}
                    canUpgrade={userProfile.packageLevel !== 'Diamond'}
                    canTransfer={true}
                  />

                  {/* Shared Role-Aware Performance Cards System */}
                  {!(userProfile?.accountType === "Customer" && userProfile?.packageLevel === "None") && (
                    <div className="mb-6">
                      <DashboardPerformanceCards userProfile={userProfile} onNavigate={onNavigate} />
                    </div>
                  )}

                  {/* RESPONSIVE LAYOUT CONTAINER */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Main Contents (Quick Actions, Banners, Products) */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* QUICK ACCESS GRID */}
                      <QuickActionGrid onActionClick={handleQuickAction} />

                      {/* PROMOTIONAL CAMPAIGNS Auto-slider */}
                      <PromoBanner onCtaClick={() => handleQuickAction('shop')} />
                    </div>

                    {/* Desktop Right Sidebar Column */}
                    <div className="space-y-6">
                      {/* RECENT TRANSACTIONS ACTIVITY */}
                      <RecentActivityCard cashins={cashinHistory} orders={orders} />
                    </div>
                  </div>

                </motion.div>
              )}

              {activeMobileTab === 'wallet' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <SectionTitle
                    title="My Digital Wallet"
                    subtitle="Deposit funds, verify ledgers and check histories"
                    icon={<WalletIcon className="w-4.5 h-4.5 text-cyan-400" />}
                  />

                  {/* Detailed balance summary card */}
                  <div className="bg-gradient-to-br from-[#1E202A] to-[#0F1015] border border-cyan-500/15 p-6 rounded-3xl relative overflow-hidden">
                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest font-mono bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-400/20">
                      Total Assets Balance
                    </span>
                    <h2 className="text-4xl font-black text-white mt-4 font-mono leading-none tracking-tight">
                      {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'} <span className="text-sm font-extrabold text-zinc-500">CC</span>
                    </h2>
                    <span className="text-xs text-gold font-mono block mt-2">
                      ≈ ₱{wallet ? (wallet.chosenWalletBalance * ccSettings.cashOutRatePHP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} PHP
                    </span>
                  </div>

                  {/* Top Up Form Section */}
                  <div id="cashin-form-section" className="bg-[#1D1F26] border border-zinc-800 rounded-3xl p-6 space-y-5">
                    <div>
                      <h3 className="font-extrabold text-sm text-white uppercase tracking-tight flex items-center gap-2">
                        <ArrowUpRight className="w-4.5 h-4.5 text-gold animate-bounce" /> Top Up Wallet via Cash-In
                      </h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-1">
                        Cash-In Rate: 1 CC = ₱{ccSettings.cashInRatePHP.toFixed(2)} | Secure corporate deposit channels
                      </p>
                    </div>

                    {cashinError && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs">
                        {cashinError}
                      </div>
                    )}

                    {cashinSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs">
                        {cashinSuccess}
                      </div>
                    )}

                    <form onSubmit={handleCashinSubmit} className="space-y-4">
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
                            className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl pl-8 pr-4 py-3 text-sm font-mono text-white font-bold transition-colors"
                            placeholder="e.g. 3500"
                          />
                        </div>
                      </div>

                      {/* Computed Credits Information Display */}
                      <div className="bg-[#0B0B0F]/80 border border-zinc-800/80 p-4 rounded-2xl text-xs space-y-1.5">
                        <span className="block font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Computed Credits Ledger</span>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-zinc-500">Corporate Exchange Rate:</span>
                          <span className="text-zinc-300">1 CC = ₱{ccSettings.cashInRatePHP.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-zinc-800/80 pt-2 mt-1.5 text-xs font-bold">
                          <span className="text-gold">Credit Output (CC):</span>
                          <span className="text-gold font-mono">
                            {(cashinAmountPhp / ccSettings.cashInRatePHP).toFixed(4)} CC
                          </span>
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
                          className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl px-3 py-3 text-xs text-white font-semibold cursor-pointer"
                        >
                          <option value="GCash">GCash (Company Account: 0917-111-2222)</option>
                          <option value="Maya">Maya (Company Account: 0917-111-2222)</option>
                          <option value="Bank">Bank Transfer (BDO Account: 00123-4567-890)</option>
                        </select>
                      </div>

                      {/* Sender Details */}
                      <div className="grid grid-cols-2 gap-3.5">
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
                            className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl px-4 py-3 text-xs text-white transition-colors"
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
                            className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl px-4 py-3 text-xs text-white transition-colors"
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
                          className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl px-4 py-3 text-xs text-white font-mono transition-colors"
                        />
                      </div>

                      {/* Proof receipt upload container */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                          Upload Proof of Payment Receipt (Required)
                        </label>
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleFileDrop}
                          className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                            isDragging ? 'border-cyan-400 bg-cyan-500/5' : proofOfPaymentUrl ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-cyan-500/40'
                          }`}
                          onClick={() => document.getElementById('customer-cashin-file-upload-re')?.click()}
                        >
                          <input
                            id="customer-cashin-file-upload-re"
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                          
                          {proofOfPaymentUrl ? (
                            <div className="space-y-2">
                              {proofOfPaymentUrl.startsWith('data:application/pdf') || receiptFile?.type === 'application/pdf' || proofOfPaymentUrl.toLowerCase().includes('.pdf') ? (
                                <div className="text-xs font-semibold text-emerald-400 font-mono">PDF Receipt Loaded Successfully</div>
                              ) : (
                                <img
                                  src={proofOfPaymentUrl}
                                  alt="Receipt Preview"
                                  className="max-h-28 mx-auto rounded-xl object-contain border border-zinc-800"
                                />
                              )}
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tap region to replace file</p>
                            </div>
                          ) : (
                            <div className="py-2 space-y-2">
                              <div className="text-zinc-300 font-extrabold text-xs">Drag and Drop receipt image here</div>
                              <div className="text-[10px] text-zinc-500 font-light">or click to browse from device</div>
                              <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-wide">Supports Images and PDFs</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Additional notes */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
                          Additional Notes (Optional)
                        </label>
                        <textarea
                          placeholder="e.g. Any additional payment details..."
                          value={cashinNotes}
                          onChange={(e) => setCashinNotes(e.target.value)}
                          className="w-full bg-[#0B0B0F] border border-zinc-800 focus:border-cyan-500 focus:outline-none rounded-xl px-4 py-3 text-xs h-16 resize-none text-white transition-colors"
                        />
                      </div>

                      {/* Submit Trigger */}
                      <AnimatedButton
                        type="submit"
                        variant="gold"
                        disabled={loading}
                        fullWidth
                      >
                        {loading ? 'Processing...' : 'Submit Cash-In Request'}
                      </AnimatedButton>
                    </form>
                  </div>

                  {/* HISTORIES */}
                  <div id="orders-section">
                    <RecentActivityCard cashins={cashinHistory} orders={orders} />
                  </div>

                </motion.div>
              )}

              {activeMobileTab === 'scan' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 max-w-md mx-auto"
                >
                  <SectionTitle
                    title="Futuristic QR Portal"
                    subtitle="Transact and verify using smart vector codes"
                    icon={<QrCode className="w-4.5 h-4.5 text-cyan-400" />}
                    className="text-center"
                  />

                  {/* Switch Sub-navigation tabs */}
                  <div className="flex justify-center p-1 bg-[#17181D] border border-zinc-800 rounded-xl max-w-xs mx-auto">
                    <button
                      onClick={() => setShowMyQr(false)}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        !showMyQr ? 'bg-cyan-500 text-[#0B0B0F]' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Scan Code
                    </button>
                    <button
                      onClick={() => setShowMyQr(true)}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        showMyQr ? 'bg-cyan-500 text-[#0B0B0F]' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      My QR ID
                    </button>
                  </div>

                  {!showMyQr ? (
                    /* SCANNER CAMERA BOX */
                    <div className="bg-[#1D1F26] border border-cyan-500/15 rounded-3xl p-6 text-center space-y-6">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">QR Code Scanner</h3>
                        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                          Align QR code inside target frame
                        </p>
                      </div>

                      {/* Animated Scanner Area */}
                      <div className="w-56 h-56 mx-auto border border-zinc-800 rounded-3xl relative overflow-hidden bg-[#0B0B0F] flex items-center justify-center shadow-inner">
                        {/* Frame corner brackets */}
                        <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-cyan-400" />
                        <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-cyan-400" />
                        <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-cyan-400" />
                        <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-cyan-400" />

                        {/* Scanner horizontal line */}
                        {scanning && (
                          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-scan-line top-0" 
                               style={{ animation: 'scan-animation 2s linear infinite' }}
                          />
                        )}

                        <style>{`
                          @keyframes scan-animation {
                            0% { top: 0%; opacity: 0.8; }
                            50% { top: 100%; opacity: 1; }
                            100% { top: 0%; opacity: 0.8; }
                          }
                        `}</style>

                        {scanning ? (
                          <div className="text-center space-y-2 select-none">
                            <Camera className="w-6 h-6 text-cyan-400 mx-auto animate-pulse" />
                            <span className="block text-[9px] uppercase font-bold text-cyan-400 font-mono tracking-widest animate-pulse">
                              Active: {scanProgress}%
                            </span>
                          </div>
                        ) : scanResult ? (
                          <div className="p-4 space-y-3">
                            <CheckCircle className="w-7 h-7 text-emerald-400 mx-auto" />
                            <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">{scanResult}</p>
                            <button
                              onClick={() => setScanResult(null)}
                              className="text-[9px] font-black text-cyan-400 uppercase tracking-widest hover:underline cursor-pointer"
                            >
                              Scan Again
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-1.5 p-6">
                            <Camera className="w-6 h-6 text-zinc-600 mx-auto" />
                            <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
                              Camera Ready
                            </span>
                          </div>
                        )}
                      </div>

                      {!scanning && !scanResult && (
                        <AnimatedButton
                          variant="cyan"
                          fullWidth
                          onClick={startCameraScan}
                        >
                          Launch Mock Scanner
                        </AnimatedButton>
                      )}
                    </div>
                  ) : (
                    /* MY QR ID CARD */
                    <div className="bg-[#1D1F26] border border-[#D4AF37]/20 rounded-3xl p-6 text-center space-y-6">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Client Identity QR</h3>
                        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                          Present to Corporate for fast verification
                        </p>
                      </div>

                      {/* Clean White QR container */}
                      <div className="bg-white p-5 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center border border-[#D4AF37]/15">
                        <QrCode className="w-40 h-40 text-black stroke-[1.5]" />
                      </div>

                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-mono font-bold bg-[#0B0B0F] px-4 py-1.5 rounded-lg text-gold border border-zinc-800 uppercase">
                          {userProfile.memberId}
                        </span>
                        <span className="block text-[8px] text-zinc-500 uppercase tracking-widest font-black mt-2 font-mono">
                          KYC LEVEL: VERIFIED CLIENT
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 font-light max-w-xs mx-auto leading-relaxed">
                        This secure ledger passport uniquely logs your customer profile inside I AM CHOSEN unilevel blockchain systems.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeMobileTab === 'notifications' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <SectionTitle
                    title="Alerts and Notifications"
                    subtitle="System announcements and identity log verifications"
                    icon={<Bell className="w-4.5 h-4.5 text-cyan-400" />}
                  />

                  {notifications.length === 0 ? (
                    <div className="text-center py-10 bg-[#1D1F26]/30 border border-zinc-800 rounded-2xl">
                      <Bell className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
                      <p className="text-zinc-500 text-xs">No alerts or notifications yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.some((n) => n.unread) && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => NotificationService.markAllAsRead(userProfile.uid)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => notif.unread && NotificationService.markAsRead(notif.id, userProfile.uid)}
                          className={`p-4 rounded-2xl border transition-all duration-300 ${
                            notif.unread
                              ? 'bg-[#17181D] border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.05)] cursor-pointer hover:border-cyan-400'
                              : 'bg-[#1D1F26]/60 border-zinc-800'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4 mb-1.5">
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              {notif.unread && <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />}
                              {notif.title}
                            </h4>
                            <span className="text-[9px] text-zinc-500 font-mono tracking-wider shrink-0 uppercase">{notif.date}</span>
                          </div>
                          <p className="text-zinc-400 text-xs font-light leading-relaxed">
                            {notif.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeMobileTab === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <SectionTitle
                    title="Client Identity Parameters"
                    subtitle="Cryptographic verification status and keys"
                    icon={<User className="w-4.5 h-4.5 text-cyan-400" />}
                  />

                  {/* Visual Header card */}
                  <div className="bg-[#1D1F26] border border-[#D4AF37]/20 rounded-3xl p-6 text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold via-gold-bright to-gold-dark" />
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-[#0B0B0F] font-black text-2xl uppercase">
                      {userProfile.fullName ? userProfile.fullName[0] : 'C'}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white leading-none">{userProfile.fullName}</h3>
                      <span className="inline-block text-[10px] font-mono tracking-wider text-gold font-bold bg-[#D4AF37]/10 px-3.5 py-1 rounded-xl border border-[#D4AF37]/20 mt-3.5 uppercase">
                        ID: {userProfile.memberId}
                      </span>
                    </div>
                  </div>

                  {/* Ledger Information Grid */}
                  <div className="bg-[#1D1F26] border border-zinc-800 rounded-3xl p-6 space-y-3.5">
                    <h4 className="font-extrabold text-xs text-white uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">
                      Registry Core Values
                    </h4>

                    {[
                      { label: 'Full Registered Name', value: userProfile.fullName },
                      { label: 'Verified Email Address', value: userProfile.email },
                      { label: 'Mobile Contact Key', value: userProfile.mobileNumber || 'N/A' },
                      { label: 'Identity Class Role', value: userProfile.role, highlight: true },
                      { label: 'KYC Level Status', value: userProfile.kycStatus || 'Unverified', badge: true },
                      { label: 'Account Creation Epoch', value: userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A' },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center text-xs py-1">
                        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wide">{row.label}:</span>
                        {row.badge ? (
                          <StatusBadge status={row.value} />
                        ) : (
                          <span className={`font-semibold ${row.highlight ? 'text-gold' : 'text-zinc-300'}`}>{row.value}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Redirect Edit profile button */}
                  <AnimatedButton
                    variant="outline"
                    fullWidth
                    onClick={() => onNavigate('profile')}
                    className="py-3"
                  >
                    <span>Configure Full Security profile</span>
                    <ChevronRight className="w-4 h-4 text-cyan-400" />
                  </AnimatedButton>
                </motion.div>
              )}
            </>
          )}

        </main>
      </div>

      {/* FLOATING PREMIUM BOTTOM MOBILE NAVIGATION BAR */}
      <BottomNavigation
        activeTab={activeMobileTab}
        setActiveTab={setActiveMobileTab}
        unreadCount={notifications.filter(n => n.unread).length}
      />

      {/* SUPPORT HELP CENTER MODAL OVERLAY */}
      <AnimatePresence>
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#1D1F26] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-cyan-500" />
              
              <div className="flex justify-between items-start mb-4 border-b border-zinc-800 pb-2">
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">Client Care Portal</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mt-0.5">Corporate Assistance</h3>
                </div>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Support Channels options */}
              <div className="space-y-4 py-2">
                <p className="text-zinc-400 text-xs font-light leading-relaxed">
                  Need help with product deliveries, payments, or your secure credits ledger? Reach out to our compliant support executives:
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 bg-[#0B0B0F] p-3.5 rounded-2xl border border-zinc-900">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wide">Compliant Email Channel</span>
                      <span className="text-xs text-white font-mono select-all">support@iamchosenintl.com</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-[#0B0B0F] p-3.5 rounded-2xl border border-zinc-900">
                    <Phone className="w-4 h-4 text-gold" />
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wide">Hotline Call Assistance</span>
                      <span className="text-xs text-white font-mono select-all">+63 917 111 2222</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-[#0B0B0F] p-3.5 rounded-2xl border border-zinc-900">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-500 tracking-wide">Viber / WhatsApp Support</span>
                      <span className="text-xs text-white font-mono select-all">+63 917 111 2222</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 leading-normal italic text-center pt-2">
                  Compliant inquiries are resolved within standard corporate cycles (1-3 business hours).
                </p>
              </div>

              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full mt-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Done / Return
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UpgradeOptionsModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSelect={handleUpgradeSelect}
        isNavigating={isUpgradeNavigating}
        navigationError={upgradeNavigationError}
      />
    </div>
  );
}

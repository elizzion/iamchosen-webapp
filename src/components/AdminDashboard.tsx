import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Shield,
  Award,
  RefreshCw,
  Layers,
  Sparkles,
  TrendingUp,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  ShoppingBag,
  FileText,
  Boxes,
  Eye,
  Check,
  X,
  Clock,
  ArrowLeft,
  Crown
} from 'lucide-react';
import { db, approvePendingAffiliate, createAuditLog } from '../firebase';
import { collection, getDocs, doc, query, where, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType } from '../types';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
  currentUserProfile: UserProfile;
}

type AdminTab = 'metrics' | 'members' | 'cashin' | 'activations' | 'products' | 'orders' | 'reports';

export default function AdminDashboard({ onNavigate, currentUserProfile }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('metrics');
  const [users, setUsers] = useState<any[]>([]);
  const [cashinRequests, setCashinRequests] = useState<any[]>([]);
  const [customerRequests, setCustomerRequests] = useState<any[]>([]);
  const [affiliateRequests, setAffiliateRequests] = useState<any[]>([]);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectingType, setRejectingType] = useState<'customer' | 'affiliate' | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalAffiliates: 0,
    totalCityDistributors: 0,
    totalRegionalDistributors: 0,
    pendingKyc: 0,
    todayRegistrations: 0,
    packageSalesCC: 0,
    ccConsumedCC: 0,
    referralBonusesCC: 0,
    activePackagesCount: 0,
    activePackagesBreakdown: {
      Bronze: 0,
      Silver: 0,
      Gold: 0,
      Platinum: 0,
      Diamond: 0
    }
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Fetch Users
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      const userList = querySnapshot.docs.map(doc => doc.data());
      setUsers(userList);

      // 2. Fetch Wallet Transactions
      const txRef = collection(db, 'wallet_transactions');
      const txSnapshot = await getDocs(txRef);
      const txList = txSnapshot.docs.map(doc => doc.data());

      // 3. Fetch Cashin requests
      const cashinRef = collection(db, 'cashin_requests');
      const cashinSnapshot = await getDocs(cashinRef);
      const cashinList = cashinSnapshot.docs.map(doc => doc.data());
      cashinList.sort((a, b) => new Date(b.requestDate || b.requestedAt || 0).getTime() - new Date(a.requestDate || a.requestedAt || 0).getTime());
      setCashinRequests(cashinList);

      // 4. Fetch Customer Package Requests
      const custReqRef = collection(db, 'customer_package_requests');
      const custReqSnapshot = await getDocs(custReqRef);
      const custReqList = custReqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      custReqList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCustomerRequests(custReqList);

      // 5. Fetch Affiliate Activation Requests
      const affReqRef = collection(db, 'affiliate_activation_requests');
      const affReqSnapshot = await getDocs(affReqRef);
      const affReqList = affReqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      affReqList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAffiliateRequests(affReqList);

      // Get today's ISO date string prefix
      const todayPrefix = new Date().toISOString().split('T')[0];

      // Calculate statistics directly
      const calculatedStats = userList.reduce((acc, user: any) => {
        acc.totalUsers += 1;
        
        if (user.createdAt && user.createdAt.startsWith(todayPrefix)) {
          acc.todayRegistrations += 1;
        }

        if (user.role === 'Customer') acc.totalCustomers += 1;
        else if (user.role === 'Affiliate') acc.totalAffiliates += 1;
        else if (user.role === 'City Distributor') acc.totalCityDistributors += 1;
        else if (user.role === 'Regional Distributor') acc.totalRegionalDistributors += 1;

        if (user.status === 'Active' && user.packageLevel && user.packageLevel !== 'None') {
          acc.activePackagesCount += 1;
          const level = user.packageLevel as 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
          if (acc.activePackagesBreakdown[level] !== undefined) {
            acc.activePackagesBreakdown[level] += 1;
          }
        }

        if (user.kycStatus === 'Pending') acc.pendingKyc += 1;

        return acc;
      }, {
        totalUsers: 0,
        totalCustomers: 0,
        totalAffiliates: 0,
        totalCityDistributors: 0,
        totalRegionalDistributors: 0,
        pendingKyc: 0,
        todayRegistrations: 0,
        activePackagesCount: 0,
        activePackagesBreakdown: {
          Bronze: 0,
          Silver: 0,
          Gold: 0,
          Platinum: 0,
          Diamond: 0
        }
      });

      // Calculate transaction totals
      let computedSales = 0;
      let computedConsumed = 0;
      let computedBonuses = 0;

      txList.forEach((tx: any) => {
        const amount = tx.amount || 0;
        if (tx.status === 'Completed') {
          if (tx.type === 'REGISTRATION') {
            computedSales += amount;
          }
          if (tx.type === 'DEBIT' && tx.walletType === 'Chosen') {
            computedConsumed += amount;
          }
          if (tx.type === 'CREDIT' && tx.walletType === 'Commission') {
            computedBonuses += amount;
          }
        }
      });

      setStats({
        ...calculatedStats,
        packageSalesCC: computedSales,
        ccConsumedCC: computedConsumed,
        referralBonusesCC: computedBonuses
      });

    } catch (e) {
      console.error("Failed to load admin metrics:", e);
      setError("An error occurred while loading administration metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAffiliate = async (userId: string, userName: string) => {
    setActionLoading(`activate-${userId}`);
    setError(null);
    setSuccess(null);
    try {
      await approvePendingAffiliate(userId, currentUserProfile.uid, currentUserProfile.email);
      setSuccess(`Successfully activated Affiliate ${userName}, set business cycle limits, and provisioned default wallets!`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Approval process failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveCashin = async (requestId: string, uid: string, amountCC: number) => {
    setActionLoading(`cashin-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const batch = writeBatch(db);

      // Update Cashin request status
      const requestRef = doc(db, 'cashin_requests', requestId);
      batch.update(requestRef, {
        status: 'Approved',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUserProfile.fullName
      });

      // Credit the CC amount to user's chosen wallet balance
      const walletRef = doc(db, 'wallets', uid);
      const walletSnap = await getDoc(walletRef);
      let currentChosen = 0;
      if (!walletSnap.exists()) {
        batch.set(walletRef, {
          uid: uid,
          chosenWalletBalance: Number(amountCC.toFixed(2)),
          commissionWalletBalance: 0,
          marketingSupportWalletBalance: 0,
          rewardWalletBalance: 0,
          cashWalletStatus: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        const walletData = walletSnap.data() as WalletType;
        currentChosen = walletData.chosenWalletBalance || 0;
        batch.update(walletRef, {
          chosenWalletBalance: Number((currentChosen + amountCC).toFixed(2)),
          updatedAt: new Date().toISOString()
        });
      }

      // Write credit transaction log
      const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: uid,
        amount: amountCC,
        type: 'CREDIT',
        walletType: 'Chosen Wallet',
        description: `Approved Cash-In Request: ${requestId}`,
        status: 'Completed',
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'APPROVE_CASHIN',
        `Approved Cash-In Request ${requestId} for user ${uid} of amount ${amountCC} CC`
      );

      setSuccess(`Cash-In request ${requestId} has been successfully APPROVED.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to approve cash-in request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineCashin = async (requestId: string, uid: string) => {
    setActionLoading(`cashin-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const batch = writeBatch(db);

      // Update Cashin request status
      const requestRef = doc(db, 'cashin_requests', requestId);
      batch.update(requestRef, {
        status: 'Declined',
        declinedAt: new Date().toISOString(),
        declinedBy: currentUserProfile.fullName
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'DECLINE_CASHIN',
        `Declined Cash-In Request ${requestId} for user ${uid}`
      );

      setSuccess(`Cash-In request ${requestId} has been successfully DECLINED.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to decline cash-in request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveCustomerPackageRequest = async (requestId: string, uid: string, packageName: string, ccAmount: number) => {
    setActionLoading(`approve-cust-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const batch = writeBatch(db);

      // 1. Update request status
      const requestRef = doc(db, 'customer_package_requests', requestId);
      batch.update(requestRef, {
        status: 'Approved',
        updatedAt: new Date().toISOString()
      });

      // 2. Set user package level
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, {
        packageLevel: packageName,
        updatedAt: new Date().toISOString()
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'CUSTOMER_PACKAGE_REQUEST_APPROVED',
        `Approved Customer package ${packageName} for User UID ${uid}`
      );

      setSuccess(`Successfully approved Customer Package Request and updated package level to ${packageName}!`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Approval process failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCustomerPackageRequest = async (requestId: string, reason: string) => {
    if (!reason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(`reject-cust-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const batch = writeBatch(db);

      const requestRef = doc(db, 'customer_package_requests', requestId);
      batch.update(requestRef, {
        status: 'Rejected',
        rejectedReason: reason,
        updatedAt: new Date().toISOString()
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'CUSTOMER_PACKAGE_REQUEST_REJECTED',
        `Rejected Customer package request ${requestId} with reason: ${reason}`
      );

      setSuccess(`Successfully rejected Customer Package Request.`);
      setRejectingRequestId(null);
      setRejectingType(null);
      setRejectionReasonInput('');
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Rejection process failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAffiliateActivationRequest = async (requestId: string, uid: string, packageName: string, ccVal: number, earningsCap: number) => {
    setActionLoading(`approve-aff-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const timestamp = new Date().toISOString();
      const batch = writeBatch(db);

      // 1. Update request status
      const requestRef = doc(db, 'affiliate_activation_requests', requestId);
      batch.update(requestRef, {
        status: 'Approved',
        reviewedBy: currentUserProfile.fullName,
        approvedAt: timestamp,
        updatedAt: timestamp
      });

      // 2. Activate and upgrade user to Affiliate
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, {
        role: 'Affiliate',
        accountType: 'Affiliate',
        status: 'Active',
        packageLevel: packageName,
        commissionEligible: true,
        walletEnabled: true,
        genealogyEnabled: true,
        businessCycleEnabled: true,
        updatedAt: timestamp
      });

      // 3. Set Wallet doc
      const walletRef = doc(db, 'wallets', uid);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) {
        batch.set(walletRef, {
          uid,
          chosenWalletBalance: 0,
          commissionWalletBalance: 0,
          marketingSupportWalletBalance: 0,
          rewardWalletBalance: 0,
          cashWalletStatus: 'Active',
          createdAt: timestamp,
          updatedAt: timestamp
        });
      } else {
        batch.update(walletRef, {
          cashWalletStatus: 'Active',
          updatedAt: timestamp
        });
      }

      // 4. Set Business Cycle doc
      const cycleRef = doc(db, 'business_cycles', uid);
      batch.set(cycleRef, {
        uid,
        packageLevel: packageName,
        packageValueCC: ccVal,
        earningsCapCC: earningsCap,
        currentQualifiedEarningsCC: 0,
        remainingCapacityCC: earningsCap,
        status: 'Active',
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'AFFILIATE_ACTIVATION_APPROVED',
        `Approved Affiliate Activation request ${requestId} for user ${uid} (${packageName} package)`
      );

      setSuccess(`Successfully approved Affiliate Activation! User role updated to Affiliate and business cycle initialized.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Approval process failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAffiliateActivationRequest = async (requestId: string, reason: string) => {
    if (!reason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(`reject-aff-${requestId}`);
    setError(null);
    setSuccess(null);
    try {
      const timestamp = new Date().toISOString();
      const batch = writeBatch(db);

      const requestRef = doc(db, 'affiliate_activation_requests', requestId);
      batch.update(requestRef, {
        status: 'Rejected',
        reviewedBy: currentUserProfile.fullName,
        rejectedReason: reason,
        updatedAt: timestamp
      });

      await batch.commit();

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'AFFILIATE_ACTIVATION_REJECTED',
        `Rejected Affiliate Activation request ${requestId} with reason: ${reason}`
      );

      setSuccess(`Successfully rejected Affiliate Activation request.`);
      setRejectingRequestId(null);
      setRejectingType(null);
      setRejectionReasonInput('');
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Rejection process failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingRegistrations = users.filter((u: any) => u.status === 'Inactive' && u.paymentStatus === 'Pending Approval');
  const pendingCashinRequests = cashinRequests.filter((c: any) => c.status === 'Pending' || c.status === 'Submitted');

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

      {/* Top Banner Navigation */}
      <header className="border-b border-cyan-950/30 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-xs font-semibold mr-4 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Dashboard
            </button>
            <span className="font-extrabold text-sm uppercase tracking-widest gold-text">
              Administrative Control Hub
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAdminData}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Hub Title */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
              System Administration
            </h1>
            <p className="text-zinc-400 font-light">
              Overview, member management, cash-ins, registrations, and catalog placeholders.
            </p>
          </div>
          <div className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-2 font-mono text-xs text-gold">
            Role: {currentUserProfile.role} • Build 000010
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap border-b border-zinc-900 gap-1 mb-8">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer ${
              activeTab === 'metrics' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Metrics Summary
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer ${
              activeTab === 'members' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Members List ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('cashin')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer relative ${
              activeTab === 'cashin' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Cash-Ins
            {pendingCashinRequests.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('activations')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer relative ${
              activeTab === 'activations' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Package Activations
            {pendingRegistrations.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold rounded-full animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer ${
              activeTab === 'products' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer ${
              activeTab === 'orders' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold transition-all border-b-2 cursor-pointer ${
              activeTab === 'reports' ? 'border-gold text-gold bg-zinc-900/20' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Reports Summary
          </button>
        </div>

        {/* Alert Alerts */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-8">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-8">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Contents */}
        {activeTab === 'metrics' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Demographic Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl shadow-md">
                <Users className="w-5 h-5 text-zinc-500 mb-3" />
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Total Members</span>
                <span className="text-2xl font-black text-white block mt-1">{stats.totalUsers}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl shadow-md">
                <Users className="w-5 h-5 text-zinc-500 mb-3" />
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Customers</span>
                <span className="text-2xl font-black text-white block mt-1">{stats.totalCustomers}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl shadow-md">
                <Award className="w-5 h-5 text-zinc-500 mb-3" />
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Affiliates</span>
                <span className="text-2xl font-black text-white block mt-1">{stats.totalAffiliates}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl shadow-md">
                <Shield className="w-5 h-5 text-zinc-500 mb-3" />
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">City Dist.</span>
                <span className="text-2xl font-black text-white block mt-1">{stats.totalCityDistributors}</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl shadow-md">
                <Layers className="w-5 h-5 text-zinc-500 mb-3" />
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Regional Dist.</span>
                <span className="text-2xl font-black text-white block mt-1">{stats.totalRegionalDistributors}</span>
              </div>
            </div>

            {/* Financial metrics widgets */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-black mb-4">Financial Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-gold mb-3" />
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Package Sales</span>
                  <span className="text-xl font-black text-white block mt-1">{stats.packageSalesCC.toLocaleString()} CC</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl">
                  <Wallet className="w-5 h-5 text-gold mb-3" />
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">CC Consumed</span>
                  <span className="text-xl font-black text-white block mt-1">{stats.ccConsumedCC.toLocaleString()} CC</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl">
                  <Coins className="w-5 h-5 text-gold mb-3" />
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Referral Bonuses</span>
                  <span className="text-xl font-black text-white block mt-1">{stats.referralBonusesCC.toLocaleString()} CC</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl">
                  <Sparkles className="w-5 h-5 text-gold mb-3" />
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Active Packages</span>
                  <span className="text-xl font-black text-white block mt-1">{stats.activePackagesCount}</span>
                </div>
              </div>
            </div>

            {/* Active packages breakdown */}
            <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl">
              <h3 className="font-extrabold text-sm text-zinc-300 uppercase tracking-wide mb-4">Packages Breakdown</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase">Bronze</span>
                  <span className="block text-lg font-black text-white mt-1">{stats.activePackagesBreakdown.Bronze}</span>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase">Silver</span>
                  <span className="block text-lg font-black text-white mt-1">{stats.activePackagesBreakdown.Silver}</span>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase">Gold</span>
                  <span className="block text-lg font-black text-white mt-1">{stats.activePackagesBreakdown.Gold}</span>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase">Platinum</span>
                  <span className="block text-lg font-black text-white mt-1">{stats.activePackagesBreakdown.Platinum}</span>
                </div>
                <div className="text-center p-3 bg-zinc-900 rounded-lg">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase">Diamond</span>
                  <span className="block text-lg font-black text-white mt-1">{stats.activePackagesBreakdown.Diamond}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 animate-fadeIn">
            <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-gold" /> Registered System Users ({users.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 uppercase">
                    <th className="py-3 px-4 font-bold">Member ID</th>
                    <th className="py-3 px-4 font-bold">Full Name</th>
                    <th className="py-3 px-4 font-bold">Email</th>
                    <th className="py-3 px-4 font-bold">Role</th>
                    <th className="py-3 px-4 font-bold">Sponsor Code</th>
                    <th className="py-3 px-4 font-bold">KYC Status</th>
                    <th className="py-3 px-4 font-bold">Package Level</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300 font-light">
                  {users.map((u, idx) => (
                    <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{u.memberId}</td>
                      <td className="py-3.5 px-4 text-white font-bold">{u.fullName}</td>
                      <td className="py-3.5 px-4 text-zinc-400">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gold">{u.role}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{u.referredBy || 'None'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          u.kycStatus === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {u.kycStatus || 'Unverified'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-semibold">{u.packageLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'cashin' && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 animate-fadeIn">
            <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-6">
              <Wallet className="w-5 h-5 text-gold" /> Cash-In Requests ledger
            </h3>

            {cashinRequests.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 font-light text-sm">
                No Cash-In requests recorded on file.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 uppercase">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">PHP Amount</th>
                      <th className="py-3 px-4">CC Value</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300 font-light">
                    {cashinRequests.map((req, idx) => (
                      <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-zinc-500">
                          {new Date(req.requestDate || req.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-white font-bold">{req.fullName}</td>
                        <td className="py-3.5 px-4 font-mono font-bold">₱{(req.amountPhp || req.amountPHP || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono text-gold font-bold">{req.amountCC || req.computedCC} CC</td>
                        <td className="py-3.5 px-4">{req.paymentChannel || req.paymentMethod}</td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">{req.referenceNumber}</td>
                        <td className="py-3.5 px-4">
                          {req.proofOfPaymentUrl ? (
                            <a
                              href={req.proofOfPaymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gold hover:underline font-bold text-[10px]"
                            >
                              View Receipt
                            </a>
                          ) : (
                            <span className="text-zinc-600">None</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            req.status === 'Declined' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {(req.status === 'Pending' || req.status === 'Submitted') && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveCashin(req.requestId, req.uid, req.amountCC || req.computedCC)}
                                disabled={actionLoading !== null}
                                className="bg-emerald-500 hover:bg-emerald-600 p-1.5 rounded text-black transition-colors"
                                title="Approve Cash-In"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeclineCashin(req.requestId, req.uid)}
                                disabled={actionLoading !== null}
                                className="bg-red-500 hover:bg-red-600 p-1.5 rounded text-white transition-colors"
                                title="Decline Cash-In"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activations' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* 1. AFFILIATE ACTIVATION REQUESTS SECTION */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
              <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-gold" /> Pending Affiliate Activations
              </h3>
              <p className="text-zinc-500 text-xs mb-6">Requests from Customers selecting the Affiliate Business path.</p>

              {affiliateRequests.filter(r => r.status === 'Pending').length === 0 ? (
                <div className="text-center py-8 text-zinc-500 font-light text-sm">
                  No pending Affiliate activation requests.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase">
                        <th className="py-3 px-4 font-bold">Full Name</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">Package</th>
                        <th className="py-3 px-4 font-bold">Value</th>
                        <th className="py-3 px-4 font-bold">Earnings Cap</th>
                        <th className="py-3 px-4 font-bold">Submitted</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300 font-light">
                      {affiliateRequests.filter(r => r.status === 'Pending').map((r, idx) => (
                        <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                          <td className="py-3.5 px-4 text-white font-bold">{r.fullName}</td>
                          <td className="py-3.5 px-4 text-zinc-400">{r.email}</td>
                          <td className="py-3.5 px-4 text-gold font-extrabold uppercase">{r.selectedPackage}</td>
                          <td className="py-3.5 px-4 font-mono text-zinc-200">
                            {r.packageValueCC} CC <span className="text-[10px] text-zinc-500">(₱{(r.amountPHP || 0).toLocaleString()})</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-gold">{r.earningsCapCC} CC</td>
                          <td className="py-3.5 px-4 text-zinc-500">{new Date(r.createdAt || 0).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleApproveAffiliateActivationRequest(r.id, r.uid, r.selectedPackage, r.packageValueCC, r.earningsCapCC)}
                              disabled={actionLoading !== null}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-[10px] font-black px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingRequestId(r.id);
                                setRejectingType('affiliate');
                                setRejectionReasonInput('');
                              }}
                              disabled={actionLoading !== null}
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 text-[10px] font-black px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider border border-red-500/20"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. CUSTOMER PACKAGE REQUESTS SECTION */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
              <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" /> Pending Customer Packages
              </h3>
              <p className="text-zinc-500 text-xs mb-6">Product package purchases from customers on the Smart Customer path.</p>

              {customerRequests.filter(r => r.status === 'Pending').length === 0 ? (
                <div className="text-center py-8 text-zinc-500 font-light text-sm">
                  No pending Customer package procurement requests.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase">
                        <th className="py-3 px-4 font-bold">Full Name</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">Wellness Package</th>
                        <th className="py-3 px-4 font-bold">Price Paid</th>
                        <th className="py-3 px-4 font-bold">Submitted</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300 font-light">
                      {customerRequests.filter(r => r.status === 'Pending').map((r, idx) => (
                        <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                          <td className="py-3.5 px-4 text-white font-bold">{r.fullName}</td>
                          <td className="py-3.5 px-4 text-zinc-400">{r.email}</td>
                          <td className="py-3.5 px-4 text-emerald-400 font-bold">{r.selectedPackage}</td>
                          <td className="py-3.5 px-4 font-mono text-zinc-200">
                            ₱{(r.amountPHP || 0).toLocaleString()} <span className="text-[10px] text-zinc-500">({r.amountCC} CC)</span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-500">{new Date(r.createdAt || 0).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleApproveCustomerPackageRequest(r.id, r.uid, r.selectedPackage, r.amountCC)}
                              disabled={actionLoading !== null}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-[10px] font-black px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingRequestId(r.id);
                                setRejectingType('customer');
                                setRejectionReasonInput('');
                              }}
                              disabled={actionLoading !== null}
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 text-[10px] font-black px-2.5 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider border border-red-500/20"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. PUBLIC REGISTRATIONS ACTIVATE TIER */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
              <h3 className="font-extrabold text-lg text-white uppercase tracking-tight flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-cyan-400" /> Pending Public Registrations
              </h3>
              <p className="text-zinc-500 text-xs mb-6">Traditional direct onboarding pending activations.</p>

              {pendingRegistrations.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 font-light text-sm">
                  No pending registrations needing package activation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase">
                        <th className="py-3 px-4 font-bold">Full Name</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">Package Type</th>
                        <th className="py-3 px-4 font-bold">Payment Method</th>
                        <th className="py-3 px-4 font-bold">Price Paid</th>
                        <th className="py-3 px-4 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300 font-light">
                      {pendingRegistrations.map((u, idx) => (
                        <tr key={idx} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                          <td className="py-3.5 px-4 text-white font-bold">{u.fullName}</td>
                          <td className="py-3.5 px-4 text-zinc-400">{u.email}</td>
                          <td className="py-3.5 px-4 text-gold font-bold">{u.packageLevel}</td>
                          <td className="py-3.5 px-4">{u.paymentMethod || 'Direct'}</td>
                          <td className="py-3.5 px-4 font-mono">₱{(u.paymentAmountPhp || 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleApproveAffiliate(u.uid, u.fullName)}
                              disabled={actionLoading !== null}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-[10px] font-black px-3 py-1 rounded transition-colors cursor-pointer uppercase tracking-wider"
                            >
                              {actionLoading === `activate-${u.uid}` ? 'Activating...' : 'Approve & Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* REJECTION MODAL FOR ADMINISTRATORS */}
            {rejectingRequestId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-[#0B0D12] border border-zinc-800/95 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider">Reject Request</h3>
                  <p className="text-zinc-400 text-xs">
                    Please provide an official reason for declining request <span className="text-zinc-200 font-mono font-bold">{rejectingRequestId}</span>.
                  </p>
                  
                  <textarea
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg bg-black border border-zinc-800 text-white focus:outline-none focus:border-red-500/50 resize-none font-medium placeholder:text-zinc-600"
                    placeholder="e.g. Invalid billing signature, incomplete payment proof..."
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRejectingRequestId(null);
                        setRejectingType(null);
                        setRejectionReasonInput('');
                      }}
                      className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border border-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (rejectingType === 'customer') {
                          handleRejectCustomerPackageRequest(rejectingRequestId, rejectionReasonInput);
                        } else {
                          handleRejectAffiliateActivationRequest(rejectingRequestId, rejectionReasonInput);
                        }
                      }}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Products Placeholder */}
        {activeTab === 'products' && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 text-center animate-fadeIn">
            <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-4 animate-pulse" />
            <h3 className="font-extrabold text-white uppercase text-md mb-2">Corporate Product Catalog Manager</h3>
            <p className="text-zinc-500 text-xs max-w-md mx-auto mb-6 leading-relaxed">
              Standard Admins can track inventories, adjust SKU codes, and restock units. Complete CRUD services are configured.
            </p>
            <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl text-left max-w-xl mx-auto space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-gold">Standard Catalog Products</span>
              <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2">
                <span className="text-white font-semibold">Chosen Herbal Blend</span>
                <span className="text-zinc-500 font-mono">SKU: ICH-HER-001 • Price: 8 CC</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-2">
                <span className="text-white font-semibold">Chosen 15-in-1 Latte Coffee</span>
                <span className="text-zinc-500 font-mono">SKU: ICH-COF-002 • Price: 15 CC</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-semibold">Chosen Pure Barley</span>
                <span className="text-zinc-500 font-mono">SKU: ICH-BAR-003 • Price: 16 CC</span>
              </div>
            </div>
          </div>
        )}

        {/* Orders Placeholder */}
        {activeTab === 'orders' && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 text-center animate-fadeIn">
            <Boxes className="w-12 h-12 text-zinc-600 mx-auto mb-4 animate-pulse" />
            <h3 className="font-extrabold text-white uppercase text-md mb-2">Order Fulfillment Center</h3>
            <p className="text-zinc-500 text-xs max-w-md mx-auto mb-6 leading-relaxed">
              Track customer purchases, package shipments, and order logs. Standard Admins have access to update status to "Shipped" or "Delivered".
            </p>
            <div className="bg-zinc-900/40 border border-zinc-850/60 rounded-xl p-4 text-xs font-mono max-w-sm mx-auto text-zinc-500 space-y-1">
              <span>-- NO ORDERS CURRENTLY PENDING FULFILLMENT --</span>
            </div>
          </div>
        )}

        {/* Reports Placeholder */}
        {activeTab === 'reports' && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 text-center animate-fadeIn">
            <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4 animate-pulse" />
            <h3 className="font-extrabold text-white uppercase text-md mb-2">Enterprise Performance Reports</h3>
            <p className="text-zinc-500 text-xs max-w-md mx-auto leading-relaxed">
              Generate PDF and CSV summaries for registration logs, wallet ledgers, tax withholdings, and total unilevel cycles.
            </p>
          </div>
        )}

      </main>

      <footer className="py-8 border-t border-zinc-950 bg-zinc-950 text-center mt-12">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.4.0 • Build 000010
        </span>
      </footer>
    </div>
  );
}

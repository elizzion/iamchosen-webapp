import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Settings, 
  TrendingUp, 
  AlertOctagon, 
  CheckCircle, 
  RotateCcw, 
  Layers, 
  Plus, 
  Search, 
  Download, 
  User, 
  RefreshCw, 
  Eye, 
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, setDoc, orderBy, limit, where } from 'firebase/firestore';
import { useCCSettings } from '../context/CCSettingsContext';
import { TechOpsTreasuryService, TransferFeeTransaction, TreasuryDisbursement } from '../services/wallet/tech-ops-treasury.service';
import { UserProfile } from '../types';

interface TechOpsTreasuryDashboardProps {
  currentUserProfile: UserProfile | null;
}

export default function TechOpsTreasuryDashboard({ currentUserProfile }: TechOpsTreasuryDashboardProps) {
  const { ccSettings, refreshSettings } = useCCSettings();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'config' | 'disbursements' | 'reconciliation' | 'ledger' | 'reversals'>('overview');
  
  // Dashboard Metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Configuration form
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    transferFeeEnabled: true,
    transferFeeAmountCC: 1.0,
    transferFeePublicDisplayName: 'Platform Transfer Fee',
    transferFeeInternalDisplayName: 'Technology Operations Treasury',
    transferFeePayer: 'SENDER',
    transferFeeType: 'PLATFORM_TRANSFER_FEE',
    transferFeeAmountType: 'FIXED',
    transferFeeApplyOnlyOnCompleted: true,
    transferFeeDestinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY'
  });

  // Reversal Form
  const [reversalId, setReversalId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [reversalSuccess, setReversalSuccess] = useState<string | null>(null);

  // Disbursement Form
  const [showDisbModal, setShowDisbModal] = useState(false);
  const [disbLoading, setDisbLoading] = useState(false);
  const [disbError, setDisbError] = useState<string | null>(null);
  const [disbForm, setDisbForm] = useState({
    payeeIdentity: '',
    amountCC: 10,
    authorityReference: '',
    corporateApprovalRecord: '',
    taxTreatment: 'NON_TAXABLE',
    supportingDocRef: '',
    notes: ''
  });

  // Data lists
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [feeTransactions, setFeeTransactions] = useState<TransferFeeTransaction[]>([]);
  const [disbursements, setDisbursements] = useState<TreasuryDisbursement[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Access check
  const userRole = currentUserProfile?.role || 'Customer';
  const hasWriteAccess = userRole === 'Super Admin' || userRole === 'TECHNOLOGY_TREASURY_OPERATOR';
  const hasViewAccess = hasWriteAccess || userRole === 'TREASURY_AUDITOR' || userRole === 'Admin';

  const fetchMetricsAndData = async () => {
    setLoadingMetrics(true);
    try {
      const rep = await TechOpsTreasuryService.getPlatformFeeReport();
      setMetrics(rep);

      // Fetch Disbursements
      const disQuery = query(collection(db, 'treasury_disbursements'), orderBy('requestedAt', 'desc'));
      const disSnap = await getDocs(disQuery);
      setDisbursements(disSnap.docs.map(d => d.data() as TreasuryDisbursement));

      // Fetch Fee transactions
      const feeQuery = query(collection(db, 'transfer_fee_transactions'), orderBy('createdAt', 'desc'));
      const feeSnap = await getDocs(feeQuery);
      setFeeTransactions(feeSnap.docs.map(d => d.data() as TransferFeeTransaction));
    } catch (e) {
      console.error("Failed to load treasury data:", e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const q = query(
        collection(db, 'wallet_transactions'),
        where('transactionType', 'in', [
          'TRANSFER_DEBIT', 
          'TRANSFER_CREDIT', 
          'PLATFORM_TRANSFER_FEE_DEBIT', 
          'TECHNOLOGY_TREASURY_FEE_CREDIT',
          'TRANSFER_REVERSAL',
          'PLATFORM_TRANSFER_FEE_REVERSAL',
          'TREASURY_FEE_REVERSAL',
          'TECHNOLOGY_OPERATIONS_COMPENSATION_DISBURSEMENT'
        ]),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setLedgerTxs(snap.docs.map(d => d.data()));
    } catch (e) {
      console.error("Failed to fetch ledger transactions:", e);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (hasViewAccess) {
      fetchMetricsAndData();
    }
  }, [hasViewAccess]);

  useEffect(() => {
    if (activeSubTab === 'ledger') {
      fetchLedger();
    }
  }, [activeSubTab]);

  // Sync Form to config Settings
  useEffect(() => {
    if (ccSettings) {
      setConfigForm({
        transferFeeEnabled: ccSettings.transferFeeEnabled !== false,
        transferFeeAmountCC: ccSettings.transferFeeAmountCC ?? 1.0,
        transferFeePublicDisplayName: ccSettings.transferFeePublicDisplayName || 'Platform Transfer Fee',
        transferFeeInternalDisplayName: ccSettings.transferFeeInternalDisplayName || 'Technology Operations Treasury',
        transferFeePayer: ccSettings.transferFeePayer || 'SENDER',
        transferFeeType: ccSettings.transferFeeType || 'PLATFORM_TRANSFER_FEE',
        transferFeeAmountType: ccSettings.transferFeeAmountType || 'FIXED',
        transferFeeApplyOnlyOnCompleted: ccSettings.transferFeeApplyOnlyOnCompleted !== false,
        transferFeeDestinationTreasuryId: ccSettings.transferFeeDestinationTreasuryId || 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY'
      });
    }
  }, [ccSettings]);

  if (!hasViewAccess) {
    return (
      <div className="p-8 text-center bg-zinc-950/40 rounded-3xl border border-zinc-900 flex flex-col items-center justify-center min-h-[400px]">
        <Lock className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Access Denied</h3>
        <p className="text-xs text-zinc-500 max-w-sm">
          You do not have administrative clearance to access the Technology Operations Treasury and Platform Transfer Fee controls.
        </p>
      </div>
    );
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWriteAccess) {
      window.showError?.("You do not have write permissions for configuration updates.", "Unauthorized");
      return;
    }
    setIsSavingConfig(true);
    try {
      const docRef = doc(db, 'system_config', 'cc_settings');
      await setDoc(docRef, configForm, { merge: true });
      await refreshSettings();
      window.showSuccess?.("Platform Transfer Fee Rules updated successfully!", "Rules Updated");
      fetchMetricsAndData();
    } catch (err: any) {
      window.showError?.(err.message || "Failed to save configuration.", "Save Failed");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWriteAccess) {
      window.showError?.("You do not have authorization to perform financial reversals.", "Unauthorized");
      return;
    }
    if (!reversalId.trim()) {
      setReversalError("Please provide a valid source Transfer Reference ID.");
      return;
    }
    if (reversalReason.trim().length < 5) {
      setReversalError("Please provide a specific reversal reason (minimum 5 characters).");
      return;
    }

    setReversalLoading(true);
    setReversalError(null);
    setReversalSuccess(null);

    try {
      const actorEmail = auth.currentUser?.email || currentUserProfile?.email || 'admin@chosen.com';
      const res = await TechOpsTreasuryService.executeReversal(reversalId.trim(), reversalReason.trim(), actorEmail);
      setReversalSuccess(`Transfer and fee reversed successfully! Refunded ${res.refundAmountCC} CC back to the sender.`);
      setReversalId('');
      setReversalReason('');
      fetchMetricsAndData();
    } catch (err: any) {
      setReversalError(err.message || "Reversal transaction aborted.");
    } finally {
      setReversalLoading(false);
    }
  };

  const handleDisbursementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWriteAccess) {
      window.showError?.("You do not have authority to create disbursements.", "Unauthorized");
      return;
    }
    if (!disbForm.payeeIdentity.trim() || !disbForm.authorityReference.trim() || !disbForm.corporateApprovalRecord.trim()) {
      setDisbError("Please fill in all mandatory fields.");
      return;
    }

    setDisbLoading(true);
    setDisbError(null);

    try {
      const actorEmail = auth.currentUser?.email || currentUserProfile?.email || 'admin@chosen.com';
      await TechOpsTreasuryService.requestDisbursement({
        payeeIdentity: disbForm.payeeIdentity.trim(),
        amountCC: Number(disbForm.amountCC),
        authorityReference: disbForm.authorityReference.trim(),
        corporateApprovalRecord: disbForm.corporateApprovalRecord.trim(),
        taxTreatment: disbForm.taxTreatment,
        supportingDocRef: disbForm.supportingDocRef.trim(),
        approvalActor: actorEmail,
        paymentReference: `REF-${Date.now()}`,
        accountingClassification: 'TECHNOLOGY_OPERATIONS_COMPENSATION_DISBURSEMENT',
        notes: disbForm.notes.trim()
      });

      setShowDisbModal(false);
      setDisbForm({
        payeeIdentity: '',
        amountCC: 10,
        authorityReference: '',
        corporateApprovalRecord: '',
        taxTreatment: 'NON_TAXABLE',
        supportingDocRef: '',
        notes: ''
      });
      window.showSuccess?.("Technology operations compensation disbursement requested successfully!", "Disbursement Initiated");
      fetchMetricsAndData();
    } catch (err: any) {
      setDisbError(err.message || "Disbursement submission failed.");
    } finally {
      setDisbLoading(false);
    }
  };

  const handleApproveDisbursement = async (id: string, action: 'APPROVED' | 'RELEASED' | 'REJECTED') => {
    if (!hasWriteAccess) {
      window.showError?.("You do not have write credentials for disbursement processing.", "Unauthorized");
      return;
    }
    try {
      const actorEmail = auth.currentUser?.email || currentUserProfile?.email || 'admin@chosen.com';
      await TechOpsTreasuryService.processDisbursementStatus(id, action, actorEmail);
      window.showSuccess?.(`Disbursement request ${action.toLowerCase()} successfully!`, "Disbursement Processed");
      fetchMetricsAndData();
    } catch (err: any) {
      window.showError?.(err.message || "Action failed.", "Transaction Error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#171A22] to-zinc-950 p-6 rounded-3xl border border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/25 text-[#00D5FF] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider font-mono">
              Technology Operations Treasury
            </span>
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/25 text-[#FFB000] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider font-mono">
              Fee Monitoring
            </span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">
            Platform Treasury & Technological Operations
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise financial auditing, atomic transfer fees, ledger-first compliance, and corporate revenue projections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchMetricsAndData}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/30 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary Sub-Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 bg-zinc-950/60 p-1.5 rounded-2xl border border-zinc-900">
        {[
          { id: 'overview', label: 'Projections & Stats', icon: TrendingUp },
          { id: 'config', label: 'Fee Configuration', icon: Settings },
          { id: 'disbursements', label: 'Disbursement Payouts', icon: Layers },
          { id: 'reconciliation', label: 'Reconciliation Audit', icon: AlertOctagon },
          { id: 'ledger', label: 'Treasury Ledger Logs', icon: FileText },
          { id: 'reversals', label: 'Atomic Reversals', icon: RotateCcw }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-600/25 to-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/45 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Sub-Tab Viewport */}
      {loadingMetrics ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-zinc-950/25 rounded-3xl border border-zinc-900">
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Loading Treasury Projections...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeSubTab === 'overview' && metrics && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Main Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-b from-[#1E293B]/45 to-[#0F172A]/45 p-5 rounded-2xl border border-cyan-500/20 shadow-lg relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-cyan-500/10 border border-cyan-500/25 text-[#00D5FF] p-2 rounded-xl">
                    <Shield className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Treasury Cash Balance</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-1 font-mono">{metrics.treasuryBalance.toFixed(2)} CC</p>
                  <span className="block text-[8px] text-zinc-500 uppercase font-mono tracking-wider mt-1.5">Liquid System Reserves</span>
                </div>

                <div className="bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-5 rounded-2xl border border-zinc-850 shadow-md relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-[#FFB000]/10 border border-[#FFB000]/25 text-[#FFB000] p-2 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Gross Platform Fees</p>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight mt-1 font-mono">{metrics.grossFees.toFixed(2)} CC</p>
                  <span className="block text-[8px] text-zinc-500 uppercase font-mono tracking-wider mt-1.5">Total Lifetime collections</span>
                </div>

                <div className="bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-5 rounded-2xl border border-zinc-850 shadow-md relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-red-500/10 border border-red-500/25 text-red-400 p-2 rounded-xl">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Reversed Platform Fees</p>
                  <p className="text-2xl font-black text-red-400 tracking-tight mt-1 font-mono">{metrics.reversedFees.toFixed(2)} CC</p>
                  <span className="block text-[8px] text-zinc-500 uppercase font-mono tracking-wider mt-1.5">Traceable reversal adjustments</span>
                </div>

                <div className="bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 p-5 rounded-2xl border border-zinc-850 shadow-md relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 p-2 rounded-xl">
                    <AlertOctagon className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Unresolved Auditing Alerts</p>
                  <p className="text-2xl font-black text-yellow-400 tracking-tight mt-1 font-mono">{metrics.unresolvedAlertsCount}</p>
                  <span className="block text-[8px] text-zinc-500 uppercase font-mono tracking-wider mt-1.5">Immediate operator action required</span>
                </div>
              </div>

              {/* Collections Breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#111318]/50 border border-zinc-850 p-4 rounded-2xl">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">Fees Collected Today</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-bold text-white font-mono">{metrics.collectedToday.toFixed(2)} CC</span>
                    <span className="text-[10px] text-zinc-500 font-mono">PHP {(metrics.collectedToday * 70).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-[#111318]/50 border border-zinc-850 p-4 rounded-2xl">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">Fees Collected This Week</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-bold text-white font-mono">{metrics.collectedThisWeek.toFixed(2)} CC</span>
                    <span className="text-[10px] text-zinc-500 font-mono">PHP {(metrics.collectedThisWeek * 70).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-[#111318]/50 border border-zinc-850 p-4 rounded-2xl">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">Fees Collected This Month</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-bold text-white font-mono">{metrics.collectedThisMonth.toFixed(2)} CC</span>
                    <span className="text-[10px] text-zinc-500 font-mono">PHP {(metrics.collectedThisMonth * 70).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Extended Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technological operations statistics */}
                <div className="bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl space-y-4">
                  <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Technological Operations Volume Projections
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950/55 p-4.5 rounded-xl border border-zinc-900">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Completed Fee Transfers</span>
                      <span className="text-xl font-bold text-white font-mono mt-1 block">{metrics.completedTransferCount}</span>
                    </div>
                    <div className="bg-zinc-950/55 p-4.5 rounded-xl border border-zinc-900">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Total Transfer Volume</span>
                      <span className="text-xl font-bold text-white font-mono mt-1 block">{metrics.totalTransferVolume.toFixed(2)} CC</span>
                    </div>
                    <div className="bg-zinc-950/55 p-4.5 rounded-xl border border-zinc-900">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Average Transfer Value</span>
                      <span className="text-xl font-bold text-white font-mono mt-1 block">{metrics.avgTransferValue.toFixed(2)} CC</span>
                    </div>
                    <div className="bg-zinc-950/55 p-4.5 rounded-xl border border-zinc-900">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Average Fee Per Transfer</span>
                      <span className="text-xl font-bold text-white font-mono mt-1 block">{metrics.avgFee.toFixed(4)} CC</span>
                    </div>
                  </div>
                </div>

                {/* System Audit Alerts Summary */}
                <div className="bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
                      <AlertOctagon className="w-4 h-4 text-yellow-400" />
                      Active Auditing Reconciliation Alerts
                    </h3>
                    <div className="space-y-2 mt-4 max-h-[180px] overflow-y-auto pr-1">
                      {metrics.alerts.length === 0 ? (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl flex items-center gap-2 text-xs">
                          <CheckCircle className="w-4 h-4" />
                          All ledger reconciliations validated. Expected system reserves are perfectly matched.
                        </div>
                      ) : (
                        metrics.alerts.map((alert: any) => (
                          <div 
                            key={alert.id} 
                            className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs font-mono ${
                              alert.type === 'CRITICAL' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            <span className="font-black">[{alert.type}]</span>
                            <div className="flex-1">
                              <p className="text-[11px] leading-relaxed">{alert.message}</p>
                              <span className="block text-[9px] text-zinc-500 mt-1">{new Date(alert.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'config' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <form onSubmit={handleSaveConfig} className="lg:col-span-2 bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    Modify Platform Transfer Fee Rules
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                    Any updates to these rules will atomically apply to all new Member-to-Member and P2P Transfers system-wide.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Rules Engine Status</label>
                    <select
                      value={configForm.transferFeeEnabled ? "true" : "false"}
                      disabled={!hasWriteAccess}
                      onChange={(e) => setConfigForm({ ...configForm, transferFeeEnabled: e.target.value === "true" })}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="true">Active (Enable 1 CC Platform Fee deduction)</option>
                      <option value="false">Inactive (Temporarily suspend fee collection)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Transfer Fee Amount (CC)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      disabled={!hasWriteAccess}
                      value={configForm.transferFeeAmountCC}
                      onChange={(e) => setConfigForm({ ...configForm, transferFeeAmountCC: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Public Display Name</label>
                    <input
                      type="text"
                      required
                      disabled={!hasWriteAccess}
                      value={configForm.transferFeePublicDisplayName}
                      onChange={(e) => setConfigForm({ ...configForm, transferFeePublicDisplayName: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Internal Display Name</label>
                    <input
                      type="text"
                      required
                      disabled={!hasWriteAccess}
                      value={configForm.transferFeeInternalDisplayName}
                      onChange={(e) => setConfigForm({ ...configForm, transferFeeInternalDisplayName: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Target Payer Entity</label>
                    <select
                      value={configForm.transferFeePayer}
                      disabled
                      className="w-full bg-zinc-950 border border-zinc-850 text-zinc-500 rounded-xl px-4 py-2.5 text-xs focus:outline-none cursor-not-allowed"
                    >
                      <option value="SENDER">Sender pays flat fee (Approved Standard)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Destination System Treasury</label>
                    <input
                      type="text"
                      disabled
                      value={configForm.transferFeeDestinationTreasuryId}
                      className="w-full bg-zinc-950 border border-zinc-850 text-zinc-500 rounded-xl px-4 py-2.5 text-xs font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                  <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    Any modifications must be justified in audit logs. These rates do not trigger secondary unilevel network commission payouts.
                  </p>
                </div>

                {hasWriteAccess ? (
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full md:w-auto bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Save Rules Configuration
                  </button>
                ) : (
                  <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                    <Lock className="w-3.5 h-3.5 text-red-500" />
                    Read-Only Access. Only Super Admins may modify active rules.
                  </div>
                )}
              </form>

              {/* Sidebar Guide */}
              <div className="bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl space-y-4 text-xs">
                <h3 className="font-black text-white text-xs uppercase tracking-wider border-b border-zinc-800 pb-2">Active Rules Matrix</h3>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-zinc-850/50 pb-2">
                    <span className="text-zinc-500 font-mono">Fee Model:</span>
                    <span className="text-white font-bold font-mono">FIXED_CC</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-850/50 pb-2">
                    <span className="text-zinc-500 font-mono">Commission Source:</span>
                    <span className="text-red-400 font-bold font-mono">FALSE</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-850/50 pb-2">
                    <span className="text-zinc-500 font-mono">Business Cycle Count:</span>
                    <span className="text-red-400 font-bold font-mono">FALSE</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-850/50 pb-2">
                    <span className="text-zinc-500 font-mono">Referral Trigger:</span>
                    <span className="text-red-400 font-bold font-mono">FALSE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-mono">Treasury Target:</span>
                    <span className="text-cyan-400 font-bold font-mono uppercase text-[10px]">SYSTEM_TECH_OPS</span>
                  </div>
                </div>

                <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/10 text-yellow-500/90 rounded-xl text-[11px] leading-relaxed">
                  <strong>Disclosure Directive:</strong> Public-facing client components must query <code>cc_settings</code> dynamic labels. They must hide internal treasury targets or Chief Technology Officer ownership specifics from end members.
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'disbursements' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Treasury Compensation Disbursements
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    View, request, and execute compensation payments funded by Technology Operations platform revenue.
                  </p>
                </div>
                {hasWriteAccess && (
                  <button 
                    onClick={() => setShowDisbModal(true)}
                    className="bg-gradient-to-r from-[#00D5FF] to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Request Disbursement
                  </button>
                )}
              </div>

              {/* Disbursements Table */}
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-850 uppercase tracking-wider text-[9px] font-bold font-mono">
                      <tr>
                        <th className="p-4">Disbursement ID</th>
                        <th className="p-4">Payee Identity</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Authority Reference</th>
                        <th className="p-4">Approval Board Ref</th>
                        <th className="p-4">Requested At</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/50">
                      {disbursements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-500 font-mono">No corporate disbursement records found.</td>
                        </tr>
                      ) : (
                        disbursements.map((dis) => (
                          <tr key={dis.id} className="hover:bg-zinc-900/25 transition-colors">
                            <td className="p-4 font-mono font-bold text-zinc-300">{dis.id}</td>
                            <td className="p-4 text-white font-bold">{dis.payeeIdentity}</td>
                            <td className="p-4 font-mono font-black text-cyan-400">{dis.amountCC.toFixed(2)} CC</td>
                            <td className="p-4 font-mono text-zinc-400">{dis.authorityReference}</td>
                            <td className="p-4 font-mono text-zinc-400">{dis.corporateApprovalRecord}</td>
                            <td className="p-4 text-zinc-400">{new Date(dis.requestedAt).toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                dis.status === 'RELEASED'
                                  ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                                  : dis.status === 'APPROVED'
                                  ? 'bg-cyan-500/10 border-cyan-500/15 text-cyan-400'
                                  : dis.status === 'REJECTED'
                                  ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                  : 'bg-yellow-500/10 border-yellow-500/15 text-yellow-400'
                              }`}>
                                {dis.status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-1">
                              {dis.status === 'REQUESTED' && hasWriteAccess && (
                                <>
                                  <button 
                                    onClick={() => handleApproveDisbursement(dis.id, 'APPROVED')}
                                    className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded px-2 py-1 text-[10px] font-bold cursor-pointer uppercase transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => handleApproveDisbursement(dis.id, 'REJECTED')}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded px-2 py-1 text-[10px] font-bold cursor-pointer uppercase transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {dis.status === 'APPROVED' && hasWriteAccess && (
                                <button 
                                  onClick={() => handleApproveDisbursement(dis.id, 'RELEASED')}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded px-2.5 py-1 text-[10px] font-black cursor-pointer uppercase transition-colors"
                                >
                                  Release funds
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'reconciliation' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-yellow-500" />
                      Dynamic Treasury Ledger Reconciliation Audit
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Runs complex double-entry accounting tests, auditing sender fee debits against technology operations treasury credit entries.
                    </p>
                  </div>
                  <button 
                    onClick={fetchMetricsAndData}
                    className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500/30 text-yellow-500 hover:text-white px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Execute Audit Test
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-950/60 p-4.5 rounded-xl border border-zinc-900 space-y-2">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Double-Entry Reconciliation Rule</span>
                      <p className="text-xs text-zinc-300">
                        Ensures that for every single completed transfer that generates a fee, the sum of all <code>PLATFORM_TRANSFER_FEE_DEBIT</code> entries exactly equals the sum of <code>TECHNOLOGY_TREASURY_FEE_CREDIT</code> entries.
                      </p>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-400 font-mono">Audit Status:</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          metrics.alerts.some((a: any) => a.message.includes('Ledger mismatch'))
                            ? 'bg-red-500/10 border-red-500/15 text-red-400'
                            : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                        }`}>
                          {metrics.alerts.some((a: any) => a.message.includes('Ledger mismatch')) ? 'MISMATCH_CRITICAL' : 'BALANCED_OK'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/60 p-4.5 rounded-xl border border-zinc-900 space-y-2">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">Reserves Coverage Rule</span>
                      <p className="text-xs text-zinc-300">
                        Audits expected system closing reserves against actual liquid treasury account balances, factoring in disbursements and reversals.
                      </p>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-400 font-mono">Audit Status:</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          metrics.alerts.some((a: any) => a.message.includes('expected closing balance'))
                            ? 'bg-red-500/10 border-red-500/15 text-red-400'
                            : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                        }`}>
                          {metrics.alerts.some((a: any) => a.message.includes('expected closing balance')) ? 'COVERAGE_ERROR' : 'VERIFIED_COVERAGE'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-850/50 pt-4 space-y-3">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Comprehensive Auditing Warnings</h4>
                    {metrics.alerts.length === 0 ? (
                      <p className="text-xs text-zinc-500 font-mono text-center py-6">No historical discrepancies or alerts. Double-entry system is fully synchronized.</p>
                    ) : (
                      metrics.alerts.map((alert: any) => (
                        <div key={alert.id} className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4 text-red-400" />
                            <span className="text-xs font-bold text-white font-mono">{alert.message}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono">{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'ledger' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Search Control */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search ledger logs by transaction reference, Member ID, type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-cyan-500/50 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                />
              </div>

              {/* Ledger Table */}
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-850 uppercase tracking-wider text-[9px] font-bold font-mono">
                      <tr>
                        <th className="p-4">Transaction ID</th>
                        <th className="p-4">Account Target</th>
                        <th className="p-4">Ledger Type</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Before</th>
                        <th className="p-4">Value (CC)</th>
                        <th className="p-4">After</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/50 font-mono">
                      {loadingLedger ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-zinc-500">Querying immutable transaction logs...</td>
                        </tr>
                      ) : ledgerTxs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-zinc-500">No matching ledger records found.</td>
                        </tr>
                      ) : (
                        ledgerTxs
                          .filter(tx => 
                            tx.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.uid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.systemAccountId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.transactionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.memberId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.description?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((tx) => (
                            <tr key={tx.id} className="hover:bg-zinc-900/25 transition-colors text-[11px]">
                              <td className="p-4 font-bold text-zinc-300">{tx.id}</td>
                              <td className="p-4">
                                {tx.systemAccountId ? (
                                  <span className="text-[#00D5FF] font-bold uppercase tracking-wider text-[9px] bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                    {tx.systemAccountId}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 font-bold">
                                    {tx.memberId ? `IAM-${tx.memberId}` : tx.uid?.slice(0, 8)}
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase text-[9px] ${
                                  tx.transactionType?.includes('REVERSAL')
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : tx.transactionType?.includes('DEBIT')
                                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                }`}>
                                  {tx.transactionType?.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-4 font-bold">
                                {tx.direction === 'Debit' ? (
                                  <span className="text-orange-400 uppercase text-[10px]">DEBIT</span>
                                ) : (
                                  <span className="text-emerald-400 uppercase text-[10px]">CREDIT</span>
                                )}
                              </td>
                              <td className="p-4 text-zinc-400">{(tx.balanceBefore || 0).toFixed(4)}</td>
                              <td className={`p-4 font-black ${tx.direction === 'Debit' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {tx.direction === 'Debit' ? '-' : '+'}{tx.amountCC?.toFixed(4) || tx.amount?.toFixed(4)}
                              </td>
                              <td className="p-4 text-zinc-300">{(tx.balanceAfter || 0).toFixed(4)}</td>
                              <td className="p-4 text-zinc-400 text-[10px] max-w-xs truncate">{tx.description}</td>
                              <td className="p-4 text-zinc-500">{tx.completedAt ? new Date(tx.completedAt).toLocaleString() : 'N/A'}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'reversals' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-red-500" />
                    Initiate Atomic Reversal
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                    Execute a fully audited financial reversal. This will refund the transfer amount and the 1 CC Platform Fee back to the sender atomically, and debit the corresponding recipient and treasury balances.
                  </p>
                </div>

                {reversalError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
                    {reversalError}
                  </div>
                )}

                {reversalSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs">
                    {reversalSuccess}
                  </div>
                )}

                <form onSubmit={handleReversalSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Source Transfer Reference ID</label>
                    <input
                      type="text"
                      required
                      disabled={!hasWriteAccess || reversalLoading}
                      placeholder="e.g. P2P-TX-172083... or P2P-M2M-..."
                      value={reversalId}
                      onChange={(e) => setReversalId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-red-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Reversal Auditing Justification Reason</label>
                    <textarea
                      required
                      rows={3}
                      disabled={!hasWriteAccess || reversalLoading}
                      placeholder="Specify why this transfer is being reversed (e.g. incorrect member id, testing purposes, double click)."
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500/50"
                    />
                  </div>

                  {hasWriteAccess ? (
                    <button
                      type="submit"
                      disabled={reversalLoading}
                      className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {reversalLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Execute Certified Reversal
                    </button>
                  ) : (
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <Lock className="w-3.5 h-3.5 text-red-500" />
                      Read-Only. Only Authorized Treasury Operators may execute reversals.
                    </div>
                  )}
                </form>
              </div>

              {/* Reversal audit history */}
              <div className="bg-[#111318]/40 border border-zinc-850 p-6 rounded-2xl space-y-4">
                <h3 className="font-black text-white text-xs uppercase tracking-wider border-b border-zinc-800 pb-2 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-red-500" />
                  Recent Reversed Fees
                </h3>
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 text-xs">
                  {feeTransactions.filter(f => f.reversalStatus === 'REVERSED').length === 0 ? (
                    <p className="text-zinc-500 font-mono text-center py-6">No historical reversals recorded.</p>
                  ) : (
                    feeTransactions
                      .filter(f => f.reversalStatus === 'REVERSED')
                      .map((tx) => (
                        <div key={tx.feeTransactionId} className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-850 space-y-1.5">
                          <div className="flex justify-between items-start font-mono">
                            <span className="font-bold text-zinc-300">{tx.feeTransactionId}</span>
                            <span className="text-red-400 font-black">-{tx.feeAmountCC.toFixed(2)} CC</span>
                          </div>
                          <div className="text-[11px] space-y-1">
                            <p className="text-zinc-400"><strong className="text-zinc-500 font-mono">Source ID:</strong> {tx.sourceTransferId}</p>
                            <p className="text-zinc-400"><strong className="text-zinc-500 font-mono">Payer:</strong> {tx.payerName}</p>
                            <p className="text-red-400/90 leading-normal bg-red-500/5 border border-red-500/10 p-2 rounded mt-1.5 text-[10px]">
                              <strong>Reason:</strong> {tx.reversalReason || 'N/A'}
                            </p>
                          </div>
                          <span className="block text-[8px] text-zinc-500 font-mono text-right">{new Date(tx.updatedAt).toLocaleString()}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Disbursement Request Modal */}
      {showDisbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-zinc-850 flex justify-between items-center bg-[#111318]/80">
              <h3 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#00D5FF]" />
                Request Treasury Disbursement
              </h3>
              <button 
                onClick={() => setShowDisbModal(false)}
                className="text-zinc-500 hover:text-white font-extrabold text-xs cursor-pointer uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleDisbursementSubmit} className="p-6 space-y-4">
              {disbError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-mono">
                  {disbError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Payee Identity / Destination</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chief Tech Officer / Contractor Name"
                    value={disbForm.payeeIdentity}
                    onChange={(e) => setDisbForm({ ...disbForm, payeeIdentity: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Disbursement Amount (CC)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={disbForm.amountCC}
                    onChange={(e) => setDisbForm({ ...disbForm, amountCC: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Authority Reference ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AUTH-TOPS-2026-07"
                    value={disbForm.authorityReference}
                    onChange={(e) => setDisbForm({ ...disbForm, authorityReference: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Corporate Approval Record Ref</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MIN-BOARD-RES-12B"
                    value={disbForm.corporateApprovalRecord}
                    onChange={(e) => setDisbForm({ ...disbForm, corporateApprovalRecord: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Accounting Classification</label>
                  <input
                    type="text"
                    disabled
                    value="TECHNOLOGY_OPERATIONS_COMPENSATION"
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl px-4 py-2.5 text-xs cursor-not-allowed font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Supporting Document Link</label>
                  <input
                    type="text"
                    placeholder="e.g. Invoice path or PDF link"
                    value={disbForm.supportingDocRef}
                    onChange={(e) => setDisbForm({ ...disbForm, supportingDocRef: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Supporting Memo / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional details regarding payee accounts, payment channels..."
                  value={disbForm.notes}
                  onChange={(e) => setDisbForm({ ...disbForm, notes: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDisbModal(false)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disbLoading}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md disabled:opacity-50"
                >
                  {disbLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Submit Request
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  RotateCcw, 
  FileText, 
  Calendar, 
  Search, 
  Filter, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertCircle, 
  Shield,
  Eye,
  X,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  limit, 
  getDoc,
  doc
} from 'firebase/firestore';
import { getCCSettings } from '../services/cc-settings/cc-settings.service';

interface ReactivationRecord {
  reactivationId: string;
  uid: string;
  memberId: string;
  memberName: string;
  oldPackage: string;
  newPackage: string;
  actionType: "Reactivation" | "Upgrade Reactivation";
  packageValueCC: number;
  phpEquivalent: number;
  previousBusinessCycleId: string;
  newBusinessCycleId: string;
  sponsorUid: string;
  sponsorMemberId: string;
  directReferralBonusCC: number;
  unilevelBonusTotalCC: number;
  flushedAmountCC: number;
  msaReset: boolean;
  msaStartDate: string;
  status: "Completed";
  createdAt: string;
  createdBy: "system";
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  reactivationId?: string;
}

export default function ReactivationReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ReactivationRecord[]>([]);
  const [cashInRate, setCashInRate] = useState<number>(70);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string>('All');
  const [selectedActionType, setSelectedActionType] = useState<string>('All');
  const [dateRangeType, setDateRangeType] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Drill-down Modal State
  const [selectedRecord, setSelectedRecord] = useState<ReactivationRecord | null>(null);
  const [modalAuditLogs, setModalAuditLogs] = useState<AuditLog[]>([]);
  const [loadingModalLogs, setLoadingModalLogs] = useState(false);

  // Fetch Reactivation Records and System Settings
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch cashInRate from system_config/cc_settings via service
      const ccSettings = await getCCSettings();
      setCashInRate(ccSettings.cashInRatePHP);

      // 2. Fetch Reactivation Records from reactivation_reports
      const reportRef = collection(db, 'reactivation_reports');
      const q = query(reportRef, orderBy('createdAt', 'desc'));
      const querySnap = await getDocs(q);
      
      const fetchedRecords: ReactivationRecord[] = [];
      querySnap.forEach((doc) => {
        fetchedRecords.push(doc.data() as ReactivationRecord);
      });
      
      setRecords(fetchedRecords);
    } catch (err: any) {
      console.error("Error fetching reactivation reports:", err);
      setError(err.message || "Failed to retrieve reactivation report logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Audit Logs when a record is selected for drill-down modal
  const fetchAuditLogsForRecord = async (record: ReactivationRecord) => {
    setLoadingModalLogs(true);
    setModalAuditLogs([]);
    try {
      const logsRef = collection(db, 'audit_logs');
      const q = query(logsRef, where('reactivationId', '==', record.reactivationId));
      const querySnap = await getDocs(q);
      
      const logs: AuditLog[] = [];
      querySnap.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          action: data.action || 'UNKNOWN',
          details: data.details || '',
          timestamp: data.timestamp || data.createdAt || new Date().toISOString()
        });
      });
      
      // Sort logs by timestamp ascending to form a clean chronological timeline
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setModalAuditLogs(logs);
    } catch (err) {
      console.error("Error loading audit logs for reactivation modal:", err);
    } finally {
      setLoadingModalLogs(false);
    }
  };

  useEffect(() => {
    if (selectedRecord) {
      fetchAuditLogsForRecord(selectedRecord);
    }
  }, [selectedRecord]);

  // Apply filters in memory for instant high-speed responsive experience
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // 1. Search term match
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          (rec.memberName || '').toLowerCase().includes(term) ||
          (rec.memberId || '').toLowerCase().includes(term) ||
          (rec.reactivationId || '').toLowerCase().includes(term) ||
          (rec.sponsorMemberId || '').toLowerCase().includes(term) ||
          (rec.previousBusinessCycleId || '').toLowerCase().includes(term) ||
          (rec.newBusinessCycleId || '').toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // 2. Package level match
      if (selectedPackage !== 'All') {
        if (rec.newPackage !== selectedPackage) return false;
      }

      // 3. Action type match
      if (selectedActionType !== 'All') {
        if (rec.actionType !== selectedActionType) return false;
      }

      // 4. Date range filter
      if (rec.createdAt) {
        const recDate = new Date(rec.createdAt);
        const now = new Date();
        
        if (dateRangeType === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (recDate < startOfToday) return false;
        } else if (dateRangeType === 'week') {
          const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (recDate < startOfWeek) return false;
        } else if (dateRangeType === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (recDate < startOfMonth) return false;
        } else if (dateRangeType === 'custom') {
          if (startDate) {
            const startLimit = new Date(startDate);
            if (recDate < startLimit) return false;
          }
          if (endDate) {
            const endLimit = new Date(endDate);
            // Include full day of the end date
            endLimit.setHours(23, 59, 59, 999);
            if (recDate > endLimit) return false;
          }
        }
      }

      return true;
    });
  }, [records, searchTerm, selectedPackage, selectedActionType, dateRangeType, startDate, endDate]);

  // Aggregate stats from matching/filtered records
  const aggregates = useMemo(() => {
    let totalReactivations = filteredRecords.length;
    let reactivationSalesCC = 0;
    let directReferralBonusesCC = 0;
    let unilevelBonusesCC = 0;
    let msaResetsCount = 0;
    let restartedCyclesCount = 0;
    let flushedAmountCC = 0;

    filteredRecords.forEach((rec) => {
      reactivationSalesCC += rec.packageValueCC || 0;
      directReferralBonusesCC += rec.directReferralBonusCC || 0;
      unilevelBonusesCC += rec.unilevelBonusTotalCC || 0;
      if (rec.msaReset) msaResetsCount++;
      if (rec.newBusinessCycleId) restartedCyclesCount++;
      flushedAmountCC += rec.flushedAmountCC || 0;
    });

    return {
      totalReactivations,
      reactivationSalesCC,
      directReferralBonusesCC,
      unilevelBonusesCC,
      msaResetsCount,
      restartedCyclesCount,
      flushedAmountCC
    };
  }, [filteredRecords]);

  // Export Filtered Table as CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No matching records to export.");
      return;
    }

    const headers = [
      "Reactivation ID",
      "Date Completed",
      "Affiliate ID",
      "Affiliate Name",
      "Old Package",
      "New Package",
      "Action Type",
      "CC Paid",
      "PHP Equivalent",
      "Sponsor ID",
      "Direct Referral Bonus (CC)",
      "Unilevel Bonus (CC)",
      "Flushed Amount (CC)",
      "Previous Cycle ID",
      "New Cycle ID",
      "MSA Reset",
      "MSA Start Date"
    ];

    const rows = filteredRecords.map(rec => [
      rec.reactivationId,
      rec.createdAt,
      rec.memberId,
      rec.memberName,
      rec.oldPackage,
      rec.newPackage,
      rec.actionType,
      rec.packageValueCC,
      rec.phpEquivalent,
      rec.sponsorMemberId || 'N/A',
      rec.directReferralBonusCC,
      rec.unilevelBonusTotalCC,
      rec.flushedAmountCC,
      rec.previousBusinessCycleId || 'N/A',
      rec.newBusinessCycleId,
      rec.msaReset ? "Yes" : "No",
      rec.msaStartDate
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IAMCHOSEN_Reactivation_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Upper Title and Refresh Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950 border border-zinc-900 p-5 rounded-2xl">
        <div>
          <h3 className="text-lg font-extrabold uppercase text-white tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-teal-400" /> Account Reactivation & Sales Report
          </h3>
          <p className="text-xs text-zinc-500 font-light mt-0.5">
            Monitor compliance, trace cycle completions, observe automated direct & unilevel commissions, and inspect msa start date resettings.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={fetchData}
            className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-teal-400 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export Report (.csv)
          </button>
        </div>
      </div>

      {/* Aggregate metrics bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-teal-500 to-cyan-500" />
          <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Total Reactivations</span>
          <span className="text-3xl font-black text-white block mt-1 font-mono">{aggregates.totalReactivations}</span>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 block">Account cycle renewals & upgrades</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-emerald-500 to-teal-500" />
          <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Reactivation Sales</span>
          <span className="text-2xl font-black text-white block mt-1 font-mono">
            {aggregates.reactivationSalesCC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
          </span>
          <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
            ≈ ₱{(aggregates.reactivationSalesCC * cashInRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl">
          <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Direct & Unilevel Bonuses</span>
          <span className="text-2xl font-black text-white block mt-1 font-mono">
            {(aggregates.directReferralBonusesCC + aggregates.unilevelBonusesCC).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
          </span>
          <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
            Ref: {aggregates.directReferralBonusesCC.toFixed(2)} | Uni: {aggregates.unilevelBonusesCC.toFixed(2)}
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl">
          <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">Flushed-Out To Pool</span>
          <span className="text-2xl font-black text-amber-500 block mt-1 font-mono">
            {aggregates.flushedAmountCC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
          </span>
          <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
            ≈ ₱{(aggregates.flushedAmountCC * cashInRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* MSA Resets and Cycles Counter bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 font-extrabold text-sm font-mono">
            {aggregates.msaResetsCount}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase">Marketing Support Allocation Resets</h4>
            <p className="text-[10px] text-zinc-500">Total accounts with restarted 30-day corporate support eligibility</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2 border-t md:border-t-0 md:border-l border-zinc-900 pt-3 md:pt-0 md:pl-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-extrabold text-sm font-mono">
            {aggregates.restartedCyclesCount}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase">Business Cycles Restarted</h4>
            <p className="text-[10px] text-zinc-500">New blockchain ledgers provisioned under safety cap limits</p>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, sponsor, cycle reference, or reactivation number..."
              className="w-full bg-zinc-900 hover:bg-zinc-850 focus:bg-zinc-900 border border-zinc-800 focus:border-teal-500/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all font-medium"
            />
          </div>

          {/* Preset Buttons for Quick Filter */}
          <div className="flex flex-wrap gap-1.5 bg-zinc-900/60 p-1 rounded-xl">
            {(['all', 'today', 'week', 'month', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDateRangeType(type)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  dateRangeType === type 
                    ? 'bg-teal-500 text-black shadow-md shadow-teal-500/15' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {type === 'all' ? 'All Time' : type === 'week' ? '7 Days' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded filter fields row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-zinc-900">
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold mb-1.5">Package Level</label>
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="All">All Packages</option>
              <option value="Bronze">Bronze</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="Platinum">Platinum</option>
              <option value="Diamond">Diamond</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold mb-1.5">Action Type</label>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="All">All Actions</option>
              <option value="Reactivation">Reactivation</option>
              <option value="Upgrade Reactivation">Upgrade Reactivation</option>
            </select>
          </div>

          {dateRangeType === 'custom' && (
            <>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* RECENT REACTIVATIONS TABLE */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
          <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-extrabold">Recent Reactivations Ledger</h4>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-lg">
            Showing {filteredRecords.length} of {records.length} logs
          </span>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Loading reactivation report indexes...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3 px-6">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-xs text-red-400 max-w-md mx-auto leading-relaxed">{error}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto" />
            <p className="text-xs text-zinc-500 font-medium">No reactivation records match your filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedPackage('All');
                setSelectedActionType('All');
                setDateRangeType('all');
              }}
              className="text-[11px] text-teal-400 font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date Completed</th>
                  <th className="py-3 px-4">Affiliate Details</th>
                  <th className="py-3 px-4">Package Jump</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4 text-right">CC Paid (PHP Equivalent)</th>
                  <th className="py-3 px-4">Sponsor ID</th>
                  <th className="py-3 px-4 text-right">Commissions (CC)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredRecords.map((rec) => (
                  <tr key={rec.reactivationId} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-4 px-4 font-mono text-[11px] text-zinc-400">
                      {rec.createdAt ? new Date(rec.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span className="block font-bold text-white text-[12px]">{rec.memberName || 'N/A'}</span>
                      <span className="block font-mono text-[10px] text-zinc-500 mt-0.5">{rec.memberId || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 line-through text-[11px]">{rec.oldPackage}</span>
                        <span className="text-zinc-400 font-medium text-[10px]">→</span>
                        <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/15 rounded text-[10px] font-bold">
                          {rec.newPackage}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                        rec.actionType === 'Upgrade Reactivation'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {rec.actionType}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="block font-black text-white text-[12px] font-mono">
                        {(rec.packageValueCC || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
                      </span>
                      <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                        (₱{(rec.phpEquivalent || (rec.packageValueCC * cashInRate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-zinc-400 text-[11px]">{rec.sponsorMemberId || 'Direct / None'}</span>
                    </td>
                    <td className="py-4 px-4 text-right space-y-0.5">
                      <div className="flex justify-end gap-1 text-[11px] font-mono">
                        <span className="text-zinc-500">DRB:</span>
                        <span className="text-teal-400 font-bold">{rec.directReferralBonusCC?.toFixed(2)} CC</span>
                      </div>
                      <div className="flex justify-end gap-1 text-[11px] font-mono">
                        <span className="text-zinc-500">Uni:</span>
                        <span className="text-cyan-400 font-bold">{rec.unilevelBonusTotalCC?.toFixed(2)} CC</span>
                      </div>
                      {rec.flushedAmountCC > 0 && (
                        <div className="flex justify-end gap-1 text-[10px] font-mono">
                          <span className="text-amber-500 font-medium">Flushed:</span>
                          <span className="text-amber-500 font-bold">{rec.flushedAmountCC?.toFixed(2)} CC</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-extrabold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-400" /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRILL-DOWN MODAL TO TRACE REACTIVATION AND AUDIT LOG DETAILS */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xs"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">Reactivation Details</h4>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {selectedRecord.reactivationId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Info Block 1: Affiliate & Sponsor info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900/40 p-4 border border-zinc-900 rounded-xl space-y-3">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold border-b border-zinc-900 pb-1.5">Affiliate Passport</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Name:</span>
                        <span className="text-white font-bold block mt-0.5">{selectedRecord.memberName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Member ID:</span>
                        <span className="text-zinc-300 font-mono block mt-0.5">{selectedRecord.memberId}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-zinc-500 block">Old Package:</span>
                        <span className="text-zinc-400 block mt-0.5 font-semibold line-through">{selectedRecord.oldPackage}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-zinc-500 block">New Package:</span>
                        <span className="text-teal-400 block mt-0.5 font-bold">{selectedRecord.newPackage}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/40 p-4 border border-zinc-900 rounded-xl space-y-3">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold border-b border-zinc-900 pb-1.5">Sponsor & Tree Info</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Sponsor ID:</span>
                        <span className="text-white font-mono block mt-0.5">{selectedRecord.sponsorMemberId || 'Direct Registration'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">MSA Resetted:</span>
                        <span className="text-emerald-400 font-bold block mt-0.5">Yes (30-Day Period)</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-zinc-500 block">Previous Cycle ID:</span>
                        <span className="text-zinc-400 font-mono block mt-0.5 break-all text-[11px]">{selectedRecord.previousBusinessCycleId || 'N/A'}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-zinc-500 block">New Cycle ID:</span>
                        <span className="text-cyan-400 font-mono block mt-0.5 break-all text-[11px]">{selectedRecord.newBusinessCycleId}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Block 2: Financial summary */}
                <div className="bg-zinc-900/40 p-4 border border-zinc-900 rounded-xl space-y-4">
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold border-b border-zinc-900 pb-1.5">Financial Reconciliation Ledger</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Total Volume CC:</span>
                      <span className="text-white font-black block mt-0.5 text-sm font-mono">{selectedRecord.packageValueCC?.toFixed(2)} CC</span>
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5">₱{(selectedRecord.phpEquivalent || (selectedRecord.packageValueCC * cashInRate))?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Direct Referral (DRB):</span>
                      <span className="text-teal-400 font-black block mt-0.5 text-sm font-mono">{selectedRecord.directReferralBonusCC?.toFixed(2)} CC</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Unilevel Overrides:</span>
                      <span className="text-cyan-400 font-black block mt-0.5 text-sm font-mono">{selectedRecord.unilevelBonusTotalCC?.toFixed(2)} CC</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Flush-Out to Pool:</span>
                      <span className="text-amber-500 font-black block mt-0.5 text-sm font-mono">{selectedRecord.flushedAmountCC?.toFixed(2)} CC</span>
                    </div>
                  </div>
                </div>

                {/* Audit Trail Timeline */}
                <div className="space-y-4">
                  <h5 className="text-[11px] uppercase tracking-wider text-zinc-400 font-black flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-400" /> Verified Audit Trail Timeline
                  </h5>
                  
                  {loadingModalLogs ? (
                    <div className="py-10 text-center">
                      <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
                      <p className="text-xs text-zinc-500 mt-2">Compiling verified audit logs...</p>
                    </div>
                  ) : modalAuditLogs.length === 0 ? (
                    <div className="py-8 bg-zinc-900/20 border border-dashed border-zinc-900 rounded-xl text-center">
                      <p className="text-xs text-zinc-500">No audit logs found matching reactivationId.</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-zinc-900 ml-3 pl-5 py-2 space-y-5">
                      {modalAuditLogs.map((log) => (
                        <div key={log.id} className="relative">
                          {/* Dot accent */}
                          <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-teal-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-teal-400 uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{log.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-zinc-900 bg-zinc-950 flex justify-end">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold px-5 py-2.5 rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer"
                >
                  Close Passport Check
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

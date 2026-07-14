import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Share2, 
  ShieldAlert, 
  Calendar,
  Layers,
  Filter,
  ArrowRight,
  Eye,
  Info
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile } from '../types';
import ChosenLogo from './ChosenLogo';

interface AdminP2PTransfersPageProps {
  onNavigate: (page: string) => void;
  currentUserProfile: UserProfile | null;
}

export default function AdminP2PTransfersPage({ onNavigate, currentUserProfile }: AdminP2PTransfersPageProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED'>('ALL');
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);

  // Stats aggregations
  const [stats, setStats] = useState({
    totalVolumeCC: 0,
    totalFeesCC: 0,
    successCount: 0,
    averageCC: 0
  });

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'p2p_transfers'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const fetched: any[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTransfers(fetched);

      // Aggregate calculations
      let volume = 0;
      let fees = 0;
      let successes = 0;

      fetched.forEach(tx => {
        if (tx.status === 'COMPLETED') {
          volume += tx.amountCC || 0;
          fees += tx.feeCC || 0;
          successes += 1;
        }
      });

      setStats({
        totalVolumeCC: Number(volume.toFixed(4)),
        totalFeesCC: Number(fees.toFixed(4)),
        successCount: successes,
        averageCC: successes > 0 ? Number((volume / successes).toFixed(2)) : 0
      });

    } catch (err) {
      console.error("Error fetching admin P2P transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleBack = () => {
    if (currentUserProfile?.role === 'Super Admin') {
      onNavigate('super-admin-dashboard');
    } else {
      onNavigate('admin-dashboard');
    }
  };

  // Filter & search logic
  const filteredTransfers = transfers.filter(tx => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      tx.transferId?.toLowerCase().includes(term) ||
      tx.senderMemberId?.toLowerCase().includes(term) ||
      tx.senderName?.toLowerCase().includes(term) ||
      tx.recipientMemberId?.toLowerCase().includes(term) ||
      tx.recipientName?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-black min-h-screen text-white flex flex-col font-sans selection:bg-gold selection:text-black" id="admin-p2p-page">
      {/* Top Header Navigation */}
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all text-xs font-mono tracking-wider uppercase group"
          id="back-to-dashboard-btn"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Panel
        </button>
        <div className="flex items-center gap-2">
          <ChosenLogo size="sm" />
          <div className="text-right">
            <span className="text-[9px] text-zinc-500 font-mono tracking-widest block leading-none">I AM CHOSEN</span>
            <span className="text-[8px] text-gold font-mono tracking-[0.3em] block mt-0.5 uppercase leading-none">P2P AUDITING SYSTEM</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white gold-text flex items-center gap-2">
              <Share2 className="w-6 h-6 text-gold" /> Peer-to-Peer Credits Ledger
            </h1>
            <p className="text-xs text-zinc-400 mt-1 font-light">
              Audit corporate credit transactions, sender-recipient profiles, and accumulated enterprise transaction fees.
            </p>
          </div>
          <button
            onClick={fetchTransfers}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-mono tracking-wider uppercase transition-all cursor-pointer"
          >
            Sync Ledger
          </button>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Volume */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase block">Total P2P Trade Volume</span>
              <span className="text-xl font-bold font-mono text-white block">
                {stats.totalVolumeCC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
              </span>
            </div>
            <div className="p-3 bg-gold/10 border border-gold/20 rounded-xl text-gold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Revenue Fees */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase block">Accumulated Company Income</span>
              <span className="text-xl font-bold font-mono text-emerald-400 block">
                {stats.totalFeesCC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Successful Count */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase block">Successful Transfers</span>
              <span className="text-xl font-bold font-mono text-white block">
                {stats.successCount.toLocaleString()}
              </span>
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Average Size */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase block">Average Transfer CC</span>
              <span className="text-xl font-bold font-mono text-white block">
                {stats.averageCC.toLocaleString()} CC
              </span>
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-2xl">
          <div className="relative flex-1">
            <input 
              type="text"
              placeholder="Search by Transfer ID, Member ID, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 pl-10 text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-gold transition-all"
            />
            <Search className="w-4 h-4 text-zinc-550 absolute left-3.5 top-3" />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Transfers Grid / Table */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 space-y-3">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono uppercase tracking-widest">Querying database ledger...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-1">
              <ShieldAlert className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">No P2P transfers found</p>
              <p className="text-xs">Adjust your search parameters or select a different filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 uppercase font-mono tracking-wider text-[10px]">
                    <th className="py-4 px-4 font-bold">Transfer ID</th>
                    <th className="py-4 px-4 font-bold">Sender Account</th>
                    <th className="py-4 px-4 font-bold"></th>
                    <th className="py-4 px-4 font-bold">Recipient Account</th>
                    <th className="py-4 px-4 text-right font-bold">Amount (CC)</th>
                    <th className="py-4 px-4 text-right font-bold">Fee (CC)</th>
                    <th className="py-4 px-4 text-center font-bold">Status</th>
                    <th className="py-4 px-4 text-right font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-zinc-300">
                  {filteredTransfers.map((tx) => (
                    <tr 
                      key={tx.id}
                      onClick={() => setSelectedTransfer(tx)}
                      className="hover:bg-zinc-900/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-white font-medium text-[11px] max-w-[120px] truncate">
                        {tx.transferId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-white block">{tx.senderName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">IAM-{tx.senderMemberId}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600 text-center">
                        <ArrowRight className="w-4 h-4 mx-auto" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-white block">{tx.recipientName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">IAM-{tx.recipientMemberId}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-gold font-bold">
                        {tx.amountCC.toFixed(2)} CC
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                        {tx.feeCC ? tx.feeCC.toFixed(2) : '1.00'} CC
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 border rounded font-mono font-bold text-[9px] uppercase tracking-wider ${
                          tx.status === 'COMPLETED' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[10px] text-zinc-500 font-mono">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Drill-down Detail Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-950 border border-zinc-900 max-w-md w-full rounded-3xl overflow-hidden relative shadow-2xl">
            <div className="gold-gradient h-1.5 w-full" />
            
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center">
                <Share2 className="w-10 h-10 text-gold mx-auto mb-2" />
                <h3 className="text-lg font-black uppercase text-white tracking-tight">P2P Transfer Summary</h3>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">ID: {selectedTransfer.transferId}</p>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 space-y-3 text-xs font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={selectedTransfer.status === 'COMPLETED' ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {selectedTransfer.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp:</span>
                  <span className="text-white">{new Date(selectedTransfer.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Idempotency Key:</span>
                  <span className="text-white max-w-[180px] truncate text-right">{selectedTransfer.idempotencyKey}</span>
                </div>

                <div className="border-t border-zinc-900 my-2 pt-2.5" />

                <div className="flex justify-between">
                  <span>Sender name:</span>
                  <span className="text-white font-sans">{selectedTransfer.senderName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sender Account:</span>
                  <span className="text-white">IAM-{selectedTransfer.senderMemberId}</span>
                </div>

                <div className="border-t border-zinc-900 my-2 pt-2.5" />

                <div className="flex justify-between">
                  <span>Recipient Name:</span>
                  <span className="text-white font-sans">{selectedTransfer.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recipient Account:</span>
                  <span className="text-white">IAM-{selectedTransfer.recipientMemberId}</span>
                </div>

                <div className="border-t border-zinc-900 my-2 pt-2.5" />

                <div className="flex justify-between text-white font-bold">
                  <span>Amount CC:</span>
                  <span className="gold-text">{selectedTransfer.amountCC.toFixed(2)} CC</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee CC:</span>
                  <span className="text-zinc-550">{selectedTransfer.feeCC ? selectedTransfer.feeCC.toFixed(2) : '1.00'} CC</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Debit CC:</span>
                  <span>{selectedTransfer.totalDebitCC ? selectedTransfer.totalDebitCC.toFixed(2) : (selectedTransfer.amountCC + 1).toFixed(2)} CC</span>
                </div>

                {selectedTransfer.note && (
                  <>
                    <div className="border-t border-zinc-900 my-2 pt-2.5" />
                    <div className="space-y-1">
                      <span className="text-zinc-550 block">Message / Note:</span>
                      <p className="text-white font-sans text-xs bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 leading-relaxed italic">
                        "{selectedTransfer.note}"
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={() => setSelectedTransfer(null)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-mono tracking-widest uppercase text-xs py-3 rounded-xl transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

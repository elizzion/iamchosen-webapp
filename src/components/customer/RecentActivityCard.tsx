import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ArrowUpRight, ChevronRight, ListFilter, ClipboardList, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import EmptyState from './EmptyState';
import { useCCSettings } from '../../context/CCSettingsContext';

interface RecentActivityCardProps {
  cashins: any[];
  orders: any[];
}

export default function RecentActivityCard({ cashins, orders }: RecentActivityCardProps) {
  const { ccSettings } = useCCSettings();
  const [filter, setFilter] = useState<'all' | 'cashins' | 'orders'>('all');
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  // Normalize cashins to a standard timeline schema
  const normalizedCashins = cashins.map((c) => ({
    id: c.requestId || `ci-${c.referenceNumber}`,
    type: 'CASHIN' as const,
    title: `Cash-In Wallet Top Up`,
    subtitle: `Via ${c.paymentMethod || c.paymentChannel || 'GCash'}`,
    referenceNumber: c.referenceNumber || c.requestId,
    status: c.status || 'Pending',
    amountCC: c.amountCC || c.computedCC || 0,
    amountPhp: c.amountPhp || c.amountPHP || 0,
    date: c.requestDate || c.requestedAt || new Date().toISOString(),
    raw: c,
  }));

  // Normalize orders to standard timeline schema
  const normalizedOrders = orders.map((o) => ({
    id: o.id || `ord-${o.productName}`,
    type: 'ORDER' as const,
    title: `Purchased ${o.productName}`,
    subtitle: 'Secured Digital Order',
    referenceNumber: o.id,
    status: o.status || 'Delivered', // Orders deduct CC instantly, marked completed/delivered
    amountCC: o.priceCC || 0,
    amountPhp: (o.priceCC || 0) * ccSettings.cashInRatePHP,
    date: o.createdAt || new Date().toISOString(),
    raw: o,
  }));

  // Combine & Sort chronologically (newest first)
  const combinedActivities = [...normalizedCashins, ...normalizedOrders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter activities
  const filteredActivities = combinedActivities.filter((act) => {
    if (filter === 'cashins') return act.type === 'CASHIN';
    if (filter === 'orders') return act.type === 'ORDER';
    return true;
  });

  return (
    <div className="bg-[#1D1F26] border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5">
      {/* Header and Filter Switches */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
          <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-tight">
            Recent Account Activities
          </h3>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-950 border border-zinc-900 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
              filter === 'all' ? 'bg-cyan-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('cashins')}
            className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
              filter === 'cashins' ? 'bg-cyan-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Cash-Ins
          </button>
          <button
            onClick={() => setFilter('orders')}
            className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
              filter === 'orders' ? 'bg-cyan-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Orders
          </button>
        </div>
      </div>

      {/* Activities Timeline */}
      {filteredActivities.length === 0 ? (
        <EmptyState
          title="No Activities Found"
          description={`There are currently no recorded ${
            filter === 'all' ? '' : filter === 'cashins' ? 'cash-in transfers' : 'purchases'
          } associated with this profile.`}
        />
      ) : (
        <div className="relative border-l border-zinc-800/80 ml-3 pl-5 space-y-5 py-1 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
          {filteredActivities.map((act) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedActivity(act)}
              className="relative group cursor-pointer"
            >
              {/* Timeline dot accent */}
              <div
                className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[#1D1F26] flex items-center justify-center transition-transform group-hover:scale-110 ${
                  act.type === 'CASHIN' ? 'bg-emerald-500' : 'bg-cyan-400'
                }`}
              />

              {/* Row card wrapper */}
              <div className="flex items-center justify-between bg-zinc-950/40 hover:bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 transition-all duration-300">
                <div className="flex items-start gap-3 truncate pr-4">
                  {/* Icon */}
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      act.type === 'CASHIN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
                    }`}
                  >
                    {act.type === 'CASHIN' ? <ArrowUpRight className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                  </div>

                  {/* Descriptions */}
                  <div className="truncate">
                    <h4 className="text-white text-xs font-bold truncate tracking-wide">{act.title}</h4>
                    <span className="block text-[10px] text-zinc-500 font-mono mt-0.5 tracking-wide truncate">
                      {act.subtitle} • Ref: {act.referenceNumber}
                    </span>
                    <span className="block text-[9px] text-zinc-600 font-mono mt-1 font-semibold uppercase">
                      {new Date(act.date).toLocaleDateString()} • {new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Pricing & status indicator */}
                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <div className="text-right">
                    <span className="block text-xs font-black font-mono text-white leading-none">
                      {act.type === 'CASHIN' ? '+' : '-'}{act.amountCC} CC
                    </span>
                    <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                      ₱{act.amountPhp.toLocaleString()}
                    </span>
                  </div>
                  <StatusBadge status={act.status} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Activity Details Modal Overlay */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#1D1F26] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-5 border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">Activity Detail</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mt-0.5">
                    {selectedActivity.type === 'CASHIN' ? 'Wallet Top Up Ledger' : 'E-Commerce Order Ledger'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Data list */}
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Operation:</span>
                  <span className="font-bold text-white">{selectedActivity.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Reference / ID:</span>
                  <span className="font-mono text-zinc-300 font-semibold">{selectedActivity.referenceNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Amount (Credits):</span>
                  <span className="font-mono font-bold text-gold">{selectedActivity.amountCC} CC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Value (PHP):</span>
                  <span className="font-mono font-bold text-zinc-300">₱{selectedActivity.amountPhp.toLocaleString()}.00 PHP</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Date/Time:</span>
                  <span className="font-semibold text-zinc-300">{new Date(selectedActivity.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 items-center">
                  <span className="text-zinc-500">Ledger Status:</span>
                  <StatusBadge status={selectedActivity.status} />
                </div>
              </div>

              {/* Additional comments if cashin */}
              {selectedActivity.type === 'CASHIN' && selectedActivity.raw.notes && (
                <div className="mt-4 bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-[11px] text-zinc-400">
                  <span className="block font-bold text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Sender Note</span>
                  <p className="italic leading-normal">{selectedActivity.raw.notes}</p>
                </div>
              )}

              {selectedActivity.type === 'CASHIN' && selectedActivity.raw.status === 'Declined' && selectedActivity.raw.rejectedReason && (
                <div className="mt-4 bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[11px] text-red-400">
                  <span className="block font-bold uppercase tracking-widest text-[9px] mb-1">Rejection Reason</span>
                  <p className="leading-normal">{selectedActivity.raw.rejectedReason}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedActivity(null)}
                className="w-full mt-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Close Ledger
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

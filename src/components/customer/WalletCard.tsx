import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, RefreshCw, ArrowUpRight, ShoppingBag, Landmark } from 'lucide-react';
import ChosenWalletIllustration from './ChosenWalletIllustration';

interface WalletCardProps {
  balanceCC: number;
  conversionRate: number;
  onRefresh: () => void;
  onCashInClick: () => void;
  onShopClick: () => void;
}

export default function WalletCard({
  balanceCC,
  conversionRate,
  onRefresh,
  onCashInClick,
  onShopClick,
}: WalletCardProps) {
  const [showBalance, setShowBalance] = useState(true);

  const phpBalance = balanceCC * conversionRate;

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E202A] via-[#15161E] to-[#0F1015] border border-cyan-500/15 p-6 shadow-2xl shadow-cyan-500/5 group"
    >
      {/* Decorative vector overlays / glow */}
      <div className="absolute right-0 top-0 z-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[45px] pointer-events-none group-hover:bg-cyan-500/20 transition-colors" />

      {/* Wallet Image */}
      <img
        src="/images/chosen-wallet.svg"
        alt="Chosen Wallet"
        className="absolute right-3 top-8 z-20 w-[125px] sm:w-[150px] md:w-[180px] object-contain pointer-events-none select-none drop-shadow-[0_0_35px_rgba(0,229,210,0.55)]"
      />

      {/* Content wrapper */}
      <div className="relative z-30">
        {/* Top Ledger Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#D4AF37]/10 rounded-lg text-gold">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono font-black">
              CHOSEN SECURED LEDGER
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Action */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onRefresh}
              title="Refresh Wallet Balance"
              className="p-1.5 bg-zinc-900/60 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.button>
            
            {/* Toggle eye balance */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowBalance(!showBalance)}
              title={showBalance ? "Hide balance" : "Show balance"}
              className="p-1.5 bg-zinc-900/60 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Balance & Illustration Section */}
        <div className="mb-6 pr-[140px]">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
            Available Assets
          </p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono leading-none">
              {showBalance ? balanceCC.toFixed(2) : '••••••'}
            </h2>
            <span className="text-sm font-extrabold text-gold tracking-widest font-mono">
              CC
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-2 flex items-center gap-1.5">
            <span className="text-cyan-400 font-bold">≈</span>
            <span>{showBalance ? `₱${phpBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱ ••••'} PHP</span>
            <span className="text-[9px] text-zinc-600 font-normal"> (1 CC = ₱{conversionRate})</span>
          </p>
        </div>

        {/* Main Touch Actions */}
        <div className="grid grid-cols-2 gap-3.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={onCashInClick}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-black text-xs font-black uppercase tracking-wider shadow-[0_4px_15px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer select-none"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5px]" />
            <span>Cash-In</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={onShopClick}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#1D1F26] hover:bg-zinc-800/80 text-white text-xs font-extrabold uppercase tracking-wider border border-zinc-800 transition-all cursor-pointer select-none"
          >
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
            <span>Shop Products</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

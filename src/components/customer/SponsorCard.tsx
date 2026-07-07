import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Copy, Check, Users } from 'lucide-react';
import AnimatedButton from './AnimatedButton';

interface SponsorCardProps {
  sponsor: any | null;
  loading: boolean;
}

export default function SponsorCard({ sponsor, loading }: SponsorCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopy = (text: string, type: 'code' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="bg-[#1D1F26] border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-gold/5 rounded-full blur-[25px]" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4.5 h-4.5 text-gold shrink-0" />
        <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-tight">
          Referral Sponsor Information
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3.5 py-2">
          <div className="h-4 bg-zinc-900 animate-pulse rounded-md w-3/4" />
          <div className="h-4 bg-zinc-900 animate-pulse rounded-md w-1/2" />
        </div>
      ) : sponsor ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Sponsor card details */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4.5 space-y-3 text-xs">
            {/* Name */}
            <div className="flex justify-between items-center py-0.5 border-b border-zinc-900/60 pb-2">
              <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Sponsor Name</span>
              <span className="font-extrabold text-white">{sponsor.fullName}</span>
            </div>

            {/* Member ID */}
            <div className="flex justify-between items-center py-0.5 border-b border-zinc-900/60 pb-2">
              <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Member ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-zinc-300 font-bold">{sponsor.memberId}</span>
                <button
                  onClick={() => handleCopy(sponsor.memberId, 'id')}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-md transition-all cursor-pointer"
                  title="Copy ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Sponsor Code */}
            <div className="flex justify-between items-center py-0.5">
              <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Sponsor Code</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-gold font-bold uppercase">{sponsor.sponsorCode}</span>
                <button
                  onClick={() => handleCopy(sponsor.sponsorCode, 'code')}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-md transition-all cursor-pointer"
                  title="Copy Sponsor Code"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic View Sponsor detail modal/trigger */}
          <AnimatedButton
            variant="outline"
            fullWidth
            onClick={() => {
              alert(`Sponsor Contact Profile:\n\nName: ${sponsor.fullName}\nEmail: ${sponsor.email || 'N/A'}\nMobile: ${sponsor.mobileNumber || 'N/A'}`);
            }}
            className="py-2.5 text-[10px]"
          >
            <User className="w-3.5 h-3.5" />
            <span>View Sponsor Details</span>
          </AnimatedButton>
        </motion.div>
      ) : (
        <div className="text-center py-6 text-zinc-500 text-xs font-light leading-relaxed">
          No sponsor assigned.
        </div>
      )}
    </div>
  );
}

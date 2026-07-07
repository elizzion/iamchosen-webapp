import React from 'react';
import { motion } from 'motion/react';

export type BadgeStatusType = 
  | 'Pending' 
  | 'Approved' 
  | 'Rejected' 
  | 'Declined' 
  | 'Delivered' 
  | 'Verified' 
  | 'Unverified' 
  | 'KYC Pending' 
  | 'Incomplete Profile'
  | 'Active'
  | 'Inactive'
  | 'Completed';

interface StatusBadgeProps {
  status: BadgeStatusType | string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalizedStatus = status.trim();

  let colorClasses = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  switch (normalizedStatus) {
    case 'Approved':
    case 'Verified':
    case 'Completed':
    case 'Active':
      colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      break;
    case 'Pending':
    case 'KYC Pending':
      colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';
      break;
    case 'Rejected':
    case 'Declined':
    case 'Inactive':
      colorClasses = 'bg-red-500/10 text-red-400 border-red-500/20';
      break;
    case 'Delivered':
      colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      break;
    case 'Unverified':
    case 'Incomplete Profile':
      colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      break;
  }

  return (
    <motion.span
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider select-none ${colorClasses} ${className}`}
    >
      {normalizedStatus}
    </motion.span>
  );
}

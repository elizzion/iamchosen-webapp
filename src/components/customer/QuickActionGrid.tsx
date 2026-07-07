import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Clipboard, ArrowUpRight, User, Headphones } from 'lucide-react';

interface QuickActionGridProps {
  onActionClick: (actionId: 'shop' | 'orders' | 'cashin' | 'profile' | 'support') => void;
}

export default function QuickActionGrid({ onActionClick }: QuickActionGridProps) {
  const actions = [
    {
      id: 'shop' as const,
      title: 'Shop Products',
      subtitle: 'Premium catalog',
      icon: ShoppingBag,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'hover:border-cyan-500/30',
    },
    {
      id: 'orders' as const,
      title: 'My Orders',
      subtitle: 'Purchase tracking',
      icon: Clipboard,
      color: 'text-gold',
      bgColor: 'bg-[#D4AF37]/10',
      borderColor: 'hover:border-gold/30',
    },
    {
      id: 'cashin' as const,
      title: 'Cash-In History',
      subtitle: 'Credit receipts',
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'hover:border-emerald-500/30',
    },
    {
      id: 'profile' as const,
      title: 'My Profile',
      subtitle: 'Security parameters',
      icon: User,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'hover:border-purple-500/30',
    },
    {
      id: 'support' as const,
      title: 'Support',
      subtitle: 'Direct assistance',
      icon: Headphones,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'hover:border-rose-500/30',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3.5">
      {actions.map((act) => {
        const IconComponent = act.icon;
        return (
          <motion.button
            key={act.id}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -3 }}
            onClick={() => onActionClick(act.id)}
            className={`flex flex-col items-center justify-center p-2 sm:p-4 bg-[#1D1F26] rounded-xl sm:rounded-2xl border border-zinc-800/80 transition-all text-center group cursor-pointer ${act.borderColor}`}
          >
            {/* Round Icon */}
            <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${act.bgColor} ${act.color} mb-1.5 sm:mb-3 group-hover:scale-105 transition-transform`}>
              <IconComponent className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
            </div>

            {/* Labels */}
            <h4 className="text-white font-bold text-[9px] sm:text-xs leading-tight sm:leading-snug break-words w-full">
              {act.title}
            </h4>
          </motion.button>
        );
      })}
    </div>
  );
}

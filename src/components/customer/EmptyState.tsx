import React from 'react';
import { motion } from 'motion/react';
import { HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center p-8 bg-[#1D1F26]/30 border border-zinc-800/50 rounded-3xl"
    >
      <div className="p-3 bg-zinc-900/80 rounded-2xl text-zinc-500 mb-3 border border-zinc-800/80">
        {icon || <HelpCircle className="w-6 h-6" />}
      </div>
      <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-zinc-500 text-[11px] font-light max-w-xs leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

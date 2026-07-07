import React from 'react';
import { motion } from 'motion/react';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'gold' | 'cyan' | 'dark' | 'outline' | 'red';
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export default function AnimatedButton({
  children,
  onClick,
  type = 'button',
  variant = 'dark',
  disabled = false,
  className = '',
  fullWidth = false,
}: AnimatedButtonProps) {
  let styleClasses = '';

  switch (variant) {
    case 'gold':
      styleClasses = 'bg-gradient-to-tr from-[#D4AF37] via-[#F9E59E] to-[#B48C2E] text-black font-extrabold shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]';
      break;
    case 'cyan':
      styleClasses = 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-black font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]';
      break;
    case 'red':
      styleClasses = 'bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.2)]';
      break;
    case 'outline':
      styleClasses = 'bg-transparent border border-zinc-800 text-zinc-300 hover:border-cyan-500/30 hover:text-white';
      break;
    case 'dark':
    default:
      styleClasses = 'bg-[#1D1F26] border border-zinc-800/80 text-white hover:border-cyan-500/20';
      break;
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={`relative inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 select-none cursor-pointer ${
        fullWidth ? 'w-full' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${styleClasses} ${className}`}
    >
      {children}
    </motion.button>
  );
}

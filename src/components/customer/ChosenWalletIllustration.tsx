import React from 'react';
import { motion } from 'motion/react';

interface ChosenWalletIllustrationProps {
  className?: string;
}

export default function ChosenWalletIllustration({ className = '' }: ChosenWalletIllustrationProps) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{
        duration: 4.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
    >
      <img
        src="/images/iamchosenwallet.png"
        alt="Chosen Wallet"
        className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-[0_0_30px_rgba(0,229,210,0.45)]"
        referrerPolicy="no-referrer"
      />
    </motion.div>
  );
}


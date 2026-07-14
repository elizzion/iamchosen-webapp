import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import AnimatedButton from './AnimatedButton';

export interface ProductType {
  id: string;
  name: string;
  category: string;
  price: number;
  php: string;
  emoji: string;
  description: string;
}

interface ProductCardProps {
  product: ProductType;
  onPurchase: (product: ProductType) => void;
  disabled?: boolean;
  key?: string | number;
}

export default function ProductCard({ product, onPurchase, disabled = false }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-[#1D1F26] border border-zinc-800 hover:border-cyan-500/15 rounded-3xl p-5 flex flex-col justify-between hover:shadow-[0_4px_25px_rgba(6,182,212,0.03)] transition-all duration-300 group"
    >
      <div>
        {/* Top visual panel */}
        <div className="flex justify-between items-start gap-2 mb-4">
          {/* Emoji Container */}
          <div className="text-3xl p-3 bg-zinc-950/80 rounded-2xl group-hover:scale-105 transition-transform duration-300 border border-zinc-900/60 flex items-center justify-center w-14 h-14 select-none">
            {product.emoji}
          </div>

          {/* Pricing Chips */}
          <div className="flex flex-col items-end space-y-1">
            <span className="text-[11px] font-black text-gold bg-[#D4AF37]/10 px-2.5 py-1 rounded-xl border border-[#D4AF37]/20 uppercase tracking-widest font-mono">
              {product.price} CC
            </span>
            <span className="text-[9px] font-semibold text-zinc-500 font-mono tracking-wider">
              {product.php}
            </span>
          </div>
        </div>

        {/* Info Area */}
        <div className="space-y-1 mb-4">
          <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block">
            {product.category}
          </span>
          <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-tight group-hover:text-gold transition-colors">
            {product.name}
          </h4>
          <p className="text-zinc-400 text-xs font-light leading-relaxed pt-1">
            {product.description}
          </p>
        </div>
      </div>

      {/* Buy Trigger */}
      <AnimatedButton
        variant="outline"
        disabled={disabled}
        onClick={() => onPurchase(product)}
        fullWidth
        className="mt-2 py-2.5 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 font-bold"
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        <span>Purchase Now</span>
      </AnimatedButton>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';

interface PromoBannerProps {
  onCtaClick: () => void;
}

export default function PromoBanner({ onCtaClick }: PromoBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Chosen 15-in-1 Premium Latte",
      subtitle: "FEATURED HIGHLIGHT",
      description: "Infused with standard-setting antioxidants and organic adaptogens for clean, sustained morning focus.",
      badge: "Best-Seller",
      gradient: "from-[#111827] via-[#1F1C38] to-[#1E1B4B]",
      accentColor: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
      tag: "Organic extracts",
    },
    {
      title: "Salted Caramel Cold Sensation",
      subtitle: "NEW ARRIVAL",
      description: "A refreshing, ready-to-mix iced coffee blend that blends supreme gourmet flavor with natural vigor.",
      badge: "Trending",
      gradient: "from-[#111827] via-[#2A1D1A] to-[#451A03]",
      accentColor: "text-amber-400",
      accentBg: "bg-amber-500/10",
      tag: "Gourmet mix",
    },
    {
      title: "Pure Barley Cellular Shield",
      subtitle: "HEALTH CAMPAIGN",
      description: "Replenish essential micronutrients and cleanse digestive pathways with certified raw barley shoots.",
      badge: "Pure Immunity",
      gradient: "from-[#111827] via-[#142D1B] to-[#064E3B]",
      accentColor: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
      tag: "Rich chlorophyll",
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 h-[210px] sm:h-[190px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={`absolute inset-0 bg-gradient-to-r ${slides[currentSlide].gradient} p-6 flex flex-col justify-between`}
        >
          {/* Top Row: Tag & Badge */}
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase tracking-widest font-mono font-bold text-zinc-400">
              {slides[currentSlide].subtitle}
            </span>
            <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border border-white/5 bg-white/5 text-white`}>
              {slides[currentSlide].badge}
            </span>
          </div>

          {/* Middle Row: Product Name & description */}
          <div className="my-1.5 space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-1.5">
              {slides[currentSlide].title}
              <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
            </h3>
            <p className="text-zinc-400 text-[11px] font-light leading-relaxed max-w-lg line-clamp-2">
              {slides[currentSlide].description}
            </p>
          </div>

          {/* Bottom Row: CTA Button & Slide dots */}
          <div className="flex justify-between items-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onCtaClick}
              className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-gold hover:text-white transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shop Now</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </motion.button>

            {/* Pagination Indicator Dots */}
            <div className="flex gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentSlide ? 'bg-cyan-400 w-3' : 'bg-zinc-700 hover:bg-zinc-500'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

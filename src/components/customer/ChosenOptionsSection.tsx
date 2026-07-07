import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Crown, ArrowRight, Check } from 'lucide-react';

interface ChosenOptionsSectionProps {
  onNavigate: (page: string) => void;
  role: string;
}

export default function ChosenOptionsSection({ onNavigate, role }: ChosenOptionsSectionProps) {
  // Only display for role === 'Customer'
  if (role !== 'Customer') return null;

  const handleSelectPath = (path: 'smart-customer' | 'affiliate-business') => {
    // Store selected option in local/session storage
    sessionStorage.setItem('selectedPath', path);
    
    // Update URL query parameters for compliance and detection logic
    const newUrl = `${window.location.origin}/package-selection?type=${path}`;
    window.history.pushState({ path }, '', newUrl);

    // Navigate to Package Selection page
    onNavigate('package-selection');
  };

  return (
    <div className="space-y-5 pt-4">
      {/* SECTION HEADER */}
      <div className="space-y-1 text-center md:text-left">
        <h2 className="text-xl font-black tracking-wider text-white uppercase gold-text">
          YOUR CHOSEN OPTIONS
        </h2>
        <p className="text-xs text-zinc-400 font-semibold">Choose the path that fits your goals.</p>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* OPTION 1: SMART CUSTOMER */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-[24px] border border-emerald-500/15 bg-[#0B0D12]/90 backdrop-blur-xl p-6 shadow-[0_0_25px_rgba(16,185,129,0.04)] hover:shadow-[0_0_35px_rgba(16,185,129,0.18)] hover:border-emerald-500/35 transition-all duration-200 group flex flex-col justify-between"
        >
          {/* Green Ambient Glow */}
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
                <ShoppingBag className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-[0.25em] text-emerald-400 font-mono">
                  Option 01
                </span>
                <h3 className="text-lg font-black text-white tracking-tight uppercase">
                  SMART CUSTOMER
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-emerald-400 leading-snug">
                Save more while enjoying premium wellness products.
              </h4>
              <p className="text-zinc-300 text-xs leading-relaxed font-medium">
                Love premium products? Become a Preferred Customer and enjoy exclusive member pricing, promotions, seasonal offers, and wellness rewards.
              </p>

              {/* Benefits Checklist */}
              <div className="space-y-2.5 pt-2">
                {[
                  'Exclusive Discounts and Rebates',
                  'Enjoy Premium Wellness Products',
                  'Exclusive Member Benefits',
                  'Special Perks and Rewards',
                  'Fast Ordering',
                  'Community Access'
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="pt-8">
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectPath('smart-customer')}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(16,185,129,0.2)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer border border-emerald-400/20"
            >
              <span>Choose Smart Customer</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5px]" />
            </motion.button>
          </div>
        </motion.div>

        {/* OPTION 2: AFFILIATE BUSINESS */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-[24px] border border-[#D4AF37]/15 bg-[#0B0D12]/90 backdrop-blur-xl p-6 shadow-[0_0_25px_rgba(212,175,55,0.04)] hover:shadow-[0_0_35px_rgba(212,175,55,0.18)] hover:border-[#D4AF37]/35 transition-all duration-200 group flex flex-col justify-between"
        >
          {/* Gold Ambient Glow */}
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#D4AF37]/5 blur-3xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform duration-200">
                <Crown className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-[0.25em] text-[#D4AF37] font-mono">
                  Option 02
                </span>
                <h3 className="text-lg font-black text-white tracking-tight uppercase">
                  AFFILIATE BUSINESS
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[#D4AF37] leading-snug">
                Turn wellness into a business opportunity.
              </h4>
              <p className="text-zinc-300 text-xs leading-relaxed font-medium">
                Turn your everyday purchases into a business opportunity. Start earning retail profits, commissions, leadership rewards, and grow your own organization with IAM CHOSEN.
              </p>

              {/* Benefits Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-2">
                {[
                  'Exclusive Premium Product',
                  'Retail Profit',
                  'Commission Income',
                  'Leadership Rewards',
                  'Ecommerce Platform',
                  'Complete Business System & Tools',
                  'AI Business Coach',
                  'Business Analytics',
                  'Marketing Support Allocation',
                  'Business Growth Opportunities',
                  'Supportive Community'
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                    <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span className="leading-tight">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="pt-8">
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectPath('affiliate-business')}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B89018] hover:from-[#E6C24A] hover:to-[#C9A325] text-black font-extrabold text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(212,175,55,0.25)] hover:shadow-[0_6px_25px_rgba(212,175,55,0.45)] transition-all cursor-pointer border border-[#D4AF37]/30"
            >
              <span>Choose Affiliate Business</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5px]" />
            </motion.button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

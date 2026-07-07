import React from 'react';
import { ArrowLeft, Sparkles, Award, Shield, DollarSign, Users, Briefcase, PhoneCall } from 'lucide-react';
import ChosenLogo from './ChosenLogo';

interface BusinessOpportunityPageProps {
  onNavigate: (page: string) => void;
}

export default function BusinessOpportunityPage({ onNavigate }: BusinessOpportunityPageProps) {
  const packages = [
    { level: 'Bronze', cc: 50, php: 3500, cap: 125, description: 'Starter package for personal wellness advocates.' },
    { level: 'Silver', cc: 350, php: 24500, cap: 875, description: 'Business starter tier with retail discount capabilities.' },
    { level: 'Gold', cc: 1500, php: 105000, cap: 3750, description: 'Standard professional package with high volume bonuses.' },
    { level: 'Platinum', cc: 3000, php: 210000, cap: 7500, description: 'Executive level with expanded leadership pools.' },
    { level: 'Diamond', cc: 5000, php: 350000, cap: 12500, description: 'Ultimate founder tier with maximum ecosystem privileges.' },
  ];

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
      {/* Top navigation option */}
      <div className="p-6 max-w-7xl mx-auto w-full">
        <button
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to home
        </button>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header and Branding */}
        <div className="text-center mb-16 flex flex-col items-center">
          <ChosenLogo size="md" className="mb-4" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-gold/10 text-gold border border-gold/20 mb-4 uppercase tracking-widest font-mono">
            <Sparkles className="w-3 h-3" /> Business Program
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
            Join Our <span className="gold-text">Business</span> Ecosystem
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base mt-4 max-w-2xl font-light leading-relaxed">
            I AM CHOSEN International offers an extraordinary combination of premium healthcare formulations and a state-of-the-art global affiliate tracking platform. Read our official plan overview below.
          </p>
        </div>

        {/* Section 1: Opportunity & Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-gold/10 border border-gold/25 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-xl font-extrabold text-white uppercase tracking-tight mb-3">
                The Business Opportunity
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Become a licensed global distributor. Our model is built for longevity, sustainability, and authentic wellness distribution. By sharing our premium concentrates, blends, and barley beverages, you unlock high-margin retail profits and continuous digital rewards.
              </p>
            </div>
            <div className="border-t border-zinc-900 pt-5 mt-6 text-xs text-zinc-500 font-mono">
              OFFICIAL ONBOARDING INVITE REQUIRED
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-gold/10 border border-gold/25 rounded-xl flex items-center justify-center mb-6">
                <DollarSign className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-xl font-extrabold text-white uppercase tracking-tight mb-3">
                Compensation Structure
              </h3>
              <p className="text-zinc-450 text-sm leading-relaxed font-light">
                We reward leadership and retail activity seamlessly:
              </p>
              <ul className="text-zinc-400 text-xs space-y-2 mt-3 list-disc list-inside">
                <li><strong className="text-white">Direct Referral Commission:</strong> Earn an immediate <span className="text-gold font-bold">4% bonus</span> on all direct downline package activations.</li>
                <li><strong className="text-white">Retail Margins:</strong> High profits on subsequent inventory purchases.</li>
                <li><strong className="text-white">2.5x Earnings Cap:</strong> Every package features a safety cap of 2.5x purchase value, protecting the integrity of the unilevel network cycle.</li>
              </ul>
            </div>
            <div className="border-t border-zinc-900 pt-5 mt-6 text-xs text-zinc-500 font-mono">
              SYSTEM REWARDS TRANSACT IN CHOSEN CREDITS (CC)
            </div>
          </div>
        </div>

        {/* Section 2: Business Packages */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-extrabold text-white uppercase tracking-tight mb-2">
              Corporate Onboarding Packages
            </h3>
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-mono">
              Select a tier to begin your affiliate lifecycle
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.level} className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-gold/40 transition-colors flex flex-col justify-between text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-zinc-800" />
                <div>
                  <span className="block text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 font-mono">Tier</span>
                  <h4 className="text-lg font-black text-white uppercase mb-2">{pkg.level}</h4>
                  <div className="bg-zinc-900/60 py-2.5 rounded-lg border border-zinc-850 my-3">
                    <span className="block text-xs text-gold font-bold">{pkg.cc} CC</span>
                    <span className="block text-[10px] text-zinc-400 font-mono">₱{pkg.php.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-light mb-4">{pkg.description}</p>
                </div>
                <div className="border-t border-zinc-900/80 pt-3 text-[10px] text-zinc-500">
                  <span className="block uppercase font-mono">Earnings Cap</span>
                  <span className="font-semibold text-gold/80">{pkg.cap} CC</span>
                </div>
              </div>
            ))}
          </div>

          {/* Distributor note */}
          <div className="mt-6 bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-400">
              <strong className="text-white">Note:</strong> We also support specialized <span className="text-gold font-semibold">City Distributor</span> and <span className="text-gold font-semibold">Regional Distributor</span> licenses. Contact corporate support or your Sponsor to discuss these regional positions.
            </p>
          </div>
        </div>

        {/* Section 3: Value Benefits & Call to Action */}
        <div className="bg-gradient-to-b from-zinc-950 to-black border border-zinc-850 rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden mb-12">
          {/* Subtle golden top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-10 bg-gold/10 rounded-full blur-md" />

          <div className="max-w-2xl mx-auto">
            <div className="w-12 h-12 bg-gold/10 border border-gold/25 rounded-full flex items-center justify-center mb-6 mx-auto">
              <PhoneCall className="w-5 h-5 text-gold" />
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white uppercase tracking-tight mb-4">
              How do I activate an Affiliate Account?
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8 font-light">
              Under our <strong className="text-white">v1.2.0 Business Policy</strong>, Affiliate registrations are no longer public. To preserve the structure of our Unilevel network, you must be onboarded directly:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-8">
              <div className="bg-zinc-900/50 border border-zinc-850 p-5 rounded-xl">
                <span className="text-gold font-bold text-xs uppercase tracking-wider block mb-1">Option 1: Member Registration</span>
                <p className="text-zinc-400 text-xs font-light leading-relaxed">
                  Your registered sponsor can create your downline position directly from their member dashboard using their Chosen Credits (CC).
                </p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-850 p-5 rounded-xl">
                <span className="text-gold font-bold text-xs uppercase tracking-wider block mb-1">Option 2: Corporate Request</span>
                <p className="text-zinc-400 text-xs font-light leading-relaxed">
                  Contact corporate support directly. The administrator can create your registration and activate your license upon verifying your package payment.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <button
                onClick={() => onNavigate('login')}
                className="w-full sm:w-auto gold-gradient text-black px-6 py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md shadow-gold/15 cursor-pointer"
              >
                Go to Sign In Page
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version v1.3.3 • Build 000007
        </span>
      </footer>
    </div>
  );
}

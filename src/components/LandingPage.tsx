import React from 'react';
import { Shield, Sparkles, TrendingUp, Award, ShoppingBag, ArrowRight } from 'lucide-react';
import ChosenLogo from './ChosenLogo';
import { useCCSettings } from '../context/CCSettingsContext';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { ccSettings } = useCCSettings();
  const products = [
    {
      name: 'Chosen Herbal Blend',
      category: 'Herbal Wellness Beverage',
      price: '8 CC',
      php: '₱560',
      description: 'A concentrated herbal beverage formulated to support daily wellness and healthy living.',
      emoji: '🌿'
    },
    {
      name: 'Chosen 15-in-1 Latte Coffee',
      category: 'Functional Coffee Beverage',
      price: '15 CC',
      php: '₱1,050',
      description: 'A premium coffee blend combining rich flavor with carefully selected herbal extracts.',
      emoji: '☕'
    },
    {
      name: 'Chosen Pure Barley',
      category: 'Barley Grass Beverage',
      price: '16 CC',
      php: '₱1,120',
      description: 'A barley grass beverage designed to complement a balanced diet and active lifestyle.',
      emoji: '🌾'
    },
    {
      name: 'Chosen Salted Caramel Iced Coffee',
      category: 'Ready-to-Mix Coffee Beverage',
      price: '16 CC',
      php: '₱1,120',
      description: 'A refreshing iced coffee blend with a smooth, premium salted caramel flavor.',
      emoji: '🧊'
    },
    {
      name: 'Chosen Choco Barley',
      category: 'Chocolate Wellness Beverage',
      price: '16 CC',
      php: '₱1,120',
      description: 'A chocolate-flavored barley beverage that combines great taste and powerful nutrients.',
      emoji: '🍫'
    }
  ];

  return (
    <div className="bg-black text-white min-h-screen selection:bg-amber-500 selection:text-black">
      {/* Premium Top Navigation Bar */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <ChosenLogo size="sm" className="w-11 h-11" />
            <div>
              <span className="font-extrabold text-xl tracking-wider uppercase gold-text leading-none block">
                I AM CHOSEN
              </span>
              <span className="block text-[8px] tracking-[0.3em] text-zinc-400 font-bold uppercase mt-1">
                INTERNATIONAL
              </span>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8 text-sm font-medium text-zinc-300">
            <a href="#about" className="hover:text-gold transition-colors">Learn More</a>
            <a href="#products" className="hover:text-gold transition-colors">Products</a>
            <button onClick={() => onNavigate('business-opportunity')} className="hover:text-gold transition-colors cursor-pointer bg-transparent border-none">Business Opportunity</button>
            <a href="#about" className="hover:text-gold transition-colors">Contact Us</a>
          </nav>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onNavigate('login')}
              className="gold-gradient text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 shadow-lg shadow-gold/20 active:scale-95 transition-all cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Abstract luxury background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gold/10 text-gold border border-gold/20 mb-6 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Launching Module 1 Active
            </span>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 uppercase">
              Building Health. <br />
              <span className="gold-text">
                Building Wealth.
              </span>{' '}
              <br />
              Building Legacy.
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl mb-10 leading-relaxed font-light">
              Welcome to <span className="font-semibold text-white">I AM CHOSEN INTERNATIONAL</span>. We blend premium, concentrated herbal health formulations with a world-class, tech-forward affiliate ecosystem to help you prosper physically and financially.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <button
                onClick={() => onNavigate('business-opportunity')}
                className="w-full sm:w-auto gold-gradient text-black px-8 py-4 rounded-xl font-extrabold text-base hover:shadow-xl hover:shadow-gold/10 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Join Our Business <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#products"
                className="w-full sm:w-auto border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 py-4 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 bg-zinc-950/40"
              >
                Explore Products
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Stats Section */}
      <section id="about" className="py-20 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-2xl">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-xl flex items-center justify-center mb-6 border border-gold/20">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 uppercase">Better Health</h3>
              <p className="text-zinc-400 font-light leading-relaxed">
                Premium raw components designed carefully with health benefits in mind. Formulated for high bioavailability and daily routines.
              </p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-2xl">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-xl flex items-center justify-center mb-6 border border-gold/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 uppercase">Better Business</h3>
              <p className="text-zinc-400 font-light leading-relaxed">
                A compensation structure featuring up to 50% to 70% retail profit margin, direct referrals, and automatic daily commission tracking.
              </p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-2xl">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-xl flex items-center justify-center mb-6 border border-gold/20">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 uppercase">Better Future</h3>
              <p className="text-zinc-400 font-light leading-relaxed">
                A sustainable, 2.5x business cycle cap protects the ecosystem, encouraging perpetual support, upgrades, and genuine retail continuity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products Catalog Grid */}
      <section id="products" className="py-24 border-t border-zinc-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 uppercase">
              Our Premium Catalog
            </h2>
            <p className="text-zinc-400 font-light">
              Sourced, blended, and packaged to meet strict regulatory and premium dietary standards. Prices calculated transparently using Chosen Credits (CC).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div
                key={product.name}
                className="group relative bg-zinc-950 border border-zinc-800 hover:border-gold/35 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
              >
                <div className="p-8">
                  <div className="text-5xl mb-6">{product.emoji}</div>
                  <span className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                    {product.category}
                  </span>
                  <h3 className="text-xl font-extrabold text-white mb-3 tracking-tight group-hover:text-gold transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-zinc-400 text-sm mb-6 font-light leading-relaxed">
                    {product.description}
                  </p>
                  <div className="flex items-end justify-between border-t border-zinc-900 pt-5 mt-auto">
                    <div>
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Retail Cost</span>
                      <span className="text-2xl font-black text-white tracking-tight">{product.price}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">PHP Equivalent</span>
                      <span className="text-lg font-bold text-gold">{product.php}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center text-xs text-zinc-500">
            * 1 Chosen Credit (CC) = ₱{ccSettings.cashInRatePHP.toFixed(2)} (Purchase Reference) | 1 Chosen Credit (CC) = ₱{ccSettings.cashOutRatePHP.toFixed(2)} (Cash-Out Reference)
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <ChosenLogo size="sm" className="w-8 h-8" />
            <div>
              <span className="font-bold text-sm text-zinc-300">I AM CHOSEN INTERNATIONAL</span>
              <span className="block text-[9px] text-zinc-500 tracking-wider">© 2026. All rights reserved.</span>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            I AM CHOSEN • Version 1.3.3 • Build 000007
          </div>
        </div>
      </footer>
    </div>
  );
}

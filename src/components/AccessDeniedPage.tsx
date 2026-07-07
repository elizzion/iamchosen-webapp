import React from 'react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

interface AccessDeniedPageProps {
  onNavigate: (page: string) => void;
}

export default function AccessDeniedPage({ onNavigate }: AccessDeniedPageProps) {
  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" />

          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-6 border border-red-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tight mb-2 text-red-500">Access Denied</h2>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-4">Security Exception</p>
          
          <p className="text-zinc-400 font-light text-sm leading-relaxed mb-8">
            You do not possess the authorization privileges required to view this administrative resource. Contact a Super Admin if you believe this is in error.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex-1 gold-gradient text-black py-2.5 rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" /> Go to Dashboard
            </button>
            <button
              onClick={() => onNavigate('landing')}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer"
            >
              Go to Landing
            </button>
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.0.0 • Build 000001
        </span>
      </footer>
    </div>
  );
}

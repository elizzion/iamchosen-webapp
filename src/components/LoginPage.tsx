import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, ensureUserProfile } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChosenLogo from './ChosenLogo';

interface LoginPageProps {
  onNavigate: (page: string) => void;
  onLoginSuccess: (user: any, userProfile: any) => void;
}

export default function LoginPage({ onNavigate, onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      window.showError?.(error, "Sign In Error");
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Fetch User Profile Document from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let profile;
      if (userDocSnap.exists()) {
        profile = userDocSnap.data();
        if (profile && !profile.uid) {
          profile.uid = user.uid;
        }
      } else {
        console.warn("User profile not found during login, auto-repairing...");
        profile = await ensureUserProfile(user);
      }
      onLoginSuccess(user, profile);
    } catch (err: any) {
      console.error(err);
      const code = (err?.code || '').toLowerCase();
      const msg = (err?.message || '').toLowerCase();
      const errStr = String(err).toLowerCase();
      
      if (
        code.includes('operation-not-allowed') ||
        msg.includes('operation-not-allowed') ||
        errStr.includes('operation-not-allowed')
      ) {
        setError("Email/Password Authentication is not enabled. Please go to your Firebase Console -> Authentication -> Sign-in method, and enable 'Email/Password'.");
      } else if (
        code.includes('invalid-credential') ||
        code.includes('invalid-login-credentials') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found') ||
        msg.includes('invalid-credential') ||
        msg.includes('invalid-login-credentials') ||
        msg.includes('wrong-password') ||
        msg.includes('user-not-found') ||
        errStr.includes('invalid-credential') ||
        errStr.includes('invalid-login-credentials') ||
        errStr.includes('wrong-password') ||
        errStr.includes('user-not-found')
      ) {
        setError("Invalid email or password. Please try again. (Note: If this is a new setup, ensure the 'Email/Password' provider is enabled in your Firebase Console -> Authentication -> Sign-in method)");
      } else if (
        code.includes('invalid-email') || 
        msg.includes('invalid-email') ||
        errStr.includes('invalid-email')
      ) {
        setError("Please enter a valid email address.");
      } else {
        setError(err?.message || "Authentication failed. Please check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">


      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative">
          {/* Top aesthetic golden line */}
          <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />

          <div className="text-center mb-8 flex flex-col items-center">
            <ChosenLogo size="md" className="mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight gold-text">
              Sign In
            </h2>
            <p className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-medium">
              I AM CHOSEN INTERNATIONAL ECOSYSTEM
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start gap-2.5 text-sm mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-xs text-gold hover:text-gold-bright transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-11 py-3 text-sm focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gold-gradient hover:brightness-110 text-black py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-gold/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-zinc-400 space-y-4">
            <div>
              Don't have an account?{' '}
              <button
                onClick={() => onNavigate('register')}
                className="text-gold font-bold hover:text-gold-bright transition-colors cursor-pointer"
              >
                Register here
              </button>
            </div>
            <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-900/60 leading-relaxed">
              <span className="text-zinc-400 font-semibold block mb-0.5">Interested in becoming an Affiliate?</span>
              Contact your Sponsor or the Company for activation.
            </div>
          </div>
        </div>
      </div>

      {/* Footer version indicator */}
      <footer className="py-6 border-t border-zinc-950 bg-zinc-950 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">
          I AM CHOSEN • Version 1.2.0 • Build 000003
        </span>
      </footer>
    </div>
  );
}

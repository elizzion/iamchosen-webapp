import React, { useState, useEffect } from 'react';
import { Mail, Key, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, createAuditLog } from '../firebase';
import ChosenLogo from './ChosenLogo';

interface ForgotPasswordPageProps {
  onNavigate: (page: string) => void;
}

export default function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      window.showError?.(error, "Reset Error");
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      window.showSuccess?.(success, "Success");
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess("Password reset instructions have been sent to your email address!");
      
      // Log audit
      await createAuditLog('SYSTEM', email.trim(), 'PASSWORD_RESET_REQUESTED', `User requested password reset link for email ${email}`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid email format.");
      } else {
        setError(err.message || "Failed to send reset link. Try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-between selection:bg-gold selection:text-black">
      {/* Top navigation option */}
      <div className="p-6 max-w-7xl mx-auto w-full">
        <button
          onClick={() => onNavigate('login')}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to login
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative">
          <div className="absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl" />

          <div className="text-center mb-8 flex flex-col items-center">
            <ChosenLogo size="md" className="mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight gold-text">
              Reset Password
            </h2>
            <p className="text-xs text-zinc-500 mt-2 uppercase tracking-widest font-medium">
              We'll send you a secure link to recover your account
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-start gap-2.5 text-sm mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-start gap-2.5 text-sm mb-6">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gold-gradient hover:brightness-110 text-black py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-gold/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-5 h-5" /> Send Reset Link
                </>
              )}
            </button>
          </form>
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

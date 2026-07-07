import React, { useState } from 'react';
import { User, Phone, Mail, Award, CheckCircle, ShieldAlert, ArrowLeft, Save, UploadCloud, AlertCircle } from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface ProfilePageProps {
  userProfile: UserProfile;
  onNavigate: (page: string) => void;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
}

export default function ProfilePage({ userProfile, onNavigate, onProfileUpdate }: ProfilePageProps) {
  const [fullName, setFullName] = useState(userProfile.fullName);
  const [mobileNumber, setMobileNumber] = useState(userProfile.mobileNumber);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [kycFileName, setKycFileName] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        updatedAt: new Date().toISOString()
      });

      const updated = {
        ...userProfile,
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        updatedAt: new Date().toISOString()
      };

      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'PROFILE_UPDATE',
        `Updated name to ${fullName} and mobile to ${mobileNumber}`
      );

      onProfileUpdate(updated);
      setSuccess("Profile updated successfully!");
    } catch (e: any) {
      setError(e.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  // Simulated KYC upload
  const handleKycUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycFileName) {
      setError("Please select a file or provide a document name.");
      return;
    }

    setSubmittingKyc(true);
    setError(null);
    setSuccess(null);

    try {
      // Update KYC status in users collection to 'Pending'
      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        kycStatus: 'Pending',
        updatedAt: new Date().toISOString()
      });

      const updated = {
        ...userProfile,
        kycStatus: 'Pending' as const,
        updatedAt: new Date().toISOString()
      };

      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'KYC_SUBMITTED',
        `Submitted KYC documents for verification (File: ${kycFileName})`
      );

      onProfileUpdate(updated);
      setSuccess("KYC documents submitted successfully! Status changed to Pending review.");
      setKycFileName('');
    } catch (e: any) {
      setError(e.message || "KYC submission failed.");
    } finally {
      setSubmittingKyc(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen selection:bg-gold selection:text-black">
      {/* Header bar */}
      <div className="p-6 border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>
          <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Account Settings</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Account Details */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="text-center pb-6 border-b border-zinc-900">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-gold/20 mx-auto flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-gold" />
              </div>
              <h3 className="text-lg font-bold text-white">{userProfile.fullName}</h3>
              <span className="text-xs text-zinc-500 font-mono block mt-1">{userProfile.memberId}</span>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Account Type</span>
                <span className="font-bold text-zinc-300">{userProfile.accountType}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Ecosystem Role</span>
                <span className="font-bold text-gold">{userProfile.role}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Package Level</span>
                <span className="font-bold text-zinc-300">{userProfile.packageLevel}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Sponsor Code</span>
                <span className="font-mono text-gold font-bold">{userProfile.sponsorCode}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold">KYC Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold mt-1 ${
                  userProfile.kycStatus === 'Verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : userProfile.kycStatus === 'Pending'
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {userProfile.kycStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Editing Profile & KYC submission */}
          <div className="md:col-span-2 space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex items-start gap-2 text-sm">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Profile fields */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold uppercase tracking-tight mb-6">Edit Personal Information</h3>
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 text-white animate-transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 text-white animate-transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={userProfile.email}
                    className="w-full bg-zinc-900/40 border border-zinc-900 text-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="gold-gradient hover:brightness-110 text-black px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-1.5 disabled:opacity-5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save Profile Details"}
                  </button>
                </div>
              </form>
            </div>

            {/* KYC Upload Simulation */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-gold" />
                <h3 className="text-xl font-bold uppercase tracking-tight">Know Your Customer (KYC) Verification</h3>
              </div>
              <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
                Submit legal identification document (e.g. Passport, Driver's License, Unified Multi-Purpose ID) to verify your account and authorize cash withdrawal windows.
              </p>

              {userProfile.kycStatus === 'Verified' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-emerald-400" />
                  <div>
                    <span className="font-extrabold text-sm block">KYC Verified & Authorized</span>
                    <span className="text-xs font-light text-zinc-400">Your profile matches high regulatory requirements. Cash payouts enabled.</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleKycUpload} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                      Document / Identification Type & ID Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Passport No. P1234567A"
                      value={kycFileName}
                      onChange={(e) => setKycFileName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 text-white mb-2 animate-transition"
                    />
                  </div>

                  <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/10 rounded-xl p-8 text-center transition-colors">
                    <UploadCloud className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <span className="block text-xs text-zinc-400">Select simulated identification document scanned file</span>
                    <span className="text-[10px] text-zinc-600">Supports PNG, JPG, PDF up to 5MB</span>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingKyc}
                      className="bg-zinc-900 hover:bg-zinc-800 text-gold hover:text-gold-bright border border-zinc-800 px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {submittingKyc ? "Submitting..." : "Submit for KYC Verification"}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

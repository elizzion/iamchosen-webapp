import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Shield, Award, AlertCircle, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types';

interface UserManagementPageProps {
  onNavigate: (page: string) => void;
  currentUserProfile: UserProfile;
}

export default function UserManagementPage({ onNavigate, currentUserProfile }: UserManagementPageProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list = querySnapshot.docs.map(doc => doc.data());
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Approve KYC submission (Admin or Super Admin capability)
  const handleApproveKyc = async (userId: string, fullName: string) => {
    const hasPermission = currentUserProfile.role === 'Super Admin' || !!(currentUserProfile.permissions?.manageMembers);
    if (!hasPermission) {
      alert("Permission Denied: You do not have the 'manageMembers' permission required to approve KYC.");
      return;
    }

    setActionLoading(userId);
    setSuccess(null);

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        kycStatus: 'Verified',
        updatedAt: new Date().toISOString()
      });

      // Audit Log
      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'KYC_APPROVAL',
        `Approved KYC identification for user ${fullName} (${userId})`
      );

      setSuccess(`Approved KYC for ${fullName} successfully!`);
      await fetchUsers();
    } catch (e: any) {
      alert("Error approving KYC: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered users matching search
  const filteredUsers = users.filter((u: any) => {
    const term = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.memberId?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-black text-white min-h-screen selection:bg-gold selection:text-black">
      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('admin-dashboard')}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-xs font-semibold mr-4 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Admin
            </button>
            <h2 className="font-extrabold text-sm uppercase tracking-widest text-zinc-100 gold-text">User Management Center</h2>
          </div>
          <button
            onClick={fetchUsers}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by Name, Email, or Member ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-gold/60 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none text-white transition-colors"
            />
          </div>
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* User table lists */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-500">Querying platform database...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 text-sm">
              No matching accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-900/20 text-xs text-zinc-500 uppercase">
                    <th className="py-4 px-6 font-bold">Member details</th>
                    <th className="py-4 px-6 font-bold">Contact Info</th>
                    <th className="py-4 px-6 font-bold">Platform Role</th>
                    <th className="py-4 px-6 font-bold">KYC Status</th>
                    <th className="py-4 px-6 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-light">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.uid} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white mb-0.5">{u.fullName}</div>
                        <div className="font-mono text-xs text-zinc-500 flex items-center gap-1.5">
                          <span>{u.memberId}</span>
                          <span>•</span>
                          <span className="text-gold/80 uppercase text-[10px] font-bold">Sponsor: {u.sponsorCode}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-zinc-200 text-xs">{u.email}</div>
                        <div className="text-zinc-500 text-xs mt-0.5">{u.mobileNumber}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-block bg-zinc-900 border border-zinc-800 text-gold font-bold text-xs px-2.5 py-1 rounded">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                          u.kycStatus === 'Verified'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : u.kycStatus === 'Pending'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse'
                            : 'bg-zinc-900 text-zinc-500'
                        }`}>
                          {u.kycStatus}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {u.kycStatus === 'Pending' ? (
                          <button
                            onClick={() => handleApproveKyc(u.uid, u.fullName)}
                            disabled={actionLoading === u.uid}
                            className="bg-emerald-500 text-black hover:brightness-110 px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 active:scale-95"
                          >
                            {actionLoading === u.uid ? (
                              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" /> Approve KYC
                              </>
                            )}
                          </button>
                        ) : u.kycStatus === 'Verified' ? (
                          <span className="text-emerald-500 text-xs font-medium flex items-center justify-center gap-1">
                            <Check className="w-4 h-4" /> Fully Authorized
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs font-light">No action needed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

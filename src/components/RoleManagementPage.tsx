import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ArrowLeft, RefreshCw, Save, Check, Users } from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface RoleManagementPageProps {
  onNavigate: (page: string) => void;
  currentUserProfile: UserProfile;
}

export default function RoleManagementPage({ onNavigate, currentUserProfile }: RoleManagementPageProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rolesList: UserRole[] = [
    'Super Admin',
    'Admin',
    'Customer',
    'Affiliate',
    'City Distributor',
    'Regional Distributor'
  ];

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, currentRole: UserRole, targetRole: UserRole, fullName: string) => {
    if (currentUserProfile.role !== 'Super Admin') {
      alert("Permission Denied: Only Super Admin role holders can change user roles.");
      return;
    }

    if (userId === currentUserProfile.uid) {
      alert("Safety Guard: You cannot change your own role. Contact another Super Admin if needed.");
      return;
    }

    setUpdatingId(userId);
    setSuccess(null);

    try {
      const userRef = doc(db, 'users', userId);
      
      // Update Firestore user document with appropriate fields and permissions
      let updateFields: any = {
        role: targetRole,
        updatedAt: new Date().toISOString()
      };

      if (targetRole === 'Super Admin') {
        updateFields.accountType = 'System';
        updateFields.packageLevel = 'None';
        updateFields.commissionEligible = false;
        updateFields.walletEnabled = false;
        updateFields.genealogyEnabled = false;
        updateFields.businessCycleEnabled = false;
        updateFields.permissions = {
          manageMembers: true,
          manageProducts: true,
          manageInventory: true,
          manageWallets: true,
          approveCashOut: true,
          manageCommissions: true,
          viewAnalytics: true,
          systemSettings: true,
          manageRoles: true,
          viewAuditLogs: true
        };
      } else if (targetRole === 'Admin') {
        updateFields.accountType = 'Admin';
        updateFields.commissionEligible = false;
        updateFields.walletEnabled = true;
        updateFields.permissions = {
          manageMembers: true,
          manageProducts: true,
          manageInventory: true,
          manageWallets: true,
          approveCashOut: true,
          manageCommissions: true,
          viewAnalytics: true,
          systemSettings: false,
          manageRoles: false,
          viewAuditLogs: true
        };
      } else if (targetRole === 'Customer') {
        updateFields.accountType = 'Customer';
        updateFields.packageLevel = 'None';
        updateFields.commissionEligible = false;
        updateFields.walletEnabled = true;
        updateFields.genealogyEnabled = false;
        updateFields.businessCycleEnabled = false;
        updateFields.permissions = {
          manageMembers: false,
          manageProducts: false,
          manageInventory: false,
          manageWallets: false,
          approveCashOut: false,
          manageCommissions: false,
          viewAnalytics: false,
          systemSettings: false,
          manageRoles: false,
          viewAuditLogs: false
        };
      } else { // Affiliate or Distributor
        updateFields.accountType = 'Affiliate';
        updateFields.commissionEligible = true;
        updateFields.walletEnabled = true;
        updateFields.genealogyEnabled = true;
        updateFields.businessCycleEnabled = true;
        updateFields.permissions = {
          manageMembers: false,
          manageProducts: false,
          manageInventory: false,
          manageWallets: false,
          approveCashOut: false,
          manageCommissions: false,
          viewAnalytics: false,
          systemSettings: false,
          manageRoles: false,
          viewAuditLogs: false
        };
      }

      await updateDoc(userRef, updateFields);

      // Write Audit Log entry
      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'ROLE_CHANGE',
        `Changed role of user ${fullName} (${userId}) from ${currentRole} to ${targetRole}`
      );

      setSuccess(`Role of ${fullName} successfully updated to ${targetRole}`);
      await fetchUsers();
    } catch (e: any) {
      alert("Error changing role: " + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

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
            <h2 className="font-extrabold text-sm uppercase tracking-widest text-zinc-100 gold-text">Role Management Center</h2>
          </div>
          <button
            onClick={fetchUsers}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Permission restriction Banner if not Super Admin */}
        {currentUserProfile.role !== 'Super Admin' && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 mb-8">
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-sm block uppercase tracking-wide">Super Admin Restricted Access</span>
              <span className="text-xs text-zinc-400 font-light mt-0.5 block leading-relaxed">
                You are currently logged in as an <span className="text-white font-bold">{currentUserProfile.role}</span>. Under strict platform security requirements, only Super Admins can reassign member roles. Inputs have been locked to read-only.
              </span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl mb-6 flex items-center gap-2 max-w-xl">
            <Check className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Roles listing table */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-500">Querying members details...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-900/20 text-xs text-zinc-500 uppercase">
                    <th className="py-4 px-6 font-bold">User Details</th>
                    <th className="py-4 px-6 font-bold">Email</th>
                    <th className="py-4 px-6 font-bold">Current Role</th>
                    <th className="py-4 px-6 font-bold text-right">Assign New Role</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-light">
                  {users.map((u: any) => (
                    <tr key={u.uid} className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white mb-0.5">{u.fullName}</div>
                        <div className="font-mono text-xs text-zinc-500">{u.memberId}</div>
                      </td>
                      <td className="py-4 px-6 text-zinc-400 text-xs">
                        {u.email}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-gold text-xs font-bold px-2.5 py-1 rounded">
                          <Shield className="w-3.5 h-3.5" /> {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {updatingId === u.uid ? (
                          <div className="inline-flex items-center gap-2 text-zinc-500 text-xs font-bold py-2">
                            <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" /> Saving...
                          </div>
                        ) : (
                          <select
                            disabled={currentUserProfile.role !== 'Super Admin' || u.uid === currentUserProfile.uid}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, u.role, e.target.value as UserRole, u.fullName)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-gold focus:text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {rolesList.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
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

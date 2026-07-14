import React, { useState, useEffect } from 'react';
import {
  Menu as MenuIcon,
  X as CloseIcon,
  Copy,
  Globe,
  Bell,
  Zap,
  LogOut
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile, Notification } from '../../types';
import { NotificationService } from '../../services/notification/notification.service';
import ChosenLogoText from '../ChosenLogoText';

interface AffiliateTopNavbarProps {
  userProfile: UserProfile | null;
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}


export default function AffiliateTopNavbar({
  userProfile,
  isDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  onNavigate,
  onLogout,
}: AffiliateTopNavbarProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'ZH' | 'ES'>('EN');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsubscribe = NotificationService.subscribeToNotifications(
      userProfile.uid,
      'Affiliate',
      (data) => {
        setNotifications(data);
      }
    );
    return () => unsubscribe();
  }, [userProfile?.uid]);

  // Copy Member ID to clipboard
  const handleCopyMemberId = () => {
    if (!userProfile?.memberId) return;
    navigator.clipboard.writeText(userProfile.memberId).then(() => {
      setCopySuccess(true);
      window.showSuccess?.("Member ID copied to clipboard!", "Success");
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Helper to check registration authorization
  const isAuthorizedForRegistration = (profile: UserProfile | null) => {
    if (!profile) return false;
    const allowedRoles = ['Super Admin', 'Admin', 'City Distributor', 'Regional Distributor'];
    const allowedPackages = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return allowedRoles.includes(profile.role) || allowedPackages.includes(profile.packageLevel);
  };

  const showRegisterButton = isAuthorizedForRegistration(userProfile);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#111318]/95 backdrop-blur-md select-none">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* LEFT SECTION */}
        <div className="flex items-center space-x-4">
          {/* Drawer Toggle Button */}
          <button
            type="button"
            onClick={isDrawerOpen ? onCloseDrawer : onOpenDrawer}
            aria-label={isDrawerOpen ? "Close navigation drawer" : "Open navigation drawer"}
            aria-controls="affiliate-navigation-drawer"
            aria-expanded={isDrawerOpen}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/40 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#CD7F32] focus:ring-offset-2 focus:ring-offset-[#111318]"
          >
            {isDrawerOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>

          {/* Logo & Brand text */}
          <div 
            onClick={() => onNavigate('affiliate-dashboard')}
            className="hidden md:flex items-center cursor-pointer hover:opacity-95 active:scale-98 transition-all"
          >
            <ChosenLogoText className="h-9 w-auto" />
          </div>
        </div>


        {/* RIGHT SECTION: ACTIONS */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          

          {/* Language Selector */}
          <div className="relative hidden md:block">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold rounded-xl pl-2 pr-7 py-2 focus:outline-none focus:border-zinc-700 text-zinc-400 appearance-none select-none cursor-pointer"
            >
              <option value="EN">EN</option>
              <option value="ZH">ZH</option>
              <option value="ES">ES</option>
            </select>
            <Globe size={12} className="text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              className="p-2 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 transition-all relative cursor-pointer focus:outline-none"
              title="Notifications"
            >
              <Bell size={16} />
              {notifications.some(n => n.unread) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2.5 w-80 bg-[#0B0D12] border border-zinc-800 rounded-2xl shadow-xl z-50 p-4 space-y-3 border-cyan-950/40">
                <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Alerts & Notifications</h4>
                  {notifications.some(n => n.unread) && (
                    <button
                      onClick={() => {
                        if (userProfile?.uid) {
                          NotificationService.markAllAsRead(userProfile.uid);
                        }
                      }}
                      className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 text-center py-4">No notifications yet.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => notif.unread && userProfile?.uid && NotificationService.markAsRead(notif.id, userProfile.uid)}
                        className={`p-2.5 rounded-xl border text-left transition-all duration-300 ${
                          notif.unread
                            ? 'bg-[#17181D] border-cyan-500/20 cursor-pointer hover:border-cyan-400/40'
                            : 'bg-[#1D1F26]/40 border-zinc-800/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="text-[10px] font-bold text-white flex items-center gap-1">
                            {notif.unread && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                            {notif.title}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-mono tracking-wider shrink-0">{notif.date}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-light leading-snug">
                          {notif.desc}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Register Member Shortcut button */}
          {showRegisterButton && (
            <button
              onClick={() => onNavigate('member-registration')}
              className="hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-[#CD7F32] to-[#F4C542] hover:brightness-110 text-black px-4 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <Zap size={14} className="fill-black" /> Register Member
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="text-zinc-400 hover:text-red-400 p-2 rounded-xl hover:bg-zinc-800/40 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>

      </div>
    </header>
  );
}

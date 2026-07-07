import React from 'react';
import { motion } from 'motion/react';
import { Bell, Globe, LogOut, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../../types';
import ChosenLogoText from '../ChosenLogoText';

interface AppHeaderProps {
  userProfile: UserProfile;
  selectedLanguage: 'EN' | 'ZH' | 'ES';
  setSelectedLanguage: (lang: 'EN' | 'ZH' | 'ES') => void;
  hasUnreadNotifications: boolean;
  onNavigateToTab: (tab: 'home' | 'wallet' | 'scan' | 'notifications' | 'profile') => void;
  onLogout: () => void;
}

export default function AppHeader({
  userProfile,
  selectedLanguage,
  setSelectedLanguage,
  hasUnreadNotifications,
  onNavigateToTab,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-950/15 bg-[#0B0B0F]/95 backdrop-blur-md lg:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo and Brand Title - Premium Mobile Responsive Layout with Inline SVG */}
        <div 
          onClick={() => onNavigateToTab('home')}
          className="flex items-center cursor-pointer hover:opacity-95 active:scale-98 transition-all"
        >
          <ChosenLogoText className="h-9 w-auto" />
        </div>

        {/* Controls Panel - Highly Compact & Clean */}
        <div className="flex items-center space-x-2">
          {/* Language Selector */}
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              className="bg-[#17181D]/80 border border-zinc-800/80 hover:border-cyan-500/20 text-[9px] font-black rounded-xl pl-2 pr-5 py-1.5 focus:outline-none text-zinc-300 cursor-pointer appearance-none transition-colors"
            >
              <option value="EN">EN</option>
              <option value="ZH">ZH</option>
              <option value="ES">ES</option>
            </select>
            <Globe className="w-2.5 h-2.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Notifications Trigger */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigateToTab('notifications')}
            className="p-2 bg-[#17181D]/80 hover:bg-zinc-800/80 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-cyan-400 transition-colors relative cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            {hasUnreadNotifications && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </motion.button>

          {/* Avatar Profile Trigger */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigateToTab('profile')}
            className="w-7.5 h-7.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-[#0B0B0F] font-black text-[10px] uppercase cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.1)] border border-cyan-400/10"
          >
            {userProfile.fullName ? userProfile.fullName[0] : 'C'}
          </motion.button>
        </div>
      </div>
    </header>
  );
}

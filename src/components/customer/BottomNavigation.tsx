import React from 'react';
import { motion } from 'motion/react';
import { Home, Wallet, QrCode, Bell, User, Users, UserPlus } from 'lucide-react';

export type CustomerTabType = 'home' | 'wallet' | 'scan' | 'notifications' | 'profile' | 'register' | 'team';

interface BottomNavigationProps {
  activeTab: CustomerTabType;
  setActiveTab: (tab: CustomerTabType) => void;
  unreadCount: number;
  role?: 'Customer' | 'Affiliate' | string;
}

export default function BottomNavigation({
  activeTab,
  setActiveTab,
  unreadCount,
  role = 'Customer',
}: BottomNavigationProps) {
  const customerTabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
    { id: 'scan' as const, label: 'Scan', icon: QrCode, isCenter: true },
    { id: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  const affiliateTabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
    { id: 'register' as const, label: 'Register', icon: UserPlus, isCenter: true },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  const tabs = role === 'Affiliate' ? affiliateTabs : customerTabs;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 w-full bg-[#0B0D12] border-t border-cyan-400/10 z-50 select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(72px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="grid grid-cols-5 h-[72px] w-full max-w-lg mx-auto items-center">
        {tabs.map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <div key={tab.id} className="flex items-center justify-center h-full w-full">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 to-teal-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-all duration-200 cursor-pointer ${
                    isActive ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0B0D12]' : ''
                  }`}
                  aria-label={tab.label}
                >
                  <IconComp className="w-[22px] h-[22px] stroke-[2.5px]" />
                </motion.button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center h-full w-full relative cursor-pointer group transition-colors duration-200"
              style={{ minHeight: '48px' }}
              aria-label={tab.label}
            >
              <div className="flex flex-col items-center justify-center relative pb-1">
                <div className="relative">
                  <IconComp
                    className={`w-[22px] h-[22px] transition-colors duration-200 ${
                      isActive ? 'text-cyan-400' : 'text-zinc-500'
                    }`}
                  />

                  {/* Notification badge */}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-[#0B0D12] animate-pulse">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>

                {/* Subtext Label */}
                <span
                  className={`text-[10px] uppercase font-medium tracking-wider mt-1 transition-colors duration-200 ${
                    isActive ? 'text-cyan-400' : 'text-zinc-500'
                  }`}
                >
                  {tab.label}
                </span>
              </div>

              {/* Active bottom indicator: 3px cyan line */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-cyan-400 rounded-t-full shadow-[0_-2px_10px_rgba(6,182,212,0.8)]"
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

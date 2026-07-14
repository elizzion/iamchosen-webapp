import React from 'react';
import {
  Home as HomeIcon,
  Wallet as WalletIcon,
  Zap,
  Users,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  BookOpen,
  Sparkles,
  Ticket
} from 'lucide-react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider
} from '@mui/material';
import ChosenLogo from '../ChosenLogo';
import { UserProfile } from '../../types';
import AffiliateNeedHelpCard from './AffiliateNeedHelpCard';

// Package color mapping helper
export const getPackageAccentColor = (level: string | undefined): string => {
  const norm = level || 'Bronze';
  switch (norm) {
    case 'Bronze': return '#CD7F32';
    case 'Silver': return '#a1a1aa'; // zinc-400
    case 'Gold': return '#fbbf24'; // amber-400
    case 'Platinum': return '#22d3ee'; // cyan-400
    case 'Diamond': return '#e879f9'; // fuchsia-400
    case 'City Distributor': return '#34d399'; // emerald-400
    case 'Regional Distributor': return '#818cf8'; // indigo-400
    default: return '#CD7F32';
  }
};

interface AffiliateNavigationItem {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
}

interface AffiliateNavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentPage: string;
  currentView: string | null;
  isAICoachOpen: boolean;
  onNavigate: (route: string) => void;
}

export default function AffiliateNavigationDrawer({
  open,
  onClose,
  userProfile,
  currentPage,
  currentView,
  isAICoachOpen,
  onNavigate,
}: AffiliateNavigationDrawerProps) {
  const accentColor = getPackageAccentColor(userProfile?.packageLevel);

  // Helper to check registration authorization
  const isAuthorizedForRegistration = (profile: UserProfile | null) => {
    if (!profile) return false;
    const allowedRoles = ['Super Admin', 'Admin', 'City Distributor', 'Regional Distributor'];
    const allowedPackages = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return allowedRoles.includes(profile.role) || allowedPackages.includes(profile.packageLevel);
  };

  const navItems: AffiliateNavigationItem[] = [
    { id: 'dashboard', label: 'Dashboard', route: 'affiliate-dashboard', icon: <HomeIcon size={18} /> },
    { id: 'wallet', label: 'Wallet', route: 'cash-in', icon: <WalletIcon size={18} /> },
    { id: 'register-member', label: 'Register Member', route: 'member-registration', icon: <Zap size={18} /> },
    { id: 'team', label: 'My Team', route: 'affiliate-dashboard:team', icon: <Users size={18} /> },
    { id: 'orders', label: 'Orders', route: 'affiliate-dashboard:orders', icon: <ShoppingBag size={18} /> },
    { id: 'commissions', label: 'Commissions', route: 'affiliate-dashboard:commissions', icon: <DollarSign size={18} /> },
    { id: 'marketing', label: 'Marketing Co-op', route: 'affiliate-dashboard:marketing', icon: <TrendingUp size={18} /> },
    { id: 'academy', label: 'Academy', route: 'affiliate-dashboard:academy', icon: <BookOpen size={18} /> },
    { id: 'ai-coach', label: 'AI Coach', route: 'affiliate-dashboard:ai-coach', icon: <Sparkles size={18} /> },
    { id: 'support', label: 'Support', route: 'affiliate-dashboard:support', icon: <Ticket size={18} /> },
    { id: 'e-commerce', label: 'E-Commerce', route: 'e-commerce', icon: <ShoppingBag size={18} /> },
  ];

  // Filter items based on Register Member permission
  const visibleItems = navItems.filter(item => {
    if (item.id === 'register-member') {
      return isAuthorizedForRegistration(userProfile);
    }
    return true;
  });

  // Calculate dynamic active ID
  const getActiveId = () => {
    if (currentPage === 'cash-in') return 'wallet';
    if (currentPage === 'member-registration') return 'register-member';
    if (currentPage === 'e-commerce') return 'e-commerce';
    if (currentPage === 'affiliate-dashboard' || currentPage === 'dashboard') {
      if (currentView) {
        if (['team', 'orders', 'commissions', 'marketing', 'academy', 'support'].includes(currentView)) {
          return currentView;
        }
      }
      if (isAICoachOpen) return 'ai-coach';
      return 'dashboard';
    }
    return '';
  };

  const activeId = getActiveId();

  const handleDrawerNavigation = (route: string) => {
    if (route === 'support') {
      sessionStorage.setItem('affiliate_view', 'support');
      onNavigate('affiliate-dashboard');
    } else if (route.startsWith('affiliate-dashboard:')) {
      const view = route.split(':')[1];
      sessionStorage.setItem('affiliate_view', view);
      onNavigate('affiliate-dashboard');
    } else {
      onNavigate(route);
    }
    onClose();
  };

  const DrawerList = (
    <Box
      sx={{
        width: {
          xs: '86vw',
          sm: 320,
        },
        maxWidth: 320,
        height: '100dvh',
        bgcolor: '#101116',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="presentation"
    >
      {/* Brand Header */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <ChosenLogo size="sm" className="w-9 h-9" />
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 900,
              letterSpacing: '0.15em',
              color: '#ffffff',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}
          >
            I AM CHOSEN
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '8px',
              letterSpacing: '0.3em',
              color: '#00D5FF',
              textTransform: 'uppercase',
              display: 'block',
              mt: 0.5,
            }}
          >
            INTERNATIONAL
          </Typography>
        </Box>
      </Box>

      {/* Navigation List */}
      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: '#1f2937',
            borderRadius: '99px',
          },
        }}
      >
        {visibleItems.map((item) => {
          const isActive = activeId === item.id;
          return (
            <ListItem key={item.id} disablePadding sx={{ width: '100%' }}>
              <ListItemButton
                selected={isActive}
                onClick={() => handleDrawerNavigation(item.route)}
                sx={{
                  py: 1.2,
                  px: 3,
                  mx: 1.5,
                  borderRadius: '12px',
                  borderLeft: isActive ? `3px solid ${accentColor}` : '3px solid transparent',
                  bgcolor: isActive ? '#171a21' : 'transparent',
                  color: isActive ? '#ffffff' : '#9ca3af',
                  transition: 'all 0.2s ease-in-out',
                  '&:focus-visible': {
                    outline: `2px solid ${accentColor}`,
                    outlineOffset: '-2px',
                  },
                  '&.Mui-selected': {
                    bgcolor: '#171a21',
                    color: '#ffffff',
                    '&:hover': {
                      bgcolor: '#1e222b',
                    },
                  },
                  '&:hover': {
                    bgcolor: '#13151b',
                    color: '#ffffff',
                    '& .MuiListItemIcon-root': {
                      color: isActive ? accentColor : '#ffffff',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: isActive ? accentColor : '#4b5563',
                    transition: 'color 0.2s',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      sx={{
                        fontSize: '13px',
                        fontWeight: isActive ? 800 : 600,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {item.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }} />

      {/* Need Help Card */}
      <AffiliateNeedHelpCard onContactSupport={() => handleDrawerNavigation('support')} />
    </Box>
  );

  return (
    <Drawer
      id="affiliate-navigation-drawer"
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true,
      }}
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#101116',
            backgroundImage: 'none',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            width: {
              xs: '86vw',
              sm: 320,
            },
            maxWidth: 320,
            overflowY: 'hidden',
          },
        },
      }}
    >
      {DrawerList}
    </Drawer>
  );
}

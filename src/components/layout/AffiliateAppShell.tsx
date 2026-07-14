import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { UserProfile } from '../../types';
import AffiliateTopNavbar from './AffiliateTopNavbar';
import AffiliateNavigationDrawer from './AffiliateNavigationDrawer';

const muiTheme = createTheme({
  typography: {
    fontFamily: '"Geist", sans-serif',
  },
});

interface AffiliateAppShellProps {
  children: React.ReactNode;
  userProfile: UserProfile | null;
  currentPage: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

export default function AffiliateAppShell({
  children,
  userProfile,
  currentPage,
  onNavigate,
  onLogout,
}: AffiliateAppShellProps) {
  const [open, setOpen] = useState(false);
  const [currentView, setCurrentView] = useState<string | null>(null);
  const [isAICoachOpen, setIsAICoachOpen] = useState(false);

  // Subscribe to view changes from AffiliateDashboard
  useEffect(() => {
    const handleViewChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentView(customEvent.detail?.view || null);
      setIsAICoachOpen(!!customEvent.detail?.aiCoach);
    };
    window.addEventListener('affiliate_view_changed', handleViewChange);
    return () => window.removeEventListener('affiliate_view_changed', handleViewChange);
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: '#08090c',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <AffiliateTopNavbar
          userProfile={userProfile}
          isDrawerOpen={open}
          onOpenDrawer={() => setOpen(true)}
          onCloseDrawer={() => setOpen(false)}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <AffiliateNavigationDrawer
          open={open}
          onClose={() => setOpen(false)}
          userProfile={userProfile}
          currentPage={currentPage}
          currentView={currentView}
          isAICoachOpen={isAICoachOpen}
          onNavigate={onNavigate}
        />

        <Box
          component="main"
          sx={{
            width: '100%',
            minWidth: 0,
            flex: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

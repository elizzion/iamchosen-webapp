import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Box, Typography, Button } from '@mui/material';

interface AffiliateNeedHelpCardProps {
  onContactSupport: () => void;
}

export default function AffiliateNeedHelpCard({ onContactSupport }: AffiliateNeedHelpCardProps) {
  return (
    <Box
      id="affiliate-need-help-card"
      sx={{
        m: 2.5,
        p: 2.5,
        bgcolor: '#171a22',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpCircle size={20} style={{ color: '#CD7F32' }} />
        <Typography
          variant="caption"
          sx={{
            color: '#ffffff',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          NEED HELP?
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: '#a1a1aa',
          fontSize: '11px',
          fontWeight: 300,
          lineHeight: 1.5,
        }}
      >
        Contact support to resolve downline queries, wallet issues, and rank activations.
      </Typography>
      <Button
        variant="contained"
        fullWidth
        onClick={onContactSupport}
        sx={{
          bgcolor: '#CD7F32',
          color: '#000000',
          fontWeight: 800,
          fontSize: '10px',
          py: 1,
          borderRadius: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            bgcolor: '#e08f3f',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(205, 127, 80, 0.25)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        }}
      >
        CONTACT SUPPORT
      </Button>
    </Box>
  );
}

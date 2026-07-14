import React, { createContext, useContext, useState, useEffect } from 'react';
import { CCSettings } from '../types';
import { 
  DEFAULT_CC_SETTINGS, 
  subscribeToCCSettings, 
  updateCCSettings,
  getCCSettings
} from '../services/cc-settings/cc-settings.service';

interface CCSettingsContextType {
  ccSettings: CCSettings;
  loading: boolean;
  updateRates: (cashInRate: number, cashOutRate: number) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const CCSettingsContext = createContext<CCSettingsContextType>({
  ccSettings: DEFAULT_CC_SETTINGS,
  loading: true,
  updateRates: async () => {},
  refreshSettings: async () => {},
});

export const useCCSettings = () => useContext(CCSettingsContext);

export const CCSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ccSettings, setCcSettings] = useState<CCSettings>(DEFAULT_CC_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Setup listener to get real-time config updates via centralized service
    const unsubscribe = subscribeToCCSettings(
      (updatedSettings) => {
        setCcSettings(updatedSettings);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateRates = async (cashInRate: number, cashOutRate: number) => {
    await updateCCSettings(cashInRate, cashOutRate);
  };

  const refreshSettings = async () => {
    const settings = await getCCSettings();
    setCcSettings(settings);
  };

  return (
    <CCSettingsContext.Provider value={{ ccSettings, loading, updateRates, refreshSettings }}>
      {children}
    </CCSettingsContext.Provider>
  );
};

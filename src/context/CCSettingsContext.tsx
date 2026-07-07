import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CCSettings } from '../types';

interface CCSettingsContextType {
  ccSettings: CCSettings;
  loading: boolean;
  updateRates: (cashInRate: number, cashOutRate: number) => Promise<void>;
}

const defaultSettings: CCSettings = {
  cashInRatePHP: 70,
  cashOutRatePHP: 69,
  currency: 'PHP',
};

const CCSettingsContext = createContext<CCSettingsContextType>({
  ccSettings: defaultSettings,
  loading: true,
  updateRates: async () => {},
});

export const useCCSettings = () => useContext(CCSettingsContext);

export const CCSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ccSettings, setCcSettings] = useState<CCSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'system_config', 'cc_settings');

    // Setup listener to get real-time config updates
    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setCcSettings({
            cashInRatePHP: typeof data.cashInRatePHP === 'number' ? data.cashInRatePHP : 70,
            cashOutRatePHP: typeof data.cashOutRatePHP === 'number' ? data.cashOutRatePHP : 69,
            currency: data.currency || 'PHP',
          });
          setLoading(false);
        } else {
          // If the configuration doesn't exist, fallback to local defaults
          console.log("system_config/cc_settings document not found. Using default conversion rates.");
          setCcSettings(defaultSettings);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error listening to system_config/cc_settings:", error);
        // Fallback to local defaults in case of permission issues or other errors
        setCcSettings(defaultSettings);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateRates = async (cashInRate: number, cashOutRate: number) => {
    try {
      const docRef = doc(db, 'system_config', 'cc_settings');
      await setDoc(docRef, {
        cashInRatePHP: cashInRate,
        cashOutRatePHP: cashOutRate,
        currency: 'PHP',
      }, { merge: true });
    } catch (error) {
      console.error("Failed to update system_config/cc_settings:", error);
      throw error;
    }
  };

  return (
    <CCSettingsContext.Provider value={{ ccSettings, loading, updateRates }}>
      {children}
    </CCSettingsContext.Provider>
  );
};

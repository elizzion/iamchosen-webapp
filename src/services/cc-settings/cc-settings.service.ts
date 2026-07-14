import { doc, getDoc, setDoc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { CCSettings } from '../../types';

export const DEFAULT_CC_SETTINGS: CCSettings = {
  cashInRatePHP: 70,
  cashOutRatePHP: 69,
  displayReferenceRatePHP: 70,
  purchaseRatePHP: 70,
  currency: 'PHP',
  transferFeeEnabled: true,
  transferFeeType: 'PLATFORM_TRANSFER_FEE',
  transferFeeAmountType: 'FIXED',
  transferFeeAmountCC: 1.0,
  transferFeePayer: 'SENDER',
  transferFeeApplyOnlyOnCompleted: true,
  transferFeeDestinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
  transferFeePublicDisplayName: 'Platform Transfer Fee',
  transferFeeInternalDisplayName: 'Technology Operations Treasury',
  transferFeeIsCommissionSource: false,
  transferFeeCountsTowardBusinessCycle: false,
};

// Check if we are in development environment
const isDev = (import.meta as any).env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

/**
 * Log a warning only in development environment
 */
export const logWarningInDev = (message: string, error?: any) => {
  if (isDev) {
    if (error) {
      console.warn(`[CCSettingsService Warning] ${message}`, error);
    } else {
      console.warn(`[CCSettingsService Warning] ${message}`);
    }
  }
};

/**
 * Get Firestore document reference for cc_settings
 */
export const getCCSettingsDocRef = () => {
  return doc(db, 'system_config', 'cc_settings');
};

/**
 * Helper to extract CCSettings from Firestore document snapshot
 */
export const extractCCSettings = (snapshot: DocumentSnapshot): CCSettings => {
  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      cashInRatePHP: typeof data?.cashInRatePHP === 'number' ? data.cashInRatePHP : DEFAULT_CC_SETTINGS.cashInRatePHP,
      cashOutRatePHP: typeof data?.cashOutRatePHP === 'number' ? data.cashOutRatePHP : DEFAULT_CC_SETTINGS.cashOutRatePHP,
      displayReferenceRatePHP: typeof data?.displayReferenceRatePHP === 'number' ? data.displayReferenceRatePHP : DEFAULT_CC_SETTINGS.displayReferenceRatePHP,
      purchaseRatePHP: typeof data?.purchaseRatePHP === 'number' ? data.purchaseRatePHP : DEFAULT_CC_SETTINGS.purchaseRatePHP,
      currency: data?.currency || DEFAULT_CC_SETTINGS.currency,
      transferFeeEnabled: data?.transferFeeEnabled !== undefined ? data.transferFeeEnabled : DEFAULT_CC_SETTINGS.transferFeeEnabled,
      transferFeeType: data?.transferFeeType || DEFAULT_CC_SETTINGS.transferFeeType,
      transferFeeAmountType: data?.transferFeeAmountType || DEFAULT_CC_SETTINGS.transferFeeAmountType,
      transferFeeAmountCC: typeof data?.transferFeeAmountCC === 'number' ? data.transferFeeAmountCC : DEFAULT_CC_SETTINGS.transferFeeAmountCC,
      transferFeePayer: data?.transferFeePayer || DEFAULT_CC_SETTINGS.transferFeePayer,
      transferFeeApplyOnlyOnCompleted: data?.transferFeeApplyOnlyOnCompleted !== undefined ? data.transferFeeApplyOnlyOnCompleted : DEFAULT_CC_SETTINGS.transferFeeApplyOnlyOnCompleted,
      transferFeeDestinationTreasuryId: data?.transferFeeDestinationTreasuryId || DEFAULT_CC_SETTINGS.transferFeeDestinationTreasuryId,
      transferFeePublicDisplayName: data?.transferFeePublicDisplayName || DEFAULT_CC_SETTINGS.transferFeePublicDisplayName,
      transferFeeInternalDisplayName: data?.transferFeeInternalDisplayName || DEFAULT_CC_SETTINGS.transferFeeInternalDisplayName,
      transferFeeIsCommissionSource: data?.transferFeeIsCommissionSource !== undefined ? data.transferFeeIsCommissionSource : DEFAULT_CC_SETTINGS.transferFeeIsCommissionSource,
      transferFeeCountsTowardBusinessCycle: data?.transferFeeCountsTowardBusinessCycle !== undefined ? data.transferFeeCountsTowardBusinessCycle : DEFAULT_CC_SETTINGS.transferFeeCountsTowardBusinessCycle,
    };
  } else {
    logWarningInDev("system_config/cc_settings document is missing. Falling back to default conversion rates.");
    return DEFAULT_CC_SETTINGS;
  }
};

/**
 * Fetch CC settings once
 */
export const getCCSettings = async (): Promise<CCSettings> => {
  try {
    const docRef = doc(db, 'system_config', 'cc_settings');
    const snapshot = await getDoc(docRef);
    return extractCCSettings(snapshot);
  } catch (error) {
    logWarningInDev("Failed to fetch system_config/cc_settings from Firestore. Falling back to default conversion rates.", error);
    return DEFAULT_CC_SETTINGS;
  }
};

/**
 * Subscribe to real-time CC settings updates
 */
export const subscribeToCCSettings = (
  onUpdate: (settings: CCSettings) => void,
  onError?: (error: any) => void
) => {
  const docRef = doc(db, 'system_config', 'cc_settings');
  return onSnapshot(
    docRef,
    (snapshot) => {
      const settings = extractCCSettings(snapshot);
      onUpdate(settings);
    },
    (error) => {
      logWarningInDev("Error listening to system_config/cc_settings updates. Falling back to default conversion rates.", error);
      if (onError) {
        onError(error);
      } else {
        onUpdate(DEFAULT_CC_SETTINGS);
      }
    }
  );
};

/**
 * Update CC settings in Firestore
 */
export const updateCCSettings = async (cashInRate: number, cashOutRate: number): Promise<void> => {
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

/**
 * Update transfer fee settings in Firestore
 */
export const updateTransferFeeSettings = async (settings: Partial<CCSettings>): Promise<void> => {
  try {
    const docRef = doc(db, 'system_config', 'cc_settings');
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Failed to update transfer fee settings:", error);
    throw error;
  }
};

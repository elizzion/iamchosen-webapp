import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface CommunityLinks {
  telegramUrl?: string;
  whatsappUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  isActive: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export type CommunityPlatform = 'telegram' | 'whatsapp' | 'instagram' | 'facebook';

export interface BuildReferralUrlOptions {
  baseUrl: string;
  registrationPath: string;
  referralCode: string;
  queryParameter: string;
}

/**
 * Gets the centralized public application URL.
 * 1. Uses VITE_PUBLIC_APP_URL when configured.
 * 2. Otherwise uses window.location.origin in development.
 * 3. Removes trailing slashes.
 */
export function getPublicAppUrl(): string {
  const env = (import.meta as any).env || {};
  const configuredUrl = env.VITE_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://iamchosen.app');
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Safely constructs a referral URL using URL and URLSearchParams.
 */
export function buildAffiliateReferralUrl(options: BuildReferralUrlOptions): string {
  const code = options.referralCode.trim();
  if (!code) return '';
  try {
    const url = new URL(options.registrationPath, options.baseUrl);
    url.searchParams.set(options.queryParameter, code);
    return url.toString();
  } catch (e) {
    console.error("Failed to build referral URL", e);
    return '';
  }
}

/**
 * Helper to validate if a URL is valid and uses the secure HTTPS protocol.
 */
export function validateCommunityUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('https://');
}

/**
 * Fetches the community links from the Firestore system_config/community_links document.
 * Falls back to environment variables if the document does not exist or fails to load.
 */
export async function fetchCommunityLinks(): Promise<CommunityLinks> {
  try {
    const docRef = doc(db, 'system_config', 'community_links');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        telegramUrl: data.telegramUrl || '',
        whatsappUrl: data.whatsappUrl || '',
        instagramUrl: data.instagramUrl || '',
        facebookUrl: data.facebookUrl || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    }
  } catch (error) {
    console.warn("Failed to fetch community links from Firestore, falling back to environment variables:", error);
  }

  // Fallback to environment variables
  const env = (import.meta as any).env || {};
  return {
    telegramUrl: env.VITE_COMMUNITY_TELEGRAM_URL || '',
    whatsappUrl: env.VITE_COMMUNITY_WHATSAPP_URL || '',
    instagramUrl: env.VITE_COMMUNITY_INSTAGRAM_URL || '',
    facebookUrl: env.VITE_COMMUNITY_FACEBOOK_URL || '',
    isActive: true,
  };
}

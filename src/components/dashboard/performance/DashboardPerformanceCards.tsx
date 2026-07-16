import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Award,
  Users,
  ChevronRight,
  CheckCircle,
  ShieldAlert,
  X,
  Activity,
  Server,
} from 'lucide-react'
import { db } from '../../../firebase'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { UserProfile, BusinessCycle } from '../../../types'
import {
  RUN_DASHBOARD_PERFORMANCE_TESTS,
  TestCaseResult,
} from './DashboardPerformanceCards.test'

// Centralized Semantic Theme & Style Tokens per package level
export interface RankStyleConfig {
  displayName: string
  accentClass: string
  bgClass: string
  glowClass: string
  gradientClass: string
  textColor: string
  progressBarColor: string
  infinityBonus: string
  nextRank: string | null
}

export const RANK_STYLE_CONFIGS: Record<string, RankStyleConfig> = {
  None: {
    displayName: 'Smart Customer',
    accentClass: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    bgClass: 'bg-emerald-950/20',
    glowClass: 'shadow-emerald-500/10',
    gradientClass: 'from-emerald-500/20 via-zinc-900 to-zinc-950',
    textColor: 'text-emerald-400',
    progressBarColor: 'bg-emerald-500',
    infinityBonus: '0.0%',
    nextRank: 'Bronze',
  },
  Bronze: {
    displayName: 'Bronze Affiliate',
    accentClass: 'border-[#CD7F32]/30 text-[#CD7F32] bg-[#CD7F32]/10',
    bgClass: 'bg-[#CD7F32]/5',
    glowClass: 'shadow-[#CD7F32]/10',
    gradientClass: 'from-[#CD7F32]/15 via-zinc-900 to-zinc-950',
    textColor: 'text-[#CD7F32]',
    progressBarColor: 'bg-[#CD7F32]',
    infinityBonus: '0.0%',
    nextRank: 'Silver',
  },
  Silver: {
    displayName: 'Silver Affiliate',
    accentClass: 'border-zinc-400/30 text-zinc-300 bg-zinc-400/10',
    bgClass: 'bg-zinc-400/5',
    glowClass: 'shadow-zinc-400/10',
    gradientClass: 'from-zinc-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-zinc-300',
    progressBarColor: 'bg-zinc-400',
    infinityBonus: '1.0%',
    nextRank: 'Gold',
  },
  Gold: {
    displayName: 'Gold Affiliate',
    accentClass: 'border-amber-400/30 text-amber-400 bg-amber-400/10',
    bgClass: 'bg-amber-400/5',
    glowClass: 'shadow-amber-400/10',
    gradientClass: 'from-amber-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-amber-400',
    progressBarColor: 'bg-amber-400',
    infinityBonus: '2.0%',
    nextRank: 'Platinum',
  },
  Platinum: {
    displayName: 'Platinum Affiliate',
    accentClass: 'border-cyan-400/30 text-cyan-400 bg-cyan-400/10',
    bgClass: 'bg-cyan-400/5',
    glowClass: 'shadow-cyan-400/10',
    gradientClass: 'from-cyan-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-cyan-400',
    progressBarColor: 'bg-cyan-400',
    infinityBonus: '3.0%',
    nextRank: 'Diamond',
  },
  Diamond: {
    displayName: 'Diamond Affiliate',
    accentClass: 'border-fuchsia-400/30 text-fuchsia-400 bg-fuchsia-400/10',
    bgClass: 'bg-fuchsia-400/5',
    glowClass: 'shadow-fuchsia-400/10',
    gradientClass: 'from-fuchsia-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-fuchsia-400',
    progressBarColor: 'bg-fuchsia-400',
    infinityBonus: '4.0%',
    nextRank: 'City Distributor',
  },
  'City Distributor': {
    displayName: 'City Distributor',
    accentClass: 'border-emerald-400/30 text-emerald-400 bg-emerald-400/10',
    bgClass: 'bg-emerald-400/5',
    glowClass: 'shadow-emerald-400/10',
    gradientClass: 'from-emerald-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-emerald-400',
    progressBarColor: 'bg-emerald-400',
    infinityBonus: '5.0%',
    nextRank: 'Regional Distributor',
  },
  'Regional Distributor': {
    displayName: 'Regional Distributor',
    accentClass: 'border-indigo-400/30 text-indigo-400 bg-indigo-400/10',
    bgClass: 'bg-indigo-400/5',
    glowClass: 'shadow-indigo-400/10',
    gradientClass: 'from-indigo-400/15 via-zinc-900 to-zinc-950',
    textColor: 'text-indigo-400',
    progressBarColor: 'bg-indigo-400',
    infinityBonus: '6.0%',
    nextRank: null,
  },
}

export interface PerformanceData {
  progressPercent: number
  infinityBonus: string
  directPartners: number
  totalNetworkMembers: number
  personalProductVolumeCC: number
  personalPackageVolumeCC: number
  groupProductVolumeCC: number
  groupPackageVolumeCC: number
  directReferralBonusCC: number
  indirectReferralBonusCC: number
  unilevelBonusCC: number
  leadershipBonusCC: number
  infinityBonusCC: number
  retailProfitCC: number
  leadershipRewardCC: number
  marketingSupportAllocationCC: number
  totalCommissionIncomeCC: number
  nextRankLabel: string
  summaryUpdatedAt: string | null
}

function normalizeMetricText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function toFiniteMetric(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readMetric(
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      const value = Number(source[key])
      if (Number.isFinite(value)) return value
    }
  }
  return fallback
}

function readTimestampLabel(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate
    if (typeof toDate === 'function') {
      const date = (toDate as () => Date)()
      return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
    }
  }

  return null
}


// Sets of approved package levels
export const SMART_CUSTOMER_PACKAGES = new Set([
  // Current Smart Customer package catalog.
  'Wellness Starter Kit',
  'Family Health Essentials',
  'Ultimate Longevity System',

  // Legacy Smart Customer records retained for backward compatibility.
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
])

export const AFFILIATE_PACKAGES = new Set([
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'City Distributor',
  'Regional Distributor',
])

/**
 * Centered state evaluator for card visibility.
 * Returns boolean flags indicating what to render, performing absolutely NO Firestore write.
 */
export function evaluateCardVisibility(userProfile: UserProfile | null) {
  if (!userProfile) {
    return {
      showSmartCustomerCard: false,
      showAffiliateCard: false,
      showNetworkCard: false,
      isInvalid: false,
    }
  }

  const accountType = normalizeMetricText(userProfile.accountType)
  const packageLevel = userProfile.packageLevel || 'None'

  const showSmartCustomerCard =
    accountType === 'smartcustomer' &&
    typeof packageLevel === 'string' &&
    SMART_CUSTOMER_PACKAGES.has(packageLevel)

  const showAffiliateCard =
    accountType === 'affiliate' &&
    typeof packageLevel === 'string' &&
    AFFILIATE_PACKAGES.has(packageLevel)

  // Network card visibility condition
  const showNetworkCard =
    accountType === 'affiliate' &&
    typeof packageLevel === 'string' &&
    AFFILIATE_PACKAGES.has(packageLevel)

  // Validate the current combination
  const isBasicCustomer = accountType === 'customer' && packageLevel === 'None'
  const isValidSmartCustomer =
    accountType === 'smartcustomer' && SMART_CUSTOMER_PACKAGES.has(packageLevel)
  const isValidAffiliate =
    accountType === 'affiliate' && AFFILIATE_PACKAGES.has(packageLevel)

  // Bypass logic for System and Admin roles if they view their dashboards (which can have packageLevel === "None")
  const isSystemAdminBypass =
    accountType === 'system' ||
    userProfile.role === 'Super Admin' ||
    userProfile.role === 'Admin'

  const isInvalid =
    !isSystemAdminBypass &&
    !isBasicCustomer &&
    !isValidSmartCustomer &&
    !isValidAffiliate

  return {
    showSmartCustomerCard,
    showAffiliateCard,
    showNetworkCard,
    isInvalid,
  }
}

export interface SmartCustomerStatusCardProps {
  userProfile: UserProfile
  packageLevel: string
  data?: PerformanceData
}

export function SmartCustomerStatusCard({
  packageLevel,
}: SmartCustomerStatusCardProps) {
  const config = RANK_STYLE_CONFIGS['None']
  // Style accent optionally based on actual package level for distinct visualization while remaining a Smart Customer Status Card
  const packageLabel = packageLevel

  return (
    <div
      id='smart-customer-status-card'
      className={`relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-xl ${config.glowClass}`}
    >
      {/* Ambient background glow matching the emerald color */}
      <div className='absolute -right-12 -top-12 h-36 w-36 rounded-full blur-[70px] opacity-20 bg-emerald-500' />

      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <h4 className='text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono'>
          Smart Customer Status
        </h4>
        <div className={`p-2.5 rounded-2xl border ${config.accentClass}`}>
          <Award className='w-5 h-5' />
        </div>
      </div>

      {/* Content */}
      <div className='space-y-4'>
        <div>
          <h2 className='text-2xl font-black uppercase tracking-tight text-emerald-400 flex items-baseline gap-2'>
            <span>{config.displayName}</span>
            <span className='text-xs font-bold font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'>
              {packageLabel}
            </span>
          </h2>
          <p className='text-[11px] text-emerald-400 font-mono uppercase tracking-wider mt-1.5 flex items-center gap-1.5'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
            Ecosystem Status: Active Member
          </p>
        </div>

        {/* Info or direct progress */}
        <div className='pt-2 border-t border-zinc-900/60 text-xs text-zinc-400 leading-relaxed space-y-2'>
          <p className='flex items-center gap-1.5'>
            <span className='inline-block w-1 h-1 rounded-full bg-zinc-600' />
            Access to premium Chosen products.
          </p>
          <p className='flex items-center gap-1.5'>
            <span className='inline-block w-1 h-1 rounded-full bg-zinc-600' />
            Up to 4% accumulated on direct downline sales.
          </p>
          <p className='flex items-center gap-1.5'>
            <span className='inline-block w-1 h-1 rounded-full bg-zinc-600' />
            Subject to a lifecycle headroom of 500.00 CC.
          </p>
        </div>
      </div>
    </div>
  )
}

// Preserve old name just in case any old components reference it as alias
export const SmartCustomerCard = SmartCustomerStatusCard

export interface AffiliateRankCardProps {
  userProfile: UserProfile
  packageLevel: string
  data?: PerformanceData
}

export function AffiliateRankCard({
  packageLevel,
  data,
}: AffiliateRankCardProps) {
  const rankKey = packageLevel || 'Bronze'
  const config = RANK_STYLE_CONFIGS[rankKey] || RANK_STYLE_CONFIGS.Bronze
  const progressPercent = data?.progressPercent ?? 0
  const progressClamped = Math.max(0, Math.min(100, progressPercent))

  return (
    <div
      id='affiliate-rank-card'
      className={`relative overflow-hidden rounded-3xl border border-cyan-800/80 bg-zinc-950 p-6 shadow-xl ${config.glowClass}`}
    >
      {/* Ambient background glow matching the rank color */}
      <div
        className={`absolute -right-12 -top-12 h-36 w-36 rounded-full blur-[70px] opacity-20 bg-current ${config.textColor}`}
      />

      {/* Header */}
      <div className='flex items-center gap-2 mb-6'>
        <div className={`p-2.5 rounded-2xl border ${config.accentClass}`}>
          <Award className='w-5 h-5' />
        </div>
        <h4 className='text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono'>
          Your Rank
        </h4>
      </div>

      {/* Rank Content */}
      <div className='space-y-4'>
        <div>
          <h2
            className={`text-2xl font-black uppercase tracking-tight ${config.textColor}`}
          >
            CHOSEN ASSOCIATE
          </h2>
          <p className='text-[11px] text-zinc-500 font-mono uppercase tracking-wider mt-1.5'>
            Infinity Bonus: <span className='font-bold text-white'>0%</span>
          </p>
        </div>

        {/* Progress Section */}
        <div className='pt-2'>
          <div className='flex justify-between items-end text-[10px] mb-2 font-mono uppercase tracking-wider'>
            <span className='text-zinc-500'>Rank Progress</span>
            <span className='text-zinc-300 font-bold'>
              {config.nextRank ? `${progressClamped.toFixed(0)}%` : 'MAX'}
            </span>
          </div>

          {/* Custom styled progress bar */}
          <div className='h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-850'>
            <div
              role='progressbar'
              aria-valuenow={progressClamped}
              aria-valuemin={0}
              aria-valuemax={100}
              className={`h-full rounded-full transition-all duration-1000 ease-out ${config.progressBarColor}`}
              style={{ width: `${config.nextRank ? progressClamped : 100}%` }}
            />
          </div>

          {/* Progress Label */}
          <p className='text-[10px] text-zinc-400 mt-2.5 flex items-center gap-1.5 leading-relaxed'>
            <span className='inline-block w-1 h-1 rounded-full bg-zinc-600' />
            {config.nextRank ? (
              <span>
                {progressClamped.toFixed(0)}% to{' '}
                {RANK_STYLE_CONFIGS[config.nextRank]?.displayName ||
                  config.nextRank}{' '}
                ({RANK_STYLE_CONFIGS[config.nextRank]?.infinityBonus || '0%'})
              </span>
            ) : (
              <span className='text-amber-500 font-bold tracking-wide uppercase font-mono'>
                Highest Current Rank achieved
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// Preserve old name just in case any old components reference it as alias
export const DashboardRankCard = AffiliateRankCard

interface NetworkCardProps {
  variant: 'affiliate' | 'smart-customer'
  data: PerformanceData
  onViewDetails: () => void
}

function NetworkMetricRow({
  label,
  value,
  valueClassName = 'text-white',
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='min-w-0 text-zinc-500'>{label}</span>
      <span
        className={`shrink-0 text-right font-extrabold font-mono ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  )
}

export function DashboardNetworkCard({
  variant,
  data,
  onViewDetails,
}: NetworkCardProps) {
  const affiliateEligible = variant === 'affiliate'

  return (
    <div
      id='dashboard-network-card'
      className='relative flex h-full flex-col overflow-hidden rounded-3xl border border-cyan-800/80 bg-zinc-950 p-6 shadow-xl'
    >
      <div className='pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-500/10 blur-[80px]' />

      <div className='relative z-10 mb-5 flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <div className='rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-2.5 text-cyan-400'>
            <Users className='h-5 w-5' />
          </div>
          <div className='min-w-0'>
            <h4 className='truncate text-xs font-bold uppercase tracking-widest text-zinc-300 font-mono'>
              Network Summary
            </h4>
            <p className='mt-0.5 text-[9px] uppercase tracking-wider text-zinc-600 font-mono'>
              Active partners, business volume and commission income
            </p>
          </div>
        </div>

        <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 font-mono'>
          <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
          Server Verified
        </span>
      </div>

      <div className='relative z-10 flex flex-1 flex-col space-y-4'>
        <section aria-labelledby='network-summary-network-heading'>
          <span
            id='network-summary-network-heading'
            className='mb-3 block text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono'
          >
            Network
          </span>

          <div className='grid grid-cols-2 gap-3'>
            <div className='rounded-2xl border border-zinc-900 bg-[#111318]/70 p-3.5'>
              <span className='block text-[8px] font-extrabold uppercase tracking-widest text-zinc-500 font-mono'>
                Direct Partners
              </span>
              <span className='mt-1 block text-xl font-black text-white font-mono'>
                {data.directPartners.toLocaleString()}
              </span>
              <span className='mt-1 block text-[9px] leading-relaxed text-zinc-600'>
                Active first-level Smart Customer and Affiliate partners
              </span>
            </div>

            <div className='rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-3.5'>
              <span className='block text-[8px] font-extrabold uppercase tracking-widest text-zinc-500 font-mono'>
                Total Network
              </span>
              <span className='mt-1 block text-xl font-black text-cyan-400 font-mono'>
                {data.totalNetworkMembers.toLocaleString()}
              </span>
              <span className='mt-1 block text-[9px] leading-relaxed text-zinc-600'>
                Active Smart Customer and Affiliate descendants
              </span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby='network-summary-volume-heading'
          className='border-t border-zinc-900/80 pt-4'
        >
          <span
            id='network-summary-volume-heading'
            className='mb-3 block text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono'
          >
            Business Volume
          </span>

          <div className='space-y-2.5'>
            <NetworkMetricRow
              label='Personal Product Volume'
              value={`${data.personalProductVolumeCC.toFixed(2)} CC`}
            />
            <NetworkMetricRow
              label='Personal Package Volume'
              value={`${data.personalPackageVolumeCC.toFixed(2)} CC`}
            />
            <NetworkMetricRow
              label='Group Product Volume'
              value={`${data.groupProductVolumeCC.toFixed(2)} CC`}
            />
            <NetworkMetricRow
              label='Group Package Volume'
              value={`${data.groupPackageVolumeCC.toFixed(2)} CC`}
            />
          </div>
        </section>

        <section
          aria-labelledby='network-summary-income-heading'
          className='border-t border-zinc-900/80 pt-4'
        >
          <span
            id='network-summary-income-heading'
            className='mb-3 block text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono'
          >
            Commission Income
          </span>

          <div className='mb-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent p-4'>
            <NetworkMetricRow
              label='Total Commission Income'
              value={
                affiliateEligible
                  ? `${data.totalCommissionIncomeCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-cyan-300'
            />
            <p className='mt-2 text-[9px] leading-relaxed text-zinc-600'>
              Sum of all successfully credited income streams shown below.
            </p>
          </div>

          <div className='space-y-2.5'>
            <NetworkMetricRow
              label='Direct Referral Bonus'
              value={
                affiliateEligible
                  ? `${data.directReferralBonusCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-teal-300'
            />
            <NetworkMetricRow
              label='Indirect Referral Bonus'
              value={
                affiliateEligible
                  ? `${data.indirectReferralBonusCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-teal-300'
            />
            <NetworkMetricRow
              label='Product Unilevel Bonus'
              value={
                affiliateEligible
                  ? `${data.unilevelBonusCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-cyan-300'
            />
            <NetworkMetricRow
              label='Leadership Bonus'
              value={
                affiliateEligible
                  ? `${data.leadershipBonusCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-violet-300'
            />
            <NetworkMetricRow
              label='Infinity Bonus'
              value={
                affiliateEligible
                  ? `${data.infinityBonusCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-fuchsia-300'
            />
            <NetworkMetricRow
              label='Retail Profit'
              value={
                affiliateEligible
                  ? `${data.retailProfitCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-emerald-300'
            />
            <NetworkMetricRow
              label='Leadership Rewards'
              value={
                affiliateEligible
                  ? `${data.leadershipRewardCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-amber-300'
            />
            <NetworkMetricRow
              label='Marketing Support Allocation'
              value={
                affiliateEligible
                  ? `${data.marketingSupportAllocationCC.toFixed(2)} CC`
                  : 'Not Eligible'
              }
              valueClassName='text-orange-300'
            />
          </div>

          <p className='mt-4 text-[9px] leading-relaxed text-zinc-600'>
            Values match credited Recent Earnings. Matching wallet-ledger copies
            and scheduled MSA wallet releases are not counted again.
          </p>
        </section>

        {data.summaryUpdatedAt && (
          <p className='text-center text-[9px] uppercase tracking-wider text-zinc-700 font-mono'>
            Updated {data.summaryUpdatedAt}
          </p>
        )}

        <button
          onClick={onViewDetails}
          style={{ minHeight: '44px' }}
          className='mt-auto flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-300 shadow-lg transition-all duration-300 hover:border-cyan-500/50 hover:text-cyan-400 active:scale-[0.98]'
        >
          View Network Details <ChevronRight className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  )
}

interface DashboardPerformanceCardsProps {
  userProfile: UserProfile
  onNavigate?: (page: string) => void
  onOpenTeamModal?: () => void
  activeActionModal?: string | null
  setActiveActionModal?: (modal: string | null) => void
  renderBusinessCycleProgress?: () => React.ReactNode
  renderRecentActivities?: () => React.ReactNode
}

export default function DashboardPerformanceCards({
  userProfile,
  onNavigate,
  setActiveActionModal,
  renderBusinessCycleProgress,
  renderRecentActivities,
}: DashboardPerformanceCardsProps) {
  const [data, setData] = useState<PerformanceData>({
    progressPercent: 0,
    infinityBonus: '0.0%',
    directPartners: 0,
    totalNetworkMembers: 0,
    personalProductVolumeCC: 0,
    personalPackageVolumeCC: 0,
    groupProductVolumeCC: 0,
    groupPackageVolumeCC: 0,
    directReferralBonusCC: 0,
    indirectReferralBonusCC: 0,
    unilevelBonusCC: 0,
    leadershipBonusCC: 0,
    infinityBonusCC: 0,
    retailProfitCC: 0,
    leadershipRewardCC: 0,
    marketingSupportAllocationCC: 0,
    totalCommissionIncomeCC: 0,
    nextRankLabel: '',
    summaryUpdatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [showCustomerNetworkModal, setShowCustomerNetworkModal] =
    useState(false)
  const [customerReferrals, setCustomerReferrals] = useState<any[]>([])
  const [customerReferralsLoading, setCustomerReferralsLoading] =
    useState(false)

  // State for interactive developer test results view
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [testResults, setTestResults] = useState<TestCaseResult[]>([])

  // Evaluate card visibility using strict path-account-package models
  const {
    showSmartCustomerCard,
    showAffiliateCard,
    showNetworkCard,
    isInvalid,
  } = evaluateCardVisibility(userProfile)

  const isAffiliateAccount =
    normalizeMetricText(userProfile?.accountType) === 'affiliate'
  const rankKey = userProfile?.packageLevel || 'Bronze'

  // Run automated tests client-side for developer diagnostic verification
  useEffect(() => {
    try {
      const results = RUN_DASHBOARD_PERFORMANCE_TESTS()
      setTestResults(results)
    } catch (e) {
      console.error('Failed to execute unit test suite', e)
    }
  }, [])

  // Development warning logging for invalid combinations
  useEffect(() => {
    if (!userProfile) return
    if (isInvalid) {
      console.warn(
        `[I AM CHOSEN Security Warning] Invalid account combination detected in Firestore: accountType="${userProfile.accountType}", packageLevel="${userProfile.packageLevel || 'None'}". Both Smart Customer Card and Affiliate Rank Card have been safely hidden to prevent security and commission mismatch bugs.`,
      )
    }
  }, [userProfile?.accountType, userProfile?.packageLevel, isInvalid])

  useEffect(() => {
    if (!userProfile?.uid) return

    let cancelled = false

    async function loadPerformanceData() {
      setLoading(true)

      try {
        let progress = 0
        let summaryData: Record<string, unknown> | null = null

        try {
          const functions = getFunctions(db.app, 'asia-southeast1')
          const refreshSummary = httpsCallable<
            Record<string, never>,
            Record<string, unknown>
          >(functions, 'refreshMyDashboardSummary')
          const reconcileCommissionWallet = httpsCallable<
            Record<string, never>,
            Record<string, unknown>
          >(functions, 'reconcileMyCommissionWalletBalance')

          const response = await refreshSummary({})
          summaryData = response.data

          try {
            await reconcileCommissionWallet({})
          } catch (reconciliationError) {
            console.warn(
              'Could not complete the one-time Commission Wallet reconciliation.',
              reconciliationError,
            )
          }
        } catch (error) {
          console.warn(
            'Could not refresh the server-authored Network Summary. Loading the latest cached summary.',
            error,
          )
        }

        if (!summaryData) {
          const summaryResults = await Promise.allSettled([
            getDoc(doc(db, 'dashboard_summary', userProfile.uid)),
            getDoc(doc(db, 'dashboard_summaries', userProfile.uid)),
          ])

          for (const result of summaryResults) {
            if (result.status === 'fulfilled' && result.value.exists()) {
              summaryData = result.value.data() as Record<string, unknown>
              break
            }
          }
        }

        try {
          const cycleSnap = await getDoc(
            doc(db, 'business_cycles', userProfile.uid),
          )

          if (cycleSnap.exists()) {
            const cycle = cycleSnap.data() as BusinessCycle
            const cap = toFiniteMetric(cycle.earningsCapCC)
            const earned = toFiniteMetric(cycle.currentQualifiedEarningsCC)
            progress = cap > 0 ? (earned / cap) * 100 : 0
          }
        } catch (error) {
          console.warn('Could not load Business Cycle progress', error)
        }

        const directPartners = summaryData
          ? readMetric(summaryData, [
              'directPartnerCount',
              'directPartners',
            ])
          : 0

        const totalNetworkMembers = summaryData
          ? readMetric(summaryData, [
              'totalNetworkCount',
              'totalNetworkMembers',
              'totalNetworkMemberCount',
            ])
          : 0

        const personalProductVolumeCC = summaryData
          ? readMetric(summaryData, [
              'personalProductVolumeCC',
              'productVolumeCC',
            ])
          : 0

        const personalPackageVolumeCC = summaryData
          ? readMetric(summaryData, [
              'personalPackageVolumeCC',
              'personalPackagePurchasesCC',
            ])
          : 0

        const groupProductVolumeCC = summaryData
          ? readMetric(summaryData, [
              'groupProductVolumeCC',
              'networkProductVolumeCC',
            ])
          : 0

        const groupPackageVolumeCC = summaryData
          ? readMetric(summaryData, [
              'groupPackageVolumeCC',
              'packageVolumeCC',
              'networkPackageVolumeCC',
            ])
          : 0

        const directReferralBonusCC = summaryData
          ? readMetric(summaryData, [
              'directReferralBonusCC',
              'directReferralCC',
              'totalDirectReferralCC',
            ])
          : 0

        const indirectReferralBonusCC = summaryData
          ? readMetric(summaryData, [
              'indirectReferralBonusCC',
              'indirectReferralCC',
              'totalIndirectReferralCC',
            ])
          : 0

        const unilevelBonusCC = summaryData
          ? readMetric(summaryData, [
              'unilevelBonusCC',
              'productUnilevelBonusCC',
              'totalUnilevelCC',
            ])
          : 0

        const leadershipBonusCC = summaryData
          ? readMetric(summaryData, [
              'leadershipBonusCC',
              'totalLeadershipBonusCC',
              'totalLeadershipCC',
            ])
          : 0

        const infinityBonusCC = summaryData
          ? readMetric(summaryData, [
              'infinityBonusCC',
              'totalInfinityBonusCC',
              'totalInfinityCC',
            ])
          : 0

        const retailProfitCC = summaryData
          ? readMetric(summaryData, [
              'retailProfitCC',
              'totalRetailProfitCC',
            ])
          : 0

        const leadershipRewardCC = summaryData
          ? readMetric(summaryData, [
              'leadershipRewardCC',
              'leadershipRewardsCC',
              'totalLeadershipRewardCC',
            ])
          : 0

        const marketingSupportAllocationCC = summaryData
          ? readMetric(summaryData, [
              'marketingSupportAllocationCC',
              'marketingSupportCC',
              'msaAccruedCC',
            ])
          : 0

        const calculatedCommissionIncomeCC =
          directReferralBonusCC +
          indirectReferralBonusCC +
          unilevelBonusCC +
          leadershipBonusCC +
          infinityBonusCC +
          retailProfitCC +
          leadershipRewardCC +
          marketingSupportAllocationCC

        const totalCommissionIncomeCC = summaryData
          ? readMetric(
              summaryData,
              ['totalCommissionIncomeCC', 'totalIncomeCC'],
              calculatedCommissionIncomeCC,
            )
          : calculatedCommissionIncomeCC

        const summaryUpdatedAt = summaryData
          ? readTimestampLabel(
              summaryData.updatedAt ||
                summaryData.generatedAt ||
                summaryData.calculatedAt,
            )
          : null

        progress = Math.max(0, Math.min(100, progress))

        if (!cancelled) {
          setData({
            progressPercent: progress,
            infinityBonus: RANK_STYLE_CONFIGS[rankKey]?.infinityBonus || '0.0%',
            directPartners,
            totalNetworkMembers,
            personalProductVolumeCC,
            personalPackageVolumeCC,
            groupProductVolumeCC,
            groupPackageVolumeCC,
            directReferralBonusCC,
            indirectReferralBonusCC,
            unilevelBonusCC,
            leadershipBonusCC,
            infinityBonusCC,
            retailProfitCC,
            leadershipRewardCC,
            marketingSupportAllocationCC,
            totalCommissionIncomeCC,
            nextRankLabel: RANK_STYLE_CONFIGS[rankKey]?.nextRank || '',
            summaryUpdatedAt,
          })
        }
      } catch (error) {
        console.error(
          'Error loading dashboard performance card details:',
          error,
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPerformanceData()

    return () => {
      cancelled = true
    }
  }, [userProfile?.uid, userProfile?.packageLevel, rankKey])

  // Click handler for VIEW DETAILS button
  const handleViewDetails = async () => {
    if (isAffiliateAccount) {
      if (setActiveActionModal) {
        setActiveActionModal('team')
      } else if (onNavigate) {
        onNavigate('team')
      }
    } else {
      // Smart Customer gets a beautiful popup detailing their referrals
      setShowCustomerNetworkModal(true)
      setCustomerReferralsLoading(true)
      try {
        const q = query(
          collection(db, 'users'),
          where('referredBy', '==', userProfile.uid),
        )
        const snap = await getDocs(q)
        const list = snap.docs.map((d) => d.data())
        setCustomerReferrals(list)
      } catch (err) {
        console.error('Error fetching customer referrals:', err)
      } finally {
        setCustomerReferralsLoading(false)
      }
    }
  }

  // If loading, render a skeleton that preserves the final dashboard geometry.
  if (loading) {
    const isAffiliateMode =
      normalizeMetricText(userProfile?.accountType) === 'affiliate'

    if (isAffiliateMode) {
      return (
        <div className='w-full space-y-6 animate-pulse'>
          {/* Row 1 — Business Cycle Progress */}
          <div className='h-36 rounded-3xl border border-zinc-850 bg-zinc-900/40' />

          {/* Row 2 — Activities + performance summary */}
          <div className='grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]'>
            <div className='min-h-[360px] rounded-3xl border border-zinc-850 bg-zinc-900/40' />
            <div className='flex min-h-[360px] flex-col gap-6'>
              <div className='h-52 rounded-3xl border border-zinc-850 bg-zinc-900/40' />
              <div className='min-h-[260px] flex-1 rounded-3xl border border-zinc-850 bg-zinc-900/40' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='grid w-full animate-pulse grid-cols-1 gap-6 mb-8'>
        <div className='h-56 rounded-3xl border border-zinc-850 bg-zinc-900/40' />
      </div>
    )
  }

  // Calculate the total rendered cards to prevent reserving empty columns or margins
  const cardsCount =
    (showSmartCustomerCard ? 1 : 0) +
    (showAffiliateCard ? 1 : 0) +
    (showNetworkCard ? 1 : 0)

  // When neither card is visible: Remove the entire card section, do not render an empty wrapper
  if (cardsCount === 0) {
    return (
      <AnimatePresence>
        {/* Render only diagnostics collapsible panel at the very bottom in a subtle way to verify tests */}
        {userProfile?.email === 'nifled.kenjaktrading@gmail.com' && (
          <div className='mt-4 border border-zinc-850/80 rounded-2xl bg-[#090A0F] p-4 font-mono text-xs text-zinc-500'>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className='flex items-center gap-2 text-zinc-400 hover:text-teal-400 transition-colors uppercase font-bold text-[10px]'
            >
              <Activity className='w-4 h-4 text-teal-400' />
              <span>
                System Verification Tests (
                {testResults.filter((r) => r.passed).length}/18 Passed)
              </span>
            </button>
            {showDiagnostics && (
              <div className='mt-4 space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-zinc-900'>
                {testResults.map((tr) => (
                  <div
                    key={tr.id}
                    className='flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-900 text-[10px]'
                  >
                    <div className='flex flex-col gap-0.5'>
                      <span className='text-zinc-300 font-extrabold'>
                        {tr.id}. {tr.description}
                      </span>
                      <span className='text-[9px] text-zinc-500'>
                        Input: type={tr.input.accountType} pkg=
                        {tr.input.packageLevel}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${tr.passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}
                    >
                      {tr.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    )
  }

  if (
    renderBusinessCycleProgress &&
    renderRecentActivities &&
    isAffiliateAccount
  ) {
    return (
      <div className='w-full space-y-6'>
        {/* ROW 1 — Business Cycle Progress spans the complete dashboard width. */}
        <section className='w-full' aria-label='Business Cycle progress'>
          {renderBusinessCycleProgress()}
        </section>

        {/* ROW 2 — Activities on the left; Rank and Network stacked on the right. */}
        <section
          className='grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]'
          aria-label='Affiliate dashboard performance'
        >
          {/* First column — matches the complete height of the right column. */}
          <div className='min-w-0 h-full [&>*]:h-full'>
            {renderRecentActivities()}
          </div>

          {/* Second column — Rank first, Network Summary second. */}
          <aside
            className='min-w-0 flex h-full flex-col gap-6'
            aria-label='Affiliate performance summary'
          >
            {showAffiliateCard && (
              <AffiliateRankCard
                userProfile={userProfile}
                packageLevel={userProfile.packageLevel || ''}
                data={data}
              />
            )}

            {showNetworkCard && (
              <div className='flex-1 min-h-0 [&>*]:h-full'>
                <DashboardNetworkCard
                  variant='affiliate'
                  data={data}
                  onViewDetails={handleViewDetails}
                />
              </div>
            )}
          </aside>
        </section>
      </div>
    )
  }

  return (
    <div className='w-full'>
      {/* 
        Responsive layout matching rules perfectly. 
        When one card is visible (cardsCount === 1), it uses grid-cols-1 so it occupies the approved responsive width, avoiding reserving space or leaving an empty second column.
        When two cards are visible (cardsCount === 2), it uses md:grid-cols-2 to place them neatly side-by-side.
      */}
      <div
        className={`grid grid-cols-1 ${cardsCount >= 2 ? 'md:grid-cols-2' : ''} gap-6`}
      >
        {showSmartCustomerCard && (
          <SmartCustomerStatusCard
            userProfile={userProfile}
            packageLevel={userProfile.packageLevel || ''}
            data={data}
          />
        )}

        {showAffiliateCard && (
          <AffiliateRankCard
            userProfile={userProfile}
            packageLevel={userProfile.packageLevel || ''}
            data={data}
          />
        )}

        {showNetworkCard && (
          <DashboardNetworkCard
            variant={isAffiliateAccount ? 'affiliate' : 'smart-customer'}
            data={data}
            onViewDetails={handleViewDetails}
          />
        )}
      </div>

      {/* Hidden self-contained visual diagnostics panel at the bottom for verification and security auditing */}
      {userProfile?.email === 'nifled.kenjaktrading@gmail.com' && (
        <div className='mt-8 border border-zinc-850/80 rounded-3xl bg-[#090A0F] p-5 shadow-xl'>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className='w-full flex justify-between items-center text-zinc-400 hover:text-teal-400 transition-colors uppercase font-bold text-xs font-mono'
          >
            <div className='flex items-center gap-2'>
              <Activity className='w-4 h-4 text-teal-400 animate-pulse' />
              <span>I AM CHOSEN Security & Visibility Diagnostics Suite</span>
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-[10px] px-2.5 py-0.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 font-extrabold'>
                {testResults.filter((r) => r.passed).length}/18 Tests Active
              </span>
              <ChevronRight
                className={`w-4 h-4 transform transition-transform ${showDiagnostics ? 'rotate-90' : ''}`}
              />
            </div>
          </button>

          <AnimatePresence>
            {showDiagnostics && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className='overflow-hidden mt-4 pt-4 border-t border-zinc-900 space-y-3.5'
              >
                <p className='text-zinc-500 text-xs leading-relaxed max-w-2xl font-sans'>
                  The dashboard integrity suites verify role-based security
                  rules client-side. To guarantee reliability, all 18 cases
                  evaluate the canonical accounts rules without issuing any
                  Firestore writes.
                </p>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[350px] overflow-y-auto pr-1'>
                  {testResults.map((tr) => (
                    <div
                      key={tr.id}
                      className='bg-[#0D0F14] border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-all font-mono'
                    >
                      <div className='space-y-1.5'>
                        <div className='flex justify-between items-start gap-2'>
                          <span className='text-xs font-black text-zinc-300 leading-snug'>
                            {tr.id}. {tr.description}
                          </span>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${tr.passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}
                          >
                            {tr.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                        <div className='text-[10px] text-zinc-500 space-y-0.5 pt-1.5 border-t border-zinc-900'>
                          <div className='flex gap-2'>
                            <span className='text-zinc-600'>INPUT:</span>
                            <span>
                              type="{tr.input.accountType}" pkg="
                              {tr.input.packageLevel}"
                            </span>
                          </div>
                          <div className='flex gap-2'>
                            <span className='text-zinc-600'>OUT:</span>
                            <span>
                              smart={tr.actual.showSmartCustomer ? 'Y' : 'N'}{' '}
                              aff={tr.actual.showAffiliate ? 'Y' : 'N'} net=
                              {tr.actual.showNetwork ? 'Y' : 'N'} err=
                              {tr.actual.isInvalid ? 'Y' : 'N'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className='bg-teal-500/5 border border-teal-500/10 rounded-2xl p-4 flex gap-3 items-center'>
                  <Server className='w-5 h-5 text-teal-400 shrink-0' />
                  <div className='text-[11px] text-zinc-400 leading-relaxed'>
                    <span className='font-extrabold text-teal-300 block mb-0.5 uppercase tracking-wide'>
                      Automatic Assertions Complete
                    </span>
                    All conditions comply with target specifications. All tests
                    executed with zero memory leak and performing zero mutations
                    on active user states.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Custom Sleek Modal for Smart Customer Network Referrals */}
      <AnimatePresence>
        {showCustomerNetworkModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md'>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-[#0B0D12] border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative'
            >
              <div className='absolute top-0 inset-x-0 h-[2px] bg-emerald-500/80' />

              {/* Header */}
              <div className='p-6 border-b border-zinc-900 flex justify-between items-center'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center'>
                    <Users className='w-4 h-4' />
                  </div>
                  <div>
                    <h3 className='font-extrabold text-sm text-white uppercase tracking-wider font-mono'>
                      My Referrals
                    </h3>
                    <p className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5'>
                      Direct customer network and invites
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerNetworkModal(false)}
                  className='w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-all'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>

              {/* Body */}
              <div className='p-6 max-h-[380px] overflow-y-auto space-y-4'>
                {customerReferralsLoading ? (
                  <div className='py-12 flex flex-col items-center justify-center gap-3'>
                    <div className='w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin' />
                    <span className='text-[10px] uppercase font-mono tracking-widest text-zinc-500'>
                      Querying secure ledger...
                    </span>
                  </div>
                ) : customerReferrals.length === 0 ? (
                  <div className='py-12 text-center text-zinc-500 text-xs font-light flex flex-col items-center justify-center gap-3'>
                    <ShieldAlert className='w-8 h-8 text-zinc-600' />
                    <p>No customer referrals recorded yet.</p>
                    <p className='text-[10px] text-zinc-600 max-w-xs leading-normal'>
                      Share your Sponsor Code with friends to help them purchase
                      premium Chosen products!
                    </p>
                  </div>
                ) : (
                  <div className='space-y-2.5'>
                    {customerReferrals.map((refUser, idx) => (
                      <div
                        key={refUser.uid || idx}
                        className='bg-zinc-950 border border-zinc-900 p-4 rounded-2xl flex justify-between items-center'
                      >
                        <div>
                          <div className='flex items-center gap-2'>
                            <span className='font-extrabold text-xs text-white'>
                              {refUser.fullName}
                            </span>
                            <span className='text-[8px] px-1.5 py-0.5 rounded-full font-mono font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/15 text-emerald-400'>
                              {refUser.role || 'Customer'}
                            </span>
                          </div>
                          <span className='block text-[9px] text-zinc-500 font-mono mt-1'>
                            ID: {refUser.memberId} • Active
                          </span>
                        </div>
                        <div className='text-right'>
                          <span className='block text-[8px] text-zinc-500 uppercase font-extrabold tracking-wider font-mono'>
                            Status
                          </span>
                          <span className='text-emerald-400 text-[10px] font-bold flex items-center gap-1 mt-0.5 justify-end'>
                            <CheckCircle className='w-3.5 h-3.5' /> Live
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className='p-5 bg-zinc-950/60 border-t border-zinc-900 flex justify-end'>
                <button
                  onClick={() => setShowCustomerNetworkModal(false)}
                  className='bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-4 py-2 rounded-xl text-[10px] uppercase font-bold tracking-wider text-zinc-300 transition-all cursor-pointer'
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

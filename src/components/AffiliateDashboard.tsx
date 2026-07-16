import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Wallet as WalletIcon,
  Award,
  RefreshCw,
  TrendingUp,
  User,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Clock,
  LogOut,
  Send,
  DollarSign,
  Sparkles,
  Copy,
  Share2,
  Home as HomeIcon,
  Bell,
  Globe,
  CheckCircle,
  ChevronRight,
  QrCode,
  MessageSquare,
  ArrowRightLeft,
  Users,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp,
  Activity,
  ShoppingBag,
  Ticket,
  ShieldAlert,
  BanknoteArrowDown,
  ChartCandlestick,
  ChartNoAxesCombined,
} from 'lucide-react'
import { db } from '../firebase'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import {
  UserProfile,
  Wallet as WalletType,
  BusinessCycle,
  Notification,
} from '../types'
import { NotificationService } from '../services/notification/notification.service'
import ChosenLogo from './ChosenLogo'
import BottomNavigation, { CustomerTabType } from './customer/BottomNavigation'
import { useCCSettings } from '../context/CCSettingsContext'
import { WalletService } from '../services/wallet/wallet.service'
import { PackageService } from '../services/package/package.service'
import { CommissionService } from '../services/commission/commission.service'
import { AIService } from '../services/ai/ai.service'
import DashboardPerformanceCards from './dashboard/performance/DashboardPerformanceCards'
import { AffiliateGrowthToolsSection } from './AffiliateGrowthTools'
import ChosenWalletCard from './wallet/ChosenWalletCard'
import MemberWelcomeBanner from './member/MemberWelcomeBanner'
import MyDigitalWallet from './wallet/MyDigitalWallet'
import RecentActivityCard from './customer/RecentActivityCard'

type PackageActivationAction =
  | 'INITIAL_ACTIVATION'
  | 'PACKAGE_UPGRADE'
  | 'BUSINESS_CYCLE_REACTIVATION'

interface ActivatePackageRequest {
  packageId: string
  accountPath: 'Affiliate' | 'Smart Customer'
  activationAction: PackageActivationAction
  idempotencyKey: string
}

interface ActivatePackageResponse {
  success?: boolean
  message?: string
  activationEventId?: string
  packageTransactionId?: string
  businessCycleId?: string
  msaEntitlementId?: string
  packageLevel?: string
  walletDebitedCC?: number
  walletBalanceAfterCC?: number
  directReferralTotalCC?: number
  indirectReferralTotalCC?: number
  leadershipFromReferralTotalCC?: number
  compensationStatus?: string
  overallStatus?: string
  idempotentReplay?: boolean
}

const packageFunctions = getFunctions(getApp(), 'asia-southeast1')
const activatePackageWithWallet = httpsCallable<
  ActivatePackageRequest,
  ActivatePackageResponse
>(packageFunctions, 'activatePackageWithWallet')

const createPackageIdempotencyKey = (
  uid: string,
  action: PackageActivationAction,
  packageId: string,
): { storageKey: string; idempotencyKey: string } => {
  const storageKey = `iamchosen:package-activation:${uid}:${action}:${packageId}`
  const existing = sessionStorage.getItem(storageKey)

  if (existing) {
    return { storageKey, idempotencyKey: existing }
  }

  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

  const idempotencyKey = `${action.toLowerCase()}:${uid}:${packageId}:${randomPart}`
  sessionStorage.setItem(storageKey, idempotencyKey)

  return { storageKey, idempotencyKey }
}

const readCallableErrorCode = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String((error as { code?: unknown }).code || '').replace(
    'functions/',
    '',
  )
}

const getPackageActivationErrorMessage = (error: unknown): string => {
  const code = readCallableErrorCode(error)
  const fallback =
    error instanceof Error && error.message
      ? error.message
      : 'Package activation could not be completed.'

  switch (code) {
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again before upgrading.'
    case 'permission-denied':
      return 'The secured package engine rejected this request. Confirm that the activatePackageWithWallet Cloud Function is deployed and that your account is authorized.'
    case 'failed-precondition':
      return fallback
    case 'not-found':
      return 'The member, wallet, package configuration, or Business Cycle record required by the secured engine was not found.'
    case 'already-exists':
      return 'This package request has already been processed. Refresh your dashboard to load the completed result.'
    case 'resource-exhausted':
      return 'Your Chosen Wallet does not have enough CC for the full target package price.'
    case 'unavailable':
      return 'The secured package engine is temporarily unavailable. Please retry using the same request.'
    case 'internal':
      return 'The secured package engine encountered an internal error. No client-side financial write was attempted.'
    default:
      return fallback
  }
}

interface PackageConfig {
  displayName: string
  badgeLabel: string
  accentClass: string
  bgClass: string
  glowClass: string
  gradientClass: string
  packageValue: number
  cycleMax: number
}

const PACKAGE_CONFIGS: Record<string, PackageConfig> = {
  Bronze: {
    displayName: 'Bronze Affiliate',
    badgeLabel: 'Bronze Affiliate',
    accentClass: 'text-[#CD7F32] border-[#CD7F32]/15',
    bgClass: 'bg-[#CD7F32]/10',
    glowClass: 'shadow-[#CD7F32]/20',
    gradientClass: 'from-[#CD7F32] to-amber-700',
    packageValue: 50,
    cycleMax: 125,
  },
  Silver: {
    displayName: 'Silver Affiliate',
    badgeLabel: 'Silver Affiliate',
    accentClass: 'text-zinc-300 border-zinc-300/15',
    bgClass: 'bg-zinc-300/10',
    glowClass: 'shadow-zinc-300/20',
    gradientClass: 'from-zinc-300 to-zinc-500',
    packageValue: 350,
    cycleMax: 875,
  },
  Gold: {
    displayName: 'Gold Affiliate',
    badgeLabel: 'Gold Affiliate',
    accentClass: 'text-amber-400 border-amber-400/15',
    bgClass: 'bg-amber-400/10',
    glowClass: 'shadow-amber-400/20',
    gradientClass: 'from-amber-400 to-yellow-600',
    packageValue: 1500,
    cycleMax: 3750,
  },
  Platinum: {
    displayName: 'Platinum Affiliate',
    badgeLabel: 'Platinum Affiliate',
    accentClass: 'text-cyan-400 border-cyan-400/15',
    bgClass: 'bg-cyan-400/10',
    glowClass: 'shadow-cyan-400/20',
    gradientClass: 'from-cyan-400 to-teal-600',
    packageValue: 3000,
    cycleMax: 7500,
  },
  Diamond: {
    displayName: 'Diamond Affiliate',
    badgeLabel: 'Diamond Affiliate',
    accentClass: 'text-fuchsia-400 border-fuchsia-400/15',
    bgClass: 'bg-fuchsia-400/10',
    glowClass: 'shadow-fuchsia-400/20',
    gradientClass: 'from-fuchsia-400 to-purple-600',
    packageValue: 5000,
    cycleMax: 12500,
  },
  'City Distributor': {
    displayName: 'City Distributor',
    badgeLabel: 'City Distributor',
    accentClass: 'text-emerald-400 border-emerald-400/15',
    bgClass: 'bg-emerald-400/10',
    glowClass: 'shadow-emerald-400/20',
    gradientClass: 'from-emerald-400 to-green-600',
    packageValue: 25000,
    cycleMax: 62500,
  },
  'Regional Distributor': {
    displayName: 'Regional Distributor',
    badgeLabel: 'Regional Distributor',
    accentClass: 'text-indigo-400 border-indigo-400/15',
    bgClass: 'bg-indigo-400/10',
    glowClass: 'shadow-indigo-400/20',
    gradientClass: 'from-indigo-400 to-blue-600',
    packageValue: 100000,
    cycleMax: 250000,
  },
}

const getPackageConfig = (level: string | undefined): PackageConfig => {
  const normalized = level || 'Bronze'
  return PACKAGE_CONFIGS[normalized] || PACKAGE_CONFIGS.Bronze
}

type CanonicalAccountStatus = 'Active' | 'Inactive' | 'Suspended' | 'Pending'
type CanonicalBusinessCycleStatus = 'Active' | 'Completed'

/**
 * Account status and Business Cycle status are separate domains.
 *
 * `Completed` is valid for a Business Cycle, not for a member account.
 * Legacy affiliate user records that incorrectly contain `status: "Completed"`
 * are treated as active in the dashboard while the backend data is corrected.
 */
const resolveAccountStatus = (
  profile: Partial<UserProfile> | Record<string, unknown> | null | undefined,
): CanonicalAccountStatus => {
  const rawStatus = String(
    (profile as any)?.accountStatus ?? (profile as any)?.status ?? '',
  )
    .trim()
    .toLowerCase()

  if (rawStatus === 'active') return 'Active'
  if (rawStatus === 'suspended') return 'Suspended'
  if (rawStatus === 'pending') return 'Pending'
  if (rawStatus === 'inactive') return 'Inactive'

  if (rawStatus === 'completed') {
    const packageLevel = String((profile as any)?.packageLevel || 'None')
    const role = String((profile as any)?.role || '')
    const accountType = String((profile as any)?.accountType || '')

    if (
      packageLevel !== 'None' &&
      (role === 'Affiliate' || accountType === 'Affiliate')
    ) {
      return 'Active'
    }
  }

  return 'Inactive'
}

/**
 * The earnings cap is authoritative for determining whether a cycle is done.
 *
 * This deliberately corrects legacy/stale records where the cycle document
 * says `Completed` even though qualified earnings are still below the cap.
 * The raw status is used only when the numeric cycle values are unavailable.
 */
const resolveBusinessCycleStatus = (
  cycle: BusinessCycle | null | undefined,
): CanonicalBusinessCycleStatus | null => {
  if (!cycle) return null

  const currentQualifiedEarningsCC = Number(
    cycle.currentQualifiedEarningsCC ?? 0,
  )
  const earningsCapCC = Number(cycle.earningsCapCC ?? 0)

  const hasValidCycleAmounts =
    Number.isFinite(currentQualifiedEarningsCC) &&
    currentQualifiedEarningsCC >= 0 &&
    Number.isFinite(earningsCapCC) &&
    earningsCapCC > 0

  if (hasValidCycleAmounts) {
    return currentQualifiedEarningsCC >= earningsCapCC ? 'Completed' : 'Active'
  }

  const rawStatus = String((cycle as any).cycleStatus ?? cycle.status ?? '')
    .trim()
    .toLowerCase()

  return rawStatus === 'completed' ? 'Completed' : 'Active'
}

type EarningsRecord = Record<string, unknown>

function readEarningsString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readEarningsAmount(...values: unknown[]): number {
  for (const value of values) {
    const amount =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN

    if (Number.isFinite(amount)) {
      return amount
    }
  }

  return 0
}

function normalizeEarningsToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')
}

function toEarningsDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (value && typeof value === 'object') {
    const timestamp = value as {
      toDate?: () => Date
      seconds?: number
      _seconds?: number
    }

    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate()
      return Number.isNaN(date.getTime()) ? null : date
    }

    const seconds = Number(timestamp.seconds ?? timestamp._seconds)
    if (Number.isFinite(seconds) && seconds > 0) {
      return new Date(seconds * 1000)
    }
  }

  return null
}

function getManilaEarningsDateKey(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const year = parts.find((part) => part.type === 'year')?.value || ''
  const month = parts.find((part) => part.type === 'month')?.value || ''
  const day = parts.find((part) => part.type === 'day')?.value || ''

  return year && month && day ? `${year}-${month}-${day}` : ''
}

function readEarningsDateKey(record: EarningsRecord): string {
  const directDateKey = readEarningsString(
    record.accrualDate,
    record.creditDate,
    record.earningDate,
  )

  if (/^\d{4}-\d{2}-\d{2}$/.test(directDateKey)) {
    return directDateKey
  }

  const date = toEarningsDate(
    record.completedAt ??
      record.creditedAt ??
      record.createdAt ??
      record.timestamp ??
      record.updatedAt,
  )

  return date ? getManilaEarningsDateKey(date) : ''
}

function isCompletedEarningStatus(record: EarningsRecord): boolean {
  const status = normalizeEarningsToken(record.status)

  return (
    status === 'COMPLETED' ||
    status === 'CREDITED' ||
    status === 'PAID' ||
    status === 'ACCRUED' ||
    status === 'PARTIALLY_ACCRUED'
  )
}

function isIncomeLedgerTransaction(record: EarningsRecord): boolean {
  if (!isCompletedEarningStatus(record)) return false

  const transactionType = normalizeEarningsToken(record.transactionType)
  const sourceType = normalizeEarningsToken(record.sourceType)
  const commissionType = normalizeEarningsToken(record.commissionType)
  const walletType = normalizeEarningsToken(record.walletType)
  const direction = normalizeEarningsToken(record.direction)
  const entryType = normalizeEarningsToken(record.type)
  const description = normalizeEarningsToken(record.description)

  if (
    direction === 'DEBIT' ||
    entryType === 'DEBIT' ||
    description.includes('REFUND') ||
    description.includes('REVERSAL') ||
    description.includes('ADJUSTMENT')
  ) {
    return false
  }

  const excludedTransactionTypes = new Set([
    'CASH_IN',
    'CASHIN',
    'P2P_RECEIVE',
    'P2P_TRANSFER_RECEIVE',
    'ADMIN_DIRECT_CC_DEPOSIT',
    'DIRECT_CC_DEPOSIT',
    'DIRECT_ADMIN_DEPOSIT',
    'ADMIN_WALLET_CREDIT',
    'MANUAL_CC_DEPOSIT',
    'MSA_CREDIT',
    'MSA_TRANSFER_DEBIT',
  ])

  if (
    excludedTransactionTypes.has(transactionType) ||
    excludedTransactionTypes.has(sourceType)
  ) {
    return false
  }

  const explicitIncomeTypes = new Set([
    'COMMISSION_CREDIT',
    'MSA_DAILY_ACCRUAL',
    'MARKETING_SUPPORT_ALLOCATION',
    'DIRECT_REFERRAL_BONUS',
    'INDIRECT_REFERRAL_BONUS',
    'UNILEVEL_BONUS',
    'LEADERSHIP_BONUS',
    'DIRECT_LEADERSHIP',
    'INDIRECT_LEADERSHIP',
    'MSA_LEADERSHIP_BONUS',
    'RETAIL_PROFIT',
    'INFINITY_BONUS',
    'LEADERSHIP_REWARD',
  ])

  if (
    explicitIncomeTypes.has(transactionType) ||
    explicitIncomeTypes.has(sourceType) ||
    explicitIncomeTypes.has(commissionType)
  ) {
    return true
  }

  return (
    (walletType === 'COMMISSION_WALLET' ||
      walletType === 'MARKETING_SUPPORT_WALLET' ||
      walletType === 'REWARD_WALLET') &&
    (direction === 'CREDIT' || entryType === 'CREDIT') &&
    Boolean(commissionType)
  )
}

function getIncomeRecordKey(
  record: EarningsRecord,
  source: 'ledger' | 'commission',
): string {
  const commissionId = readEarningsString(
    record.commissionId,
    record.sourceCommissionId,
    record.referenceNumber,
  )
  const msaAccrualId = readEarningsString(
    record.sourceMsaDailyAccrualId,
    record.dailyAccrualId,
  )
  const recordId = readEarningsString(
    record.transactionId,
    record.id,
    record.referenceNumber,
  )

  if (msaAccrualId) return `msa:${msaAccrualId}`
  if (commissionId) return `commission:${commissionId}`

  return `${source}:${recordId || JSON.stringify(record)}`
}

interface AffiliateDashboardProps {
  userProfile: UserProfile
  onLogout: () => void
  onNavigate: (page: string) => void
}

export default function AffiliateDashboard({
  userProfile,
  onLogout,
  onNavigate,
}: AffiliateDashboardProps) {
  const { ccSettings } = useCCSettings()
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [businessCycle, setBusinessCycle] = useState<BusinessCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCompletedModal, setShowCompletedModal] = useState(false)

  // Sponsor & Copy States
  const [sponsor, setSponsor] = useState<any | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [sponsorLoading, setSponsorLoading] = useState(false)

  // Cashout Modal form state
  const [showCashoutModal, setShowCashoutModal] = useState(false)
  const [cashoutAmountCC, setCashoutAmountCC] = useState<number>(100)
  const [payoutChannel, setPayoutChannel] = useState<'Bank' | 'GCash' | 'Maya'>(
    'GCash',
  )
  const [accountNumber, setAccountName] = useState('')
  const [cashoutError, setCashoutError] = useState<string | null>(null)
  const [cashoutSuccess, setCashoutSuccess] = useState<string | null>(null)

  // Shared My Digital Wallet activity sources
  const [cashinHistory, setCashinHistory] = useState<any[]>([])
  const [cashoutHistory, setCashoutHistory] = useState<any[]>([])
  const [orderHistory, setOrderHistory] = useState<any[]>([])
  const [commissionHistory, setCommissionHistory] = useState<any[]>([])
  const [p2pReceivedHistory, setP2pReceivedHistory] = useState<any[]>([])
  const [p2pSentHistory, setP2pSentHistory] = useState<any[]>([])
  const [walletTransactions, setWalletTransactions] = useState<any[]>([])

  // Transfer Modal state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferRecipient, setTransferRecipient] = useState('')
  const [transferAmount, setTransferAmount] = useState<number>(10)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)

  // Upgrade Modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [selectedUpgradeLevel, setSelectedUpgradeLevel] = useState<string>('')
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeResult, setUpgradeResult] =
    useState<ActivatePackageResponse | null>(null)
  const [showUpgradeSuccessModal, setShowUpgradeSuccessModal] = useState(false)
  const [upgradeRedirectSeconds, setUpgradeRedirectSeconds] = useState(4)
  const [upgradeRedirecting, setUpgradeRedirecting] = useState(false)

  // AI Business Coach states
  const [showAICoachModal, setShowAICoachModal] = useState(false)
  const [aiCoachQuery, setAICoachQuery] = useState('')
  const [aiCoachHistory, setAICoachHistory] = useState<
    Array<{ sender: 'user' | 'ai'; text: string }>
  >([])
  const [aiCoachLoading, setAICoachLoading] = useState(false)

  // Quick action detail states
  const [activeActionModal, setActiveActionModal] = useState<string | null>(
    null,
  )
  const [commissionSummary, setCommissionSummary] = useState<any>(null)
  const [totalCommissionIncomeCC, setTotalCommissionIncomeCC] = useState(0)
  const [downlineList, setDownlineList] = useState<any[]>([])

  // Simulation state
  const [simulating, setSimulating] = useState(false)
  const [directReferralRate, setDirectReferralRate] = useState<number>(4)
  const [dbPackages, setDbPackages] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState<boolean>(true)

  // Mobile navigation and view States
  const [activeMobileTab, setActiveMobileTab] =
    useState<CustomerTabType>('home')
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'ZH' | 'ES'>(
    'EN',
  )
  const [isWalletExpanded, setIsWalletExpanded] = useState(true)
  const [showMyDigitalWallet, setShowMyDigitalWallet] = useState(false)

  // Notifications State linked to Firestore
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotificationsDropdown, setShowNotificationsDropdown] =
    useState(false)

  const applyRequestedAffiliateView = useCallback(
    (requestedView: string): void => {
      setShowMyDigitalWallet(false)
      setActiveActionModal(null)
      setShowAICoachModal(false)

      if (requestedView === 'wallet' || requestedView === 'cash-in') {
        setShowMyDigitalWallet(true)
        setActiveMobileTab('wallet')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      setActiveMobileTab('home')

      if (requestedView === 'ai-coach') {
        setShowAICoachModal(true)
        return
      }

      if (
        [
          'team',
          'orders',
          'commissions',
          'marketing',
          'academy',
          'support',
        ].includes(requestedView)
      ) {
        setActiveActionModal(requestedView)
        return
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [],
  )

  const returnToMainDashboardAfterUpgrade = useCallback(() => {
    setUpgradeRedirecting(true)
    setShowUpgradeSuccessModal(false)
    setShowUpgradeModal(false)
    setSelectedUpgradeLevel('')
    setUpgradeError(null)
    setUpgradeSuccess(null)
    setActiveActionModal(null)
    setShowAICoachModal(false)
    setShowMyDigitalWallet(false)
    setActiveMobileTab('home')

    onNavigate('affiliate-dashboard')

    // Switch to the main dashboard route before the full reload. This forces
    // Auth, profile, package, wallet, Business Cycle, rank, and network data to
    // be rehydrated from authoritative Firestore state.
    window.setTimeout(() => {
      window.location.reload()
    }, 150)
  }, [onNavigate])

  useEffect(() => {
    if (!showUpgradeSuccessModal) return

    setUpgradeRedirectSeconds(4)
    setUpgradeRedirecting(false)

    const countdownTimer = window.setInterval(() => {
      setUpgradeRedirectSeconds((current) => Math.max(1, current - 1))
    }, 1000)

    const redirectTimer = window.setTimeout(() => {
      returnToMainDashboardAfterUpgrade()
    }, 4000)

    return () => {
      window.clearInterval(countdownTimer)
      window.clearTimeout(redirectTimer)
    }
  }, [showUpgradeSuccessModal, returnToMainDashboardAfterUpgrade])

  useEffect(() => {
    const unsubscribe = NotificationService.subscribeToNotifications(
      userProfile.uid,
      'Affiliate',
      (data) => {
        setNotifications(data)
      },
    )
    return () => unsubscribe()
  }, [userProfile.uid])

  useEffect(() => {
    fetchDashboardData()
  }, [userProfile.uid])
  // Lifetime Total Earnings comes from the server-authored dashboard summary.
  // Balance Commissions remains the current transferable Commission Wallet.
  useEffect(() => {
    const summaryRef = doc(db, 'dashboard_summary', userProfile.uid)

    const unsubscribeSummary = onSnapshot(
      summaryRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setTotalCommissionIncomeCC(0)
          return
        }

        const summaryData = snapshot.data()
        const total = Number(
          summaryData.totalCommissionIncomeCC ??
            summaryData.totalIncomeCC ??
            0,
        )

        setTotalCommissionIncomeCC(
          Number.isFinite(total) && total > 0 ? total : 0,
        )
      },
      (error) => {
        console.error(
          'Error subscribing to lifetime Total Commission Income:',
          error,
        )
      },
    )

    return () => unsubscribeSummary()
  }, [userProfile.uid])
  // Live earnings and wallet ledger subscriptions.
  // Scheduled or Admin-triggered MSA and Leadership earnings appear without
  // requiring the Affiliate to reload the application.
  useEffect(() => {
    const commissionsQuery = query(
      collection(db, 'commissions'),
      where('earnerUid', '==', userProfile.uid),
    )
    const walletLedgerQuery = query(
      collection(db, 'wallet_transactions'),
      where('uid', '==', userProfile.uid),
      limit(200),
    )

    const unsubscribeCommissions = onSnapshot(
      commissionsQuery,
      (snapshot) => {
        setCommissionHistory(
          snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })),
        )
      },
      (error) => {
        console.error('Error subscribing to live commission earnings:', error)
      },
    )

    const unsubscribeWalletLedger = onSnapshot(
      walletLedgerQuery,
      (snapshot) => {
        setWalletTransactions(
          snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })),
        )
      },
      (error) => {
        console.error(
          'Error subscribing to live wallet earnings ledger:',
          error,
        )
      },
    )

    return () => {
      unsubscribeCommissions()
      unsubscribeWalletLedger()
    }
  }, [userProfile.uid])
  // Synchronize the active dashboard view with AffiliateAppShell.
  useEffect(() => {
    const event = new CustomEvent('affiliate_view_changed', {
      detail: {
        view: showMyDigitalWallet ? 'wallet' : activeActionModal,
        aiCoach: showAICoachModal,
      },
    })
    window.dispatchEvent(event)
  }, [activeActionModal, showAICoachModal, showMyDigitalWallet])

  // Apply a pending Drawer request after navigating from another page.
  useEffect(() => {
    const pendingView = sessionStorage.getItem('affiliate_view')
    if (!pendingView) return

    applyRequestedAffiliateView(pendingView)
    sessionStorage.removeItem('affiliate_view')
  }, [applyRequestedAffiliateView])

  // Apply Drawer requests immediately while this dashboard is already mounted.
  useEffect(() => {
    const handleAffiliateViewRequest = (event: Event): void => {
      const customEvent = event as CustomEvent<{ view?: string }>
      const requestedView = customEvent.detail?.view
      if (!requestedView) return

      applyRequestedAffiliateView(requestedView)
      sessionStorage.removeItem('affiliate_view')
    }

    window.addEventListener(
      'affiliate_view_requested',
      handleAffiliateViewRequest,
    )

    return () => {
      window.removeEventListener(
        'affiliate_view_requested',
        handleAffiliateViewRequest,
      )
    }
  }, [applyRequestedAffiliateView])

  const fetchDashboardData = async () => {
    setLoading(true)
    // 1. Fetch Wallet via WalletService
    try {
      const walletData = await WalletService.getWallet(userProfile.uid)
      if (walletData) {
        setWallet(walletData)
      }
    } catch (err) {
      console.error('Error loading dashboard details (Step 1: Wallet):', err)
    }

    // 2. Fetch Business Cycle
    try {
      const cycleData = await PackageService.getBusinessCycle(userProfile.uid)
      if (cycleData) {
        setBusinessCycle(cycleData)
        setShowCompletedModal(
          resolveBusinessCycleStatus(cycleData) === 'Completed',
        )
      } else {
        setBusinessCycle(null)
        setShowCompletedModal(false)
      }
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 2: Business Cycle):',
        err,
      )
    }

    // 4. Fetch Sponsor details if present
    if (userProfile.referredBy) {
      setSponsorLoading(true)
      try {
        const sponsorDocRef = doc(db, 'users', userProfile.referredBy)
        const sponsorSnap = await getDoc(sponsorDocRef)
        if (sponsorSnap.exists()) {
          setSponsor(sponsorSnap.data())
        } else {
          const q = query(
            collection(db, 'users'),
            where('sponsorCode', '==', userProfile.referredBy),
            limit(1),
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            setSponsor(snap.docs[0].data())
          } else {
            setSponsor(null)
          }
        }
      } catch (err) {
        console.error('Error loading dashboard details (Step 4: Sponsor):', err)
        setSponsor(null)
      } finally {
        setSponsorLoading(false)
      }
    } else {
      setSponsor(null)
    }

    // 4. Fetch all member-owned activity sources used by RecentActivityCard.
    // Each query is ownership-scoped; the shared card normalizes, sorts, and paginates.
    try {
      const cashinQuery = query(
        collection(db, 'cashin_requests'),
        where('uid', '==', userProfile.uid),
      )
      const cashinSnap = await getDocs(cashinQuery)
      setCashinHistory(
        cashinSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Cash-In history):',
        err,
      )
      setCashinHistory([])
    }

    try {
      const cashoutQuery = query(
        collection(db, 'cashout_requests'),
        where('uid', '==', userProfile.uid),
      )
      const cashoutSnap = await getDocs(cashoutQuery)
      setCashoutHistory(
        cashoutSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Cash-Out history):',
        err,
      )
      setCashoutHistory([])
    }

    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('uid', '==', userProfile.uid),
      )
      const ordersSnap = await getDocs(ordersQuery)
      setOrderHistory(
        ordersSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Order history):',
        err,
      )
      setOrderHistory([])
    }

    try {
      const commissionsQuery = query(
        collection(db, 'commissions'),
        where('earnerUid', '==', userProfile.uid),
      )
      const commissionsSnap = await getDocs(commissionsQuery)
      setCommissionHistory(
        commissionsSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Commission earnings):',
        err,
      )
      setCommissionHistory([])
    }

    try {
      const receivedP2PQuery = query(
        collection(db, 'p2p_transfers'),
        where('recipientUid', '==', userProfile.uid),
      )
      const receivedP2PSnap = await getDocs(receivedP2PQuery)
      setP2pReceivedHistory(
        receivedP2PSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Received P2P transfers):',
        err,
      )
      setP2pReceivedHistory([])
    }

    try {
      const sentP2PQuery = query(
        collection(db, 'p2p_transfers'),
        where('senderUid', '==', userProfile.uid),
      )
      const sentP2PSnap = await getDocs(sentP2PQuery)
      setP2pSentHistory(
        sentP2PSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (err) {
      console.error(
        'Error loading dashboard details (Activity: Sent P2P transfers):',
        err,
      )
      setP2pSentHistory([])
    }

    // Compatibility read model for legacy and canonical P2P ledger entries.
    try {
      const walletTransactionsQuery = query(
        collection(db, 'wallet_transactions'),
        where('uid', '==', userProfile.uid),
        limit(200),
      )
      const walletTransactionsSnapshot = await getDocs(walletTransactionsQuery)

      setWalletTransactions(
        walletTransactionsSnapshot.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })),
      )
    } catch (error) {
      console.error(
        'Error loading dashboard details (Activity: Wallet transactions):',
        error,
      )
      setWalletTransactions([])
    }

    // 6. Fetch Commissions Summary
    try {
      const summary = await CommissionService.getCommissionSummary(
        userProfile.uid,
      )
      setCommissionSummary(summary)
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 6: Commission Summary):',
        err,
      )
    }

    // 7. Fetch Direct referrals for downline tools
    let downlineDocs: any[] = []
    try {
      const refs: Record<string, any> = {}

      // Query 1: referredBy == userProfile.uid
      const q1 = query(
        collection(db, 'users'),
        where('referredBy', '==', userProfile.uid),
        limit(100),
      )
      const s1 = await getDocs(q1)
      s1.docs.forEach((d) => {
        refs[d.id] = d.data()
      })

      // Query 2: sponsorUid == userProfile.uid
      const q2 = query(
        collection(db, 'users'),
        where('sponsorUid', '==', userProfile.uid),
        limit(100),
      )
      const s2 = await getDocs(q2)
      s2.docs.forEach((d) => {
        refs[d.id] = d.data()
      })

      // Query 3: referredBy == userProfile.sponsorCode (if sponsorCode is defined)
      if (userProfile.sponsorCode) {
        const q3 = query(
          collection(db, 'users'),
          where('referredBy', '==', userProfile.sponsorCode),
          limit(100),
        )
        const s3 = await getDocs(q3)
        s3.docs.forEach((d) => {
          refs[d.id] = d.data()
        })
      }

      downlineDocs = Object.values(refs)
    } catch (e) {
      console.error('Error loading dashboard details (Step 7: Downlines):', e)
    }
    setDownlineList(downlineDocs)

    // 8. Fetch directReferralRate from system_config/business_rules
    try {
      const rulesDocRef = doc(db, 'system_config', 'business_rules')
      const rulesSnap = await getDoc(rulesDocRef)
      if (rulesSnap.exists()) {
        const rulesData = rulesSnap.data()
        if (rulesData && typeof rulesData.directReferralRate === 'number') {
          setDirectReferralRate(rulesData.directReferralRate)
        } else {
          setDirectReferralRate(4)
        }
      } else {
        setDirectReferralRate(4)
      }
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 8: CC business_rules):',
        err,
      )
      setDirectReferralRate(4)
    }

    // 9. Fetch packages from packages collection where type == "Affiliate" or "Distributor"
    try {
      setLoadingPackages(true)
      const packagesRef = collection(db, 'packages')
      const packagesSnap = await getDocs(packagesRef)
      const packagesList: any[] = []
      packagesSnap.forEach((doc) => {
        const data = doc.data()
        if (data.type === 'Affiliate' || data.type === 'Distributor') {
          packagesList.push({
            id: doc.id,
            ...data,
          })
        }
      })
      setDbPackages(packagesList)
    } catch (err) {
      console.error('Error loading dashboard details (Step 9: Packages):', err)
      setDbPackages([])
    } finally {
      setLoadingPackages(false)
    }

    setLoading(false)
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/register?ref=${userProfile.sponsorCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  const handleShare = () => {
    const link = `${window.location.origin}/register?ref=${userProfile.sponsorCode}`
    if (navigator.share) {
      navigator
        .share({
          title: 'Join I AM CHOSEN',
          text: 'Join me in I AM CHOSEN — a revolutionary innovatech business platform combining wellness, fintech tools, digital wallets, and modern network-powered entrepreneurship.',
          url: link,
        })
        .catch(console.error)
    } else {
      handleCopyLink()
    }
  }

  // Submit Cashout via WalletService
  const handleCashoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCashoutError(null)
    setCashoutSuccess(null)

    if (!wallet) return

    if (cashoutAmountCC <= 0) {
      setCashoutError('Amount must be greater than zero.')
      return
    }

    setLoading(true)
    try {
      const res = await WalletService.createCashOutRequest(
        userProfile.uid,
        userProfile.email,
        wallet,
        {
          memberId: userProfile.memberId,
          fullName: userProfile.fullName,
          amountCC: cashoutAmountCC,
          payoutChannel,
          destinationDetails: accountNumber,
          cashOutRatePHP: ccSettings.cashOutRatePHP,
        },
      )

      setCashoutSuccess(
        `Successfully requested cashout of ${cashoutAmountCC} CC! Net: ₱${res.netPhp.toLocaleString()} scheduled for release this Friday.`,
      )
      setAccountName('')
      setTimeout(() => {
        setShowCashoutModal(false)
        fetchDashboardData()
      }, 3000)
    } catch (e: any) {
      setCashoutError(e.message || 'Failed to submit request.')
    } finally {
      setLoading(false)
    }
  }

  // Submit P2P Transfer via WalletService
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferError(null)
    setTransferSuccess(null)

    if (!wallet) return

    if (transferAmount <= 0) {
      setTransferError('Amount must be greater than zero.')
      return
    }

    if (!transferRecipient) {
      setTransferError('Recipient email address is required.')
      return
    }

    setTransferLoading(true)
    try {
      await WalletService.createTransferRequest(
        userProfile.uid,
        userProfile.email,
        wallet,
        {
          recipientEmail: transferRecipient,
          amountCC: transferAmount,
          memberId: userProfile.memberId,
        },
      )

      // The callable transaction has completed, so refresh the activity ledger.
      await fetchDashboardData()

      setTransferSuccess(
        `Successfully transferred ${transferAmount} CC to ${transferRecipient}!`,
      )
      setTransferRecipient('')
      setTransferAmount(10)
      setTimeout(() => {
        setShowTransferModal(false)
      }, 3000)
    } catch (e: any) {
      setTransferError(e.message || 'Failed to complete P2P Transfer.')
    } finally {
      setTransferLoading(false)
    }
  }

  // Submit Package Upgrade through the secured callable package engine.
  // The browser performs validation for user feedback only; the backend remains authoritative.
  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpgradeError(null)
    setUpgradeSuccess(null)
    setUpgradeResult(null)

    if (!selectedUpgradeLevel) {
      setUpgradeError('Please select a target package level to upgrade to.')
      return
    }

    const valCCMap: Record<string, number> = {
      Bronze: 50,
      Silver: 350,
      Gold: 1500,
      Platinum: 3000,
      Diamond: 5000,
      'City Distributor': 25000,
      'Regional Distributor': 100000,
    }

    const currentLevel = userProfile.packageLevel || 'Bronze'
    const targetValue = valCCMap[selectedUpgradeLevel] || 0
    const currentValue = valCCMap[currentLevel] || 0

    if (targetValue <= currentValue) {
      setUpgradeError(
        `You cannot upgrade to ${selectedUpgradeLevel} because it is equal to or lower than your current package tier (${currentLevel}).`,
      )
      return
    }

    if (!wallet || wallet.chosenWalletBalance < targetValue) {
      setUpgradeError(
        `Insufficient Chosen Wallet balance. The full ${selectedUpgradeLevel} package price is ${targetValue} CC, but your Chosen Wallet balance is only ${wallet?.chosenWalletBalance || 0} CC.`,
      )
      return
    }

    const activationAction: PackageActivationAction = 'PACKAGE_UPGRADE'
    const { storageKey, idempotencyKey } = createPackageIdempotencyKey(
      userProfile.uid,
      activationAction,
      selectedUpgradeLevel,
    )

    setUpgradeLoading(true)

    try {
      const callableResult = await activatePackageWithWallet({
        packageId: selectedUpgradeLevel,
        accountPath: 'Affiliate',
        activationAction,
        idempotencyKey,
      })
      const result = callableResult.data

      if (result.success === false) {
        throw new Error(
          result.message ||
            'The secured package engine did not complete the upgrade.',
        )
      }

      sessionStorage.removeItem(storageKey)
      setUpgradeResult(result)
      setUpgradeSuccess(
        `Your ${result.packageLevel || selectedUpgradeLevel} Affiliate package upgrade was completed securely.`,
      )

      window.dispatchEvent(
        new CustomEvent('package_activation_completed', {
          detail: result,
        }),
      )

      // Refresh local dashboard state before displaying the receipt. The
      // success modal then returns to the main dashboard and performs a full
      // reload so the parent profile is also refreshed.
      await fetchDashboardData()
      setShowUpgradeModal(false)
      setShowUpgradeSuccessModal(true)
    } catch (error: unknown) {
      console.error('Secured package upgrade failed:', error)
      // Keep the idempotency key in sessionStorage so a retry cannot double-charge.
      setUpgradeError(getPackageActivationErrorMessage(error))
    } finally {
      setUpgradeLoading(false)
    }
  }

  // Ask AI Business Coach
  const handleAskAICoach = async (promptText?: string) => {
    const textToAsk = promptText || aiCoachQuery
    if (!textToAsk.trim()) return

    const userMessage = { sender: 'user' as const, text: textToAsk }
    setAICoachHistory((prev) => [...prev, userMessage])
    setAICoachQuery('')
    setAICoachLoading(true)

    try {
      const response = await AIService.askAICoach(userProfile.uid, textToAsk)
      setAICoachHistory((prev) => [
        ...prev,
        { sender: 'ai' as const, text: response },
      ])
    } catch (e) {
      console.error(e)
      setAICoachHistory((prev) => [
        ...prev,
        {
          sender: 'ai' as const,
          text: 'I apologize, I am unable to connect to the model. Let me try again.',
        },
      ])
    } finally {
      setAICoachLoading(false)
    }
  }

  const currentDayName = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' })
  }

  const getUpcomingFriday = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = day <= 5 ? 5 - day : 12 - day
    d.setDate(d.getDate() + diff)
    d.setHours(12, 0, 0, 0)
    return d
  }

  const handleOpenMyDigitalWallet = (): void => {
    applyRequestedAffiliateView('wallet')
  }

  const handleMobileTabChange = (tab: CustomerTabType) => {
    setActiveMobileTab(tab)

    if (tab === 'home') {
      applyRequestedAffiliateView('dashboard')
    } else if (tab === 'register') {
      onNavigate('member-registration')
    } else if (tab === 'wallet') {
      handleOpenMyDigitalWallet()
    }
  }

  // Simulation: Receive Direct Commissions (4%) - Secure backend-proxied simulation
  const handleSimulateCommission = async (
    amountCC: number,
    bonusType: string,
  ) => {
    if (!wallet) return
    setSimulating(true)

    try {
      const response = await fetch('/api/simulate-commission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: userProfile.uid,
          amountCC,
          bonusType,
        }),
      })

      if (!response.ok) {
        throw new Error('Simulation failed on the secure backend.')
      }

      const result = await response.json()
      if (result.success) {
        await fetchDashboardData()
      }
    } catch (e: any) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Simulation failed.')
    } finally {
      setSimulating(false)
    }
  }

  const simulatorTiers = [
    { name: 'Bronze', fallbackCC: 50, isDistributor: false },
    { name: 'Silver', fallbackCC: 350, isDistributor: false },
    { name: 'Gold', fallbackCC: 1500, isDistributor: false },
    { name: 'Platinum', fallbackCC: 3000, isDistributor: false },
    { name: 'Diamond', fallbackCC: 5000, isDistributor: false },
    { name: 'City Distributor', fallbackCC: 25000, isDistributor: true },
    {
      name: 'Regional Distributor',
      fallbackCC: 100000,
      isDistributor: true,
    },
  ]

  let ratePercentage = directReferralRate
  let rateMultiplier = directReferralRate / 100
  if (directReferralRate > 0 && directReferralRate < 1) {
    ratePercentage = directReferralRate * 100
    rateMultiplier = directReferralRate
  }

  const getCycleProgressPercentage = (): number => {
    let current = 0
    let cap = 0
    const cashInRateVal = ccSettings?.cashInRatePHP || 70

    if (businessCycle) {
      if (typeof businessCycle.currentQualifiedEarningsCC === 'number') {
        current = businessCycle.currentQualifiedEarningsCC
      } else if (
        typeof (businessCycle as any).currentQualifiedEarningsPHP === 'number'
      ) {
        current =
          (businessCycle as any).currentQualifiedEarningsPHP / cashInRateVal
      }

      if (typeof businessCycle.earningsCapCC === 'number') {
        cap = businessCycle.earningsCapCC
      } else if (typeof (businessCycle as any).earningsCapPHP === 'number') {
        cap = (businessCycle as any).earningsCapPHP / cashInRateVal
      }
    } else if (userProfile) {
      if (typeof (userProfile as any).currentQualifiedEarningsCC === 'number') {
        current = (userProfile as any).currentQualifiedEarningsCC
      } else if (
        typeof (userProfile as any).currentQualifiedEarningsPHP === 'number'
      ) {
        current =
          (userProfile as any).currentQualifiedEarningsPHP / cashInRateVal
      }

      if (typeof (userProfile as any).earningsCapCC === 'number') {
        cap = (userProfile as any).earningsCapCC
      } else if (typeof (userProfile as any).earningsCapPHP === 'number') {
        cap = (userProfile as any).earningsCapPHP / cashInRateVal
      }
    }

    if (
      typeof current !== 'number' ||
      isNaN(current) ||
      typeof cap !== 'number' ||
      isNaN(cap) ||
      cap <= 0
    ) {
      return 0
    }

    const progress = (current / cap) * 100
    const rounded = Math.round(progress)
    return Math.min(100, Math.max(0, rounded))
  }

  const cashInRate = ccSettings?.cashInRatePHP || 70
  const manilaTodayKey = getManilaEarningsDateKey()

  const todaysEarningsCC = useMemo(() => {
    const earningsBySource = new Map<string, number>()

    walletTransactions.forEach((rawRecord) => {
      const record = rawRecord as EarningsRecord

      if (
        !isIncomeLedgerTransaction(record) ||
        readEarningsDateKey(record) !== manilaTodayKey
      ) {
        return
      }

      const amountCC = readEarningsAmount(
        record.creditedAmountCC,
        record.qualifiedAmountCC,
        record.amountCC,
        record.amount,
      )

      if (amountCC <= 0) return

      earningsBySource.set(getIncomeRecordKey(record, 'ledger'), amountCC)
    })

    // Compatibility fallback for credited commission records whose historical
    // wallet ledger entry is unavailable. Matching ledger/source IDs prevent
    // the same income from being counted twice.
    commissionHistory.forEach((rawRecord) => {
      const record = rawRecord as EarningsRecord

      if (
        !isCompletedEarningStatus(record) ||
        readEarningsDateKey(record) !== manilaTodayKey
      ) {
        return
      }

      const amountCC = readEarningsAmount(
        record.creditedAmountCC,
        record.amountCC,
        record.amount,
      )

      if (amountCC <= 0) return

      const sourceKey = getIncomeRecordKey(record, 'commission')
      if (!earningsBySource.has(sourceKey)) {
        earningsBySource.set(sourceKey, amountCC)
      }
    })

    return Number(
      Array.from(earningsBySource.values())
        .reduce((total, amountCC) => total + amountCC, 0)
        .toFixed(4),
    )
  }, [commissionHistory, manilaTodayKey, walletTransactions])

  // Helper to resolve package CC value
  const getPackageCCValue = (level: string): number => {
    const stdMap: Record<string, number> = {
      Bronze: 50,
      Silver: 350,
      Gold: 1500,
      Platinum: 3000,
      Diamond: 5000,
      'City Distributor': 25000,
      'Regional Distributor': 100000,
    }
    const foundPkg = dbPackages.find((p) => p.id === level || p.name === level)
    if (foundPkg && typeof foundPkg.valueCC === 'number') {
      return foundPkg.valueCC
    }
    return stdMap[level] || 50
  }

  const accountStatus = resolveAccountStatus(userProfile)
  const cycleStatus = resolveBusinessCycleStatus(businessCycle)
  const isBusinessCycleCompleted = cycleStatus === 'Completed'

  const activeAffiliatePackages = [
    'Bronze',
    'Silver',
    'Gold',
    'Platinum',
    'Diamond',
    'City Distributor',
    'Regional Distributor',
  ]

  // Filter active direct affiliates
  const activeDirectAffiliates = (downlineList || []).filter((member) => {
    const isAffiliate = member.role === 'Affiliate'
    const hasActivePackage = activeAffiliatePackages.includes(
      member.packageLevel,
    )
    const isActiveAccount = resolveAccountStatus(member) === 'Active'
    return isAffiliate && hasActivePackage && isActiveAccount
  })

  // 1. Personal Sales in CC (convert from PHP if only PHP exists)
  const personalSalesCC = activeDirectAffiliates.reduce(
    (sum, member) => sum + getPackageCCValue(member.packageLevel || 'Bronze'),
    0,
  )

  // 2. Group Volume in CC
  const groupVolumeCC = activeDirectAffiliates.reduce(
    (sum, member) => sum + 50,
    0,
  ) // Each active member contributes 50 CC unilevel volume

  // 3. Personal Volume in CC
  const rawPersonalVolume =
    userProfile && (userProfile as any).personalVolumeCC !== undefined
      ? (userProfile as any).personalVolumeCC
      : userProfile && (userProfile as any).personalVolumePHP !== undefined
        ? (userProfile as any).personalVolumePHP / cashInRate
        : 50.0
  const personalVolumeCC =
    typeof rawPersonalVolume === 'number' && !isNaN(rawPersonalVolume)
      ? rawPersonalVolume
      : 0

  // 4. Direct Affiliate (Count) - Count only users with active affiliate package
  const directAffiliatesCount = activeDirectAffiliates.length

  // 5. Monthly Earnings in CC (convert from PHP if only PHP exists)
  let rawMonthlyEarnings = 0
  if (
    commissionSummary &&
    typeof commissionSummary.grandTotal === 'number' &&
    commissionSummary.grandTotal > 0
  ) {
    rawMonthlyEarnings = commissionSummary.grandTotal
  } else if (
    userProfile &&
    (userProfile as any).monthlyEarningsCC !== undefined
  ) {
    rawMonthlyEarnings = (userProfile as any).monthlyEarningsCC
  } else if (
    userProfile &&
    (userProfile as any).monthlyEarningsPHP !== undefined
  ) {
    rawMonthlyEarnings = (userProfile as any).monthlyEarningsPHP / cashInRate
  } else if (
    commissionSummary &&
    typeof commissionSummary.grandTotal === 'number'
  ) {
    rawMonthlyEarnings = commissionSummary.grandTotal
  }
  const monthlyEarningsCC =
    typeof rawMonthlyEarnings === 'number' && !isNaN(rawMonthlyEarnings)
      ? rawMonthlyEarnings
      : 0

  const renderBusinessCycleProgress = () => {
    return (
      <div className='bg-zinc-950 border border-cyan-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group'>
        <div className='flex justify-between items-start mb-5'>
          <div>
            <h3 className='font-extrabold text-sm text-white uppercase tracking-tight flex items-center gap-2'>
              <ShieldCheck className='w-4 h-4 text-cyan-500 animate-pulse' />{' '}
              Business Cycle Progress
            </h3>
          </div>
          {businessCycle && cycleStatus && (
            <div className='flex flex-wrap justify-end gap-2'>
              <span
                className={`text-[9px] font-mono px-2.5 py-1 rounded-full uppercase font-bold border ${
                  accountStatus === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                }`}
              >
                Account: {accountStatus}
              </span>
              <span
                className={`text-[9px] font-mono px-2.5 py-1 rounded-full uppercase font-bold border ${
                  cycleStatus === 'Active'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15'
                    : 'bg-red-500/10 text-red-400 border-red-500/15'
                }`}
              >
                Cycle: {cycleStatus}
              </span>
            </div>
          )}
        </div>

        {businessCycle ? (
          <div className='space-y-5'>
            <div className='space-y-2'>
              <div className='flex justify-between text-xs font-mono'>
                <span className='text-zinc-400 font-semibold'>
                  Qualified Earnings Balance:
                </span>
                <span className='text-zinc-200 font-bold'>
                  {businessCycle.currentQualifiedEarningsCC} /{' '}
                  {businessCycle.earningsCapCC} CC
                </span>
              </div>
              <div className='w-full bg-zinc-900 h-5 rounded-full overflow-hidden border border-zinc-800'>
                <div
                  className='cyan-gradient h-full transition-all duration-500'
                  style={{
                    width: `${Math.min(
                      100,
                      (businessCycle.currentQualifiedEarningsCC /
                        businessCycle.earningsCapCC) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <div className='flex items-center justify-center text-[10px] text-zinc-500 uppercase font-mono'>
                <span className='text-cyan-500 font-bold'>
                  {Math.max(
                    Number(businessCycle.earningsCapCC || 0) -
                      Number(businessCycle.currentQualifiedEarningsCC || 0),
                    0,
                  )}{' '}
                  CC capacity remaining
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className='text-center py-8'>
            <Award className='w-8 h-8 text-zinc-500 mx-auto mb-3' />
            <h4 className='font-extrabold text-white text-sm uppercase tracking-tight'>
              Business Cycle not initialized
            </h4>
            <p className='text-zinc-500 text-xs mt-2 max-w-sm mx-auto'>
              You do not have an active package tier cycle on file. Please
              purchase a Bronze, Silver, Gold, Platinum, or Diamond package to
              initialize your earnings ledger.
            </p>
          </div>
        )}
      </div>
    )
  }

  const renderRecentActivities = () => {
    return (
      <RecentActivityCard
        cashins={cashinHistory}
        cashouts={cashoutHistory}
        orders={orderHistory}
        commissions={commissionHistory}
        p2pReceived={p2pReceivedHistory}
        p2pSent={p2pSentHistory}
        walletTransactions={walletTransactions}
        currentUid={userProfile.uid}
        accountType='Affiliate'
        layoutVariant='wide'
        pageSize={6}
        visibleTabs={['earnings', 'deposits', 'withdrawals', 'orders']}
      />
    )
  }

  return (
    <div className='bg-[#07090D] min-h-screen text-white relative flex selection:bg-gold selection:text-black'>
      {/* Custom Global Rules compliance injected styles */}
      <style>{`
        .neon-border-card {
          background: #111318;
          border: 1px solid rgba(0, 213, 255, 0.15);
        }
        .gold-border-card {
          background: #111318;
          border: 1px solid rgba(244, 197, 66, 0.15);
        }
        /* Custom styled scrolls */
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: #07090D;
        }
        ::-webkit-scrollbar-thumb {
          background: #1F2937;
          border-radius: 99px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #374151;
        }
      `}</style>

      {/* RIGHT CONTENT WORKSPACE */}
      <div className='flex-1 flex flex-col w-full min-h-screen bg-[#07090D]'>
        {/* Top Header */}
        <header className='hidden border-b border-zinc-800/40 bg-[#111318]/90 backdrop-blur sticky top-0 z-30'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
            {/* Left side profile/hamburger */}
            <div className='flex items-center space-x-3'>
              <div className='lg:hidden flex items-center space-x-2'>
                <ChosenLogo size='sm' className='w-8 h-8' />
              </div>
              {/* Member Profile Initials / Badge */}
              <div className='flex items-center space-x-2 bg-zinc-900/80 border border-zinc-800/80 rounded-xl px-3 py-1.5'>
                <div
                  className={`w-6 h-6 rounded-full ${getPackageConfig(userProfile.packageLevel).bgClass} border ${getPackageConfig(userProfile.packageLevel).accentClass} flex items-center justify-center text-[10px] font-bold font-mono`}
                >
                  {userProfile.fullName
                    ? userProfile.fullName.substring(0, 2).toUpperCase()
                    : 'IA'}
                </div>
                <div className='text-left hidden sm:block'>
                  <span className='block text-[10px] font-black text-white leading-tight'>
                    {userProfile.fullName}
                  </span>
                  <span
                    className={`block text-[8px] ${getPackageConfig(userProfile.packageLevel).accentClass.split(' ')[0]} uppercase font-bold tracking-wider`}
                  >
                    {getPackageConfig(userProfile.packageLevel).displayName}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side global actions */}
            <div className='flex items-center space-x-3 sm:space-x-4'>
              {/* Member ID display button */}
              <button
                onClick={() => handleCopyLink()}
                className='text-[10px] font-bold px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[#00D5FF] font-mono hover:border-[#00D5FF]/40 transition-colors flex items-center gap-1 cursor-pointer'
                title='Copy Sponsor Referral Link'
              >
                <span>ID: {userProfile.memberId}</span>
                <Copy className='w-3 h-3 text-zinc-500' />
              </button>

              {/* Language Selector */}
              <div className='relative hidden sm:block'>
                <select
                  value={selectedLanguage}
                  onChange={(e: any) => setSelectedLanguage(e.target.value)}
                  className='bg-zinc-900 border border-zinc-800 text-[10px] font-bold rounded-xl pl-2 pr-6 py-1.5 focus:outline-none text-zinc-400 appearance-none select-none cursor-pointer'
                >
                  <option value='EN'>EN</option>
                  <option value='ZH'>ZH</option>
                  <option value='ES'>ES</option>
                </select>
                <Globe className='w-2.5 h-2.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none' />
              </div>

              {/* Notification Bell with alert indicator */}
              <div className='relative'>
                <button
                  onClick={() =>
                    setShowNotificationsDropdown(!showNotificationsDropdown)
                  }
                  className='p-1.5 bg-[#17181D]/80 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-cyan-400 transition-colors relative cursor-pointer'
                  title='Notifications'
                >
                  <Bell className='w-4 h-4' />
                  {notifications.some((n) => n.unread) && (
                    <span className='absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse' />
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotificationsDropdown && (
                  <div className='absolute right-0 mt-2 w-80 bg-[#0B0D12] border border-zinc-800 rounded-2xl shadow-xl z-50 p-4 space-y-3 border-cyan-950/40'>
                    <div className='flex justify-between items-center border-b border-zinc-800/60 pb-2'>
                      <h4 className='text-xs font-bold text-white uppercase tracking-wider'>
                        Alerts & Notifications
                      </h4>
                      {notifications.some((n) => n.unread) && (
                        <button
                          onClick={() => {
                            NotificationService.markAllAsRead(userProfile.uid)
                          }}
                          className='text-[9px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider transition-colors cursor-pointer'
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className='max-h-60 overflow-y-auto space-y-2.5 pr-1'>
                      {notifications.length === 0 ? (
                        <p className='text-[10px] text-zinc-500 text-center py-4'>
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() =>
                              notif.unread &&
                              NotificationService.markAsRead(
                                notif.id,
                                userProfile.uid,
                              )
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all duration-300 ${
                              notif.unread
                                ? 'bg-[#17181D] border-cyan-500/20 cursor-pointer hover:border-cyan-400/40'
                                : 'bg-[#1D1F26]/40 border-zinc-800/50'
                            }`}
                          >
                            <div className='flex justify-between items-start gap-2 mb-1'>
                              <span className='text-[10px] font-bold text-white flex items-center gap-1'>
                                {notif.unread && (
                                  <span className='w-1.5 h-1.5 rounded-full bg-cyan-400' />
                                )}
                                {notif.title}
                              </span>
                              <span className='text-[8px] text-zinc-500 font-mono tracking-wider shrink-0'>
                                {notif.date}
                              </span>
                            </div>
                            <p className='text-[10px] text-zinc-400 font-light leading-snug'>
                              {notif.desc}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Register Member Shortcut button */}
              <button
                onClick={() => onNavigate('member-registration')}
                className='hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-[#CD7F32] to-[#F4C542] hover:brightness-110 text-black px-4 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer shadow-md'
              >
                <Zap className='w-3.5 h-3.5 fill-black' /> Register Member
              </button>

              {/* Logout button */}
              <button
                onClick={onLogout}
                className='text-zinc-400 hover:text-red-400 p-2 rounded-xl transition-colors cursor-pointer'
                title='Logout'
              >
                <LogOut className='w-5 h-5' />
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Frame */}
        <main className='max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-[100px] lg:pb-10 space-y-6'>
          {showMyDigitalWallet ? (
            <MyDigitalWallet
              userProfile={userProfile}
              wallet={wallet}
              cashinHistory={cashinHistory}
              cashoutHistory={cashoutHistory}
              orders={orderHistory}
              commissionHistory={commissionHistory}
              p2pReceivedHistory={p2pReceivedHistory}
              p2pSentHistory={p2pSentHistory}
              walletTransactions={walletTransactions}
              isLoading={loading}
              onRefresh={fetchDashboardData}
              onNavigate={onNavigate}
              onBack={() => applyRequestedAffiliateView('dashboard')}
            />
          ) : (
            <>
              <MemberWelcomeBanner
                userProfile={userProfile}
                onOpenPackage={() => onNavigate('package-selection')}
              />

              {businessCycle && isBusinessCycleCompleted && (
                <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden'>
                  <div className='absolute top-0 inset-y-0 left-0 w-1 bg-red-500' />
                  <div>
                    <h3 className='font-extrabold text-sm uppercase tracking-wider text-red-400 flex items-center gap-2'>
                      <ShieldAlert className='w-4 h-4 animate-pulse text-red-500' />{' '}
                      Business Cycle Completed
                    </h3>
                    <p className='text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed'>
                      Your member account remains {accountStatus}. Your current
                      Business Cycle reached its earnings cap, so commission
                      eligibility is paused until reactivation or upgrade.
                    </p>
                  </div>
                  <div className='flex gap-2.5 shrink-0 w-full md:w-auto mt-2 md:mt-0'>
                    <button
                      onClick={() => {
                        window.history.pushState(
                          {},
                          '',
                          '/package-selection?type=affiliate-business&action=reactivate',
                        )
                        onNavigate('package-selection')
                      }}
                      className='flex-1 md:flex-none px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-800 cursor-pointer transition-colors'
                    >
                      Reactivate Business Cycle
                    </button>
                    <button
                      onClick={() => {
                        window.history.pushState(
                          {},
                          '',
                          '/package-selection?type=affiliate-business&action=upgrade',
                        )
                        onNavigate('package-selection')
                      }}
                      className='flex-1 md:flex-none px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors'
                    >
                      Upgrade Package
                    </button>
                  </div>
                </div>
              )}
              {/* Reusable Chosen Wallet Card - Placed above the welcome banner */}
              <ChosenWalletCard
                uid={userProfile.uid}
                accountType={
                  userProfile.accountType as
                    | 'Customer'
                    | 'Smart Customer'
                    | 'Affiliate'
                }
                packageLevel={userProfile.packageLevel || 'None'}
                balanceCC={wallet?.chosenWalletBalance || 0}
                displayReferenceRatePHP={
                  ccSettings.displayReferenceRatePHP || 70
                }
                isLoading={loading}
                onCashIn={handleOpenMyDigitalWallet}
                onUpgrade={() => setShowUpgradeModal(true)}
                onTransfer={() => onNavigate('p2p-transfer')}
                canUpgrade={userProfile.packageLevel !== 'Regional Distributor'}
                canTransfer={true}
              />

              {/* Wallet Overview (Collapsible Card) */}
              <div className='bg-[#111318] border border-cyan-800/80 rounded-3xl shadow-xl overflow-hidden'>
                {/* Header Bar */}
                <div
                  onClick={() => setIsWalletExpanded((prev) => !prev)}
                  className='p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer select-none bg-[#171A22] border-b border-cyan-500/40 hover:bg-zinc-900/30 transition-colors gap-4 sm:gap-0'
                >
                  <div className='flex items-center gap-3'>
                    <div className='w-9 h-9 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 rounded-xl flex items-center justify-center'>
                      <WalletIcon className='w-4 h-4' />
                    </div>
                    <div>
                      <h3 className='font-extrabold text-sm text-white uppercase tracking-tight flex items-center gap-2'>
                        Wallet Portfolio Overview
                      </h3>
                      <p className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5'>
                        Chosen Credits • Earnings Balance
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end'>
                    <div className='flex items-center gap-4 text-sm sm:text-xs font-mono pr-2'>
                      <div>
                        <span className='text-zinc-400 uppercase text-[10px] sm:text-[8px] block font-bold'>
                          Chosen Balance
                        </span>
                        <span className='text-white font-black text-base sm:text-sm'>
                          {wallet
                            ? wallet.chosenWalletBalance.toFixed(2)
                            : '0.00'}{' '}
                          CC
                        </span>
                      </div>
                      <div className='w-px h-8 sm:h-6 bg-zinc-800' />
                      <div>
                        <span className='text-zinc-400 uppercase text-[10px] sm:text-[8px] block font-bold'>
                          Balance Commissions
                        </span>
                        <span className='text-amber-500 font-black text-base sm:text-sm'>
                          {wallet
                            ? wallet.commissionWalletBalance.toFixed(2)
                            : '0.00'}{' '}
                          CC
                        </span>
                      </div>
                    </div>

                    <div className='w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 shrink-0'>
                      {isWalletExpanded ? (
                        <ChevronUp className='w-4 h-4' />
                      ) : (
                        <ChevronDown className='w-4 h-4' />
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible content */}
                {isWalletExpanded && (
                  <div className='p-6 bg-[#111318] animate-fadeIn space-y-6'>
                    {/* Rest of Portfolio Grid (4 items: Commission, Marketing Support, Reward, and Cash Wallet) */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                      {/* Commission Wallet */}
                      <div className='bg-zinc-950 border border-cyan-800/80 rounded-2xl p-4 shadow-md relative overflow-hidden group'>
                        <div className='flex justify-between items-start mb-2'>
                          <span className='text-[11px] text-zinc-500 uppercase tracking-widest font-mono'>
                            Total Earnings
                          </span>
                          <div className='w-8 h-8 bg-amber-500/10 rounded-md flex items-center justify-center border border-amber-500/25 text-amber-500'>
                            <DollarSign className='w-5 h-5' />
                          </div>
                        </div>
                        <div className='text-base font-black tracking-tight text-white mb-0.5'>
                          {wallet
                            ? totalCommissionIncomeCC.toFixed(2)
                            : '0.00'}{' '}
                          CC
                        </div>
                        <div className='text-[11px] text-zinc-400 font-mono'>
                          ≈ ₱
                          {wallet
                            ? (
                                totalCommissionIncomeCC *
                                ccSettings.cashOutRatePHP
                              ).toLocaleString()
                            : '0'}
                        </div>
                      </div>

                      {/* Marketing Support Wallet */}
                      <div className='bg-zinc-950 border border-cyan-800/80 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                        <div className='flex justify-between items-start mb-2'>
                          <span className='text-[11px] text-zinc-500 uppercase tracking-widest font-mono'>
                            MSA
                          </span>
                          <div className='w-8 h-8 bg-blue-500/10 rounded-md flex items-center justify-center border border-blue-500/25 text-blue-400'>
                            <ChartNoAxesCombined className='w-5 h-5' />
                          </div>
                        </div>
                        <div className='text-base font-black tracking-tight text-white mb-0.5'>
                          {wallet
                            ? wallet.marketingSupportWalletBalance.toFixed(2)
                            : '0.00'}{' '}
                          CC
                        </div>
                        <div className='text-[11px] text-zinc-400 font-mono'>
                          ≈ ₱
                          {wallet
                            ? (
                                wallet.marketingSupportWalletBalance * 70
                              ).toLocaleString()
                            : '0'}
                        </div>
                        <div className='mt-3 h-6 flex items-center justify-center text-[8px] text-zinc-500 uppercase tracking-wider border border-zinc-900 bg-zinc-950 rounded-lg'>
                          Locked Balance
                        </div>
                      </div>

                      {/* Reward Wallet */}
                      <div className='bg-zinc-950 border border-cyan-800/80 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                        <div className='flex justify-between items-start mb-2'>
                          <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                            Today's Earnings
                          </span>
                          <div className='w-8 h-8 bg-emerald-500/10 rounded-md flex items-center justify-center border border-emerald-500/25 text-emerald-400'>
                            <ChartCandlestick className='w-5 h-5' />
                          </div>
                        </div>
                        <div className='text-base font-black tracking-tight text-white mb-0.5'>
                          {todaysEarningsCC.toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}{' '}
                          CC
                        </div>
                        <div className='text-[9px] text-zinc-400 font-mono'>
                          ≈{' '}
                          {new Intl.NumberFormat('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(
                            todaysEarningsCC *
                              (ccSettings?.cashOutRatePHP || 69),
                          )}
                        </div>
                        <div className='mt-3 h-6 flex items-center justify-center text-[8px] text-zinc-500 uppercase tracking-wider border border-zinc-900 bg-zinc-950 rounded-lg'>
                          Credited Today • Manila Time
                        </div>
                      </div>

                      {/* Cash Wallet */}
                      <div className='bg-zinc-950 border border-cyan-800/80 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                        <div className='flex justify-between items-start mb-2'>
                          <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                            Withdrawable Balance
                          </span>
                          <div className='w-8 h-8 bg-teal-500/10 rounded-md flex items-center justify-center border border-teal-500/25 text-teal-400'>
                            <BanknoteArrowDown className='w-5 h-5' />
                          </div>
                        </div>
                        <div className='text-base font-black tracking-tight text-white mb-0.5'>
                          {wallet
                            ? wallet.rewardWalletBalance.toFixed(2)
                            : '0.00'}{' '}
                          CC
                        </div>
                        <div className='text-[9px] text-zinc-400 font-mono'>
                          ≈ ₱
                          {wallet
                            ? (wallet.rewardWalletBalance * 70).toLocaleString()
                            : '0'}
                        </div>
                        <button
                          onClick={() => setShowCashoutModal(true)}
                          className='mt-3 w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-teal-500/40 text-white hover:text-teal-400 font-bold text-[9px] py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1'
                        >
                          <ArrowUpRight className='w-3.5 h-3.5' /> Request
                          Cash-Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shared Role-Aware Performance Cards System */}
              {!(
                userProfile?.accountType === 'Customer' &&
                userProfile?.packageLevel === 'None'
              ) && (
                <div className='my-6'>
                  <DashboardPerformanceCards
                    userProfile={userProfile}
                    onNavigate={onNavigate}
                    activeActionModal={activeActionModal}
                    setActiveActionModal={setActiveActionModal}
                    renderBusinessCycleProgress={renderBusinessCycleProgress}
                    renderRecentActivities={renderRecentActivities}
                  />
                </div>
              )}

              {/* AI Coach Advice Banner */}
              <div className='bg-zinc-950 border border-cyan-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group'>
                <div className='absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none' />
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
                  <div className='flex items-start gap-3'>
                    <div className='w-9 h-9 bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform'>
                      <MessageSquare className='w-4 h-4' />
                    </div>
                    <div>
                      <h4 className='font-extrabold text-xs text-white uppercase tracking-tight'>
                        Need help growing your business?
                      </h4>
                      <p className='text-zinc-400 text-xs mt-1 leading-relaxed font-light'>
                        Ask your AI Business Coach how to get your first
                        customers, invite members, and grow from Bronze to
                        Silver.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAICoachModal(true)}
                    className='bg-[#111318] border border-cyan-800 hover:border-cyan-500/40 hover:text-cyan-400 font-extrabold text-[10px] py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider shrink-0'
                  >
                    Ask AI Coach <Sparkles className='w-3 h-3 animate-pulse' />
                  </button>
                </div>
              </div>

              {/* Reusable Affiliate Growth & Referral Tools Section */}
              <AffiliateGrowthToolsSection userProfile={userProfile} />
            </>
          )}
        </main>

        {/* P2P Transfer Modal */}
        {showTransferModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn'>
            <div className='w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 bg-cyan-500 rounded-t-3xl' />
              <h3 className='text-lg font-black uppercase tracking-tight mb-1 text-white'>
                P2P Credit Transfer
              </h3>
              <p className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono mb-4'>
                Transfer Chosen Credits (CC) to other members instantly
              </p>

              {transferError && (
                <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4'>
                  {transferError}
                </div>
              )}
              {transferSuccess && (
                <div className='bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs mb-4'>
                  {transferSuccess}
                </div>
              )}

              <form onSubmit={handleTransferSubmit} className='space-y-4'>
                <div>
                  <label className='block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5'>
                    Recipient Account Email
                  </label>
                  <input
                    type='email'
                    required
                    placeholder='e.g. member@chosen.com'
                    value={transferRecipient}
                    onChange={(e) => setTransferRecipient(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all'
                  />
                </div>

                <div>
                  <label className='block text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5'>
                    Amount in Credits (CC)
                  </label>
                  <input
                    type='number'
                    required
                    min='1'
                    step='0.01'
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none transition-all'
                  />
                  <span className='block text-[9px] text-zinc-500 mt-1'>
                    A fixed Platform Transfer Fee of 1 CC is charged per
                    completed transfer.
                  </span>
                </div>

                <div className='flex gap-3 pt-2'>
                  <button
                    type='button'
                    onClick={() => setShowTransferModal(false)}
                    className='flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={transferLoading}
                    className='flex-1 bg-cyan-500 hover:brightness-110 text-black py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center'
                  >
                    {transferLoading ? 'Processing...' : 'Transfer Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AI Business Coach Chat Modal */}
        {showAICoachModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn'>
            <div className='w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative h-[500px] flex flex-col justify-between'>
              <div className='absolute top-0 inset-x-0 h-1 bg-teal-500 rounded-t-3xl' />

              <div className='flex justify-between items-center pb-3 border-b border-zinc-800/80'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 bg-teal-500/15 text-teal-400 rounded-lg flex items-center justify-center border border-teal-500/25'>
                    <Sparkles className='w-4 h-4' />
                  </div>
                  <div>
                    <h3 className='text-sm font-black uppercase tracking-tight text-white leading-none'>
                      AI Business Coach
                    </h3>
                    <span className='text-[8px] text-zinc-500 uppercase tracking-wider font-mono'>
                      Bronze Growth Companion
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAICoachModal(false)}
                  className='text-zinc-500 hover:text-white text-xs uppercase font-bold px-2 py-1'
                >
                  Close
                </button>
              </div>

              {/* Message History */}
              <div className='flex-1 overflow-y-auto my-4 space-y-4 pr-1 text-xs'>
                {aiCoachHistory.length === 0 ? (
                  <div className='text-center py-10 space-y-4'>
                    <p className='text-zinc-500'>
                      Welcome to your AI Business Coach! Select a suggested
                      topic below to begin planning your Bronze strategy:
                    </p>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto'>
                      <button
                        onClick={() =>
                          handleAskAICoach(
                            'How do I get my first 5 customers in IAM CHOSEN?',
                          )
                        }
                        className='bg-zinc-900 hover:bg-zinc-850 p-3 rounded-xl border border-zinc-850 hover:border-teal-500/30 text-left text-zinc-300 transition-all font-medium'
                      >
                        🎯 How to get my first 5 customers?
                      </button>
                      <button
                        onClick={() =>
                          handleAskAICoach(
                            'How can I invite members to register using my sponsor link?',
                          )
                        }
                        className='bg-zinc-900 hover:bg-zinc-850 p-3 rounded-xl border border-zinc-850 hover:border-teal-500/30 text-left text-zinc-300 transition-all font-medium'
                      >
                        👥 How to invite active members?
                      </button>
                      <button
                        onClick={() =>
                          handleAskAICoach(
                            'What is the fastest strategy to upgrade from Bronze to Silver?',
                          )
                        }
                        className='bg-zinc-900 hover:bg-zinc-850 p-3 rounded-xl border border-zinc-850 hover:border-teal-500/30 text-left text-zinc-300 transition-all font-medium'
                      >
                        🚀 Strategy: Upgrade to Silver
                      </button>
                      <button
                        onClick={() =>
                          handleAskAICoach(
                            'How do unilevel commission cycles and safety caps work?',
                          )
                        }
                        className='bg-zinc-900 hover:bg-zinc-850 p-3 rounded-xl border border-zinc-850 hover:border-teal-500/30 text-left text-zinc-300 transition-all font-medium'
                      >
                        🛡️ Understanding safety caps
                      </button>
                    </div>
                  </div>
                ) : (
                  aiCoachHistory.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`p-4 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-line border ${
                          m.sender === 'user'
                            ? 'bg-zinc-900 border-zinc-800 text-white'
                            : 'bg-teal-950/20 border-teal-500/10 text-zinc-100'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                {aiCoachLoading && (
                  <div className='flex justify-start'>
                    <div className='p-4 bg-zinc-900/40 border border-zinc-850 rounded-2xl flex items-center gap-2'>
                      <div className='w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping' />
                      <span className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono'>
                        Analyzing Business Guidelines...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input form */}
              <div className='flex gap-2 border-t border-zinc-800/80 pt-3'>
                <input
                  type='text'
                  placeholder='Ask how to build unilevel nodes or reach rank promotions...'
                  value={aiCoachQuery}
                  onChange={(e) => setAICoachQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAICoach()}
                  className='flex-1 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2.5 focus:outline-none focus:border-teal-500/50 text-xs text-white'
                />
                <button
                  onClick={() => handleAskAICoach()}
                  className='bg-teal-500 text-black font-extrabold px-6 py-2 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 cursor-pointer'
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Action Modals (Shop, Orders, Team, Commissions, Marketing, Academy, Support, QR Code) */}
        {activeActionModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn'>
            <div className='w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 bg-gold rounded-t-3xl' />

              {/* Modal Header */}
              <div className='flex justify-between items-start mb-4'>
                <h3 className='text-sm font-black uppercase tracking-tight text-white'>
                  {activeActionModal === 'shop' && 'Commerce Catalog'}
                  {activeActionModal === 'orders' && 'My Orders History'}
                  {activeActionModal === 'team' && 'My Downline Network'}
                  {activeActionModal === 'commissions' &&
                    'Unilevel Commissions Breakdown'}
                  {activeActionModal === 'marketing' &&
                    'Marketing Co-op Funding'}
                  {activeActionModal === 'academy' &&
                    'Ecosystem Training Academy'}
                  {activeActionModal === 'support' && 'Sponsor Help & Support'}
                  {activeActionModal === 'qrcode' && 'My Sponsor QR Code'}
                </h3>
                <button
                  onClick={() => setActiveActionModal(null)}
                  className='text-zinc-500 hover:text-white text-xs uppercase font-extrabold'
                >
                  Close
                </button>
              </div>

              {/* Modal Contents */}
              <div className='text-xs text-zinc-400 space-y-4'>
                {activeActionModal === 'shop' && (
                  <div className='space-y-4'>
                    <div className='p-4 bg-amber-500/5 border border-amber-500/10 text-amber-500 rounded-xl'>
                      <span className='block font-bold uppercase tracking-wider text-[11px] mb-1'>
                        Commerce Integration (Phase 3)
                      </span>
                      <p className='font-light leading-relaxed'>
                        The official corporate products commerce store catalog
                        is scheduled for rollout in Sprint 4.
                      </p>
                    </div>
                    <div className='bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 space-y-2'>
                      <span className='block font-bold text-white uppercase tracking-wider text-[10px]'>
                        Upcoming Products:
                      </span>
                      <div className='flex justify-between font-mono'>
                        <span>Pure Barley (1 Box)</span>
                        <span className='text-gold font-bold'>16 CC</span>
                      </div>
                      <div className='flex justify-between font-mono'>
                        <span>Iced Barley Coffee (1 Box)</span>
                        <span className='text-gold font-bold'>16 CC</span>
                      </div>
                      <div className='flex justify-between font-mono'>
                        <span>Barley Latte (1 Box)</span>
                        <span className='text-gold font-bold'>16 CC</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeActionModal === 'orders' && (
                  <div className='space-y-3'>
                    <div className='text-center py-6 text-zinc-500 font-light'>
                      No historic corporate orders found for this member ID.
                    </div>
                    <div className='bg-zinc-900/30 p-4 rounded-2xl border border-zinc-850/60 text-[11px]'>
                      <span className='block font-bold text-zinc-300 uppercase mb-1'>
                        Commerce Ingress
                      </span>
                      <p className='leading-relaxed'>
                        All package activations and repurchase records are
                        tracked directly on your active business plan cycle
                        ledger.
                      </p>
                    </div>
                  </div>
                )}

                {activeActionModal === 'team' && (
                  <div className='space-y-4'>
                    <div className='bg-zinc-900/40 p-4 rounded-2xl border border-zinc-850 text-center'>
                      <span className='block text-[8px] text-zinc-500 uppercase font-mono'>
                        Total Direct Referrals
                      </span>
                      <span className='text-2xl font-black text-white'>
                        {downlineList.length} Active Nodes
                      </span>
                    </div>

                    <div className='space-y-2 max-h-[220px] overflow-y-auto'>
                      {downlineList.length === 0 ? (
                        <p className='text-center text-zinc-500 py-6'>
                          You have no active downline members yet. Share your
                          sponsor link to register your first partner!
                        </p>
                      ) : (
                        downlineList.map((m, i) => (
                          <div
                            key={i}
                            className='bg-zinc-900/50 p-3 rounded-xl border border-zinc-850 flex justify-between items-center'
                          >
                            <div>
                              <span className='block font-bold text-white'>
                                {m.fullName}
                              </span>
                              <span className='block text-[8px] font-mono text-zinc-500 uppercase mt-0.5'>
                                {m.memberId} • Pack:{' '}
                                {m.packageLevel || 'Bronze'}
                              </span>
                            </div>
                            <span className='text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15'>
                              Active
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeActionModal === 'commissions' && (
                  <div className='space-y-3'>
                    <div className='grid grid-cols-2 gap-3'>
                      <div className='bg-zinc-900/40 p-4 rounded-xl border border-zinc-850'>
                        <span className='block text-[8px] text-zinc-500 uppercase font-mono mb-1'>
                          Direct Referrals
                        </span>
                        <span className='text-sm font-black text-white font-mono'>
                          {commissionSummary?.totalDirectReferral.toFixed(2)} CC
                        </span>
                      </div>
                      <div className='bg-zinc-900/40 p-4 rounded-xl border border-zinc-850'>
                        <span className='block text-[8px] text-zinc-500 uppercase font-mono mb-1'>
                          Unilevel Bonus
                        </span>
                        <span className='text-sm font-black text-white font-mono'>
                          {commissionSummary?.totalUnilevel.toFixed(2)} CC
                        </span>
                      </div>
                    </div>
                    <div className='p-4 bg-zinc-900/30 border border-zinc-850 rounded-2xl'>
                      <span className='block font-bold text-zinc-300 uppercase text-[10px] mb-1'>
                        Ecosystem Matching Guidelines
                      </span>
                      <p className='leading-relaxed text-[11px]'>
                        {getPackageConfig(userProfile.packageLevel).displayName}
                        s accumulate 4% on direct unilevel sales, subject to a
                        total lifecycle headroom of{' '}
                        {getPackageConfig(userProfile.packageLevel).cycleMax}{' '}
                        CC.
                      </p>
                    </div>
                  </div>
                )}

                {activeActionModal === 'marketing' && (
                  <div className='space-y-3 text-[11px] leading-relaxed'>
                    <p>
                      The **IAM CHOSEN Marketing Support Wallet** allocates
                      specialized co-op funding resources to qualified high-tier
                      affiliate leaders for regional offline branding and
                      localized distribution networks.
                    </p>
                    <p>
                      As a{' '}
                      <strong className='text-gold'>
                        {getPackageConfig(userProfile.packageLevel).displayName}
                      </strong>
                      , your allocation is safely tracked under your locked
                      support ledger, which releases upon upgrading and
                      achieving unilevel milestones.
                    </p>
                  </div>
                )}

                {activeActionModal === 'academy' && (
                  <div className='space-y-3'>
                    <div className='bg-zinc-900/40 p-3 rounded-xl border border-zinc-850 flex items-center gap-3'>
                      <div className='w-8 h-8 bg-gold/10 text-gold rounded flex items-center justify-center shrink-0'>
                        <BookOpen className='w-4 h-4' />
                      </div>
                      <div>
                        <span className='block font-bold text-white'>
                          Ecosystem Welcome Guide
                        </span>
                        <span className='block text-[9px] text-zinc-500'>
                          Video Lecture • 12 mins
                        </span>
                      </div>
                    </div>
                    <div className='bg-zinc-900/40 p-3 rounded-xl border border-zinc-850 flex items-center gap-3'>
                      <div className='w-8 h-8 bg-gold/10 text-gold rounded flex items-center justify-center shrink-0'>
                        <BookOpen className='w-4 h-4' />
                      </div>
                      <div>
                        <span className='block font-bold text-white'>
                          Understanding Safety Caps
                        </span>
                        <span className='block text-[9px] text-zinc-500'>
                          Presentation Slides • PDF
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeActionModal === 'support' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      alert('Support ticket created successfully.')
                      setActiveActionModal(null)
                    }}
                    className='space-y-3'
                  >
                    <div>
                      <label className='block text-[9px] uppercase tracking-wider text-zinc-400 font-bold mb-1'>
                        Subject
                      </label>
                      <input
                        type='text'
                        required
                        placeholder='e.g. Wallet Verification'
                        className='w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2 text-xs focus:outline-none'
                      />
                    </div>
                    <div>
                      <label className='block text-[9px] uppercase tracking-wider text-zinc-400 font-bold mb-1'>
                        Message Description
                      </label>
                      <textarea
                        required
                        placeholder='Describe your inquiry...'
                        className='w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2 text-xs h-16 resize-none focus:outline-none'
                      />
                    </div>
                    <button
                      type='submit'
                      className='w-full gold-gradient text-black font-extrabold py-2 rounded-xl uppercase text-[10px] tracking-wider transition-all hover:brightness-110'
                    >
                      Submit Support Ticket
                    </button>
                  </form>
                )}

                {activeActionModal === 'qrcode' && (
                  <div className='text-center py-6 space-y-4'>
                    <div className='bg-white p-4 rounded-2xl w-44 h-44 mx-auto flex items-center justify-center border border-zinc-200 shadow-md'>
                      <QrCode className='w-36 h-36 text-black' />
                    </div>
                    <p className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono'>
                      Scan to register directly under {userProfile.fullName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECURED PACKAGE UPGRADE SUCCESS MODAL */}
        {showUpgradeSuccessModal && upgradeResult && (
          <div
            className='fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn overflow-y-auto'
            role='dialog'
            aria-modal='true'
            aria-labelledby='upgrade-success-title'
            aria-describedby='upgrade-success-description'
          >
            <div className='w-full max-w-lg bg-zinc-950 border border-emerald-500/25 rounded-3xl p-7 my-8 shadow-[0_24px_80px_rgba(0,0,0,0.75)] relative overflow-hidden'>
              <div className='absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400' />
              <div className='absolute -right-12 -top-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-[70px] pointer-events-none' />

              <div className='relative'>
                <div className='w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.12)]'>
                  <CheckCircle className='w-9 h-9' />
                </div>

                <div className='text-center mt-5'>
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 font-mono'>
                    <ShieldCheck className='w-3.5 h-3.5' />
                    Secured Upgrade Completed
                  </span>
                  <h3
                    id='upgrade-success-title'
                    className='mt-4 text-2xl font-black uppercase tracking-tight text-white'
                  >
                    Affiliate Package Upgraded
                  </h3>
                  <p
                    id='upgrade-success-description'
                    className='mt-2 text-xs leading-relaxed text-zinc-400'
                  >
                    Your package, wallet debit, new Business Cycle, MSA
                    entitlement, and compensation processing were confirmed by
                    the secured package engine.
                  </p>
                </div>

                <div className='mt-6 rounded-2xl border border-zinc-800 bg-[#0B0D12] p-5'>
                  <div className='grid grid-cols-1 gap-3 text-xs sm:grid-cols-2'>
                    <div>
                      <span className='block text-[8px] font-black uppercase tracking-widest text-zinc-500 font-mono'>
                        New Package
                      </span>
                      <span className='mt-1 block font-extrabold text-emerald-400'>
                        {upgradeResult.packageLevel || selectedUpgradeLevel}
                      </span>
                    </div>
                    <div>
                      <span className='block text-[8px] font-black uppercase tracking-widest text-zinc-500 font-mono'>
                        Wallet Debited
                      </span>
                      <span className='mt-1 block font-extrabold text-white font-mono'>
                        {Number(upgradeResult.walletDebitedCC || 0).toFixed(2)}{' '}
                        CC
                      </span>
                    </div>
                    <div>
                      <span className='block text-[8px] font-black uppercase tracking-widest text-zinc-500 font-mono'>
                        Wallet Balance
                      </span>
                      <span className='mt-1 block font-extrabold text-cyan-400 font-mono'>
                        {Number(
                          upgradeResult.walletBalanceAfterCC || 0,
                        ).toFixed(2)}{' '}
                        CC
                      </span>
                    </div>
                    <div>
                      <span className='block text-[8px] font-black uppercase tracking-widest text-zinc-500 font-mono'>
                        Final Status
                      </span>
                      <span className='mt-1 block font-extrabold text-emerald-400'>
                        {upgradeResult.overallStatus ||
                          upgradeResult.compensationStatus ||
                          'COMPLETED'}
                      </span>
                    </div>
                  </div>

                  <div className='mt-4 border-t border-zinc-900 pt-4'>
                    <span className='block text-[8px] font-black uppercase tracking-widest text-zinc-500 font-mono'>
                      Activation Reference
                    </span>
                    <span className='mt-1 block break-all text-[10px] font-bold text-zinc-300 font-mono'>
                      {upgradeResult.activationEventId || 'Confirmed'}
                    </span>
                  </div>
                </div>

                <div className='mt-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-3.5 text-center'>
                  <div className='flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300'>
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        upgradeRedirecting ? 'animate-spin' : ''
                      }`}
                    />
                    {upgradeRedirecting
                      ? 'Refreshing your dashboard...'
                      : `Returning to the main dashboard in ${upgradeRedirectSeconds} seconds`}
                  </div>
                </div>

                <button
                  type='button'
                  onClick={returnToMainDashboardAfterUpgrade}
                  disabled={upgradeRedirecting}
                  className='mt-5 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-black py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait'
                >
                  {upgradeRedirecting ? (
                    <>
                      <RefreshCw className='w-4 h-4 animate-spin' />
                      Refreshing Dashboard
                    </>
                  ) : (
                    <>
                      Go to Main Dashboard Now
                      <ChevronRight className='w-4 h-4' />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Package Upgrade Modal */}
        {showUpgradeModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto'>
            <div className='w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 my-8 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-3xl' />

              <h3 className='text-xl font-bold uppercase tracking-tight mb-1 text-white gold-text'>
                Upgrade Affiliate Package
              </h3>
              <p className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono mb-6'>
                Instant self-service package expansion
              </p>

              {upgradeError && (
                <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4'>
                  {upgradeError}
                </div>
              )}

              {upgradeSuccess && (
                <div className='bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs mb-4 font-bold text-center'>
                  {upgradeSuccess}
                </div>
              )}

              {upgradeResult && (
                <div className='mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-[11px] text-zinc-300'>
                  <div className='mb-3 text-[10px] font-black uppercase tracking-widest text-cyan-400'>
                    Secured Activation Receipt
                  </div>
                  <div className='grid grid-cols-1 gap-2 font-mono sm:grid-cols-2'>
                    <span>
                      Event: {upgradeResult.activationEventId || 'Processing'}
                    </span>
                    <span>
                      Transaction:{' '}
                      {upgradeResult.packageTransactionId || 'Processing'}
                    </span>
                    <span>
                      Business Cycle:{' '}
                      {upgradeResult.businessCycleId || 'Processing'}
                    </span>
                    <span>
                      MSA Entitlement:{' '}
                      {upgradeResult.msaEntitlementId || 'Processing'}
                    </span>
                    <span>
                      Direct Referral:{' '}
                      {Number(upgradeResult.directReferralTotalCC || 0).toFixed(
                        2,
                      )}{' '}
                      CC
                    </span>
                    <span>
                      Indirect Referral:{' '}
                      {Number(
                        upgradeResult.indirectReferralTotalCC || 0,
                      ).toFixed(2)}{' '}
                      CC
                    </span>
                    <span>
                      Leadership:{' '}
                      {Number(
                        upgradeResult.leadershipFromReferralTotalCC || 0,
                      ).toFixed(2)}{' '}
                      CC
                    </span>
                    <span>
                      Status:{' '}
                      {upgradeResult.compensationStatus ||
                        upgradeResult.overallStatus ||
                        'Submitted'}
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleUpgradeSubmit} className='space-y-4'>
                <div className='grid grid-cols-2 gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/60'>
                  <div>
                    <span className='block text-[8px] text-zinc-500 uppercase tracking-wider font-semibold font-mono'>
                      Current Tier
                    </span>
                    <span className='text-sm font-bold text-white block mt-0.5'>
                      {userProfile.packageLevel || 'Bronze'}
                    </span>
                  </div>
                  <div>
                    <span className='block text-[8px] text-zinc-500 uppercase tracking-wider font-semibold font-mono'>
                      Usable Balance
                    </span>
                    <span className='text-sm font-black text-gold block mt-0.5'>
                      {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'}{' '}
                      CC
                    </span>
                  </div>
                </div>

                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Select Target Package Level
                  </label>
                  <select
                    required
                    value={selectedUpgradeLevel}
                    onChange={(e) => setSelectedUpgradeLevel(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors text-white'
                  >
                    <option value=''>-- Choose Package Level --</option>
                    {(() => {
                      const valCCMap: Record<string, number> = {
                        Bronze: 50,
                        Silver: 350,
                        Gold: 1500,
                        Platinum: 3000,
                        Diamond: 5000,
                        'City Distributor': 25000,
                        'Regional Distributor': 100000,
                      }
                      const currentVal =
                        valCCMap[userProfile.packageLevel || 'Bronze'] || 0

                      return Object.entries(valCCMap)
                        .filter(([level, val]) => val > currentVal)
                        .map(([level, val]) => (
                          <option key={level} value={level}>
                            {level} Package ({val} CC)
                          </option>
                        ))
                    })()}
                  </select>
                </div>

                {selectedUpgradeLevel &&
                  (() => {
                    const valCCMap: Record<string, number> = {
                      Bronze: 50,
                      Silver: 350,
                      Gold: 1500,
                      Platinum: 3000,
                      Diamond: 5000,
                      'City Distributor': 25000,
                      'Regional Distributor': 100000,
                    }
                    const capCCMap: Record<string, number> = {
                      Bronze: 125,
                      Silver: 875,
                      Gold: 3750,
                      Platinum: 7500,
                      Diamond: 12500,
                      'City Distributor': 62500,
                      'Regional Distributor': 250000,
                    }

                    const currentLevel = userProfile.packageLevel || 'Bronze'
                    const currentVal = valCCMap[currentLevel] || 0
                    const currentCap = capCCMap[currentLevel] || 0

                    const targetVal = valCCMap[selectedUpgradeLevel] || 0
                    const targetCap = capCCMap[selectedUpgradeLevel] || 0

                    const fullPackagePriceCC = targetVal
                    const balance = wallet?.chosenWalletBalance || 0
                    const isInsufficient = balance < fullPackagePriceCC

                    return (
                      <div className='bg-zinc-900/60 border border-zinc-800/40 p-4 rounded-2xl text-xs space-y-3'>
                        <span className='block font-bold text-zinc-300 uppercase tracking-widest text-[9px] mb-1'>
                          Upgrade Comparison
                        </span>

                        <div className='grid grid-cols-3 text-zinc-500 font-mono pb-1 border-b border-zinc-800/40'>
                          <span>Spec</span>
                          <span className='text-center'>Current</span>
                          <span className='text-right text-white'>Target</span>
                        </div>

                        <div className='flex justify-between text-zinc-400'>
                          <span>Package Value:</span>
                          <span className='font-mono text-zinc-500'>
                            {currentVal} CC
                          </span>
                          <span className='font-mono text-emerald-400 font-bold'>
                            → {targetVal} CC
                          </span>
                        </div>

                        <div className='flex justify-between text-zinc-400'>
                          <span>Earnings Cap:</span>
                          <span className='font-mono text-zinc-500'>
                            {currentCap} CC
                          </span>
                          <span className='font-mono text-cyan-400 font-bold'>
                            → {targetCap} CC
                          </span>
                        </div>

                        <div className='border-t border-zinc-800/60 pt-3 flex justify-between items-center text-sm'>
                          <span className='font-bold text-zinc-300 uppercase tracking-wider text-[10px]'>
                            Full Package Price:
                          </span>
                          <span className='font-black text-gold font-mono text-base'>
                            {fullPackagePriceCC.toFixed(2)} CC
                          </span>
                        </div>

                        {isInsufficient && (
                          <div className='mt-2 bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-[11px] leading-relaxed'>
                            ⚠️ <strong>Insufficient credits.</strong> You need
                            an additional{' '}
                            <strong>
                              {(fullPackagePriceCC - balance).toFixed(2)} CC
                            </strong>{' '}
                            to complete this upgrade. Please close this modal
                            and click "Cash-In" to top up.
                          </div>
                        )}
                      </div>
                    )
                  })()}

                <div className='flex gap-3 pt-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowUpgradeModal(false)
                      setSelectedUpgradeLevel('')
                      setUpgradeError(null)
                      setUpgradeSuccess(null)
                      setUpgradeResult(null)
                    }}
                    className='flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={
                      upgradeLoading ||
                      !selectedUpgradeLevel ||
                      (() => {
                        const valCCMap: Record<string, number> = {
                          Bronze: 50,
                          Silver: 350,
                          Gold: 1500,
                          Platinum: 3000,
                          Diamond: 5000,
                          'City Distributor': 25000,
                          'Regional Distributor': 100000,
                        }
                        const fullPackagePriceCC =
                          valCCMap[selectedUpgradeLevel] || 0
                        return (
                          (wallet?.chosenWalletBalance || 0) <
                          fullPackagePriceCC
                        )
                      })()
                    }
                    className='flex-1 gold-gradient hover:brightness-110 text-black py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {upgradeLoading ? (
                      <div className='w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin' />
                    ) : (
                      'Confirm Upgrade'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Business Cycle Completed Modal */}
        {showCompletedModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto'>
            <div className='w-full max-w-md bg-zinc-950 border border-zinc-850 rounded-3xl p-8 shadow-2xl relative overflow-hidden'>
              <div className='absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-gold to-yellow-300' />
              <div className='absolute top-1/2 right-1/4 -translate-y-1/2 w-32 h-32 bg-gold/5 rounded-full blur-[50px] pointer-events-none' />

              <div className='w-16 h-16 bg-gold/10 border border-gold/25 text-gold rounded-2xl flex items-center justify-center mb-6'>
                <ShieldAlert className='w-8 h-8 animate-pulse text-gold' />
              </div>

              <h3 className='text-2xl font-black uppercase tracking-tight text-white mb-3'>
                Business Cycle Completed
              </h3>

              <p className='text-zinc-300 text-sm font-light leading-relaxed mb-6'>
                You have reached your current Business Cycle earning capacity.
                Your member account remains {accountStatus}. To continue
                receiving commission earnings, reactivate your current Business
                Cycle or upgrade to a higher package.
              </p>

              <div className='space-y-3'>
                <button
                  onClick={() => {
                    window.history.pushState(
                      {},
                      '',
                      '/package-selection?type=affiliate-business&action=reactivate',
                    )
                    onNavigate('package-selection')
                  }}
                  className='w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl border border-zinc-800 cursor-pointer transition-colors'
                >
                  Reactivate Business Cycle
                </button>
                <button
                  onClick={() => {
                    window.history.pushState(
                      {},
                      '',
                      '/package-selection?type=affiliate-business&action=upgrade',
                    )
                    onNavigate('package-selection')
                  }}
                  className='w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors'
                >
                  Upgrade Package
                </button>
                <button
                  onClick={() => setShowCompletedModal(false)}
                  className='w-full py-2.5 text-zinc-500 hover:text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer text-center'
                >
                  Dismiss & View Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cash-Out Modal */}
        {showCashoutModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto'>
            <div className='w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 my-8 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-t-3xl' />

              <h3 className='text-xl font-bold uppercase tracking-tight mb-2 text-white'>
                Request Cash-Out
              </h3>
              <p className='text-xs text-zinc-500 uppercase tracking-widest font-mono mb-6'>
                Convert Commission Wallet credits into local currency
              </p>

              {cashoutError && (
                <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4'>
                  {cashoutError}
                </div>
              )}

              {cashoutSuccess && (
                <div className='bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs mb-4'>
                  {cashoutSuccess}
                </div>
              )}

              <form onSubmit={handleCashoutSubmit} className='space-y-4'>
                <div>
                  <label className='block text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1.5'>
                    Amount to Cash-Out (CC)
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      required
                      min='1'
                      step='any'
                      value={cashoutAmountCC}
                      onChange={(e) =>
                        setCashoutAmountCC(Number(e.target.value))
                      }
                      className='w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500'
                      placeholder='Enter CC amount'
                    />
                    <div className='absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold font-mono'>
                      CC
                    </div>
                  </div>
                  <p className='text-[10px] text-zinc-500 mt-1'>
                    Available Commission:{' '}
                    {wallet
                      ? wallet.commissionWalletBalance.toFixed(2)
                      : '0.00'}{' '}
                    CC
                  </p>
                </div>

                <div>
                  <label className='block text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1.5'>
                    Payout Gateway Channel
                  </label>
                  <select
                    value={payoutChannel}
                    onChange={(e: any) => setPayoutChannel(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer'
                  >
                    <option value='GCash'>GCash</option>
                    <option value='Maya'>Maya</option>
                    <option value='Bank'>Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className='block text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1.5'>
                    Destination Account / Mobile Number
                  </label>
                  <input
                    type='text'
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountName(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500'
                    placeholder='e.g. 09171234567 or Bank details'
                  />
                </div>

                <div className='pt-4 flex items-center justify-end gap-3 border-t border-zinc-900'>
                  <button
                    type='button'
                    onClick={() => setShowCashoutModal(false)}
                    className='px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={loading}
                    className='px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 shadow-md'
                  >
                    {loading ? 'Processing...' : 'Submit Cash-Out'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <BottomNavigation
          activeTab={activeMobileTab}
          setActiveTab={handleMobileTabChange}
          unreadCount={notifications.filter((n) => n.unread).length}
          role='Affiliate'
        />

        {/* Footer version indicator */}
        <footer className='py-8 border-t border-cyan-950/20 bg-zinc-950/40 text-center'>
          <span className='text-[10px] text-zinc-500 font-mono'>
            I AM CHOSEN • Version v1.7.1 • Build 000027
          </span>
        </footer>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  UserCheck,
  Shield,
  Award,
  ArrowLeft,
  RefreshCw,
  Layers,
  Sparkles,
  TrendingUp,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  Activity,
  Database,
  ShoppingBag,
  Check,
  X,
  Plus,
  Server,
  Inbox,
  LogOut,
  Sliders,
  DollarSign,
  ArrowUpRight,
  FileText,
  PieChart,
  Brain,
  BookOpen,
  Terminal,
  Settings,
  Search,
  Package,
  History,
  HelpCircle,
  Globe,
  Share2,
  Calendar,
  Lock,
  MessageSquare,
  FileSpreadsheet,
  Network,
  Eye,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  db,
  approvePendingAffiliate,
  createAuditLog,
  approveCashInAndActivatePackage,
} from '../firebase'
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { UserProfile, Wallet as WalletType } from '../types'
import ChosenLogo from './ChosenLogo'
import { useCCSettings } from '../context/CCSettingsContext'
import ReactivationReport from './ReactivationReport'
import TechOpsTreasuryDashboard from './TechOpsTreasuryDashboard'

interface SuperAdminDashboardProps {
  onNavigate: (page: string) => void
  currentUserProfile: UserProfile
  onLogout: () => void
}

interface InventoryItem {
  id: string
  name: string
  sku: string
  category: string
  priceCC: number
  phpPrice: number
  stock: number
  status: string
}

type UnknownRecord = Record<string, unknown>

interface NormalizedCashInRequest extends UnknownRecord {
  id: string
  requestId: string
  uid: string
  fullName: string
  memberId: string
  requestedAt: string
  paymentChannel: string
  senderAccountName: string
  senderAccountNumber: string
  referenceNumber: string
  proofOfPaymentUrl: string
  amountPhp: number
  amountCC: number
  status: string
}

interface PackageActivationReportRecord extends UnknownRecord {
  id: string
  activationEventId: string
  uid: string
  memberId: string
  activationAction: string
  previousPackageLevel: string
  newPackageLevel: string
  packageValueCC: number
  walletDebitedCC: number
  directReferralTotalCC: number
  indirectReferralTotalCC: number
  leadershipFromReferralTotalCC: number
  msaEntitlementAmountCC: number
  overallStatus: string
  createdAt: string
}

interface CompensationReportRecord extends UnknownRecord {
  id: string
  commissionType: string
  referralBonusType: string
  leadershipSourceType: string
  activationEventId: string
  earnerUid: string
  earnerMemberId: string
  sourceMemberId: string
  level: number
  amountCC: number
  status: string
  ruleVersion: string
  createdAt: string
}

interface MsaEntitlementReportRecord extends UnknownRecord {
  id: string
  activationEventId: string
  uid: string
  memberId: string
  packageLevel: string
  amountCC: number
  status: string
  createdAt: string
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function normalizeCashInRequest(
  documentId: string,
  rawData: UnknownRecord,
): NormalizedCashInRequest {
  return {
    ...rawData,
    id: documentId,
    requestId:
      readString(rawData.requestId, rawData.id, documentId) || documentId,
    uid: readString(rawData.uid),
    fullName: readString(rawData.fullName) || 'Unknown Member',
    memberId: readString(rawData.memberId) || 'Unavailable',
    requestedAt: readString(
      rawData.requestedAt,
      rawData.requestDate,
      rawData.createdAt,
      rawData.updatedAt,
    ),
    paymentChannel:
      readString(rawData.paymentChannel, rawData.paymentMethod) ||
      'Unavailable',
    senderAccountName:
      readString(rawData.senderAccountName, rawData.accountName) ||
      'Unavailable',
    senderAccountNumber:
      readString(rawData.senderAccountNumber, rawData.accountNumber) ||
      'Unavailable',
    referenceNumber: readString(rawData.referenceNumber) || 'Unavailable',
    proofOfPaymentUrl: readString(rawData.proofOfPaymentUrl),
    amountPhp: readFiniteNumber(rawData.amountPhp, rawData.amountPHP),
    amountCC: readFiniteNumber(rawData.amountCC, rawData.computedCC),
    status: readString(rawData.status) || 'Pending',
  }
}

function normalizeDateValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().toISOString()
    }
    if (typeof maybeTimestamp.seconds === 'number') {
      return new Date(maybeTimestamp.seconds * 1000).toISOString()
    }
  }
  return ''
}

function normalizePackageActivationReport(
  documentId: string,
  rawData: UnknownRecord,
): PackageActivationReportRecord {
  return {
    ...rawData,
    id: documentId,
    activationEventId:
      readString(rawData.activationEventId, rawData.eventId, documentId) ||
      documentId,
    uid: readString(rawData.uid),
    memberId: readString(rawData.memberId) || 'Unavailable',
    activationAction: readString(rawData.activationAction, rawData.action),
    previousPackageLevel:
      readString(rawData.previousPackageLevel, rawData.fromPackageLevel) ||
      'None',
    newPackageLevel:
      readString(rawData.newPackageLevel, rawData.packageLevel) || 'Unknown',
    packageValueCC: readFiniteNumber(
      rawData.packageValueCC,
      rawData.packagePriceCC,
    ),
    walletDebitedCC: readFiniteNumber(
      rawData.walletDebitedCC,
      rawData.amountCC,
    ),
    directReferralTotalCC: readFiniteNumber(rawData.directReferralTotalCC),
    indirectReferralTotalCC: readFiniteNumber(rawData.indirectReferralTotalCC),
    leadershipFromReferralTotalCC: readFiniteNumber(
      rawData.leadershipFromReferralTotalCC,
      rawData.leadershipTotalCC,
    ),
    msaEntitlementAmountCC: readFiniteNumber(
      rawData.msaEntitlementAmountCC,
      rawData.msaAmountCC,
    ),
    overallStatus:
      readString(rawData.overallStatus, rawData.status) || 'Unknown',
    createdAt: normalizeDateValue(
      rawData.createdAt || rawData.completedAt || rawData.updatedAt,
    ),
  }
}

function normalizeCompensationReport(
  documentId: string,
  rawData: UnknownRecord,
): CompensationReportRecord {
  return {
    ...rawData,
    id: documentId,
    commissionType: readString(
      rawData.commissionType,
      rawData.type,
      rawData.bonusType,
    ),
    referralBonusType: readString(
      rawData.referralBonusType,
      rawData.referralType,
    ),
    leadershipSourceType: readString(
      rawData.leadershipSourceType,
      rawData.sourceType,
    ),
    activationEventId: readString(rawData.activationEventId, rawData.eventId),
    earnerUid: readString(rawData.earnerUid, rawData.uid),
    earnerMemberId:
      readString(rawData.earnerMemberId, rawData.memberId) || 'Unavailable',
    sourceMemberId: readString(rawData.sourceMemberId) || 'Unavailable',
    level: readFiniteNumber(rawData.level, rawData.referralLevel),
    amountCC: readFiniteNumber(rawData.amountCC, rawData.amount),
    status: readString(rawData.status) || 'Unknown',
    ruleVersion: readString(rawData.ruleVersion) || 'Unversioned',
    createdAt: normalizeDateValue(rawData.createdAt || rawData.timestamp),
  }
}

function normalizeMsaEntitlementReport(
  documentId: string,
  rawData: UnknownRecord,
): MsaEntitlementReportRecord {
  return {
    ...rawData,
    id: documentId,
    activationEventId: readString(rawData.activationEventId, rawData.eventId),
    uid: readString(rawData.uid),
    memberId: readString(rawData.memberId) || 'Unavailable',
    packageLevel: readString(rawData.packageLevel) || 'Unknown',
    amountCC: readFiniteNumber(
      rawData.amountCC,
      rawData.entitlementAmountCC,
      rawData.msaAmountCC,
    ),
    status: readString(rawData.status) || 'Pending',
    createdAt: normalizeDateValue(rawData.createdAt || rawData.updatedAt),
  }
}

function isReferralCommission(record: CompensationReportRecord): boolean {
  return record.commissionType.toLowerCase().includes('referral')
}

function isLeadershipCommission(record: CompensationReportRecord): boolean {
  return record.commissionType.toLowerCase().includes('leadership')
}

function formatCashInDate(value: string): string {
  if (!value) {
    return 'Date unavailable'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date)
}

type ActiveTab =
  | 'overview' // Dashboard Overview
  | 'members' // Members
  | 'products' // Products
  | 'orders' // Orders
  | 'inventory' // Inventory
  | 'wallet-management' // Chosen Wallet Management
  | 'commission-engine' // Commission Engine
  | 'marketing-support' // Marketing Support Allocation
  | 'cashout-approval' // Cash-Out Approval
  | 'cashin-approval' // Cash-In Approval
  | 'treasury' // Platform Treasury & Technology Operations Fee Monitoring
  | 'p2p-marketplace' // P2P Marketplace
  | 'reports' // Reports
  | 'analytics' // Analytics
  | 'leadership' // Leadership Dashboard
  | 'ai-coach' // AI Business Coach
  | 'academy' // Training Academy
  | 'audit-logs' // Audit Logs
  | 'settings' // System Settings

export default function SuperAdminDashboard({
  onNavigate,
  currentUserProfile,
  onLogout,
}: SuperAdminDashboardProps) {
  const { ccSettings, updateRates } = useCCSettings()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (error) {
      window.showError?.(error, 'Super Admin Action Error')
    }
  }, [error])

  useEffect(() => {
    if (success) {
      window.showSuccess?.(success, 'Super Admin Action Succeeded')
    }
  }, [success])
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

  // Enterprise Stats state
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalCustomers: 0,
    totalAffiliates: 0,
    cityDistributors: 0,
    regionalDistributors: 0,
    totalSalesCC: 0,
    totalSalesPhp: 0,
    totalOrders: 0,
    packageSalesCC: 0,
    pendingCashOutCount: 0,
    pendingPackageActivationsCount: 0,
    totalCCIssued: 0,
    totalCommissionPaid: 0,
    totalMarketingAllocation: 0,
    p2pVolumeCC: 0,
    totalFlushedBusinessCycleCC: 0,
    onlineUsers: 12,
  })

  // Database / List states
  const [userList, setUserList] = useState<UserProfile[]>([])
  const [walletList, setWalletList] = useState<WalletType[]>([])
  const [txList, setTxList] = useState<any[]>([])
  const [cashoutList, setCashoutList] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [packageActivationReports, setPackageActivationReports] = useState<
    PackageActivationReportRecord[]
  >([])
  const [compensationReports, setCompensationReports] = useState<
    CompensationReportRecord[]
  >([])
  const [msaEntitlementReports, setMsaEntitlementReports] = useState<
    MsaEntitlementReportRecord[]
  >([])
  const [reportLoadWarnings, setReportLoadWarnings] = useState<string[]>([])
  const [reportSearchQuery, setReportSearchQuery] = useState('')
  const [reportTypeFilter, setReportTypeFilter] = useState('All')
  const [reportStatusFilter, setReportStatusFilter] = useState('All')

  const [pendingCashOuts, setPendingCashOuts] = useState<any[]>([])
  const [cashinRequests, setCashinRequests] = useState<any[]>([])
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [pendingActivations, setPendingActivations] = useState<any[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [packageChartData, setPackageChartData] = useState<any[]>([])
  const [salesTrendData, setSalesTrendData] = useState<any[]>([])

  // CC Conversion settings temporary inputs
  const [tempCashInRate, setTempCashInRate] = useState<number>(70)
  const [tempCashOutRate, setTempCashOutRate] = useState<number>(69)
  const [rateSaveSuccess, setRateSaveSuccess] = useState<boolean>(false)
  const [rateSaveError, setRateSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (ccSettings) {
      setTempCashInRate(ccSettings.cashInRatePHP)
      setTempCashOutRate(ccSettings.cashOutRatePHP)
    }
  }, [ccSettings])

  // Simulation rate multiplier
  const [onlineUsers, setOnlineUsers] = useState(18)

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('')

  // Audit log filters
  const [auditLimit, setAuditLimit] = useState<number>(50)
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('')
  const [auditActionFilter, setAuditActionFilter] = useState<string>('All')
  const [auditEmailFilter, setAuditEmailFilter] = useState<string>('All')

  // Extract unique actions & actor emails for filters
  const uniqueActions = useMemo(() => {
    const actions = auditLogs.map((log) => log.action).filter(Boolean)
    return ['All', ...Array.from(new Set(actions))]
  }, [auditLogs])

  const uniqueEmails = useMemo(() => {
    const emails = auditLogs.map((log) => log.actorEmail).filter(Boolean)
    return ['All', ...Array.from(new Set(emails))]
  }, [auditLogs])

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // 1. Search filter
      const matchesSearch =
        auditSearchQuery === '' ||
        (log.details &&
          log.details.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
        (log.actorEmail &&
          log.actorEmail
            .toLowerCase()
            .includes(auditSearchQuery.toLowerCase())) ||
        (log.action &&
          log.action.toLowerCase().includes(auditSearchQuery.toLowerCase()))

      // 2. Action filter
      const matchesAction =
        auditActionFilter === 'All' || log.action === auditActionFilter

      // 3. Operational Email filter
      const matchesEmail =
        auditEmailFilter === 'All' || log.actorEmail === auditEmailFilter

      return matchesSearch && matchesAction && matchesEmail
    })
  }, [auditLogs, auditSearchQuery, auditActionFilter, auditEmailFilter])

  const displayedAuditLogs = useMemo(() => {
    return filteredAuditLogs.slice(0, auditLimit)
  }, [filteredAuditLogs, auditLimit])

  const directReferralReports = useMemo(
    () =>
      compensationReports.filter(
        (record) =>
          isReferralCommission(record) &&
          (record.referralBonusType.toLowerCase() === 'direct' ||
            record.level === 1),
      ),
    [compensationReports],
  )

  const indirectReferralReports = useMemo(
    () =>
      compensationReports.filter(
        (record) =>
          isReferralCommission(record) &&
          !directReferralReports.some((direct) => direct.id === record.id),
      ),
    [compensationReports, directReferralReports],
  )

  const leadershipReports = useMemo(
    () => compensationReports.filter(isLeadershipCommission),
    [compensationReports],
  )

  const sumCompensationAmount = (records: CompensationReportRecord[]) =>
    records.reduce((total, record) => total + Number(record.amountCC || 0), 0)

  const filteredCompensationReports = useMemo(() => {
    const normalizedSearch = reportSearchQuery.trim().toLowerCase()

    return compensationReports.filter((record) => {
      const direct =
        isReferralCommission(record) &&
        (record.referralBonusType.toLowerCase() === 'direct' ||
          record.level === 1)
      const category = isLeadershipCommission(record)
        ? 'Leadership Bonus'
        : direct
          ? 'Direct Referral'
          : isReferralCommission(record)
            ? 'Indirect Referral'
            : record.commissionType || 'Other'
      const matchesType =
        reportTypeFilter === 'All' || category === reportTypeFilter
      const matchesStatus =
        reportStatusFilter === 'All' || record.status === reportStatusFilter
      const haystack = [
        record.id,
        record.activationEventId,
        record.earnerMemberId,
        record.sourceMemberId,
        record.commissionType,
        record.referralBonusType,
        record.leadershipSourceType,
      ]
        .join(' ')
        .toLowerCase()

      return (
        matchesType &&
        matchesStatus &&
        (!normalizedSearch || haystack.includes(normalizedSearch))
      )
    })
  }, [
    compensationReports,
    reportSearchQuery,
    reportTypeFilter,
    reportStatusFilter,
  ])

  // Chosen Wallet Management states
  const [adjustTargetUid, setAdjustTargetUid] = useState('')
  const [adjustAmountCC, setAdjustAmountCC] = useState<number>(0)
  const [adjustWalletType, setAdjustWalletType] = useState<string>(
    'chosenWalletBalance',
  )
  const [adjustReason, setAdjustReason] = useState<string>('')

  // AI Business Coach chat history state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      sender: 'coach',
      text: 'Hello Executive. I am your I AM CHOSEN AI Business Coach. I can analyze system health, project upcoming cycle achievements, design unilevel downline incentives, or formulate sales reports. How may I assist your enterprise leadership today?',
      timestamp: new Date().toLocaleTimeString(),
    },
  ])

  useEffect(() => {
    fetchEnterpriseData()
    // Simulate minor change in online users to look alive
    const interval = setInterval(() => {
      setOnlineUsers((prev) => {
        const diff = Math.random() > 0.5 ? 1 : -1
        const next = prev + diff
        return next < 8 ? 8 : next > 30 ? 30 : next
      })
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  const fetchEnterpriseData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Users
      const usersRef = collection(db, 'users')
      const usersSnap = await getDocs(usersRef)
      const fetchedUsers = usersSnap.docs.map((d) => d.data() as UserProfile)
      setUserList(fetchedUsers)

      // 2. Fetch Wallets for aggregate calculations
      const walletsRef = collection(db, 'wallets')
      const walletsSnap = await getDocs(walletsRef)
      const fetchedWallets = walletsSnap.docs.map((d) => d.data() as WalletType)
      setWalletList(fetchedWallets)

      // 3. Fetch Wallet Transactions
      const txRef = collection(db, 'wallet_transactions')
      const txSnap = await getDocs(txRef)
      const fetchedTxs = txSnap.docs.map((d) => d.data())
      setTxList(fetchedTxs)

      // 4. Fetch Cashout Requests
      const cashoutRef = collection(db, 'cashout_requests')
      const cashoutSnap = await getDocs(cashoutRef)
      const fetchedCashouts = cashoutSnap.docs.map((d) => d.data())
      setCashoutList(fetchedCashouts)

      // 4.6 Fetch Flushed Business Cycle Commissions
      let totalFlushedBusinessCycleCC = 0
      try {
        const flushedQuery = query(
          collection(db, 'flushed_commissions'),
          where('reason', '==', 'BUSINESS_CYCLE_COMPLETED'),
          where('status', '==', 'Flushed'),
        )
        const flushedSnap = await getDocs(flushedQuery)
        if (!flushedSnap.empty) {
          flushedSnap.docs.forEach((doc) => {
            const data = doc.data()
            totalFlushedBusinessCycleCC += Number(data.amountCC || 0)
          })
        } else {
          // fallback query to commissions if empty or doesn't exist
          const commQuery = query(
            collection(db, 'commissions'),
            where('status', '==', 'Flushed'),
            where('reason', '==', 'BUSINESS_CYCLE_COMPLETED'),
          )
          const commSnap = await getDocs(commQuery)
          commSnap.docs.forEach((doc) => {
            const data = doc.data()
            totalFlushedBusinessCycleCC += Number(data.amountCC || 0)
          })
        }
      } catch (e) {
        console.warn(
          'Could not query flushed_commissions, trying fallback query:',
          e,
        )
        try {
          const commQuery = query(
            collection(db, 'commissions'),
            where('status', '==', 'Flushed'),
            where('reason', '==', 'BUSINESS_CYCLE_COMPLETED'),
          )
          const commSnap = await getDocs(commQuery)
          commSnap.docs.forEach((doc) => {
            const data = doc.data()
            totalFlushedBusinessCycleCC += Number(data.amountCC || 0)
          })
        } catch (fallbackError) {
          console.error(
            'Error with fallback query for flushed commissions:',
            fallbackError,
          )
        }
      }

      // 4.5 Fetch Cashin Requests
      const cashinRef = collection(db, 'cashin_requests')
      const cashinSnap = await getDocs(cashinRef)
      const fetchedCashins = cashinSnap.docs.map((documentSnapshot) =>
        normalizeCashInRequest(
          documentSnapshot.id,
          documentSnapshot.data() as UnknownRecord,
        ),
      )
      fetchedCashins.sort((first, second) => {
        const firstTime = new Date(first.requestedAt).getTime()
        const secondTime = new Date(second.requestedAt).getTime()

        return (
          (Number.isFinite(secondTime) ? secondTime : 0) -
          (Number.isFinite(firstTime) ? firstTime : 0)
        )
      })
      setCashinRequests(fetchedCashins)

      // 5. Fetch Audit Logs
      const auditRef = collection(db, 'audit_logs')
      const auditSnap = await getDocs(auditRef)
      const fetchedAudits = auditSnap.docs.map((d) => d.data())
      fetchedAudits.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      setAuditLogs(fetchedAudits)

      // 5.5 Fetch server-generated package activation and compensation reports.
      // Missing collections or insufficient admin read permissions are isolated
      // as warnings so the rest of the Enterprise Command Center still loads.
      const reportWarnings: string[] = []

      try {
        const activationSnapshot = await getDocs(
          collection(db, 'package_activation_reports'),
        )
        const activationRecords = activationSnapshot.docs.map((snapshot) =>
          normalizePackageActivationReport(
            snapshot.id,
            snapshot.data() as UnknownRecord,
          ),
        )
        activationRecords.sort(
          (first, second) =>
            new Date(second.createdAt || 0).getTime() -
            new Date(first.createdAt || 0).getTime(),
        )
        setPackageActivationReports(activationRecords)
      } catch (reportError) {
        console.warn('Package activation reports unavailable:', reportError)
        setPackageActivationReports([])
        reportWarnings.push(
          'Package activation reports are unavailable. Confirm the collection exists and Super Admin has read access.',
        )
      }

      try {
        const commissionSnapshot = await getDocs(collection(db, 'commissions'))
        const commissionRecords = commissionSnapshot.docs.map((snapshot) =>
          normalizeCompensationReport(
            snapshot.id,
            snapshot.data() as UnknownRecord,
          ),
        )
        commissionRecords.sort(
          (first, second) =>
            new Date(second.createdAt || 0).getTime() -
            new Date(first.createdAt || 0).getTime(),
        )
        setCompensationReports(commissionRecords)
      } catch (reportError) {
        console.warn('Compensation reports unavailable:', reportError)
        setCompensationReports([])
        reportWarnings.push(
          'Compensation reports are unavailable. Confirm Super Admin can read commissions.',
        )
      }

      try {
        const msaSnapshot = await getDocs(collection(db, 'msa_entitlements'))
        const msaRecords = msaSnapshot.docs.map((snapshot) =>
          normalizeMsaEntitlementReport(
            snapshot.id,
            snapshot.data() as UnknownRecord,
          ),
        )
        msaRecords.sort(
          (first, second) =>
            new Date(second.createdAt || 0).getTime() -
            new Date(first.createdAt || 0).getTime(),
        )
        setMsaEntitlementReports(msaRecords)
      } catch (reportError) {
        console.warn('MSA entitlement reports unavailable:', reportError)
        setMsaEntitlementReports([])
        reportWarnings.push(
          'MSA entitlement reports are unavailable. Confirm the collection exists and Super Admin has read access.',
        )
      }

      setReportLoadWarnings(reportWarnings)

      // 6. Fetch or Initialize Inventory
      const inventoryDocRef = doc(db, 'system', 'inventory')
      const inventorySnap = await getDoc(inventoryDocRef)
      let inventoryList: InventoryItem[] = []

      const defaultInventory: InventoryItem[] = [
        {
          id: 'prod-001',
          name: 'Chosen Herbal Blend',
          sku: 'ICH-HB-001',
          category: 'Herbal Wellness Beverage',
          priceCC: 8,
          phpPrice: 560,
          stock: 1420,
          status: 'In Stock',
        },
        {
          id: 'prod-002',
          name: 'Chosen 15-in-1 Latte Coffee',
          sku: 'ICH-COF-002',
          category: 'Functional Coffee Beverage',
          priceCC: 15,
          phpPrice: 1050,
          stock: 2150,
          status: 'In Stock',
        },
        {
          id: 'prod-003',
          name: 'Chosen Pure Barley',
          sku: 'ICH-BAR-003',
          category: 'Barley Grass Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 980,
          status: 'In Stock',
        },
        {
          id: 'prod-004',
          name: 'Chosen Salted Caramel Iced Coffee',
          sku: 'ICH-SCC-004',
          category: 'Ready-to-Mix Coffee Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 1120,
          status: 'In Stock',
        },
        {
          id: 'prod-005',
          name: 'Chosen Choco Barley',
          sku: 'ICH-CHO-005',
          category: 'Chocolate Wellness Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 1500,
          status: 'In Stock',
        },
      ]

      if (inventorySnap.exists()) {
        inventoryList = inventorySnap.data().items as InventoryItem[]
      } else {
        await setDoc(inventoryDocRef, { items: defaultInventory })
        inventoryList = defaultInventory
      }
      setInventory(inventoryList)

      // Perform Demographic Parsing
      let membersCount = 0
      let customersCount = 0
      let affiliatesCount = 0
      let cityCount = 0
      let regionalCount = 0
      let pendingActivationsCount = 0

      const packageLevels = {
        Bronze: 0,
        Silver: 0,
        Gold: 0,
        Platinum: 0,
        Diamond: 0,
        None: 0,
      }

      const activList: any[] = []

      fetchedUsers.forEach((u) => {
        membersCount++
        if (u.role === 'Customer') customersCount++
        else if (u.role === 'Affiliate') affiliatesCount++
        else if (u.role === 'City Distributor') cityCount++
        else if (u.role === 'Regional Distributor') regionalCount++

        if (u.status === 'Inactive' && u.paymentStatus === 'Pending Approval') {
          pendingActivationsCount++
          activList.push(u)
        }

        if (
          u.packageLevel &&
          packageLevels[u.packageLevel as keyof typeof packageLevels] !==
            undefined
        ) {
          packageLevels[u.packageLevel as keyof typeof packageLevels]++
        }
      })

      setPendingActivations(activList)

      // Wallet Aggregates
      let ccIssuedTotal = 0
      let commissionAllocationTotal = 0
      let marketingAllocationTotal = 0

      fetchedWallets.forEach((w) => {
        ccIssuedTotal +=
          (w.chosenWalletBalance || 0) +
          (w.commissionWalletBalance || 0) +
          (w.marketingSupportWalletBalance || 0) +
          (w.rewardWalletBalance || 0)
        commissionAllocationTotal += w.commissionWalletBalance || 0
        marketingAllocationTotal += w.marketingSupportWalletBalance || 0
      })

      // Transaction Ledger Analysis
      let pkgSalesCC = 0
      let commissionPaidCC = 0
      let p2pVolCC = 0
      let ordersCount = 0

      fetchedTxs.forEach((tx) => {
        const amount = tx.amount || 0
        if (tx.status === 'Completed') {
          ordersCount++
          if (tx.type === 'REGISTRATION') {
            pkgSalesCC += amount
          }
          if (tx.type === 'COMMISSION_CREDIT') {
            commissionPaidCC += amount
          }
          if (
            tx.description &&
            (tx.description.includes('P2P') ||
              tx.description.toLowerCase().includes('transfer'))
          ) {
            p2pVolCC += amount
          }
        }
      })

      // Cashout Request Management Filters
      const pendingCashOutList = fetchedCashouts.filter(
        (c) => c.status === 'Submitted' || c.status === 'Pending',
      )
      setPendingCashOuts(pendingCashOutList)

      // Financials Summary
      const totalSalesCC = pkgSalesCC + ordersCount * 12 // adding base product simulation sales
      const totalSalesPhp = totalSalesCC * ccSettings.cashInRatePHP

      setStats({
        totalMembers: membersCount,
        totalCustomers: customersCount,
        totalAffiliates: affiliatesCount,
        cityDistributors: cityCount,
        regionalDistributors: regionalCount,
        totalSalesCC,
        totalSalesPhp,
        totalOrders: ordersCount || 1,
        packageSalesCC: pkgSalesCC,
        pendingCashOutCount: pendingCashOutList.length,
        pendingPackageActivationsCount: pendingActivationsCount,
        totalCCIssued: Number(ccIssuedTotal.toFixed(2)),
        totalCommissionPaid: Number(commissionPaidCC.toFixed(2)),
        totalMarketingAllocation: Number(marketingAllocationTotal.toFixed(2)),
        p2pVolumeCC: Number(p2pVolCC.toFixed(2)),
        totalFlushedBusinessCycleCC: Number(
          totalFlushedBusinessCycleCC.toFixed(2),
        ),
        onlineUsers: onlineUsers,
      })

      // Recharts: Package level breakdown
      const packageChart = [
        { name: 'Bronze', Count: packageLevels.Bronze, fill: '#cd7f32' },
        { name: 'Silver', Count: packageLevels.Silver, fill: '#c0c0c0' },
        { name: 'Gold', Count: packageLevels.Gold, fill: '#ffd700' },
        { name: 'Platinum', Count: packageLevels.Platinum, fill: '#e5e4e2' },
        { name: 'Diamond', Count: packageLevels.Diamond, fill: '#b9f2ff' },
      ]
      setPackageChartData(packageChart)

      // Sales Trend Simulation (ERP style charts)
      const mockSalesTrend = [
        {
          date: 'Mon',
          Sales: Math.floor(pkgSalesCC * 0.1) || 50,
          Registrations: 2,
        },
        {
          date: 'Tue',
          Sales: Math.floor(pkgSalesCC * 0.15) || 80,
          Registrations: 3,
        },
        {
          date: 'Wed',
          Sales: Math.floor(pkgSalesCC * 0.12) || 60,
          Registrations: 2,
        },
        {
          date: 'Thu',
          Sales: Math.floor(pkgSalesCC * 0.25) || 120,
          Registrations: 5,
        },
        {
          date: 'Fri',
          Sales: Math.floor(pkgSalesCC * 0.18) || 90,
          Registrations: 4,
        },
        {
          date: 'Sat',
          Sales: Math.floor(pkgSalesCC * 0.1) || 50,
          Registrations: 1,
        },
        {
          date: 'Sun',
          Sales: Math.floor(pkgSalesCC * 0.09) || 45,
          Registrations: 1,
        },
      ]
      setSalesTrendData(mockSalesTrend)
    } catch (e) {
      console.error('Super Admin Data Fetch failed:', e)
      setError(
        'An error occurred while consolidating corporate database metrics.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault()
    setRateSaveError(null)
    setRateSaveSuccess(false)

    if (tempCashInRate <= 0 || tempCashOutRate <= 0) {
      setRateSaveError('Rates must be positive numbers.')
      return
    }

    try {
      await updateRates(tempCashInRate, tempCashOutRate)
      setRateSaveSuccess(true)
      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'UPDATE_CC_CONVERSION_RATES',
        `Updated CC Conversion settings. Cash-In: ₱${tempCashInRate}, Cash-Out: ₱${tempCashOutRate}`,
      )
      setTimeout(() => {
        setRateSaveSuccess(false)
      }, 5000)
    } catch (err: any) {
      console.error(err)
      setRateSaveError(err.message || 'Failed to update CC settings.')
    }
  }

  // 1. Approved Package Activation
  const handleApproveActivation = async (userId: string, userName: string) => {
    setActionLoading(`activate-${userId}`)
    setError(null)
    setSuccess(null)
    try {
      await approvePendingAffiliate(
        userId,
        currentUserProfile.uid,
        currentUserProfile.email,
      )
      setSuccess(
        `Successfully activated Affiliate ${userName}, set business cycle limits, and provisioned default wallets!`,
      )
      await fetchEnterpriseData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to approve affiliate registration.')
    } finally {
      setActionLoading(null)
    }
  }

  // 2. Approve Cash-Out Request
  const handleApproveCashout = async (
    requestId: string,
    uid: string,
    amountCC: number,
  ) => {
    setActionLoading(`cashout-${requestId}`)
    setError(null)
    setSuccess(null)
    try {
      const batch = writeBatch(db)

      // Update Cashout request status
      const requestRef = doc(db, 'cashout_requests', requestId)
      batch.update(requestRef, {
        status: 'Approved',
        approvedAt: new Date().toISOString(),
        releasedBy: currentUserProfile.fullName,
      })

      await batch.commit()

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'APPROVE_CASHOUT',
        `Approved Cashout Request ${requestId} for user ${uid} of amount ${amountCC} CC`,
      )

      setSuccess(
        `Cash-out request ${requestId} has been successfully APPROVED.`,
      )
      await fetchEnterpriseData()
    } catch (err: any) {
      console.error(err)
      setError('Failed to approve cash-out request.')
    } finally {
      setActionLoading(null)
    }
  }

  // 3. Decline & Refund Cash-Out Request
  const handleDeclineCashout = async (
    requestId: string,
    uid: string,
    amountCC: number,
  ) => {
    setActionLoading(`cashout-${requestId}`)
    setError(null)
    setSuccess(null)
    try {
      const batch = writeBatch(db)

      // Update Cashout request status
      const requestRef = doc(db, 'cashout_requests', requestId)
      batch.update(requestRef, {
        status: 'Declined',
        declinedAt: new Date().toISOString(),
        declinedBy: currentUserProfile.fullName,
      })

      // Refund the deducted CC back to user's commission wallet balance
      const walletRef = doc(db, 'wallets', uid)
      const walletSnap = await getDoc(walletRef)
      if (!walletSnap.exists()) {
        throw new Error('Target user wallet not found for refund.')
      }
      const walletData = walletSnap.data() as WalletType
      const currentCommission = walletData.commissionWalletBalance || 0

      batch.update(walletRef, {
        commissionWalletBalance: Number(
          (currentCommission + amountCC).toFixed(2),
        ),
        updatedAt: new Date().toISOString(),
      })

      // Write credit refund transaction log
      const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: uid,
        amount: amountCC,
        type: 'CREDIT',
        walletType: 'Commission',
        description: `Refund: Declined Cashout Request ${requestId}`,
        status: 'Completed',
        createdAt: new Date().toISOString(),
      })

      await batch.commit()

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'DECLINE_CASHOUT',
        `Declined Cashout Request ${requestId} and refunded ${amountCC} CC to user ${uid}`,
      )

      setSuccess(
        `Cash-out request ${requestId} was DECLINED and ${amountCC} CC was refunded to the user's commission wallet.`,
      )
      await fetchEnterpriseData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to decline cash-out request.')
    } finally {
      setActionLoading(null)
    }
  }

  // 3.5 Approve Cash-In / Top-Up Request
  // Financial writes are executed by the secured callable Cloud Function.
  const handleApproveCashin = async (requestId: string): Promise<void> => {
    if (!requestId) {
      setError('The Cash-In request ID is unavailable.')
      return
    }

    setActionLoading(`cashin-${requestId}`)
    setError(null)
    setSuccess(null)

    try {
      const callableResult = await approveCashInAndActivatePackage({
        requestId,
      })
      const resultData =
        callableResult &&
        typeof callableResult === 'object' &&
        'data' in callableResult
          ? (callableResult as { data?: Record<string, unknown> }).data
          : (callableResult as Record<string, unknown> | undefined)

      if (resultData?.success === false) {
        throw new Error('The Cash-In request was not approved.')
      }

      const creditedCC = readFiniteNumber(
        resultData?.creditedCC,
        resultData?.amountCC,
      )

      setSuccess(
        creditedCC > 0
          ? `Cash-In request ${requestId} was approved and ${creditedCC.toLocaleString(
              'en-PH',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              },
            )} CC was credited successfully.`
          : `Cash-In request ${requestId} was approved successfully.`,
      )

      await fetchEnterpriseData()
    } catch (err: unknown) {
      console.error('Cash-In approval failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to approve the Cash-In request.',
      )
    } finally {
      setActionLoading(null)
    }
  }

  // 3.6 Decline Cash-In Request
  const handleDeclineCashin = async (requestId: string, uid: string) => {
    setActionLoading(`cashin-${requestId}`)
    setError(null)
    setSuccess(null)
    try {
      const batch = writeBatch(db)

      // Update Cashin request status
      const requestRef = doc(db, 'cashin_requests', requestId)
      batch.update(requestRef, {
        status: 'Declined',
        declinedAt: new Date().toISOString(),
        declinedBy: currentUserProfile.fullName,
      })

      await batch.commit()

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'DECLINE_CASHIN',
        `Declined Cash-In Request ${requestId} for user ${uid}`,
      )

      setSuccess(`Cash-In request ${requestId} has been successfully DECLINED.`)
      await fetchEnterpriseData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to decline cash-in request.')
    } finally {
      setActionLoading(null)
    }
  }

  // 4. Adjust Inventory / Restock
  const handleRestock = async (productId: string, amount: number) => {
    setActionLoading(`restock-${productId}`)
    setError(null)
    setSuccess(null)
    try {
      const updatedItems = inventory.map((item) => {
        if (item.id === productId) {
          const nextStock = item.stock + amount
          return {
            ...item,
            stock: nextStock,
            status: nextStock > 100 ? 'In Stock' : 'Low Stock',
          }
        }
        return item
      })

      const inventoryDocRef = doc(db, 'system', 'inventory')
      await updateDoc(inventoryDocRef, { items: updatedItems })

      setInventory(updatedItems)
      setSuccess(`Inventory successfully updated with +${amount} stock.`)
    } catch (err) {
      console.error(err)
      setError('Failed to update product inventory.')
    } finally {
      setActionLoading(null)
    }
  }

  // 5. Credit Adjustment (Chosen Wallet Management module)
  const handleWalletAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustTargetUid) {
      setError('Please select a target user for wallet adjustment.')
      return
    }
    if (adjustAmountCC === 0) {
      setError('Adjustment amount cannot be zero.')
      return
    }

    setActionLoading('wallet-adjust')
    setError(null)
    setSuccess(null)

    try {
      const userRef = doc(db, 'users', adjustTargetUid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        throw new Error('Target user profile not found in system directory.')
      }
      const targetUser = userSnap.data() as UserProfile

      const walletRef = doc(db, 'wallets', adjustTargetUid)
      const walletSnap = await getDoc(walletRef)
      if (!walletSnap.exists()) {
        throw new Error('Target user wallet record not found.')
      }

      const walletData = walletSnap.data() as WalletType
      const currentBalance =
        (walletData[adjustWalletType as keyof WalletType] as number) || 0
      const nextBalance = Number((currentBalance + adjustAmountCC).toFixed(2))

      if (nextBalance < 0) {
        throw new Error('Target wallet balance cannot drop below 0 CC.')
      }

      const batch = writeBatch(db)
      batch.update(walletRef, {
        [adjustWalletType]: nextBalance,
        updatedAt: new Date().toISOString(),
      })

      // Write transaction ledger entry
      const txId = `TX-ADJ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
      const niceWalletName = adjustWalletType
        .replace('Balance', '')
        .replace('Wallet', ' Wallet')
        .replace('chosen', 'Chosen')

      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: adjustTargetUid,
        amount: Math.abs(adjustAmountCC),
        type: adjustAmountCC > 0 ? 'CREDIT' : 'DEBIT',
        walletType:
          niceWalletName.charAt(0).toUpperCase() + niceWalletName.slice(1),
        description:
          adjustReason || `Corporate System Adjustment by Super Admin`,
        status: 'Completed',
        createdAt: new Date().toISOString(),
      })

      await batch.commit()

      await createAuditLog(
        currentUserProfile.uid,
        currentUserProfile.email,
        'WALLET_ADJUSTMENT',
        `Adjusted ${targetUser.fullName}'s ${niceWalletName} by ${adjustAmountCC > 0 ? '+' : ''}${adjustAmountCC} CC. Reason: ${adjustReason || 'None specified'}`,
      )

      setSuccess(
        `Adjusted ${targetUser.fullName}'s ${niceWalletName} successfully by ${adjustAmountCC > 0 ? '+' : ''}${adjustAmountCC} CC.`,
      )
      setAdjustTargetUid('')
      setAdjustAmountCC(0)
      setAdjustReason('')
      await fetchEnterpriseData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to make wallet balance adjustment.')
    } finally {
      setActionLoading(null)
    }
  }

  // 6. Send message to AI Business Coach
  const handleSendCoachMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = {
      sender: 'user',
      text: chatInput,
      timestamp: new Date().toLocaleTimeString(),
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')

    // Simulate AI thinking and output structured response
    setTimeout(() => {
      let coachReply =
        "I've analyzed that request against the I AM CHOSEN ledger metadata. "
      const cleanInput = userMsg.text.toLowerCase()

      if (
        cleanInput.includes('status') ||
        cleanInput.includes('health') ||
        cleanInput.includes('performance')
      ) {
        coachReply += `Currently, system performance is OPTIMAL. Total system sales reside at ₱${stats.totalSalesPhp.toLocaleString()}, with ${stats.totalCCIssued.toLocaleString()} CC currently issued in wallets. Online user activity shows a healthy active peak of ${onlineUsers} concurrent admins, and unfulfilled cash-outs are at ${pendingCashOuts.length} entries, presenting zero system blockage.`
      } else if (
        cleanInput.includes('sales') ||
        cleanInput.includes('revenue') ||
        cleanInput.includes('growth')
      ) {
        coachReply += `Our primary sales driver is package activations, generating a total of ${stats.packageSalesCC.toLocaleString()} CC. To accelerate regional sales, I suggest launching a localized unilevel incentive for our ${stats.regionalDistributors} Regional Distributors in Visayas/Mindanao, matching active cycles with customized 15-in-1 coffee samplers to build product familiarity in emerging communities.`
      } else if (
        cleanInput.includes('cashout') ||
        cleanInput.includes('payout')
      ) {
        coachReply += `There are currently ${pendingCashOuts.length} pending cashout releases in queue. I advise completing approvals on GCash channels first, as they represent 70% of withdrawal volume. Ensure the corporate withholding tax audit is registered on approved amounts to maintain perfect legal compliance.`
      } else if (
        cleanInput.includes('cycle') ||
        cleanInput.includes('affiliate')
      ) {
        coachReply += `With ${stats.totalAffiliates} Affiliates in the system, we see a business cycle completion rate of approximately 18% weekly. Implementing an automated SMS notifier when an Affiliate is within 90% of their 2.5x capacity earnings limit will encourage rapid cycle renewal purchases, protecting their unilevel downline earnings flow.`
      } else {
        coachReply += `Based on unilevel genealogy statistics, I recommend reviewing our distributor reward guidelines. Ensuring our ${stats.cityDistributors} City Distributors are hosting monthly wellness seminars utilizing the Training Academy's product manuals will organically elevate brand loyalty and local product sales.`
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'coach',
          text: coachReply,
          timestamp: new Date().toLocaleTimeString(),
        },
      ])
    }, 1200)
  }

  // Filter lists based on search
  const filteredUsers = userList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredTxs = txList.filter(
    (tx) =>
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.description &&
        tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tx.walletType.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className='bg-[#030611] text-zinc-100 min-h-screen flex font-sans selection:bg-gold selection:text-black relative overflow-x-hidden'>
      <style>{`
        .glass-card {
          background: rgba(10, 15, 30, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(6, 182, 212, 0.15);
        }
        .gold-border-card {
          background: rgba(10, 15, 30, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .neon-glow-btn {
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.35);
        }
        .gold-glow-btn {
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.25);
        }
      `}</style>

      {/* LEFT SIDEBAR: Navigation Panel */}
      <aside className='w-80 border-r border-cyan-950/40 bg-zinc-950/90 flex flex-col shrink-0 backdrop-blur-md'>
        <div className='p-6 border-b border-cyan-950/20 flex items-center space-x-3'>
          <ChosenLogo size='sm' className='w-12 h-12' />
          <div>
            <span className='font-extrabold text-sm tracking-wider text-zinc-100 uppercase gold-text block leading-none'>
              I AM CHOSEN
            </span>
            <span className='block text-[8px] tracking-[0.35em] text-cyan-400 font-bold uppercase mt-1'>
              INTERNATIONAL
            </span>
            <span className='block text-[7px] tracking-[0.35em] text-zinc-500 font-bold uppercase mt-1'>
              EXECUTIVE CONSOLE
            </span>
          </div>
        </div>

        {/* Dynamic Nav Tabs */}
        <div className='flex-1 overflow-y-auto p-4 space-y-6'>
          <div>
            <span className='block px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5'>
              Enterprise Overview
            </span>
            <nav className='space-y-1'>
              <button
                onClick={() => {
                  setActiveTab('overview')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Activity className='w-4 h-4' /> Dashboard Overview
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('analytics')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <PieChart className='w-4 h-4' /> Analytics & Trends
                </span>
              </button>
            </nav>
          </div>

          <div>
            <span className='block px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5'>
              Core Operations
            </span>
            <nav className='space-y-1'>
              <button
                onClick={() => {
                  setActiveTab('members')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Users className='w-4 h-4' /> Members Registry
                </span>
                {pendingActivations.length > 0 && (
                  <span className='px-1.5 py-0.5 rounded text-[9px] font-black bg-gold text-black animate-pulse'>
                    {pendingActivations.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('products')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'products'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Package className='w-4 h-4' /> Products Catalog
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('orders')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <ShoppingBag className='w-4 h-4' /> Fulfillment Orders
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('inventory')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Server className='w-4 h-4' /> Stock Inventory
                </span>
              </button>
            </nav>
          </div>

          <div>
            <span className='block px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5'>
              Financial Ledgers
            </span>
            <nav className='space-y-1'>
              <button
                onClick={() => {
                  setActiveTab('wallet-management')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'wallet-management'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Wallet className='w-4 h-4' /> Wallet Ledger
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('commission-engine')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'commission-engine'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Network className='w-4 h-4' /> Commission Engine
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('marketing-support')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'marketing-support'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Globe className='w-4 h-4' /> Marketing Support
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('cashout-approval')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'cashout-approval'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Coins className='w-4 h-4' /> Cash-Out Approval
                </span>
                {pendingCashOuts.length > 0 && (
                  <span className='px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-black animate-pulse'>
                    {pendingCashOuts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('cashin-approval')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'cashin-approval'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <ArrowUpRight className='w-4 h-4' /> Cash-In Approval
                </span>
                {cashinRequests.filter(
                  (c) => c.status === 'Submitted' || c.status === 'Pending',
                ).length > 0 && (
                  <span className='px-1.5 py-0.5 rounded text-[9px] font-black bg-gold text-black animate-pulse'>
                    {
                      cashinRequests.filter(
                        (c) =>
                          c.status === 'Submitted' || c.status === 'Pending',
                      ).length
                    }
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('p2p-marketplace')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'p2p-marketplace'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Share2 className='w-4 h-4' /> P2P Marketplace
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('treasury')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'treasury'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold font-black'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Shield className='w-4 h-4 text-cyan-400' /> Platform Treasury
                </span>
              </button>
            </nav>
          </div>

          <div>
            <span className='block px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5'>
              Intelligence & Training
            </span>
            <nav className='space-y-1'>
              <button
                onClick={() => {
                  setActiveTab('ai-coach')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'ai-coach'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Brain className='w-4 h-4' /> AI Business Coach
                </span>
                <span className='px-1 py-0.5 rounded text-[7px] font-black bg-indigo-500 text-white uppercase'>
                  Active
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('academy')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'academy'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <BookOpen className='w-4 h-4' /> Training Academy
                </span>
              </button>
            </nav>
          </div>

          <div>
            <span className='block px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5'>
              Reports & Settings
            </span>
            <nav className='space-y-1'>
              <button
                onClick={() => {
                  setActiveTab('reports')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <FileSpreadsheet className='w-4 h-4' /> Reports Center
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('leadership')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'leadership'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Award className='w-4 h-4' /> Leadership Board
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('audit-logs')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'audit-logs'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Terminal className='w-4 h-4' /> System Audit Logs
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('settings')
                  setSearchQuery('')
                }}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-gold/10 text-gold border-l-2 border-gold font-bold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <Settings className='w-4 h-4' /> System Settings
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className='p-4 border-t border-zinc-900 bg-zinc-950/60 text-center'>
          <div className='text-[10px] text-zinc-600 font-mono'>
            I AM CHOSEN INTERNATIONAL • v1.3.4 • Build 000008
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WINDOW */}
      <div className='flex-1 flex flex-col min-w-0 overflow-y-auto'>
        {/* TOP STATUS BAR */}
        <header className='border-b border-zinc-900 bg-zinc-950/90 backdrop-blur sticky top-0 z-40'>
          <div className='px-6 sm:px-8 h-20 flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <Sliders className='w-5 h-5 text-gold' />
              <div>
                <span className='font-extrabold text-sm tracking-widest text-zinc-300 uppercase block'>
                  {activeTab.replace('-', ' ')} PANEL
                </span>
                <span className='block text-[8px] tracking-[0.35em] text-zinc-500 font-bold uppercase'>
                  SECURITY CLEARED AS SUPER ADMIN
                </span>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='flex gap-2'>
                <button
                  onClick={() => onNavigate('user-management')}
                  className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer'
                >
                  Direct User Mgmt
                </button>
                <button
                  onClick={() => onNavigate('role-management')}
                  className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer'
                >
                  Roles
                </button>
                <button
                  onClick={onLogout}
                  className='text-zinc-400 hover:text-red-400 p-2 rounded-lg transition-colors cursor-pointer'
                  title='Logout from Executive Hub'
                >
                  <LogOut className='w-5 h-5' />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ALERTS SECTION */}
        <div className='px-6 sm:px-8 pt-6'>
          {error && (
            <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn'>
              <AlertCircle className='w-5 h-5 shrink-0 mt-0.5' />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className='bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn'>
              <CheckCircle className='w-5 h-5 shrink-0 mt-0.5' />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* TAB CONTENTS */}
        <main className='flex-1 px-6 sm:px-8 pt-4 pb-8'>
          {loading ? (
            <div className='flex flex-col items-center justify-center py-24 space-y-4'>
              <div className='w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin' />
              <p className='text-zinc-500 font-mono text-xs uppercase tracking-widest'>
                Consolidating Ledger Balances...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className='space-y-8 animate-fadeIn'>
                  {/* Executive Hero */}
                  <div className='bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-900 rounded-2xl p-8 relative overflow-hidden'>
                    <div className='absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 bg-gold/5 rounded-full blur-[80px] pointer-events-none' />
                    <div>
                      <div className='inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-3 py-1 text-[10px] font-bold text-gold uppercase tracking-wider mb-3'>
                        <Shield className='w-3.5 h-3.5' /> Executive
                        Authorization Clear
                      </div>
                      <h1 className='text-3xl font-black text-white uppercase tracking-tight'>
                        Super Admin Corporate Console
                      </h1>
                      <p className='text-zinc-400 font-light mt-1 text-sm max-w-2xl'>
                        Real-time tracking of unilevel downlines, corporate
                        credit minting, product distribution, audit checks, and
                        automated marketing pool allocations.
                      </p>
                    </div>
                  </div>

                  {/* STATS BENTO GRID */}
                  <div className='space-y-4'>
                    <h2 className='text-xs uppercase tracking-widest text-zinc-500 font-black flex items-center gap-2'>
                      <Users className='w-4 h-4 text-gold' /> Membership
                      Distribution & Distributors
                    </h2>
                    <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
                      <div className='bg-zinc-950 border border-zinc-900 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Members
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          {stats.totalMembers}
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Customers
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          {stats.totalCustomers}
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Affiliates
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          {stats.totalAffiliates}
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          City Distributors
                        </span>
                        <span className='text-2xl font-black text-gold block mt-1'>
                          {stats.cityDistributors}
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Regional Distributors
                        </span>
                        <span className='text-2xl font-black text-gold block mt-1'>
                          {stats.regionalDistributors}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* FINANCIAL AGGREGATES BENTO GRID */}
                  <div className='space-y-4'>
                    <h2 className='text-xs uppercase tracking-widest text-zinc-500 font-black flex items-center gap-2'>
                      <TrendingUp className='w-4 h-4 text-gold' /> Financial
                      Aggregates & Volume
                    </h2>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl relative overflow-hidden'>
                        <div className='absolute top-0 inset-x-0 h-[1.5px] gold-gradient' />
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Sales (Gross)
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          ₱{stats.totalSalesPhp.toLocaleString()}
                        </span>
                        <span className='text-[10px] text-gold/80 font-mono mt-1 block'>
                          ≈ {stats.totalSalesCC.toLocaleString()} CC
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Package Sales
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          {stats.packageSalesCC.toLocaleString()} CC
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          ≈ ₱
                          {(
                            stats.packageSalesCC * ccSettings.cashInRatePHP
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Orders
                        </span>
                        <span className='text-2xl font-black text-white block mt-1'>
                          {stats.totalOrders}
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          Registrations & Purchases
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total CC Issued
                        </span>
                        <span className='text-2xl font-black text-emerald-400 block mt-1'>
                          {stats.totalCCIssued.toLocaleString()} CC
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          All wallet balances in system
                        </span>
                      </div>

                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Total Commission Paid
                        </span>
                        <span className='text-2xl font-black text-gold block mt-1'>
                          {stats.totalCommissionPaid.toLocaleString()} CC
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          Unilevel & direct payouts
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Marketing Allocation
                        </span>
                        <span className='text-2xl font-black text-zinc-300 block mt-1'>
                          {stats.totalMarketingAllocation.toLocaleString()} CC
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          Global marketing support pool
                        </span>
                      </div>
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          P2P Volume
                        </span>
                        <span className='text-2xl font-black text-zinc-300 block mt-1'>
                          {stats.p2pVolumeCC.toLocaleString()} CC
                        </span>
                        <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                          Peer-to-peer credit transfers
                        </span>
                      </div>
                      {currentUserProfile?.role === 'Super Admin' && (
                        <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                          <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                            Flush Out Business Cycle
                          </span>
                          <span className='text-2xl font-black text-amber-500 block mt-1'>
                            {stats.totalFlushedBusinessCycleCC.toLocaleString()}{' '}
                            CC
                          </span>
                          <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                            ≈ ₱
                            {(
                              stats.totalFlushedBusinessCycleCC *
                              (ccSettings?.cashInRatePHP || 70)
                            ).toLocaleString()}
                          </span>
                          <span className='text-[10px] text-zinc-500 font-mono mt-1 block'>
                            Excess earnings from completed Business Cycles
                          </span>
                        </div>
                      )}
                      <div className='bg-zinc-950 border border-zinc-900/80 p-5 rounded-xl'>
                        <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold'>
                          Uptime Health
                        </span>
                        <span className='text-2xl font-black text-emerald-400 block mt-1'>
                          99.98%
                        </span>
                        <span className='text-[10px] text-emerald-500 font-mono mt-1 block'>
                          All systems operational
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK ALERTS QUEUE ROW */}
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <div className='flex justify-between items-center mb-4'>
                        <h3 className='font-bold text-sm text-white uppercase flex items-center gap-2'>
                          <Coins className='w-4 h-4 text-gold' /> Pending
                          Cashouts
                        </h3>
                        <span className='text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono font-bold'>
                          {pendingCashOuts.length} waiting
                        </span>
                      </div>
                      <p className='text-xs text-zinc-400 font-light mb-4'>
                        Affiliate commissions waiting for banking releases.
                        Approved cashouts deduct balances securely.
                      </p>
                      <button
                        onClick={() => setActiveTab('cashout-approval')}
                        className='text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer'
                      >
                        Process Payout Queue{' '}
                        <ArrowUpRight className='w-3.5 h-3.5' />
                      </button>
                    </div>

                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <div className='flex justify-between items-center mb-4'>
                        <h3 className='font-bold text-sm text-white uppercase flex items-center gap-2'>
                          <Sparkles className='w-4 h-4 text-gold' /> Pending
                          Registrations
                        </h3>
                        <span className='text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-gold font-mono font-bold'>
                          {pendingActivations.length} waiting
                        </span>
                      </div>
                      <p className='text-xs text-zinc-400 font-light mb-4'>
                        Distributor registrations awaiting receipt and sponsor
                        checks. Activations establish unilevel placement.
                      </p>
                      <button
                        onClick={() => setActiveTab('members')}
                        className='text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer'
                      >
                        Review Members <ArrowUpRight className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MEMBERS REGISTRY */}
              {activeTab === 'members' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                    <div>
                      <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                        Ecosystem Members Directory
                      </h2>
                      <p className='text-xs text-zinc-500 font-light mt-0.5'>
                        Trace registered user roles, modify accounts, and
                        complete pending affiliate package approvals.
                      </p>
                    </div>
                    <div className='relative w-full md:w-80'>
                      <Search className='w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2' />
                      <input
                        type='text'
                        placeholder='Search by Name, Email, Member ID...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-gold/60'
                      />
                    </div>
                  </div>

                  {/* PENDING APPROVALS QUEUE */}
                  {pendingActivations.length > 0 && (
                    <div className='bg-zinc-950 border border-gold/20 p-6 rounded-2xl'>
                      <h3 className='text-sm font-extrabold text-gold uppercase tracking-wider mb-4 flex items-center gap-2'>
                        <Sparkles className='w-4 h-4 animate-spin text-gold' />{' '}
                        Pending Registrations Approvals
                      </h3>
                      <div className='overflow-x-auto'>
                        <table className='w-full text-left border-collapse text-xs'>
                          <thead>
                            <tr className='border-b border-zinc-900 text-zinc-500 uppercase'>
                              <th className='py-2.5 px-3'>Date</th>
                              <th className='py-2.5 px-3'>Full Name</th>
                              <th className='py-2.5 px-3'>Email Address</th>
                              <th className='py-2.5 px-3'>Referred By</th>
                              <th className='py-2.5 px-3'>Desired Package</th>
                              <th className='py-2.5 px-3'>Receipt / Payment</th>
                              <th className='py-2.5 px-3 text-center'>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingActivations.map((u, idx) => (
                              <tr
                                key={idx}
                                className='border-b border-zinc-900/60 hover:bg-zinc-900/25'
                              >
                                <td className='py-3 px-3 font-mono text-zinc-500'>
                                  {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td className='py-3 px-3 font-bold text-white'>
                                  {u.fullName}
                                </td>
                                <td className='py-3 px-3 text-zinc-400'>
                                  {u.email}
                                </td>
                                <td className='py-3 px-3 text-zinc-400 font-mono'>
                                  {u.referredBy || 'None'}
                                </td>
                                <td className='py-3 px-3'>
                                  <span className='font-extrabold text-gold'>
                                    {u.packageLevel}
                                  </span>
                                </td>
                                <td className='py-3 px-3 text-zinc-400'>
                                  {u.paymentMethod || 'GCash'} / ₱
                                  {(u.paymentAmountPhp || 0).toLocaleString()}
                                </td>
                                <td className='py-3 px-3 text-center'>
                                  <button
                                    onClick={() =>
                                      handleApproveActivation(u.uid, u.fullName)
                                    }
                                    disabled={actionLoading !== null}
                                    className='bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-[10px] font-black px-3 py-1.5 rounded tracking-wider uppercase transition-all cursor-pointer'
                                  >
                                    {actionLoading === `activate-${u.uid}`
                                      ? 'Activating...'
                                      : 'Approve'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* COMPLETE USERS LIST */}
                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-left border-collapse text-xs'>
                        <thead>
                          <tr className='border-b border-zinc-900 bg-zinc-900/20 text-zinc-500 uppercase font-bold'>
                            <th className='py-3 px-4'>Member ID</th>
                            <th className='py-3 px-4'>Full Name</th>
                            <th className='py-3 px-4'>Email</th>
                            <th className='py-3 px-4'>Role</th>
                            <th className='py-3 px-4'>Package</th>
                            <th className='py-3 px-4'>Sponsor Code</th>
                            <th className='py-3 px-4'>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className='text-center py-12 text-zinc-600'
                              >
                                No members found matching the search criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u, idx) => (
                              <tr
                                key={idx}
                                className='border-b border-zinc-900/60 hover:bg-zinc-900/10'
                              >
                                <td className='py-3 px-4 font-mono text-zinc-400'>
                                  {u.memberId || 'IAM-Pending'}
                                </td>
                                <td className='py-3 px-4'>
                                  <span className='font-bold text-white block'>
                                    {u.fullName}
                                  </span>
                                  <span className='text-[10px] text-zinc-500'>
                                    {u.mobileNumber}
                                  </span>
                                </td>
                                <td className='py-3 px-4 text-zinc-400'>
                                  {u.email}
                                </td>
                                <td className='py-3 px-4 font-semibold'>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] ${
                                      u.role === 'Super Admin'
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : u.role === 'Admin'
                                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                          : u.role === 'Affiliate'
                                            ? 'bg-gold/10 text-gold border border-gold/20'
                                            : u.role === 'City Distributor'
                                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                              : u.role ===
                                                  'Regional Distributor'
                                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                                : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {u.role}
                                  </span>
                                </td>
                                <td className='py-3 px-4 font-bold text-zinc-300'>
                                  {u.packageLevel}
                                </td>
                                <td className='py-3 px-4 font-mono text-zinc-500'>
                                  {u.sponsorCode || 'None'}
                                </td>
                                <td className='py-3 px-4'>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      u.status === 'Active'
                                        ? 'text-emerald-400 bg-emerald-500/10'
                                        : 'text-zinc-500 bg-zinc-900'
                                    }`}
                                  >
                                    {u.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PRODUCTS CATALOG */}
              {activeTab === 'products' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Product Administration & Packaging
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      View and maintain corporate wellness and beverage lines
                      sold across unilevel sponsor loops.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {inventory.map((prod, idx) => (
                      <div
                        key={idx}
                        className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between'
                      >
                        <div>
                          <div className='flex justify-between items-start mb-4'>
                            <span className='text-3xl'>
                              {prod.id === 'prod-001'
                                ? '🌿'
                                : prod.id === 'prod-002'
                                  ? '☕'
                                  : prod.id === 'prod-003'
                                    ? '🌾'
                                    : prod.id === 'prod-004'
                                      ? '🧊'
                                      : '🍫'}
                            </span>
                            <span className='px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[9px] text-zinc-400 uppercase font-bold'>
                              {prod.sku}
                            </span>
                          </div>
                          <h3 className='text-base font-extrabold text-white mb-1 uppercase'>
                            {prod.name}
                          </h3>
                          <span className='text-xs text-zinc-500 block mb-4'>
                            {prod.category}
                          </span>

                          <div className='space-y-1 border-t border-zinc-900/60 pt-4 mb-6'>
                            <div className='flex justify-between text-xs'>
                              <span className='text-zinc-500'>
                                Corporate CC Cost:
                              </span>
                              <span className='font-bold text-gold'>
                                {prod.priceCC} CC
                              </span>
                            </div>
                            <div className='flex justify-between text-xs'>
                              <span className='text-zinc-500'>
                                Retail PHP Price:
                              </span>
                              <span className='font-bold text-white'>
                                ₱{prod.phpPrice.toLocaleString()}
                              </span>
                            </div>
                            <div className='flex justify-between text-xs'>
                              <span className='text-zinc-500'>
                                Package Equivalent:
                              </span>
                              <span className='font-bold text-zinc-400'>
                                1 Sachet Pack
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className='bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 text-center text-xs font-semibold text-zinc-300'>
                          Active in Distribution Loops
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: FULFILLMENT ORDERS */}
              {activeTab === 'orders' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      System Sales Fulfillment Orders
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Verify order distribution pipelines, packaging status, and
                      distributor warehouse dispatchings.
                    </p>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6'>
                    <h3 className='font-bold text-sm text-white uppercase mb-4 flex items-center gap-2'>
                      <ShoppingBag className='w-4 h-4 text-gold' /> System
                      Fulfillment Pipeline
                    </h3>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-left border-collapse text-xs'>
                        <thead>
                          <tr className='border-b border-zinc-900 text-zinc-500 uppercase font-bold'>
                            <th className='py-2.5 px-3'>Order SKU</th>
                            <th className='py-2.5 px-3'>Item Name</th>
                            <th className='py-2.5 px-3'>Quantity</th>
                            <th className='py-2.5 px-3 text-right'>
                              Value (CC)
                            </th>
                            <th className='py-2.5 px-3 text-right'>
                              Gross PHP
                            </th>
                            <th className='py-2.5 px-3 text-center'>
                              Fulfillment Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className='border-b border-zinc-900/60'>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              ORD-HB-206
                            </td>
                            <td className='py-3 px-3 font-bold text-white'>
                              Chosen Herbal Blend Pack
                            </td>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              120 units
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-gold'>
                              960 CC
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-emerald-400'>
                              ₱67,200.00
                            </td>
                            <td className='py-3 px-3 text-center'>
                              <span className='px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold'>
                                Shipped
                              </span>
                            </td>
                          </tr>
                          <tr className='border-b border-zinc-900/60'>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              ORD-COF-903
                            </td>
                            <td className='py-3 px-3 font-bold text-white'>
                              Chosen 15-in-1 Latte Coffee
                            </td>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              50 units
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-gold'>
                              750 CC
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-emerald-400'>
                              ₱52,500.00
                            </td>
                            <td className='py-3 px-3 text-center'>
                              <span className='px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold'>
                                Shipped
                              </span>
                            </td>
                          </tr>
                          <tr className='border-b border-zinc-900/60'>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              ORD-BAR-412
                            </td>
                            <td className='py-3 px-3 font-bold text-white'>
                              Chosen Pure Barley Box
                            </td>
                            <td className='py-3 px-3 font-mono text-zinc-400'>
                              20 units
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-gold'>
                              320 CC
                            </td>
                            <td className='py-3 px-3 text-right font-mono text-emerald-400'>
                              ₱22,400.00
                            </td>
                            <td className='py-3 px-3 text-center'>
                              <span className='px-2.5 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold animate-pulse'>
                                Processing
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: STOCK INVENTORY */}
              {activeTab === 'inventory' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Fulfillment Stock Levels
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Maintain warehouse unit counts. Restocking automatically
                      synchronizes across the distributor fulfillment hubs.
                    </p>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6'>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-left border-collapse text-xs'>
                        <thead>
                          <tr className='border-b border-zinc-900 text-zinc-500 uppercase font-bold'>
                            <th className='py-3 px-4'>Product Name</th>
                            <th className='py-3 px-4'>SKU Code</th>
                            <th className='py-3 px-4'>Category</th>
                            <th className='py-3 px-4 text-center'>
                              Fulfillment Cost
                            </th>
                            <th className='py-3 px-4 text-center'>
                              Current Stock
                            </th>
                            <th className='py-3 px-4 text-center'>Status</th>
                            <th className='py-3 px-4 text-center'>
                              Action Restock
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map((item, idx) => (
                            <tr
                              key={idx}
                              className='border-b border-zinc-900/60 hover:bg-zinc-900/10'
                            >
                              <td className='py-3.5 px-4 font-bold text-white flex items-center gap-2'>
                                <span className='text-xl'>
                                  {item.id === 'prod-001'
                                    ? '🌿'
                                    : item.id === 'prod-002'
                                      ? '☕'
                                      : item.id === 'prod-003'
                                        ? '🌾'
                                        : item.id === 'prod-004'
                                          ? '🧊'
                                          : '🍫'}
                                </span>
                                {item.name}
                              </td>
                              <td className='py-3.5 px-4 font-mono text-xs text-zinc-400'>
                                {item.sku}
                              </td>
                              <td className='py-3.5 px-4 text-zinc-300'>
                                {item.category}
                              </td>
                              <td className='py-3.5 px-4 text-center'>
                                <div className='text-xs font-bold text-white font-mono'>
                                  {item.priceCC} CC
                                </div>
                                <div className='text-[10px] text-zinc-500 font-mono'>
                                  ₱{item.phpPrice}
                                </div>
                              </td>
                              <td className='py-3.5 px-4 text-center font-bold text-white font-mono'>
                                {item.stock.toLocaleString()} units
                              </td>
                              <td className='py-3.5 px-4 text-center'>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.stock > 1000
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                  }`}
                                >
                                  {item.stock > 1000 ? 'In Stock' : 'Low Stock'}
                                </span>
                              </td>
                              <td className='py-3.5 px-4'>
                                <div className='flex items-center justify-center gap-2'>
                                  <button
                                    onClick={() => handleRestock(item.id, 50)}
                                    disabled={actionLoading !== null}
                                    className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] px-2.5 py-1 rounded hover:text-gold transition-colors font-semibold cursor-pointer'
                                  >
                                    +50
                                  </button>
                                  <button
                                    onClick={() => handleRestock(item.id, 100)}
                                    disabled={actionLoading !== null}
                                    className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] px-2.5 py-1 rounded hover:text-gold transition-colors font-semibold cursor-pointer'
                                  >
                                    +100
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: CHOSEN WALLET MANAGEMENT */}
              {activeTab === 'wallet-management' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Chosen Wallet Balance Adjuster
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Direct balance correction tool for correcting errors,
                      issuing promotional credits, or adjusting member
                      commissions.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {/* FORM ADJUSTMENT */}
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl h-fit'>
                      <h3 className='font-bold text-sm text-gold uppercase mb-4 flex items-center gap-2'>
                        <Sliders className='w-4 h-4 text-gold' /> Correct /
                        Issue Balances
                      </h3>

                      <form
                        onSubmit={handleWalletAdjustment}
                        className='space-y-4 text-xs'
                      >
                        <div>
                          <label className='block text-zinc-400 font-bold mb-2 uppercase tracking-wide'>
                            Target Member UID
                          </label>
                          <select
                            required
                            value={adjustTargetUid}
                            onChange={(e) => setAdjustTargetUid(e.target.value)}
                            className='w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-gold text-zinc-300'
                          >
                            <option value=''>
                              -- Choose Member Profile --
                            </option>
                            {userList.map((u, idx) => (
                              <option key={idx} value={u.uid}>
                                {u.fullName} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className='block text-zinc-400 font-bold mb-2 uppercase tracking-wide'>
                            Select Ledger Wallet
                          </label>
                          <select
                            value={adjustWalletType}
                            onChange={(e) =>
                              setAdjustWalletType(e.target.value)
                            }
                            className='w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-gold text-zinc-300'
                          >
                            <option value='chosenWalletBalance'>
                              Chosen Wallet Balance
                            </option>
                            <option value='commissionWalletBalance'>
                              Commission Wallet Balance
                            </option>
                            <option value='marketingSupportWalletBalance'>
                              Marketing Support Balance
                            </option>
                            <option value='rewardWalletBalance'>
                              Reward Wallet Balance
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className='block text-zinc-400 font-bold mb-2 uppercase tracking-wide'>
                            Amount CC (Use negative to deduct)
                          </label>
                          <input
                            type='number'
                            required
                            step='any'
                            placeholder='e.g. 100 or -50'
                            value={adjustAmountCC || ''}
                            onChange={(e) =>
                              setAdjustAmountCC(Number(e.target.value))
                            }
                            className='w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-gold text-zinc-300'
                          />
                        </div>

                        <div>
                          <label className='block text-zinc-400 font-bold mb-2 uppercase tracking-wide'>
                            Audit Correction Reason
                          </label>
                          <textarea
                            rows={3}
                            required
                            placeholder='State the corporate reason for adjustments...'
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            className='w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-gold text-zinc-300 resize-none'
                          />
                        </div>

                        <button
                          type='submit'
                          disabled={actionLoading !== null}
                          className='w-full gold-gradient text-black font-black uppercase py-2.5 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer'
                        >
                          {actionLoading === 'wallet-adjust'
                            ? 'Adjusting...'
                            : 'Execute Correction'}
                        </button>
                      </form>
                    </div>

                    {/* LIVE WALLET DIRECTORY */}
                    <div className='md:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl p-6'>
                      <h3 className='font-bold text-sm text-white uppercase mb-4 flex items-center gap-2'>
                        <Database className='w-4 h-4 text-gold' /> System Wallet
                        Directories
                      </h3>
                      <div className='overflow-y-auto max-h-[420px]'>
                        <table className='w-full text-left border-collapse text-xs'>
                          <thead>
                            <tr className='border-b border-zinc-900 text-zinc-500 uppercase font-bold sticky top-0 bg-zinc-950'>
                              <th className='py-2.5 px-3'>Member Name</th>
                              <th className='py-2.5 px-3 text-right'>
                                Chosen Wallet
                              </th>
                              <th className='py-2.5 px-3 text-right'>
                                Commission
                              </th>
                              <th className='py-2.5 px-3 text-right'>
                                Marketing
                              </th>
                              <th className='py-2.5 px-3 text-right'>Reward</th>
                            </tr>
                          </thead>
                          <tbody>
                            {walletList.map((w, idx) => {
                              const userObj = userList.find(
                                (u) => u.uid === w.uid,
                              )
                              if (!userObj) return null
                              return (
                                <tr
                                  key={idx}
                                  className='border-b border-zinc-900/60 hover:bg-zinc-900/25'
                                >
                                  <td className='py-3 px-3'>
                                    <span className='font-bold text-white block'>
                                      {userObj.fullName}
                                    </span>
                                    <span className='text-[10px] text-zinc-500 font-mono'>
                                      {userObj.memberId}
                                    </span>
                                  </td>
                                  <td className='py-3 px-3 text-right text-emerald-400 font-mono font-bold'>
                                    {(w.chosenWalletBalance || 0).toFixed(2)} CC
                                  </td>
                                  <td className='py-3 px-3 text-right text-gold font-mono font-bold'>
                                    {(w.commissionWalletBalance || 0).toFixed(
                                      2,
                                    )}{' '}
                                    CC
                                  </td>
                                  <td className='py-3 px-3 text-right text-zinc-300 font-mono'>
                                    {(
                                      w.marketingSupportWalletBalance || 0
                                    ).toFixed(2)}{' '}
                                    CC
                                  </td>
                                  <td className='py-3 px-3 text-right text-zinc-400 font-mono'>
                                    {(w.rewardWalletBalance || 0).toFixed(2)} CC
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: COMMISSION ENGINE */}
              {activeTab === 'commission-engine' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Referral & Leadership Compensation Engine
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Monitor Direct Referral, Indirect Referral, and Leadership
                      Bonus records generated by the secured package engine.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <h3 className='font-bold text-sm text-gold uppercase mb-4 flex items-center gap-2'>
                        <Network className='w-4 h-4 text-gold' /> Referral &
                        Leadership Generation Rules
                      </h3>
                      <div className='space-y-4 text-xs'>
                        <div className='border-b border-zinc-900 pb-3 flex justify-between items-center'>
                          <div>
                            <span className='font-bold text-white block uppercase'>
                              Direct Referral Bonus
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              Level 1 Referral Bonus, stored separately for
                              clear monitoring
                            </span>
                          </div>
                          <span className='px-2.5 py-1 rounded bg-gold/15 text-gold border border-gold/30 font-bold'>
                            4.00% CC
                          </span>
                        </div>
                        <div className='border-b border-zinc-900 pb-3 flex justify-between items-center'>
                          <div>
                            <span className='font-bold text-white block uppercase'>
                              Indirect Referral Bonus
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              Levels 2-15, subject to the upline's active
                              business license
                            </span>
                          </div>
                          <span className='px-2.5 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-bold'>
                            Config-driven
                          </span>
                        </div>
                        <div className='border-b border-zinc-900 pb-3 flex justify-between items-center'>
                          <div>
                            <span className='font-bold text-white block uppercase'>
                              Leadership Bonus
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              Generated only from successfully credited downline
                              commission income
                            </span>
                          </div>
                          <span className='px-2.5 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-bold'>
                            Source-linked
                          </span>
                        </div>
                        <div className='border-b border-zinc-900 pb-3 flex justify-between items-center'>
                          <div>
                            <span className='font-bold text-white block uppercase'>
                              Infinite Distributor Cycle Cap
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              Max earnings cap multiplier of package level value
                            </span>
                          </div>
                          <span className='px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold'>
                            2.50x Cap
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between'>
                      <div>
                        <h3 className='font-bold text-sm text-white uppercase mb-2 flex items-center gap-2'>
                          <HelpCircle className='w-4 h-4 text-gold' />{' '}
                          compensation Compliance
                        </h3>
                        <p className='text-xs text-zinc-400 font-light leading-relaxed mb-4'>
                          Compensation calculations are bound securely under
                          smart-ledgers. Simulating commissions in development
                          is strictly hidden in production builds to preserve
                          structural unilevel transaction integrity.
                        </p>
                        <div className='bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-500'>
                          <span className='text-zinc-300 font-bold block mb-1'>
                            Production Integrity Active
                          </span>
                          Referral and Leadership records must contain their
                          activation event, source commission, rule version,
                          status, and idempotency key. Any unlinked credit is an
                          audit exception.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: MARKETING SUPPORT ALLOCATION */}
              {activeTab === 'marketing-support' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Marketing Support Allocation Pool
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Monitor MSA entitlements, scheduled credits, and
                      Leadership Bonuses generated only after a successful MSA
                      credit.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl text-center'>
                      <span className='block text-[10px] text-zinc-500 uppercase tracking-widest font-black'>
                        Global Pool Balance
                      </span>
                      <span className='text-3xl font-black text-white block mt-2'>
                        {stats.totalMarketingAllocation.toLocaleString()} CC
                      </span>
                      <span className='text-xs text-zinc-400 font-mono block mt-1'>
                        ≈ ₱
                        {(
                          stats.totalMarketingAllocation *
                          ccSettings.cashInRatePHP
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className='md:col-span-2 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <h3 className='font-bold text-sm text-white uppercase mb-4'>
                        Daily Pool Settings
                      </h3>
                      <div className='space-y-3 text-xs'>
                        <div className='flex justify-between items-center py-2 border-b border-zinc-900'>
                          <span className='text-zinc-400'>
                            Company Allocation Sachet Rate:
                          </span>
                          <span className='font-bold text-gold'>
                            ₱1.00 PHP / sachet
                          </span>
                        </div>
                        <div className='flex justify-between items-center py-2 border-b border-zinc-900'>
                          <span className='text-zinc-400'>
                            Automatic Distribution Trigger:
                          </span>
                          <span className='font-bold text-white'>
                            15th & Last Day, 1:00 PM Asia/Manila
                          </span>
                        </div>
                        <div className='flex justify-between items-center py-2'>
                          <span className='text-zinc-400'>
                            Total Distributing Affiliates:
                          </span>
                          <span className='font-bold text-emerald-400'>
                            {stats.totalAffiliates} members qualified
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: CASHOUT APPROVAL */}
              {activeTab === 'cashout-approval' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                    <div>
                      <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                        Commission Cashout Release Queue
                      </h2>
                      <p className='text-xs text-zinc-500 font-light mt-0.5'>
                        Validate withdrawal requests submitted by active
                        affiliates. Declining automatically refunds the amount
                        instantly.
                      </p>
                    </div>
                    <div className='bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 font-mono text-xs text-zinc-400'>
                      Pending Queue: {pendingCashOuts.length}
                    </div>
                  </div>

                  {pendingCashOuts.length === 0 ? (
                    <div className='text-center py-12 bg-zinc-950 border border-zinc-900 rounded-2xl text-zinc-500 text-xs'>
                      No pending cashout release requests awaiting approval.
                    </div>
                  ) : (
                    <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                      <div className='overflow-x-auto'>
                        <table className='w-full text-left border-collapse text-xs'>
                          <thead>
                            <tr className='border-b border-zinc-900 bg-zinc-900/10 text-zinc-500 uppercase font-bold'>
                              <th className='py-3 px-4'>Request Date</th>
                              <th className='py-3 px-4'>Member Account</th>
                              <th className='py-3 px-4'>Mode</th>
                              <th className='py-3 px-4'>Account Details</th>
                              <th className='py-3 px-4 text-right'>
                                Amount (CC)
                              </th>
                              <th className='py-3 px-4 text-right'>
                                Net PHP (₱)
                              </th>
                              <th className='py-3 px-4 text-center'>
                                Action Decision
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingCashOuts.map((req, idx) => (
                              <tr
                                key={idx}
                                className='border-b border-zinc-900/60 hover:bg-zinc-900/10'
                              >
                                <td className='py-3 px-4 font-mono text-zinc-400'>
                                  {new Date(req.requestDate).toLocaleString()}
                                </td>
                                <td className='py-3 px-4'>
                                  <span className='font-bold text-white block'>
                                    {req.fullName}
                                  </span>
                                  <span className='text-[10px] text-zinc-500 font-mono'>
                                    {req.memberId}
                                  </span>
                                </td>
                                <td className='py-3 px-4'>
                                  <span className='px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-bold text-zinc-300'>
                                    {req.payoutChannel}
                                  </span>
                                </td>
                                <td className='py-3 px-4 font-mono text-zinc-400'>
                                  {req.destinationDetails}
                                </td>
                                <td className='py-3 px-4 text-right font-bold text-gold font-mono'>
                                  {req.amountCC.toLocaleString('en-PH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 4,
                                  })}{' '}
                                  CC
                                </td>
                                <td className='py-3 px-4 text-right font-bold text-emerald-400 font-mono'>
                                  ₱
                                  {(req.netPhp || 0).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className='py-3 px-4'>
                                  <div className='flex items-center justify-center gap-2'>
                                    <button
                                      onClick={() =>
                                        handleApproveCashout(
                                          req.requestId,
                                          req.uid,
                                          req.amountCC,
                                        )
                                      }
                                      disabled={actionLoading !== null}
                                      className='p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all cursor-pointer'
                                      title='Approve Release'
                                    >
                                      <Check className='w-4 h-4' />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeclineCashout(
                                          req.requestId,
                                          req.uid,
                                          req.amountCC,
                                        )
                                      }
                                      disabled={actionLoading !== null}
                                      className='p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black rounded-lg transition-all cursor-pointer'
                                      title='Decline & Refund'
                                    >
                                      <X className='w-4 h-4' />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9.5: CASHIN APPROVAL */}
              {activeTab === 'cashin-approval' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                    <div>
                      <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                        System Cash-In Verification Queue
                      </h2>
                      <p className='text-xs text-zinc-500 font-light mt-0.5'>
                        Review, verify, and approve top-up requests submitted by
                        Customers and Affiliates. Approving automatically
                        credits the user's Chosen Wallet with CC.
                      </p>
                    </div>
                    <div className='bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 font-mono text-xs text-zinc-400'>
                      Total Requests: {cashinRequests.length}
                    </div>
                  </div>

                  {cashinRequests.length === 0 ? (
                    <div className='text-center py-12 bg-zinc-950 border border-zinc-900 rounded-2xl text-zinc-500 text-xs font-light'>
                      No cash-in requests recorded in the system.
                    </div>
                  ) : (
                    <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                      <div className='overflow-x-auto'>
                        <table className='w-full text-left border-collapse text-xs'>
                          <thead>
                            <tr className='border-b border-zinc-900 bg-zinc-900/10 text-zinc-500 uppercase font-bold'>
                              <th className='py-3 px-4'>Request Date</th>
                              <th className='py-3 px-4'>User Details</th>
                              <th className='py-3 px-4'>Payment Channel</th>
                              <th className='py-3 px-4'>
                                Sender Account Details
                              </th>
                              <th className='py-3 px-4 font-mono'>
                                Reference Number
                              </th>
                              <th className='py-3 px-4 text-center'>Receipt</th>
                              <th className='py-3 px-4 text-right'>
                                Amount PHP
                              </th>
                              <th className='py-3 px-4 text-right'>
                                Credit (CC)
                              </th>
                              <th className='py-3 px-4 text-center'>Status</th>
                              <th className='py-3 px-4 text-center'>
                                Action Decision
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cashinRequests.map((req, idx) => (
                              <tr
                                key={idx}
                                className='border-b border-zinc-900/60 hover:bg-zinc-900/10'
                              >
                                <td className='py-3 px-4 font-mono text-zinc-400'>
                                  {formatCashInDate(req.requestedAt)}
                                </td>
                                <td className='py-3 px-4'>
                                  <span className='font-bold text-white block'>
                                    {req.fullName}
                                  </span>
                                  <span className='text-[10px] text-zinc-500 font-mono'>
                                    {req.memberId}
                                  </span>
                                </td>
                                <td className='py-3 px-4'>
                                  <span className='px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-bold text-zinc-300'>
                                    {req.paymentChannel}
                                  </span>
                                </td>
                                <td className='py-3 px-4 text-zinc-400'>
                                  <span className='block font-medium'>
                                    {req.senderAccountName}
                                  </span>
                                  <span className='text-[10px] text-zinc-500 font-mono'>
                                    {req.senderAccountNumber}
                                  </span>
                                </td>
                                <td className='py-3 px-4 font-mono text-zinc-300 font-bold uppercase'>
                                  {req.referenceNumber}
                                </td>
                                <td className='py-3 px-4 text-center'>
                                  {req.proofOfPaymentUrl ? (
                                    <button
                                      type='button'
                                      onClick={() =>
                                        setSelectedProofUrl(
                                          req.proofOfPaymentUrl,
                                        )
                                      }
                                      className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gold/10 hover:bg-gold hover:text-black border border-gold/30 text-gold text-[10px] font-bold transition-all cursor-pointer'
                                    >
                                      <Eye className='w-3.5 h-3.5' /> View
                                      Receipt
                                    </button>
                                  ) : (
                                    <span className='text-zinc-600 text-[10px] italic'>
                                      No receipt
                                    </span>
                                  )}
                                </td>
                                <td className='py-3 px-4 text-right font-bold text-white font-mono'>
                                  {new Intl.NumberFormat('en-PH', {
                                    style: 'currency',
                                    currency: 'PHP',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(req.amountPhp)}
                                </td>
                                <td className='py-3 px-4 text-right font-bold text-gold font-mono'>
                                  {req.amountCC.toLocaleString('en-PH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 4,
                                  })}{' '}
                                  CC
                                </td>
                                <td className='py-3 px-4 text-center'>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                      req.status === 'Approved'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : req.status === 'Declined'
                                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                    }`}
                                  >
                                    {req.status}
                                  </span>
                                </td>
                                <td className='py-3 px-4'>
                                  <div className='flex items-center justify-center gap-2'>
                                    {req.status === 'Submitted' ||
                                    req.status === 'Pending' ? (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleApproveCashin(req.requestId)
                                          }
                                          disabled={actionLoading !== null}
                                          className='p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all cursor-pointer'
                                          title='Approve Cash-In'
                                        >
                                          <Check className='w-4 h-4' />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeclineCashin(
                                              req.requestId,
                                              req.uid,
                                            )
                                          }
                                          disabled={actionLoading !== null}
                                          className='p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black rounded-lg transition-all cursor-pointer'
                                          title='Decline Cash-In'
                                        >
                                          <X className='w-4 h-4' />
                                        </button>
                                      </>
                                    ) : (
                                      <span className='text-zinc-500 text-[10px] font-mono'>
                                        Processed
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9.8: PLATFORM TREASURY & FEE MONITORING */}
              {activeTab === 'treasury' && (
                <div className='space-y-6 animate-fadeIn'>
                  <TechOpsTreasuryDashboard
                    currentUserProfile={currentUserProfile}
                  />
                </div>
              )}

              {/* TAB 10: P2P MARKETPLACE */}
              {activeTab === 'p2p-marketplace' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      P2P Credit Trade Market
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Verify peer-to-peer credit transactions, transfer details,
                      and escrow security trails.
                    </p>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl text-center space-y-4 max-w-lg mx-auto'>
                    <Share2 className='w-12 h-12 text-gold mx-auto' />
                    <h3 className='text-sm font-bold text-white uppercase'>
                      Live P2P Auditing Ledger
                    </h3>
                    <p className='text-xs text-zinc-400 leading-relaxed'>
                      All user-to-user Chosen Credit (CC) transfers are logged
                      traceably with automatic balance reconciliation and 1 CC
                      company fee collection.
                    </p>
                    <button
                      onClick={() => onNavigate('admin-p2p-transfers')}
                      className='w-full bg-[#111318] hover:bg-zinc-900 border border-zinc-800 hover:border-gold/50 text-gold font-bold uppercase tracking-widest text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer'
                    >
                      <span>Launch Advanced Audit Ledger</span>
                      <ArrowUpRight className='w-4 h-4 text-gold' />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 11: REPORTS CENTER */}
              {activeTab === 'reports' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Package Activation & Compensation Reports
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Monitor server-generated activation events, wallet debits,
                      Direct and Indirect Referral Bonuses, Leadership Bonuses,
                      MSA entitlements, processing status, and idempotency
                      results.
                    </p>
                  </div>

                  {reportLoadWarnings.length > 0 && (
                    <div className='rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-300'>
                      <div className='font-black uppercase tracking-wider'>
                        Reporting integration requires attention
                      </div>
                      <ul className='mt-2 space-y-1 list-disc pl-5'>
                        {reportLoadWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className='grid grid-cols-2 lg:grid-cols-6 gap-4'>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        Activations
                      </span>
                      <span className='text-2xl font-black text-white'>
                        {packageActivationReports.length}
                      </span>
                    </div>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        Wallet Debits
                      </span>
                      <span className='text-xl font-black text-cyan-400'>
                        {packageActivationReports
                          .reduce(
                            (total, report) =>
                              total + Number(report.walletDebitedCC || 0),
                            0,
                          )
                          .toFixed(2)}{' '}
                        CC
                      </span>
                    </div>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        Direct Referral
                      </span>
                      <span className='text-xl font-black text-gold'>
                        {sumCompensationAmount(directReferralReports).toFixed(
                          2,
                        )}{' '}
                        CC
                      </span>
                    </div>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        Indirect Referral
                      </span>
                      <span className='text-xl font-black text-emerald-400'>
                        {sumCompensationAmount(indirectReferralReports).toFixed(
                          2,
                        )}{' '}
                        CC
                      </span>
                    </div>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        Leadership Bonus
                      </span>
                      <span className='text-xl font-black text-fuchsia-400'>
                        {sumCompensationAmount(leadershipReports).toFixed(2)} CC
                      </span>
                    </div>
                    <div className='bg-zinc-950 border border-zinc-900 p-4 rounded-xl'>
                      <span className='block text-[9px] text-zinc-500 uppercase tracking-widest font-black'>
                        MSA Entitlements
                      </span>
                      <span className='text-2xl font-black text-blue-400'>
                        {msaEntitlementReports.length}
                      </span>
                    </div>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-5'>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                      <div className='relative'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600' />
                        <input
                          value={reportSearchQuery}
                          onChange={(event) =>
                            setReportSearchQuery(event.target.value)
                          }
                          placeholder='Member ID, Event ID, Commission ID...'
                          className='w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-gold/50'
                        />
                      </div>
                      <select
                        value={reportTypeFilter}
                        onChange={(event) =>
                          setReportTypeFilter(event.target.value)
                        }
                        className='rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs outline-none focus:border-gold/50'
                      >
                        <option>All</option>
                        <option>Direct Referral</option>
                        <option>Indirect Referral</option>
                        <option>Leadership Bonus</option>
                      </select>
                      <select
                        value={reportStatusFilter}
                        onChange={(event) =>
                          setReportStatusFilter(event.target.value)
                        }
                        className='rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs outline-none focus:border-gold/50'
                      >
                        <option>All</option>
                        <option>Credited</option>
                        <option>Flushed</option>
                        <option>Not Qualified</option>
                        <option>Pending</option>
                        <option>Completed</option>
                        <option>Failed</option>
                      </select>
                    </div>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                    <div className='p-5 border-b border-zinc-900'>
                      <h3 className='text-sm font-black uppercase text-white'>
                        Package Activation Events
                      </h3>
                      <p className='text-[10px] text-zinc-500 mt-1'>
                        Server-generated summaries. Official totals must not be
                        reconstructed from client-side assumptions.
                      </p>
                    </div>
                    <div className='overflow-x-auto'>
                      <table className='w-full min-w-[1050px] text-left text-xs'>
                        <thead className='bg-zinc-900/60 text-[9px] uppercase tracking-wider text-zinc-500'>
                          <tr>
                            <th className='px-4 py-3'>Event ID</th>
                            <th className='px-4 py-3'>Member</th>
                            <th className='px-4 py-3'>Action</th>
                            <th className='px-4 py-3'>Package</th>
                            <th className='px-4 py-3 text-right'>
                              Wallet Debit
                            </th>
                            <th className='px-4 py-3 text-right'>Direct</th>
                            <th className='px-4 py-3 text-right'>Indirect</th>
                            <th className='px-4 py-3 text-right'>Leadership</th>
                            <th className='px-4 py-3'>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packageActivationReports
                            .slice(0, 100)
                            .map((report) => (
                              <tr
                                key={report.id}
                                className='border-t border-zinc-900/70 hover:bg-zinc-900/30'
                              >
                                <td className='px-4 py-3 font-mono text-cyan-400'>
                                  {report.activationEventId}
                                </td>
                                <td className='px-4 py-3 font-mono text-zinc-300'>
                                  {report.memberId}
                                </td>
                                <td className='px-4 py-3'>
                                  {report.activationAction}
                                </td>
                                <td className='px-4 py-3'>
                                  {report.previousPackageLevel} →{' '}
                                  {report.newPackageLevel}
                                </td>
                                <td className='px-4 py-3 text-right font-mono'>
                                  {report.walletDebitedCC.toFixed(2)} CC
                                </td>
                                <td className='px-4 py-3 text-right font-mono text-gold'>
                                  {report.directReferralTotalCC.toFixed(2)} CC
                                </td>
                                <td className='px-4 py-3 text-right font-mono text-emerald-400'>
                                  {report.indirectReferralTotalCC.toFixed(2)} CC
                                </td>
                                <td className='px-4 py-3 text-right font-mono text-fuchsia-400'>
                                  {report.leadershipFromReferralTotalCC.toFixed(
                                    2,
                                  )}{' '}
                                  CC
                                </td>
                                <td className='px-4 py-3'>
                                  <span className='rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[9px] font-bold uppercase'>
                                    {report.overallStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          {packageActivationReports.length === 0 && (
                            <tr>
                              <td
                                colSpan={9}
                                className='px-4 py-10 text-center text-zinc-600'
                              >
                                No server-generated package activation reports
                                found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                    <div className='p-5 border-b border-zinc-900'>
                      <h3 className='text-sm font-black uppercase text-white'>
                        Referral & Leadership Ledger
                      </h3>
                      <p className='text-[10px] text-zinc-500 mt-1'>
                        Direct Referral, Indirect Referral, and Leadership Bonus
                        remain separate and source-linked.
                      </p>
                    </div>
                    <div className='overflow-x-auto'>
                      <table className='w-full min-w-[1050px] text-left text-xs'>
                        <thead className='bg-zinc-900/60 text-[9px] uppercase tracking-wider text-zinc-500'>
                          <tr>
                            <th className='px-4 py-3'>Commission ID</th>
                            <th className='px-4 py-3'>Type</th>
                            <th className='px-4 py-3'>Source</th>
                            <th className='px-4 py-3'>Earner</th>
                            <th className='px-4 py-3'>Level</th>
                            <th className='px-4 py-3 text-right'>Amount</th>
                            <th className='px-4 py-3'>Status</th>
                            <th className='px-4 py-3'>Rule</th>
                            <th className='px-4 py-3'>Event ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCompensationReports
                            .slice(0, 200)
                            .map((record) => {
                              const isDirect =
                                isReferralCommission(record) &&
                                (record.referralBonusType.toLowerCase() ===
                                  'direct' ||
                                  record.level === 1)
                              const displayType = isLeadershipCommission(record)
                                ? 'Leadership Bonus'
                                : isDirect
                                  ? 'Direct Referral'
                                  : isReferralCommission(record)
                                    ? 'Indirect Referral'
                                    : record.commissionType || 'Other'

                              return (
                                <tr
                                  key={record.id}
                                  className='border-t border-zinc-900/70 hover:bg-zinc-900/30'
                                >
                                  <td className='px-4 py-3 font-mono text-cyan-400'>
                                    {record.id}
                                  </td>
                                  <td className='px-4 py-3 font-bold'>
                                    {displayType}
                                  </td>
                                  <td className='px-4 py-3 text-zinc-400'>
                                    {record.leadershipSourceType ||
                                      record.referralBonusType ||
                                      'Package Activation'}
                                  </td>
                                  <td className='px-4 py-3 font-mono'>
                                    {record.earnerMemberId}
                                  </td>
                                  <td className='px-4 py-3 font-mono'>
                                    {record.level || '—'}
                                  </td>
                                  <td className='px-4 py-3 text-right font-mono text-gold'>
                                    {record.amountCC.toFixed(2)} CC
                                  </td>
                                  <td className='px-4 py-3'>{record.status}</td>
                                  <td className='px-4 py-3 font-mono text-zinc-500'>
                                    {record.ruleVersion}
                                  </td>
                                  <td className='px-4 py-3 font-mono text-zinc-500'>
                                    {record.activationEventId || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          {filteredCompensationReports.length === 0 && (
                            <tr>
                              <td
                                colSpan={9}
                                className='px-4 py-10 text-center text-zinc-600'
                              >
                                No compensation records match the selected
                                filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                    <div className='p-5 border-b border-zinc-900'>
                      <h3 className='text-sm font-black uppercase text-white'>
                        MSA Entitlements
                      </h3>
                      <p className='text-[10px] text-zinc-500 mt-1'>
                        Entitlement creation does not generate Leadership Bonus.
                        Leadership is generated only after the scheduled MSA
                        credit succeeds.
                      </p>
                    </div>
                    <div className='overflow-x-auto'>
                      <table className='w-full min-w-[850px] text-left text-xs'>
                        <thead className='bg-zinc-900/60 text-[9px] uppercase tracking-wider text-zinc-500'>
                          <tr>
                            <th className='px-4 py-3'>Entitlement ID</th>
                            <th className='px-4 py-3'>Event ID</th>
                            <th className='px-4 py-3'>Member</th>
                            <th className='px-4 py-3'>Package</th>
                            <th className='px-4 py-3 text-right'>Amount</th>
                            <th className='px-4 py-3'>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msaEntitlementReports.slice(0, 100).map((record) => (
                            <tr
                              key={record.id}
                              className='border-t border-zinc-900/70'
                            >
                              <td className='px-4 py-3 font-mono text-cyan-400'>
                                {record.id}
                              </td>
                              <td className='px-4 py-3 font-mono text-zinc-500'>
                                {record.activationEventId || '—'}
                              </td>
                              <td className='px-4 py-3 font-mono'>
                                {record.memberId}
                              </td>
                              <td className='px-4 py-3'>
                                {record.packageLevel}
                              </td>
                              <td className='px-4 py-3 text-right font-mono text-blue-400'>
                                {record.amountCC.toFixed(2)} CC
                              </td>
                              <td className='px-4 py-3'>{record.status}</td>
                            </tr>
                          ))}
                          {msaEntitlementReports.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className='px-4 py-10 text-center text-zinc-600'
                              >
                                No MSA entitlement records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className='pt-6 border-t border-zinc-900'>
                    <ReactivationReport />
                  </div>
                </div>
              )}

              {/* TAB 12: ANALYTICS & TRENDS */}
              {activeTab === 'analytics' && (
                <div className='space-y-8 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Ecosystem Analytics & Performance Charts
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Analyze weekly package registration volumes, member
                      trends, and user package distributions.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
                    {/* Area Chart */}
                    <div className='lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl'>
                      <h3 className='font-extrabold text-xs uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-6'>
                        <Activity className='w-5 h-5 text-gold' /> Weekly Sales
                        Volume (CC)
                      </h3>
                      <div className='h-80 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <AreaChart
                            data={salesTrendData}
                            margin={{
                              top: 10,
                              right: 10,
                              left: -20,
                              bottom: 0,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id='colorSales'
                                x1='0'
                                y1='0'
                                x2='0'
                                y2='1'
                              >
                                <stop
                                  offset='5%'
                                  stopColor='#ffd700'
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset='95%'
                                  stopColor='#ffd700'
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray='3 3'
                              stroke='#27272a'
                            />
                            <XAxis
                              dataKey='date'
                              stroke='#71717a'
                              fontSize={11}
                              tickLine={false}
                            />
                            <YAxis
                              stroke='#71717a'
                              fontSize={11}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#09090b',
                                borderColor: '#27272a',
                                color: '#fff',
                              }}
                            />
                            <Area
                              type='monotone'
                              dataKey='Sales'
                              stroke='#ffd700'
                              strokeWidth={2}
                              fillOpacity={1}
                              fill='url(#colorSales)'
                              name='Sales (CC)'
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl'>
                      <h3 className='font-extrabold text-xs uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-6'>
                        <Award className='w-5 h-5 text-gold' /> Package Levels
                      </h3>
                      <div className='h-80 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <BarChart
                            data={packageChartData}
                            margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray='3 3'
                              stroke='#27272a'
                            />
                            <XAxis
                              dataKey='name'
                              stroke='#71717a'
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis
                              stroke='#71717a'
                              fontSize={10}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#09090b',
                                borderColor: '#27272a',
                                color: '#fff',
                              }}
                            />
                            <Bar dataKey='Count' name='Members'>
                              {packageChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 13: LEADERSHIP BOARD */}
              {activeTab === 'leadership' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Leadership Board & Milestones
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      View top performers and ranking achievements across
                      Visayas, Mindanao, and Luzon regions.
                    </p>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6'>
                    <h3 className='font-bold text-sm text-white uppercase mb-4'>
                      Top Recruiters & Builders
                    </h3>
                    <div className='space-y-4'>
                      <div className='flex justify-between items-center text-xs p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80'>
                        <div className='flex items-center gap-3'>
                          <span className='font-black text-gold text-sm'>
                            #1
                          </span>
                          <div>
                            <span className='font-bold text-white block'>
                              Ariel San Jose
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              Regional Director • Mindanao Hub
                            </span>
                          </div>
                        </div>
                        <span className='font-bold text-gold font-mono'>
                          42 Direct Sponsors
                        </span>
                      </div>
                      <div className='flex justify-between items-center text-xs p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80'>
                        <div className='flex items-center gap-3'>
                          <span className='font-black text-zinc-400 text-sm'>
                            #2
                          </span>
                          <div>
                            <span className='font-bold text-white block'>
                              Clarissa Sy
                            </span>
                            <span className='text-zinc-500 text-[10px]'>
                              City Director • Cebu Central
                            </span>
                          </div>
                        </div>
                        <span className='font-bold text-gold font-mono'>
                          28 Direct Sponsors
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 14: AI BUSINESS COACH */}
              {activeTab === 'ai-coach' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Executive AI Business Coach
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Interact with your specialized AI Coach for downline
                      projections, sales models, and distributor training
                      suggestions.
                    </p>
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl p-6 h-[500px] flex flex-col justify-between'>
                    <div className='flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin'>
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] p-4 rounded-xl text-xs leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-gold text-black font-semibold rounded-tr-none'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none'
                            }`}
                          >
                            <p>{msg.text}</p>
                            <span
                              className={`block text-[8px] mt-2 font-mono ${msg.sender === 'user' ? 'text-black/60' : 'text-zinc-500'}`}
                            >
                              {msg.timestamp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleSendCoachMessage}
                      className='flex gap-2'
                    >
                      <input
                        type='text'
                        placeholder='Ask AI Coach for sales optimizations, cycle alerts, or payout recommendations...'
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className='flex-1 bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-4 py-3 text-xs focus:outline-none'
                      />
                      <button
                        type='submit'
                        className='bg-gold hover:brightness-110 text-black px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer'
                      >
                        Ask Coach
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 15: TRAINING ACADEMY */}
              {activeTab === 'academy' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Digital Training Academy
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Access digital brochures, wellness seminar presentations,
                      compensation videos, and unilevel guides.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <h3 className='font-bold text-sm text-white uppercase mb-2 flex items-center gap-2'>
                        <BookOpen className='w-4 h-4 text-gold' /> Distributor
                        Presentation Slides
                      </h3>
                      <p className='text-xs text-zinc-400 font-light leading-relaxed mb-4'>
                        Standardized marketing presentation slide decks
                        outlining the 15-in-1 latte benefits, herbal blends, and
                        package pricing structures.
                      </p>
                      <span className='text-[10px] text-gold font-bold uppercase font-mono block'>
                        PDF Slides Cleared for Seminars
                      </span>
                    </div>

                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <h3 className='font-bold text-sm text-white uppercase mb-2 flex items-center gap-2'>
                        <Award className='w-4 h-4 text-gold' /> Unilevel
                        Strategy Guides
                      </h3>
                      <p className='text-xs text-zinc-400 font-light leading-relaxed mb-4'>
                        Step-by-step unilevel duplication plans teaching
                        affiliates how to optimize generation depths and safely
                        monitor cycle caps.
                      </p>
                      <span className='text-[10px] text-zinc-400 font-bold uppercase font-mono block'>
                        Level 1-5 Placements Cleared
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 16: SYSTEM AUDIT LOGS */}
              {activeTab === 'audit-logs' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                    <div>
                      <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                        Corporate Security Audit trails
                      </h2>
                      <p className='text-xs text-zinc-500 font-light mt-0.5'>
                        Trace administrative updates, package approvals, cashout
                        declines, and system balance corrections.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Control & Filter Bar */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-900'>
                    {/* Search Field */}
                    <div className='relative'>
                      <span className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500'>
                        <Search className='w-4 h-4' />
                      </span>
                      <input
                        type='text'
                        placeholder='Search audit trail...'
                        value={auditSearchQuery}
                        onChange={(e) => setAuditSearchQuery(e.target.value)}
                        className='w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-300 focus:outline-none focus:border-gold placeholder-zinc-600'
                      />
                    </div>

                    {/* Filter by Action */}
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] text-zinc-500 uppercase tracking-wider font-mono shrink-0'>
                        Action:
                      </span>
                      <select
                        value={auditActionFilter}
                        onChange={(e) => setAuditActionFilter(e.target.value)}
                        className='w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none focus:border-gold'
                      >
                        <option value='All'>All Actions</option>
                        {uniqueActions
                          .filter((act) => act !== 'All')
                          .map((act, index) => (
                            <option key={index} value={act}>
                              {act}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Filter by Operational Email */}
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] text-zinc-500 uppercase tracking-wider font-mono shrink-0'>
                        Operator:
                      </span>
                      <select
                        value={auditEmailFilter}
                        onChange={(e) => setAuditEmailFilter(e.target.value)}
                        className='w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none focus:border-gold'
                      >
                        <option value='All'>All Emails</option>
                        {uniqueEmails
                          .filter((email) => email !== 'All')
                          .map((email, index) => (
                            <option key={index} value={email}>
                              {email}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Filter by Limit */}
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] text-zinc-500 uppercase tracking-wider font-mono shrink-0'>
                        Rows:
                      </span>
                      <select
                        value={auditLimit}
                        onChange={(e) => setAuditLimit(Number(e.target.value))}
                        className='w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:outline-none focus:border-gold'
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                      </select>
                    </div>
                  </div>

                  {/* Metrics count indicator */}
                  <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] text-zinc-500 font-mono gap-1'>
                    <div>
                      Showing{' '}
                      <span className='text-white font-bold'>
                        {displayedAuditLogs.length}
                      </span>{' '}
                      of{' '}
                      <span className='text-white font-bold'>
                        {filteredAuditLogs.length}
                      </span>{' '}
                      matching events
                      {auditLogs.length > filteredAuditLogs.length &&
                        ` (filtered from ${auditLogs.length} total events)`}
                    </div>
                    {filteredAuditLogs.length > auditLimit && (
                      <div className='text-[10px] text-amber-500 uppercase tracking-wider bg-amber-500/5 border border-amber-500/10 rounded px-2 py-0.5'>
                        Row limit active ({auditLimit})
                      </div>
                    )}
                  </div>

                  <div className='bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden'>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-left border-collapse text-xs'>
                        <thead>
                          <tr className='border-b border-zinc-900 bg-zinc-900/20 text-zinc-500 uppercase font-bold'>
                            <th className='py-3 px-4'>Timestamp</th>
                            <th className='py-3 px-4'>Operator Email</th>
                            <th className='py-3 px-4'>Action</th>
                            <th className='py-3 px-4'>Details Log</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedAuditLogs.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className='text-center py-12 text-zinc-600'
                              >
                                No matching system audit events found.
                              </td>
                            </tr>
                          ) : (
                            displayedAuditLogs.map((log, idx) => (
                              <tr
                                key={idx}
                                className='border-b border-zinc-900/60 hover:bg-zinc-900/10 text-zinc-400'
                              >
                                <td className='py-3 px-4 font-mono text-zinc-500 whitespace-nowrap'>
                                  {log.timestamp
                                    ? new Date(log.timestamp).toLocaleString()
                                    : 'N/A'}
                                </td>
                                <td className='py-3 px-4 font-bold text-white break-all'>
                                  {log.actorEmail}
                                </td>
                                <td className='py-3 px-4 whitespace-nowrap'>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      log.action.includes('ADJUSTMENT') ||
                                      log.action.includes('CORRECTION')
                                        ? 'bg-amber-500/15 text-amber-400'
                                        : log.action.includes('APPROVE')
                                          ? 'bg-emerald-500/15 text-emerald-400'
                                          : log.action.includes('DECLINE')
                                            ? 'bg-red-500/15 text-red-400'
                                            : 'bg-zinc-900 text-zinc-300'
                                    }`}
                                  >
                                    {log.action}
                                  </span>
                                </td>
                                <td className='py-3 px-4 text-xs font-light'>
                                  {log.details}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 17: SYSTEM SETTINGS */}
              {activeTab === 'settings' && (
                <div className='space-y-6 animate-fadeIn'>
                  <div>
                    <h2 className='text-lg font-extrabold uppercase text-white tracking-tight'>
                      Platform Maintenance Configurations
                    </h2>
                    <p className='text-xs text-zinc-500 font-light mt-0.5'>
                      Toggle operational state rules, clear transient
                      transaction logs, or lock distributor access.
                    </p>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl'>
                      <h3 className='font-bold text-sm text-white uppercase mb-4'>
                        Operational Status Toggles
                      </h3>
                      <div className='space-y-4 text-xs'>
                        <div className='flex justify-between items-center py-2 border-b border-zinc-900'>
                          <div>
                            <span className='font-bold text-zinc-300 block'>
                              Registration Portal Access
                            </span>
                            <span className='text-[10px] text-zinc-500'>
                              Allow sponsors to register downlines
                            </span>
                          </div>
                          <span className='px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold'>
                            Online
                          </span>
                        </div>
                        <div className='flex justify-between items-center py-2 border-b border-zinc-900'>
                          <div>
                            <span className='font-bold text-zinc-300 block'>
                              Withdrawal Cashout Gate
                            </span>
                            <span className='text-[10px] text-zinc-500'>
                              Allow active members to request cashouts
                            </span>
                          </div>
                          <span className='px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold'>
                            Online
                          </span>
                        </div>
                        <div className='flex justify-between items-center py-2'>
                          <div>
                            <span className='font-bold text-zinc-300 block'>
                              Platform Maintenance Mode
                            </span>
                            <span className='text-[10px] text-zinc-500'>
                              Restrict access to corporate consoles
                            </span>
                          </div>
                          <span className='px-2 py-1 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded font-bold'>
                            Offline
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className='bg-zinc-950 border border-zinc-900 p-6 rounded-2xl flex flex-col justify-between'>
                      <div>
                        <h3 className='font-bold text-sm text-white uppercase mb-2 flex items-center gap-2'>
                          <Database className='w-4 h-4 text-gold' /> Database
                          Sync Logs
                        </h3>
                        <p className='text-xs text-zinc-400 font-light leading-relaxed mb-4'>
                          Database collections are bound securely in Firestore
                          clusters. Synchronization status checks unfulfilled
                          transactions and resets cache locks every 24 hours.
                        </p>
                      </div>
                      <div className='flex gap-2'>
                        <button
                          onClick={fetchEnterpriseData}
                          className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs px-4 py-2.5 rounded-lg transition-all font-bold text-zinc-300 cursor-pointer'
                        >
                          Trigger Sync Now
                        </button>
                      </div>
                    </div>

                    {/* CC Conversion settings card */}
                    <div className='bg-[#181920] border border-zinc-800 p-6 rounded-2xl md:col-span-2'>
                      <h3 className='font-bold text-sm text-gold uppercase mb-2 flex items-center gap-2'>
                        <Sliders className='w-4 h-4 text-gold' /> Global CC
                        Conversion Rates (Manual v3.0 Settings)
                      </h3>
                      <p className='text-xs text-zinc-400 mb-6'>
                        Read directly from{' '}
                        <code className='bg-zinc-950 text-zinc-300 px-1 py-0.5 rounded font-mono'>
                          system_config/cc_settings
                        </code>{' '}
                        doc. Changes here immediately recalculate Cash-In
                        equivalent and Cash-Out values across all users in
                        real-time.
                      </p>

                      <form onSubmit={handleSaveRates} className='space-y-4'>
                        {rateSaveSuccess && (
                          <div className='p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium'>
                            ✓ CC rates successfully saved to Firestore and
                            propagated to all dashboards!
                          </div>
                        )}
                        {rateSaveError && (
                          <div className='p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium'>
                            ⚠ {rateSaveError}
                          </div>
                        )}

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          <div>
                            <label className='block text-xs uppercase text-zinc-500 font-extrabold tracking-wider mb-2'>
                              Cash-In Rate (1 CC = ₱ PHP)
                            </label>
                            <input
                              type='number'
                              required
                              min='1'
                              step='0.01'
                              value={tempCashInRate}
                              onChange={(e) =>
                                setTempCashInRate(Number(e.target.value))
                              }
                              className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors font-bold'
                            />
                            <p className='text-[10px] text-zinc-600 mt-1'>
                              Official manual standard: 70 PHP
                            </p>
                          </div>

                          <div>
                            <label className='block text-xs uppercase text-zinc-500 font-extrabold tracking-wider mb-2'>
                              Cash-Out Rate (1 CC = ₱ PHP)
                            </label>
                            <input
                              type='number'
                              required
                              min='1'
                              step='0.01'
                              value={tempCashOutRate}
                              onChange={(e) =>
                                setTempCashOutRate(Number(e.target.value))
                              }
                              className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors font-bold'
                            />
                            <p className='text-[10px] text-zinc-600 mt-1'>
                              Official manual standard: 69 PHP
                            </p>
                          </div>
                        </div>

                        <div className='flex justify-end pt-2'>
                          <button
                            type='submit'
                            className='bg-gold hover:bg-gold-light text-black text-xs font-bold px-5 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5'
                          >
                            <Check className='w-4 h-4' /> Save Rate
                            Configuration
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        <footer className='py-8 border-t border-zinc-950 bg-zinc-950 text-center text-[10px] text-zinc-600 font-mono shrink-0'>
          I AM CHOSEN ENTERPRISE PORTAL • SECURE SUPER ADMIN LEVEL ACCESS ONLY •
          2026-07-05
        </footer>

        {selectedProofUrl && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn'>
            <div className='w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-2xl' />
              <button
                type='button'
                onClick={() => setSelectedProofUrl(null)}
                className='absolute top-4 right-4 p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer'
              >
                <X className='w-4 h-4' />
              </button>

              <h3 className='text-sm font-bold uppercase tracking-wider text-gold mb-4'>
                Proof of Payment Receipt
              </h3>

              <div className='border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center min-h-[300px] max-h-[70vh]'>
                {selectedProofUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={selectedProofUrl}
                    title='PDF Proof'
                    className='w-full h-[50vh]'
                  />
                ) : (
                  <img
                    src={selectedProofUrl}
                    alt='Proof of Payment receipt'
                    className='max-w-full max-h-[50vh] object-contain'
                  />
                )}
              </div>

              <div className='mt-4 flex justify-end'>
                <button
                  type='button'
                  onClick={() => setSelectedProofUrl(null)}
                  className='bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-bold px-4 py-2 rounded-lg transition-all cursor-pointer'
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { db, createAuditLog } from '../firebase'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  limit,
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
    packageValue: 10000,
    cycleMax: 25000,
  },
  'Regional Distributor': {
    displayName: 'Regional Distributor',
    badgeLabel: 'Regional Distributor',
    accentClass: 'text-indigo-400 border-indigo-400/15',
    bgClass: 'bg-indigo-400/10',
    glowClass: 'shadow-indigo-400/20',
    gradientClass: 'from-indigo-400 to-blue-600',
    packageValue: 25000,
    cycleMax: 62500,
  },
}

const getPackageConfig = (level: string | undefined): PackageConfig => {
  const normalized = level || 'Bronze'
  return PACKAGE_CONFIGS[normalized] || PACKAGE_CONFIGS.Bronze
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
  const [transactions, setTransactions] = useState<any[]>([])
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

  // Cashin Modal form state
  const [showCashinModal, setShowCashinModal] = useState(false)
  const [cashinAmountPhp, setCashinAmountPhp] = useState<number>(3500)
  const [cashinChannel, setCashinChannel] = useState<'GCash' | 'Maya' | 'Bank'>(
    'GCash',
  )
  const [cashinReference, setCashinReference] = useState('')
  const [cashinAccountName, setCashinAccountName] = useState('')
  const [cashinAccountNumber, setCashinAccountNumber] = useState('')
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [cashinNotes, setCashinNotes] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [cashinError, setCashinError] = useState<string | null>(null)
  const [cashinSuccess, setCashinSuccess] = useState<string | null>(null)
  const [cashinHistory, setCashinHistory] = useState<any[]>([])

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

  // Activity feed filtering
  const [activityFilter, setActivityFilter] = useState<
    'ALL' | 'TRANSACTIONS' | 'COMMISSIONS' | 'REFERRALS'
  >('ALL')

  // Notifications State linked to Firestore
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotificationsDropdown, setShowNotificationsDropdown] =
    useState(false)

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

  // Synchronize active view state with AffiliateAppShell
  useEffect(() => {
    const event = new CustomEvent('affiliate_view_changed', {
      detail: {
        view: activeActionModal,
        aiCoach: showAICoachModal,
      },
    })
    window.dispatchEvent(event)
  }, [activeActionModal, showAICoachModal])

  // Check for any pending navigation views from the Drawer
  useEffect(() => {
    const pendingView = sessionStorage.getItem('affiliate_view')
    if (pendingView) {
      if (
        [
          'team',
          'orders',
          'commissions',
          'marketing',
          'academy',
          'support',
        ].includes(pendingView)
      ) {
        setActiveActionModal(pendingView)
      } else if (pendingView === 'ai-coach') {
        setShowAICoachModal(true)
      }
      sessionStorage.removeItem('affiliate_view')
    }
  }, [])

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
        if (cycleData.status === 'Completed') {
          setShowCompletedModal(true)
        }
      }
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 2: Business Cycle):',
        err,
      )
    }

    // 3. Fetch Transactions via WalletService
    try {
      const txList = await WalletService.getWalletTransactions(userProfile.uid)
      txList.sort(
        (a: any, b: any) =>
          new Date(b.timestamp || b.createdAt).getTime() -
          new Date(a.timestamp || a.createdAt).getTime(),
      )
      setTransactions(txList)
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 3: Wallet Transactions):',
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

    // 5. Fetch Cash-In history
    try {
      const cashinQuery = query(
        collection(db, 'cashin_requests'),
        where('uid', '==', userProfile.uid),
      )
      const cashinSnap = await getDocs(cashinQuery)
      const cashinList = cashinSnap.docs.map((doc) => doc.data())
      cashinList.sort(
        (a, b) =>
          new Date(b.requestDate || b.requestedAt).getTime() -
          new Date(a.requestDate || a.requestedAt).getTime(),
      )
      setCashinHistory(cashinList)
    } catch (err) {
      console.error(
        'Error loading dashboard details (Step 5: Cash-in History):',
        err,
      )
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
      )
      const s1 = await getDocs(q1)
      s1.docs.forEach((d) => {
        refs[d.id] = d.data()
      })

      // Query 2: sponsorUid == userProfile.uid
      const q2 = query(
        collection(db, 'users'),
        where('sponsorUid', '==', userProfile.uid),
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

  // Submit Cash-In via WalletService
  const handleCashinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCashinError(null)
    setCashinSuccess(null)

    if (cashinAmountPhp < 70) {
      setCashinError('Minimum cash-in is ₱70.00 (1 CC).')
      return
    }

    if (!cashinReference) {
      setCashinError('Transaction reference number is required.')
      return
    }

    if (!receiptFile) {
      setCashinError('Please upload a proof of payment receipt.')
      return
    }

    setLoading(true)
    try {
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`

      // Upload the receipt to Storage first
      const uploadResult = await WalletService.uploadReceipt(
        userProfile.uid,
        requestId,
        receiptFile,
      )

      const computedCC = WalletService.calculateCashInCC(cashinAmountPhp)
      await WalletService.createCashInRequest(userProfile.uid, {
        requestId,
        memberId: userProfile.memberId,
        fullName: userProfile.fullName,
        email: userProfile.email,
        amountPHP: cashinAmountPhp,
        computedCC,
        paymentMethod: cashinChannel,
        referenceNumber: cashinReference,

        // Storage receipt details
        proofOfPaymentUrl: uploadResult.proofOfPaymentUrl,
        proofOfPaymentPath: uploadResult.proofOfPaymentPath,
        proofOfPaymentFileName: uploadResult.proofOfPaymentFileName,
        proofOfPaymentContentType: uploadResult.proofOfPaymentContentType,
        proofOfPaymentSizeBytes: uploadResult.proofOfPaymentSizeBytes,

        notes: cashinNotes,
      })

      setCashinSuccess(
        `Cash-In request for ₱${cashinAmountPhp.toLocaleString()} submitted successfully! We are validating your receipt.`,
      )
      setCashinReference('')
      setReceiptFile(null)
      setTimeout(() => {
        setShowCashinModal(false)
        setProofOfPaymentUrl('')
        setCashinNotes('')
        fetchDashboardData()
      }, 3000)
    } catch (err: any) {
      setCashinError(err.message || 'Failed to submit request.')
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

      setTransferSuccess(
        `Successfully transferred ${transferAmount} CC to ${transferRecipient}!`,
      )
      setTransferRecipient('')
      setTransferAmount(10)
      setTimeout(() => {
        setShowTransferModal(false)
        fetchDashboardData()
      }, 3000)
    } catch (e: any) {
      setTransferError(e.message || 'Failed to complete P2P Transfer.')
    } finally {
      setTransferLoading(false)
    }
  }

  // Submit Package Upgrade via PackageService
  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpgradeError(null)
    setUpgradeSuccess(null)

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
      'City Distributor': 10000,
      'Regional Distributor': 25000,
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

    const costCC = targetValue - currentValue

    if (!wallet || wallet.chosenWalletBalance < costCC) {
      setUpgradeError(
        `Insufficient Chosen Wallet balance. You need ${costCC} CC to upgrade to ${selectedUpgradeLevel}, but your Chosen Wallet balance is only ${wallet?.chosenWalletBalance || 0} CC.`,
      )
      return
    }

    setUpgradeLoading(true)
    try {
      await PackageService.upgradePackage(
        userProfile.uid,
        userProfile.email,
        currentLevel,
        selectedUpgradeLevel as any,
        costCC,
      )

      setUpgradeSuccess(
        `Congratulations! Successfully upgraded your package level to ${selectedUpgradeLevel}!`,
      )
      setTimeout(() => {
        setShowUpgradeModal(false)
        setSelectedUpgradeLevel('')
        fetchDashboardData()
      }, 3000)
    } catch (err: any) {
      setUpgradeError(err.message || 'Failed to complete package upgrade.')
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

  // File drop helpers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setCashinError(
        'Invalid file type. Please upload an image or PDF proof of payment receipt.',
      )
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setCashinError(
        'File is too large. Please upload an image smaller than 5MB.',
      )
      return
    }

    setReceiptFile(file)
    try {
      const previewUrl = URL.createObjectURL(file)
      setProofOfPaymentUrl(previewUrl)
      setCashinError(null)
    } catch (e) {
      setCashinError('Failed to generate file preview.')
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

  const handleMobileTabChange = (tab: CustomerTabType) => {
    setActiveMobileTab(tab)
    if (tab === 'register') {
      onNavigate('member-registration')
    } else if (tab === 'wallet') {
      onNavigate('cash-in')
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

  // Filtered recent activities
  const getFilteredActivities = () => {
    let list = []

    // Form comprehensive log from real Firestore ledger & commissions
    const txMapped = transactions.map((tx) => ({
      id: tx.id,
      title: tx.description || 'Wallet Transaction',
      type: 'TRANSACTIONS',
      amount: `${tx.type === 'CREDIT' ? '+' : '-'}${tx.amount || tx.amountCC} CC`,
      isCredit: tx.type === 'CREDIT',
      date: new Date(tx.timestamp || tx.createdAt).toLocaleString(),
      subtext: `ID: ${tx.id} • Wallet: ${tx.walletType || 'Chosen'}`,
    }))

    list = [...txMapped]

    if (commissionSummary && commissionSummary.count > 0) {
      // Add fake or real commissions if they aren't duplicate
    }

    if (activityFilter === 'ALL') return list
    return list.filter((item) => item.type === activityFilter)
  }

  const filteredActivities = getFilteredActivities()

  const simulatorTiers = [
    { name: 'Bronze', fallbackCC: 50, isDistributor: false },
    { name: 'Silver', fallbackCC: 350, isDistributor: false },
    { name: 'Gold', fallbackCC: 1500, isDistributor: false },
    { name: 'Platinum', fallbackCC: 3000, isDistributor: false },
    { name: 'Diamond', fallbackCC: 5000, isDistributor: false },
    { name: 'City Distributor', fallbackCC: undefined, isDistributor: true },
    {
      name: 'Regional Distributor',
      fallbackCC: undefined,
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

  // Helper to resolve package CC value
  const getPackageCCValue = (level: string): number => {
    const stdMap: Record<string, number> = {
      Bronze: 50,
      Silver: 350,
      Gold: 1500,
      Platinum: 3000,
      Diamond: 5000,
      'City Distributor': 10000,
      'Regional Distributor': 25000,
    }
    const foundPkg = dbPackages.find((p) => p.id === level || p.name === level)
    if (foundPkg && typeof foundPkg.valueCC === 'number') {
      return foundPkg.valueCC
    }
    return stdMap[level] || 50
  }

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
    const isActive = member.status === 'Active'
    return isAffiliate && hasActivePackage && isActive
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

  const renderRecentActivities = () => {
    return (
      <div className='space-y-6'>
        {/* Active Business Plan Cycle Card */}
        <div className='bg-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group'>
          <div className='absolute top-0 inset-x-0 h-[2px] bg-amber-500/80' />
          <div className='absolute top-0 right-0 w-32 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none' />
          <div className='flex justify-between items-start mb-5'>
            <div>
              <h3 className='font-extrabold text-sm text-white uppercase tracking-tight flex items-center gap-2'>
                <ShieldCheck className='w-4 h-4 text-amber-500 animate-pulse' />{' '}
                Business Cycle Progress
              </h3>
            </div>
            {businessCycle && (
              <span
                className={`text-[9px] font-mono px-2.5 py-1 rounded-full uppercase font-bold border ${
                  businessCycle.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                    : 'bg-red-500/10 text-red-400 border-red-500/15'
                }`}
              >
                {businessCycle.status}
              </span>
            )}
          </div>

          {businessCycle ? (
            <div className='space-y-5'>
              {/* Progress Indicators */}
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
                    className='gold-gradient h-full transition-all duration-500'
                    style={{
                      width: `${Math.min(100, (businessCycle.currentQualifiedEarningsCC / businessCycle.earningsCapCC) * 100)}%`,
                    }}
                  />
                </div>
                <div className='flex items-center justify-center text-[10px] text-zinc-500 uppercase font-mono'>
                  <span className='text-amber-500 font-bold'>
                    {businessCycle.remainingCapacityCC} CC capacity remaining
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

        {/* Recent Account Activities Card */}
        <div className='bg-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden'>
          <div className='absolute top-0 inset-x-0 h-[2px] bg-zinc-800' />

          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5'>
            <div>
              <h3 className='font-extrabold text-sm text-white uppercase tracking-tight'>
                Recent Account Activities
              </h3>
              <p className='text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-1'>
                Audit Ledger & Network Milestones
              </p>
            </div>

            {/* Filter buttons inside card */}
            <div className='flex gap-1.5 bg-zinc-900/60 p-1 rounded-xl border border-zinc-850'>
              <button
                onClick={() => setActivityFilter('ALL')}
                className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  activityFilter === 'ALL'
                    ? 'bg-zinc-850 text-white border border-zinc-800'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All Activities
              </button>
              <button
                onClick={() => setActivityFilter('TRANSACTIONS')}
                className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  activityFilter === 'TRANSACTIONS'
                    ? 'bg-zinc-850 text-white border border-zinc-800'
                    : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Financial Ledger
              </button>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className='text-center py-8 text-zinc-500 text-xs font-light'>
              No account activities matched your filter.
            </div>
          ) : (
            <div className='space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent'>
              {filteredActivities.map((item, i) => (
                <div
                  key={item.id || i}
                  className='bg-zinc-900/30 hover:bg-zinc-900/55 border border-zinc-850 p-3.5 rounded-2xl flex justify-between items-center text-xs transition-colors'
                >
                  <div>
                    <div className='flex items-center gap-1.5 flex-wrap'>
                      <span className='font-bold text-white text-[11px] leading-tight'>
                        {item.title}
                      </span>
                    </div>
                    <span className='block text-[8px] text-zinc-500 font-mono mt-1 uppercase tracking-wider'>
                      {item.date} • {item.subtext}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-black text-xs ml-2 shrink-0 ${
                      item.isCredit ? 'text-emerald-400' : 'text-zinc-300'
                    }`}
                  >
                    {item.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
          {businessCycle && businessCycle.status === 'Completed' && (
            <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden'>
              <div className='absolute top-0 inset-y-0 left-0 w-1 bg-red-500' />
              <div>
                <h3 className='font-extrabold text-sm uppercase tracking-wider text-red-400 flex items-center gap-2'>
                  <ShieldAlert className='w-4 h-4 animate-pulse text-red-500' />{' '}
                  Business Cycle Completed
                </h3>
                <p className='text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed'>
                  Your Business Cycle is completed. Reactivate or upgrade to
                  continue earning commissions.
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
                  Reactivate Account
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
                  Upgrade Account
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
            displayReferenceRatePHP={ccSettings.displayReferenceRatePHP || 70}
            isLoading={loading}
            onCashIn={() => onNavigate('cash-in')}
            onUpgrade={() => setShowUpgradeModal(true)}
            onTransfer={() => onNavigate('p2p-transfer')}
            canUpgrade={userProfile.packageLevel !== 'Diamond'}
            canTransfer={true}
          />

          {/* Wallet Overview (Collapsible Card) */}
          <div className='bg-[#111318] border border-zinc-800/80 rounded-3xl shadow-xl overflow-hidden'>
            {/* Header Bar */}
            <div
              onClick={() => setIsWalletExpanded((prev) => !prev)}
              className='p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer select-none bg-[#171A22] border-b border-zinc-800/40 hover:bg-zinc-900/30 transition-colors gap-4 sm:gap-0'
            >
              <div className='flex items-center gap-3'>
                <div className='w-9 h-9 bg-[#CD7F32]/10 border border-[#CD7F32]/25 text-[#CD7F32] rounded-xl flex items-center justify-center'>
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
                      {wallet ? wallet.chosenWalletBalance.toFixed(2) : '0.00'}{' '}
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
                  <div className='bg-zinc-950 border border-zinc-850 rounded-2xl p-4 shadow-md relative overflow-hidden group'>
                    <div className='absolute top-0 inset-x-0 h-[2px] bg-amber-500' />
                    <div className='flex justify-between items-start mb-2'>
                      <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                        Total Earnings
                      </span>
                      <div className='w-5 h-5 bg-amber-500/10 rounded-md flex items-center justify-center border border-amber-500/25 text-amber-500'>
                        <DollarSign className='w-3 h-3' />
                      </div>
                    </div>
                    <div className='text-base font-black tracking-tight text-white mb-0.5'>
                      {wallet
                        ? wallet.commissionWalletBalance.toFixed(2)
                        : '0.00'}{' '}
                      CC
                    </div>
                    <div className='text-[9px] text-zinc-400 font-mono'>
                      ≈ ₱
                      {wallet
                        ? (
                            wallet.commissionWalletBalance *
                            ccSettings.cashOutRatePHP
                          ).toLocaleString()
                        : '0'}
                    </div>
                  </div>

                  {/* Marketing Support Wallet */}
                  <div className='bg-zinc-950 border border-zinc-850 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                    <div className='absolute top-0 inset-x-0 h-[2px] bg-blue-500' />
                    <div className='flex justify-between items-start mb-2'>
                      <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                        MSA
                      </span>
                      <div className='w-5 h-5 bg-blue-500/10 rounded-md flex items-center justify-center border border-blue-500/25 text-blue-400'>
                        <TrendingUp className='w-3 h-3' />
                      </div>
                    </div>
                    <div className='text-base font-black tracking-tight text-white mb-0.5'>
                      {wallet
                        ? wallet.marketingSupportWalletBalance.toFixed(2)
                        : '0.00'}{' '}
                      CC
                    </div>
                    <div className='text-[9px] text-zinc-400 font-mono'>
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
                  <div className='bg-zinc-950 border border-zinc-850 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                    <div className='absolute top-0 inset-x-0 h-[2px] bg-emerald-500' />
                    <div className='flex justify-between items-start mb-2'>
                      <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                        Today's Earnings
                      </span>
                      <div className='w-5 h-5 bg-emerald-500/10 rounded-md flex items-center justify-center border border-emerald-500/25 text-emerald-400'>
                        <Award className='w-3 h-3' />
                      </div>
                    </div>
                    <div className='text-base font-black tracking-tight text-white mb-0.5'>
                      {wallet ? wallet.rewardWalletBalance.toFixed(2) : '0.00'}{' '}
                      CC
                    </div>
                    <div className='text-[9px] text-zinc-400 font-mono'>
                      ≈ ₱
                      {wallet
                        ? (wallet.rewardWalletBalance * 70).toLocaleString()
                        : '0'}
                    </div>
                    <div className='mt-3 h-6 flex items-center justify-center text-[8px] text-zinc-500 uppercase tracking-wider border border-zinc-900 bg-zinc-950 rounded-lg'>
                      Non-Withdrawable
                    </div>
                  </div>

                  {/* Cash Wallet */}
                  <div className='bg-zinc-950 border border-zinc-850 rounded-2xl p-4 shadow-md relative overflow-hidden'>
                    <div className='absolute top-0 inset-x-0 h-[2px] bg-teal-500' />
                    <div className='flex justify-between items-start mb-2'>
                      <span className='text-[9px] text-zinc-500 uppercase tracking-widest font-mono'>
                        Withdrawable Balance
                      </span>
                      <div className='w-5 h-5 bg-teal-500/10 rounded-md flex items-center justify-center border border-teal-500/25 text-teal-400'>
                        <TrendingUp className='w-3 h-3' />
                      </div>
                    </div>
                    <div className='text-base font-black tracking-tight text-white mb-0.5'>
                      {wallet ? wallet.rewardWalletBalance.toFixed(2) : '0.00'}{' '}
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
                      <ArrowUpRight className='w-3.5 h-3.5' /> Request Cash-Out
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
                renderRecentActivities={renderRecentActivities}
              />
            </div>
          )}

          {/* AI Coach Advice Banner */}
          <div className='bg-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group'>
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
                    Ask your AI Business Coach how to get your first customers,
                    invite members, and grow from Bronze to Silver.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAICoachModal(true)}
                className='bg-[#111318] border border-zinc-800 hover:border-teal-500/50 hover:text-teal-400 font-extrabold text-[10px] py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider shrink-0'
              >
                Ask AI Coach <Sparkles className='w-3 h-3 animate-pulse' />
              </button>
            </div>
          </div>

          {/* Reusable Affiliate Growth & Referral Tools Section */}
          <AffiliateGrowthToolsSection userProfile={userProfile} />
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
                    A flat fee of 0.50 CC is charged per transaction.
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
                        'City Distributor': 10000,
                        'Regional Distributor': 25000,
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
                      'City Distributor': 10000,
                      'Regional Distributor': 25000,
                    }
                    const capCCMap: Record<string, number> = {
                      Bronze: 125,
                      Silver: 875,
                      Gold: 3750,
                      Platinum: 7500,
                      Diamond: 12500,
                      'City Distributor': 25000,
                      'Regional Distributor': 62500,
                    }

                    const currentLevel = userProfile.packageLevel || 'Bronze'
                    const currentVal = valCCMap[currentLevel] || 0
                    const currentCap = capCCMap[currentLevel] || 0

                    const targetVal = valCCMap[selectedUpgradeLevel] || 0
                    const targetCap = capCCMap[selectedUpgradeLevel] || 0

                    const diffVal = targetVal - currentVal
                    const balance = wallet?.chosenWalletBalance || 0
                    const isInsufficient = balance < diffVal

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
                            Upgrade Cost (Difference):
                          </span>
                          <span className='font-black text-gold font-mono text-base'>
                            {diffVal.toFixed(2)} CC
                          </span>
                        </div>

                        {isInsufficient && (
                          <div className='mt-2 bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-[11px] leading-relaxed'>
                            ⚠️ <strong>Insufficient credits.</strong> You need
                            an additional{' '}
                            <strong>{(diffVal - balance).toFixed(2)} CC</strong>{' '}
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
                          'City Distributor': 10000,
                          'Regional Distributor': 25000,
                        }
                        const diffVal =
                          (valCCMap[selectedUpgradeLevel] || 0) -
                          (valCCMap[userProfile.packageLevel || 'Bronze'] || 0)
                        return (wallet?.chosenWalletBalance || 0) < diffVal
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
                To continue receiving commission earnings, privileges, and
                business benefits, please reactivate your current package or
                upgrade to a higher package.
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
                  Reactivate Account
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
                  Upgrade Account
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

        {/* Cash-In Modal */}
        {showCashinModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto'>
            <div className='w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 my-8 shadow-2xl relative'>
              <div className='absolute top-0 inset-x-0 h-1 gold-gradient rounded-t-3xl' />

              <h3 className='text-xl font-bold uppercase tracking-tight mb-2 text-white gold-text'>
                Request Cash-In / Top Up
              </h3>
              <p className='text-xs text-zinc-500 uppercase tracking-widest font-mono mb-6'>
                1 CC = ₱70.00 | Add usable credits to your Chosen Wallet
              </p>

              {cashinError && (
                <div className='bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4'>
                  {cashinError}
                </div>
              )}

              {cashinSuccess && (
                <div className='bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs mb-4'>
                  {cashinSuccess}
                </div>
              )}

              <form onSubmit={handleCashinSubmit} className='space-y-4'>
                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Amount in Philippine Pesos (PHP)
                  </label>
                  <div className='relative'>
                    <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono font-bold'>
                      ₱
                    </span>
                    <input
                      type='number'
                      required
                      min='70'
                      step='1'
                      value={cashinAmountPhp}
                      onChange={(e) =>
                        setCashinAmountPhp(Number(e.target.value))
                      }
                      className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono focus:outline-none transition-colors text-white'
                      placeholder='e.g. 3500'
                    />
                  </div>
                </div>

                <div className='bg-zinc-900/60 border border-zinc-800/40 p-4 rounded-2xl text-xs space-y-2'>
                  <span className='block font-bold text-zinc-300 uppercase tracking-widest text-[10px] mb-1'>
                    Auto-Computed Credits
                  </span>
                  <div className='flex justify-between'>
                    <span className='text-zinc-500'>Rate:</span>
                    <span className='text-white font-mono'>1 CC = ₱70.00</span>
                  </div>
                  <div className='flex justify-between border-t border-zinc-800/60 pt-2 mt-1 text-sm font-bold'>
                    <span className='text-gold'>Computed CC:</span>
                    <span className='text-gold font-mono'>
                      {(cashinAmountPhp / 70).toFixed(4)} CC
                    </span>
                  </div>
                </div>

                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Payment Method / Target Account
                  </label>
                  <select
                    value={cashinChannel}
                    onChange={(e: any) => setCashinChannel(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors'
                  >
                    <option value='GCash'>
                      GCash (Company: 0917-111-2222)
                    </option>
                    <option value='Maya'>Maya (Company: 0917-111-2222)</option>
                    <option value='Bank'>
                      Bank Transfer (BDO: 00123-4567-890)
                    </option>
                  </select>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                      Sender Account Name
                    </label>
                    <input
                      type='text'
                      placeholder='e.g. Juan dela Cruz'
                      value={cashinAccountName}
                      onChange={(e) => setCashinAccountName(e.target.value)}
                      className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors text-white'
                    />
                  </div>
                  <div>
                    <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                      Sender Account Number
                    </label>
                    <input
                      type='text'
                      placeholder='e.g. 0917-123-4567'
                      value={cashinAccountNumber}
                      onChange={(e) => setCashinAccountNumber(e.target.value)}
                      className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors text-white'
                    />
                  </div>
                </div>

                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Transaction Reference Number
                  </label>
                  <input
                    type='text'
                    required
                    placeholder='Paste reference / receipt transaction code'
                    value={cashinReference}
                    onChange={(e) => setCashinReference(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors text-white'
                  />
                </div>

                {/* Drag-and-drop & Click to Upload Region */}
                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Upload Proof of Payment Receipt (Required)
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-gold bg-gold/5'
                        : proofOfPaymentUrl
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-zinc-800 hover:border-gold/40'
                    }`}
                    onClick={() =>
                      document
                        .getElementById('affiliate-cashin-file-upload')
                        ?.click()
                    }
                  >
                    <input
                      id='affiliate-cashin-file-upload'
                      type='file'
                      accept='image/*,application/pdf'
                      className='hidden'
                      onChange={handleFileSelect}
                    />

                    {proofOfPaymentUrl ? (
                      <div className='space-y-2'>
                        {proofOfPaymentUrl.startsWith('data:application/pdf') ||
                        receiptFile?.type === 'application/pdf' ||
                        proofOfPaymentUrl.toLowerCase().includes('.pdf') ? (
                          <div className='text-xs font-semibold text-emerald-400'>
                            PDF Document Selected
                          </div>
                        ) : (
                          <img
                            src={proofOfPaymentUrl}
                            alt='Proof of Payment Preview'
                            className='max-h-24 mx-auto rounded object-contain border border-zinc-800'
                          />
                        )}
                        <p className='text-[10px] text-zinc-500'>
                          Click or drag another file to replace receipt
                        </p>
                      </div>
                    ) : (
                      <div className='py-2 space-y-1'>
                        <div className='text-zinc-400 font-bold text-xs'>
                          Drag and Drop receipt image here
                        </div>
                        <div className='text-[10px] text-zinc-500'>
                          or click to browse from device
                        </div>
                        <div className='text-[9px] text-zinc-600 font-mono uppercase'>
                          Supports Images and PDFs
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Notes field */}
                <div>
                  <label className='block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2'>
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    placeholder='e.g. Payment details, branch name, or any additional message...'
                    value={cashinNotes}
                    onChange={(e) => setCashinNotes(e.target.value)}
                    className='w-full bg-zinc-900 border border-zinc-800 focus:border-gold/60 rounded-xl px-4 py-2 text-xs focus:outline-none transition-colors h-16 resize-none text-white'
                  />
                </div>

                <div className='flex gap-3 pt-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowCashinModal(false)
                      setProofOfPaymentUrl('')
                      setCashinNotes('')
                    }}
                    className='flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={loading}
                    className='flex-1 gold-gradient hover:brightness-110 text-black py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1 cursor-pointer'
                  >
                    {loading ? (
                      <div className='w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin' />
                    ) : (
                      'Submit Cash-In'
                    )}
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

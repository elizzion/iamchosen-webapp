import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Crown,
  Infinity as InfinityIcon,
  Megaphone,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react'

import StatusBadge from './StatusBadge'
import EmptyState from './EmptyState'
import { useCCSettings } from '../../context/CCSettingsContext'

type AccountType = 'Customer' | 'Smart Customer' | 'Affiliate'

type ActivityType =
  | 'CASHIN'
  | 'ADMIN_DEPOSIT'
  | 'CASHOUT'
  | 'ORDER'
  | 'PAYOUT'
  | 'P2P_RECEIVE'
  | 'P2P_SEND'

export type ActivityFilter = 'earnings' | 'deposits' | 'withdrawals' | 'orders'

type LayoutVariant = 'compact' | 'wide'

type UnknownRecord = Record<string, unknown>

interface RecentActivityCardProps {
  cashins?: unknown[]
  cashouts?: unknown[]
  orders?: unknown[]
  commissions?: unknown[]
  payouts?: unknown[]
  p2pReceived?: unknown[]
  p2pSent?: unknown[]
  p2pTransfers?: unknown[]
  walletTransactions?: unknown[]
  currentUid?: string

  accountType?: AccountType
  layoutVariant?: LayoutVariant
  /** @deprecated Recent activities are fixed at 8 records per page. */
  pageSize?: number
  className?: string
  visibleTabs?: readonly ActivityFilter[]
}

interface NormalizedActivity {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  referenceNumber: string
  status: string
  amountCC: number
  amountPhp: number
  date: string
  raw: UnknownRecord
}

interface FilterDefinition {
  id: ActivityFilter
  label: string
}

const FILTERS: Record<ActivityFilter, FilterDefinition> = {
  earnings: {
    id: 'earnings',
    label: 'Recent Earnings',
  },
  deposits: {
    id: 'deposits',
    label: 'Deposits',
  },
  withdrawals: {
    id: 'withdrawals',
    label: 'Withdrawals',
  },
  orders: {
    id: 'orders',
    label: 'Orders',
  },
}

const CUSTOMER_ACTIVITY_TABS: readonly ActivityFilter[] = ['deposits', 'orders']

const AFFILIATE_ACTIVITY_TABS: readonly ActivityFilter[] = [
  'earnings',
  'deposits',
  'withdrawals',
  'orders',
]

const ACTIVITIES_PER_PAGE = 8

function toRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : {}
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

function readDate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString()
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }

    if (typeof value === 'object' && value !== null) {
      const timestamp = value as {
        toDate?: () => Date
        seconds?: number
        _seconds?: number
      }

      if (typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate()

        if (!Number.isNaN(date.getTime())) {
          return date.toISOString()
        }
      }

      const seconds = readNumber(timestamp.seconds, timestamp._seconds)

      if (seconds > 0) {
        return new Date(seconds * 1000).toISOString()
      }
    }
  }

  return ''
}

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_')
}

function isCompletedP2PRecord(value: unknown): boolean {
  const transfer = toRecord(value)
  const status = normalizeToken(
    readString(transfer.status, transfer.transferStatus, transfer.ledgerStatus),
  )

  return (
    !status ||
    status === 'COMPLETED' ||
    status === 'SUCCESS' ||
    status === 'SUCCESSFUL' ||
    status === 'SUCCEEDED' ||
    status === 'SETTLED' ||
    status === 'POSTED' ||
    status === 'APPROVED'
  )
}

function getP2PRecordId(value: unknown, index: number): string {
  const transfer = toRecord(value)
  const metadata = toRecord(transfer.metadata)

  const explicitId = readString(
    transfer.transferId,
    transfer.requestId,
    transfer.referenceId,
    transfer.referenceNumber,
    transfer.sourceTransferId,
    transfer.transactionId,
    transfer.idempotencyKey,
    transfer.id,
    metadata.transferId,
    metadata.requestId,
    metadata.referenceId,
    metadata.sourceTransferId,
    metadata.transactionId,
    metadata.idempotencyKey,
  )

  if (explicitId) {
    return explicitId
  }

  const senderUid = readString(
    transfer.senderUid,
    transfer.fromUid,
    metadata.senderUid,
    metadata.fromUid,
  )
  const recipientUid = readString(
    transfer.recipientUid,
    transfer.receiverUid,
    transfer.toUid,
    metadata.recipientUid,
    metadata.receiverUid,
    metadata.toUid,
  )
  const amountCC = readNumber(
    transfer.amountCC,
    transfer.transferAmountCC,
    transfer.amount,
    metadata.amountCC,
  )
  const date = readDate(
    transfer.completedAt,
    transfer.createdAt,
    transfer.timestamp,
    metadata.completedAt,
    metadata.createdAt,
  )

  return [senderUid, recipientUid, amountCC, date].some(Boolean)
    ? `p2p-${senderUid}-${recipientUid}-${amountCC}-${date}`
    : `p2p-transfer-${index}`
}

function dedupeP2PRecords(records: unknown[]): unknown[] {
  const seen = new Set<string>()

  return records.filter((record, index) => {
    const id = getP2PRecordId(record, index)

    if (seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

function formatOrdinalLevel(value: number): string {
  const level = Math.max(1, Math.trunc(value))
  const remainder100 = level % 100

  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${level}th`
  }

  switch (level % 10) {
    case 1:
      return `${level}st`
    case 2:
      return `${level}nd`
    case 3:
      return `${level}rd`
    default:
      return `${level}th`
  }
}

function readCommissionLevel(record: UnknownRecord): number {
  const metadata = toRecord(record.metadata)

  const level = readNumber(
    record.genealogyLevel,
    record.referralLevel,
    record.leadershipLevel,
    record.unilevelLevel,
    record.commissionLevel,
    record.uplineLevel,
    record.requiredDepth,
    record.level,
    record.depth,
    metadata.genealogyLevel,
    metadata.referralLevel,
    metadata.leadershipLevel,
    metadata.unilevelLevel,
    metadata.commissionLevel,
    metadata.uplineLevel,
    metadata.requiredDepth,
    metadata.level,
    metadata.depth,
  )

  return Number.isFinite(level) && level > 0 ? Math.trunc(level) : 0
}

function getCommissionLevelLabel(record: UnknownRecord): string {
  const level = readCommissionLevel(record)

  return level > 0 ? `${formatOrdinalLevel(level)} Level` : ''
}

function readCommissionSourceToken(record: UnknownRecord): string {
  const metadata = toRecord(record.metadata)

  return normalizeToken(
    readString(
      record.leadershipSourceType,
      record.commissionSourceType,
      record.sourceType,
      record.sourceCommissionType,
      record.earningSourceType,
      metadata.leadershipSourceType,
      metadata.commissionSourceType,
      metadata.sourceType,
      metadata.sourceCommissionType,
      metadata.earningSourceType,
    ),
  )
}

function getCommissionSourceLabel(record: UnknownRecord): string {
  const metadata = toRecord(record.metadata)
  const sourceType = readCommissionSourceToken(record)

  if (sourceType === 'MSA_DAILY_ACCRUAL') {
    return 'Daily MSA Accrual'
  }

  if (sourceType === 'MSA_CREDIT') {
    return 'MSA Wallet Release'
  }

  if (sourceType.includes('MSA')) {
    return 'Marketing Support Allocation'
  }

  if (sourceType.includes('UNILEVEL')) {
    return 'Product Unilevel'
  }

  if (
    sourceType.includes('REFERRAL') ||
    sourceType.includes('PACKAGE_ACTIVATION')
  ) {
    return 'Referral Bonus'
  }

  const referralClassification = normalizeToken(
    readString(
      record.referralBonusType,
      record.referralType,
      record.bonusType,
      metadata.referralBonusType,
      metadata.referralType,
      metadata.bonusType,
    ),
  )

  if (referralClassification.includes('DIRECT')) {
    return 'Direct Referral'
  }

  if (referralClassification.includes('INDIRECT')) {
    return 'Indirect Referral'
  }

  return readString(
    record.commissionSourceLabel,
    metadata.commissionSourceLabel,
  )
}

function normalizeCommissionName(
  value: string,
  record: UnknownRecord = {},
): string {
  const metadata = toRecord(record.metadata)

  const normalized = normalizeToken(
    readString(
      record.commissionType,
      record.bonusType,
      record.earningType,
      value,
      metadata.commissionType,
      metadata.bonusType,
      metadata.earningType,
    ),
  )

  const commissionLevel = readCommissionLevel(record)
  const commissionSourceType = readCommissionSourceToken(record)

  // Direct MSA Leadership, MSA Leadership, and related aliases are one
  // Leadership Bonus generated from the same daily MSA accrual. "Direct"
  // is represented by Commission Level: 1st Level.
  const isMsaLeadership =
    normalized.includes('LEADERSHIP') &&
    (normalized.includes('MSA') || commissionSourceType.includes('MSA'))

  if (isMsaLeadership) {
    return 'Leadership Bonus'
  }

  const referralClassification = normalizeToken(
    readString(
      record.referralBonusType,
      record.referralType,
      record.category,
      record.sourceType,
      metadata.referralBonusType,
      metadata.referralType,
      metadata.category,
      metadata.sourceType,
    ),
  )

  switch (normalized) {
    case 'DIRECT_REFERRAL':
    case 'DIRECT_REFERRAL_BONUS':
      return 'Direct Referral Bonus'

    case 'INDIRECT_REFERRAL':
    case 'INDIRECT_REFERRAL_BONUS':
      return 'Indirect Referral Bonus'

    case 'REFERRAL_BONUS':
    case 'REFERRAL_BONUSES':
      if (referralClassification.includes('INDIRECT') || commissionLevel > 1) {
        return 'Indirect Referral Bonus'
      }

      if (referralClassification.includes('DIRECT') || commissionLevel === 1) {
        return 'Direct Referral Bonus'
      }

      return 'Referral Bonus'

    case 'UNILEVEL':
    case 'UNILEVEL_BONUS':
      return 'Unilevel Bonus'

    case 'LEADERSHIP':
    case 'LEADERSHIP_BONUS':
    case 'MSA_LEADERSHIP':
    case 'MSA_DIRECT_LEADERSHIP':
    case 'DIRECT_MSA_LEADERSHIP':
    case 'MSA_INDIRECT_LEADERSHIP':
    case 'INDIRECT_MSA_LEADERSHIP':
      return 'Leadership Bonus'

    case 'LEADERSHIP_REWARD':
    case 'LEADERSHIP_REWARDS':
      return 'Leadership Reward'

    case 'INFINITY':
    case 'INFINITY_BONUS':
    case 'INFINITY_MATCHING':
    case 'INFINITY_UNILEVEL':
      return 'Infinity Bonus'

    case 'MARKETING_SUPPORT':
    case 'MARKETING_SUPPORT_ALLOCATION':
    case 'MSA':
    case 'MSA_DAILY_ACCRUAL':
      return 'Marketing Support Allocation'

    case 'RETAIL':
    case 'RETAIL_PROFIT':
      return 'Retail Profit'

    default:
      return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())
  }
}

function getEarningDedupeKey(record: UnknownRecord, index: number): string {
  const metadata = toRecord(record.metadata)

  const commissionType =
    readString(
      record.commissionType,
      record.bonusType,
      record.earningType,
      record.type,
      metadata.commissionType,
      metadata.bonusType,
      metadata.earningType,
      metadata.type,
    ) || 'Commission'

  const operation = normalizeToken(
    normalizeCommissionName(commissionType, record),
  )

  const msaDailySourceId = readString(
    record.sourceMsaDailyAccrualId,
    metadata.sourceMsaDailyAccrualId,
  )

  const underlyingSourceId = readString(
    msaDailySourceId,
    record.sourceMsaCreditId,
    record.sourceReferralBonusId,
    record.sourceUnilevelCommissionId,
    record.sourceInfinityCommissionId,
    record.sourceRetailProfitId,
    record.sourceRewardId,
    record.sourceRecordId,
    record.sourceEventId,
    record.activationEventId,
    record.packageActivationEventId,
    metadata.sourceMsaCreditId,
    metadata.sourceReferralBonusId,
    metadata.sourceUnilevelCommissionId,
    metadata.sourceInfinityCommissionId,
    metadata.sourceRetailProfitId,
    metadata.sourceRewardId,
    metadata.sourceRecordId,
    metadata.sourceEventId,
    metadata.activationEventId,
    metadata.packageActivationEventId,
  )

  const earnerUid = readString(
    record.earnerUid,
    record.uid,
    record.userUid,
    record.ownerUid,
    metadata.earnerUid,
    metadata.uid,
    metadata.userUid,
    metadata.ownerUid,
  )

  const level = readCommissionLevel(record)
  const sourceToken = readCommissionSourceToken(record)

  const isMsaLeadershipEarning =
    operation === 'LEADERSHIP_BONUS' &&
    (Boolean(msaDailySourceId) ||
      sourceToken.includes('MSA') ||
      normalizeToken(underlyingSourceId).includes('MSA_DAILY'))

  if (underlyingSourceId) {
    if (isMsaLeadershipEarning) {
      return [
        'earning-source',
        'LEADERSHIP_BONUS',
        earnerUid || 'unknown-earner',
        underlyingSourceId,
      ].join(':')
    }

    return [
      'earning-source',
      operation,
      earnerUid || 'unknown-earner',
      underlyingSourceId,
      level || 0,
    ].join(':')
  }

  const commissionId = readString(
    record.commissionId,
    record.sourceCommissionId,
    metadata.commissionId,
    metadata.sourceCommissionId,
  )

  if (commissionId) {
    return `earning-commission:${commissionId}`
  }

  const referenceId = readString(
    record.referenceNumber,
    record.transactionId,
    record.id,
    metadata.referenceNumber,
    metadata.transactionId,
    metadata.id,
  )

  return [
    'earning-fallback',
    operation,
    earnerUid || 'unknown-earner',
    referenceId || index,
    level || 0,
  ].join(':')
}

function formatDateTime(value: string): string {
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

function formatCC(amount: number, type: ActivityType): string {
  const prefix =
    type === 'CASHOUT' || type === 'P2P_SEND' || type === 'ORDER' ? '-' : '+'

  return `${prefix}${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} CC`
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getActivityIcon(activity: NormalizedActivity) {
  if (
    activity.type === 'CASHIN' ||
    activity.type === 'ADMIN_DEPOSIT' ||
    activity.type === 'P2P_RECEIVE'
  ) {
    return <ArrowDownToLine className='h-4 w-4' />
  }

  if (activity.type === 'CASHOUT' || activity.type === 'P2P_SEND') {
    return <ArrowUpFromLine className='h-4 w-4' />
  }

  if (activity.type === 'ORDER') {
    return <ShoppingBag className='h-4 w-4' />
  }

  const title = activity.title.toLowerCase()

  if (title.includes('referral')) {
    return <Users className='h-4 w-4' />
  }

  if (title.includes('leadership')) {
    return <Crown className='h-4 w-4' />
  }

  if (title.includes('infinity')) {
    return <InfinityIcon className='h-4 w-4' />
  }

  if (title.includes('marketing')) {
    return <Megaphone className='h-4 w-4' />
  }

  if (title.includes('retail')) {
    return <BadgeDollarSign className='h-4 w-4' />
  }

  return <Coins className='h-4 w-4' />
}

function getActivityColors(type: ActivityType): {
  dot: string
  icon: string
  amount: string
} {
  switch (type) {
    case 'CASHIN':
    case 'ADMIN_DEPOSIT':
    case 'P2P_RECEIVE':
      return {
        dot: 'bg-emerald-500',
        icon: 'bg-emerald-500/10 text-emerald-400',
        amount: 'text-emerald-400',
      }

    case 'CASHOUT':
    case 'P2P_SEND':
      return {
        dot: 'bg-rose-500',
        icon: 'bg-rose-500/10 text-rose-400',
        amount: 'text-rose-400',
      }

    case 'ORDER':
      return {
        dot: 'bg-cyan-400',
        icon: 'bg-cyan-500/10 text-cyan-400',
        amount: 'text-cyan-400',
      }

    case 'PAYOUT':
      return {
        dot: 'bg-fuchsia-500',
        icon: 'bg-fuchsia-500/10 text-fuchsia-400',
        amount: 'text-fuchsia-400',
      }
  }
}

function isEarnedActivity(activity: NormalizedActivity): boolean {
  if (activity.type !== 'PAYOUT') {
    return false
  }

  const status = normalizeToken(activity.status)

  return status === 'CREDITED' || status === 'COMPLETED'
}

function ActivityStatusBadge({ activity }: { activity: NormalizedActivity }) {
  if (isEarnedActivity(activity)) {
    return (
      <span className='inline-flex min-h-6 items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-400'>
        Earned
      </span>
    )
  }

  return <StatusBadge status={activity.status} />
}

function getModalTitle(type: ActivityType): string {
  switch (type) {
    case 'CASHIN':
      return 'Cash-In Ledger'

    case 'ADMIN_DEPOSIT':
      return 'Direct CC Deposit Ledger'

    case 'P2P_RECEIVE':
      return 'Received P2P Transfer'

    case 'CASHOUT':
      return 'Cash-Out Ledger'

    case 'P2P_SEND':
      return 'Sent P2P Transfer'

    case 'ORDER':
      return 'E-Commerce Order Ledger'

    case 'PAYOUT':
      return 'Commission Earnings Ledger'
  }
}

function getEmptyDescription(filter: ActivityFilter): string {
  switch (filter) {
    case 'earnings':
      return 'No commission earnings have been recorded yet.'

    case 'deposits':
      return 'No Cash-In, Direct CC Deposit, or received P2P deposits have been recorded yet.'

    case 'withdrawals':
      return 'No Cash-Out or sent P2P withdrawals have been recorded yet.'

    case 'orders':
      return 'No product orders have been recorded yet.'
  }
}

export default function RecentActivityCard({
  cashins = [],
  cashouts = [],
  orders = [],
  commissions = [],
  payouts = [],
  p2pReceived = [],
  p2pSent = [],
  p2pTransfers = [],
  walletTransactions = [],
  currentUid = '',
  accountType = 'Customer',
  layoutVariant = 'compact',
  className = '',
  visibleTabs,
}: RecentActivityCardProps) {
  const { ccSettings } = useCCSettings()

  const settings = ccSettings as unknown as Partial<{
    displayReferenceRatePHP: number
    purchaseRatePHP: number

    // Temporary compatibility with the
    // existing context field.
    cashInRatePHP: number
  }>

  const displayReferenceRatePHP = readNumber(
    settings.displayReferenceRatePHP,
    settings.purchaseRatePHP,
    settings.cashInRatePHP,
  )

  const resolvedVisibleFilters = useMemo<ActivityFilter[]>(() => {
    if (visibleTabs && visibleTabs.length > 0) {
      return [...new Set(visibleTabs)]
    }

    return accountType === 'Affiliate'
      ? [...AFFILIATE_ACTIVITY_TABS]
      : [...CUSTOMER_ACTIVITY_TABS]
  }, [accountType, visibleTabs])

  const [filter, setFilter] = useState<ActivityFilter>(
    () => resolvedVisibleFilters[0] ?? 'deposits',
  )

  const [selectedActivity, setSelectedActivity] =
    useState<NormalizedActivity | null>(null)

  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!resolvedVisibleFilters.includes(filter)) {
      setFilter(resolvedVisibleFilters[0] ?? 'deposits')
    }
  }, [filter, resolvedVisibleFilters])

  useEffect(() => {
    setPage(1)
  }, [filter])

  const normalizedCashins = useMemo<NormalizedActivity[]>(
    () =>
      cashins.map((item, index) => {
        const cashin = toRecord(item)

        return {
          id: readString(cashin.requestId, cashin.id) || `cashin-${index}`,
          type: 'CASHIN',
          title: 'Cash-In Wallet Top Up',
          subtitle: `Via ${
            readString(cashin.paymentMethod, cashin.paymentChannel) ||
            'Approved payment channel'
          }`,
          referenceNumber:
            readString(cashin.requestId, cashin.id) || 'Unavailable',
          status: readString(cashin.status) || 'Pending',
          amountCC: readNumber(cashin.amountCC, cashin.computedCC),
          amountPhp: readNumber(cashin.amountPHP, cashin.amountPhp),
          date: readString(
            cashin.requestedAt,
            cashin.requestDate,
            cashin.updatedAt,
          ),
          raw: cashin,
        }
      }),
    [cashins],
  )

  const normalizedAdminDeposits = useMemo<NormalizedActivity[]>(
    () =>
      walletTransactions
        .map((item) => toRecord(item))
        .filter((transaction) => {
          const transactionType = normalizeToken(
            readString(
              transaction.transactionType,
              transaction.type,
              transaction.sourceType,
              transaction.depositType,
            ),
          )
          const direction = normalizeToken(
            readString(transaction.direction, transaction.entryType),
          )
          const walletType = normalizeToken(readString(transaction.walletType))

          const isAdminDeposit =
            transactionType === 'ADMIN_DIRECT_CC_DEPOSIT' ||
            transactionType === 'DIRECT_CC_DEPOSIT' ||
            transactionType === 'DIRECT_ADMIN_DEPOSIT' ||
            transactionType === 'ADMIN_WALLET_CREDIT' ||
            transactionType === 'MANUAL_CC_DEPOSIT'

          const isChosenWallet =
            !walletType ||
            walletType === 'CHOSEN_WALLET' ||
            walletType === 'CHOSEN' ||
            walletType === 'CHOSEN_CREDITS_CC'

          return (
            isAdminDeposit &&
            isChosenWallet &&
            (!direction || direction === 'CREDIT')
          )
        })
        .map((transaction, index) => {
          const amountCC = readNumber(
            transaction.amountCC,
            transaction.amount,
            transaction.creditAmountCC,
          )
          const adminName = readString(
            transaction.adminName,
            transaction.creditedByName,
            transaction.approvedBy,
          )
          const referenceNumber =
            readString(
              transaction.referenceNumber,
              transaction.depositId,
              transaction.transactionId,
              transaction.id,
            ) || `admin-deposit-${index}`

          return {
            id: referenceNumber,
            type: 'ADMIN_DEPOSIT',
            title: 'Direct CC Deposit',
            subtitle: adminName
              ? `Credited by ${adminName}`
              : 'Credited by I AM CHOSEN Administration',
            referenceNumber,
            status: readString(transaction.status) || 'Completed',
            amountCC,
            amountPhp:
              readNumber(
                transaction.phpEquivalent,
                transaction.amountPhp,
                transaction.amountPHP,
              ) || amountCC * displayReferenceRatePHP,
            date: readDate(
              transaction.completedAt,
              transaction.createdAt,
              transaction.timestamp,
              transaction.updatedAt,
            ),
            raw: transaction,
          }
        }),
    [displayReferenceRatePHP, walletTransactions],
  )

  const normalizedCashouts = useMemo<NormalizedActivity[]>(
    () =>
      cashouts.map((item, index) => {
        const cashout = toRecord(item)

        return {
          id: readString(cashout.requestId, cashout.id) || `cashout-${index}`,
          type: 'CASHOUT',
          title: 'Cash-Out Request',
          subtitle: `Via ${
            readString(cashout.payoutChannel) || 'Approved payout channel'
          }`,
          referenceNumber:
            readString(cashout.requestId, cashout.id) || 'Unavailable',
          status: readString(cashout.status) || 'Pending',
          amountCC: readNumber(cashout.amountCC),
          amountPhp: readNumber(cashout.netPhp, cashout.grossPhp),
          date: readString(cashout.requestDate, cashout.approvedAt),
          raw: cashout,
        }
      }),
    [cashouts],
  )

  const normalizedOrders = useMemo<NormalizedActivity[]>(
    () =>
      orders.map((item, index) => {
        const order = toRecord(item)

        const quantity = Math.max(1, readNumber(order.quantity) || 1)

        const unitPriceCC = readNumber(order.priceCC, order.unitPriceCC)

        const amountCC =
          readNumber(order.totalAmountCC, order.totalCC) ||
          unitPriceCC * quantity

        const productName =
          readString(order.productName, order.name, order.productTitle) ||
          'Product'

        return {
          id: readString(order.orderId, order.id) || `order-${index}`,
          type: 'ORDER',
          title: `Purchased ${productName}`,
          subtitle: 'Secured Digital Order',
          referenceNumber: readString(order.orderId, order.id) || 'Unavailable',
          status: readString(order.status) || 'Completed',
          amountCC,
          amountPhp:
            readNumber(order.totalPHP, order.totalPhp, order.phpPrice) ||
            amountCC * displayReferenceRatePHP,
          date: readString(order.createdAt, order.orderDate, order.updatedAt),
          raw: order,
        }
      }),
    [displayReferenceRatePHP, orders],
  )

  // Canonical member earnings are readable from both the commissions ledger
  // and immutable wallet_transactions. The wallet ledger also exposes daily
  // MSA accruals, which are not commission documents.
  const walletEarningRecords = useMemo(
    () =>
      walletTransactions
        .map((item) => toRecord(item))
        .filter((transaction) => {
          const transactionType = normalizeToken(
            readString(transaction.transactionType, transaction.type),
          )
          const walletType = normalizeToken(readString(transaction.walletType))
          const direction = normalizeToken(readString(transaction.direction))

          const isCommissionCredit =
            transactionType === 'COMMISSION_CREDIT' &&
            walletType === 'COMMISSION_WALLET'

          const isDailyMsa =
            transactionType === 'MSA_DAILY_ACCRUAL' &&
            walletType === 'MARKETING_SUPPORT_WALLET'

          return (
            (isCommissionCredit || isDailyMsa) &&
            (!direction || direction === 'CREDIT')
          )
        })
        .map((transaction) => {
          const transactionType = normalizeToken(
            readString(transaction.transactionType, transaction.type),
          )
          const isDailyMsa = transactionType === 'MSA_DAILY_ACCRUAL'

          const earningId =
            readString(
              transaction.sourceCommissionId,
              transaction.sourceMsaDailyAccrualId,
              transaction.referenceNumber,
              transaction.id,
            ) || undefined

          return {
            ...transaction,
            id: earningId,
            commissionId: earningId,
            commissionType: isDailyMsa
              ? 'Marketing Support Allocation'
              : readString(transaction.commissionType) || 'Commission',
            amountCC: readNumber(transaction.amountCC, transaction.amount),
            description:
              readString(transaction.description) ||
              (isDailyMsa
                ? 'Daily Marketing Support Wallet accrual'
                : 'Commission Wallet credit'),
            status: readString(transaction.status) || 'Credited',
            createdAt: readDate(
              transaction.completedAt,
              transaction.createdAt,
              transaction.timestamp,
            ),
          }
        }),
    [walletTransactions],
  )

  const commissionRecords = useMemo(() => {
    // Prefer authoritative commission documents. Wallet ledger entries remain
    // a fallback for older or delayed commission records.
    const records = [...commissions, ...payouts, ...walletEarningRecords]
    const seen = new Set<string>()

    return records.filter((item, index) => {
      const record = toRecord(item)
      const dedupeKey = getEarningDedupeKey(record, index)

      if (seen.has(dedupeKey)) {
        return false
      }

      seen.add(dedupeKey)
      return true
    })
  }, [commissions, payouts, walletEarningRecords])

  const normalizedPayouts = useMemo<NormalizedActivity[]>(
    () =>
      commissionRecords.map((item, index) => {
        const payout = toRecord(item)

        const commissionType =
          readString(payout.commissionType, payout.type) || 'Commission'

        const title = normalizeCommissionName(commissionType, payout)
        const amountCC = readNumber(payout.amountCC, payout.amount)

        return {
          id: readString(payout.id, payout.commissionId) || `payout-${index}`,
          type: 'PAYOUT',
          title,
          subtitle:
            getCommissionSourceLabel(payout) ||
            readString(payout.description) ||
            'Commission income',
          referenceNumber:
            readString(payout.id, payout.commissionId) || 'Unavailable',
          status: readString(payout.status) || 'Completed',
          amountCC,
          amountPhp:
            readNumber(payout.phpEquivalent) ||
            amountCC * displayReferenceRatePHP,
          date: readString(
            payout.createdAt,
            payout.completedAt,
            payout.updatedAt,
          ),
          raw: payout,
        }
      }),
    [commissionRecords, displayReferenceRatePHP],
  )

  const classifiedP2PTransfers = useMemo(() => {
    const received: unknown[] = []
    const sent: unknown[] = []
    const sharedRecords = [...p2pTransfers, ...walletTransactions]

    sharedRecords.forEach((item) => {
      if (!isCompletedP2PRecord(item)) {
        return
      }

      const transfer = toRecord(item)
      const metadata = toRecord(transfer.metadata)
      const recipientUid = readString(
        transfer.recipientUid,
        transfer.receiverUid,
        transfer.toUid,
        transfer.creditUid,
        metadata.recipientUid,
        metadata.receiverUid,
        metadata.toUid,
      )
      const senderUid = readString(
        transfer.senderUid,
        transfer.fromUid,
        transfer.debitUid,
        metadata.senderUid,
        metadata.fromUid,
      )
      const ownerUid = readString(
        transfer.userUid,
        transfer.ownerUid,
        transfer.accountUid,
        transfer.uid,
        metadata.userUid,
        metadata.ownerUid,
      )
      const recordType = normalizeToken(
        readString(
          transfer.activityType,
          transfer.transactionType,
          transfer.ledgerType,
          transfer.category,
          transfer.type,
          metadata.activityType,
          metadata.transactionType,
          metadata.category,
          metadata.type,
        ),
      )
      const sourceType = normalizeToken(
        readString(
          transfer.sourceTransferType,
          transfer.sourceType,
          transfer.transferType,
          metadata.sourceTransferType,
          metadata.sourceType,
          metadata.transferType,
        ),
      )
      const direction = normalizeToken(
        readString(
          transfer.direction,
          transfer.entryType,
          transfer.flow,
          metadata.direction,
          metadata.entryType,
          metadata.flow,
        ),
      )
      // The transfer fee is included in totalDebitCC on the canonical send.
      // Do not render the separate fee ledger as another withdrawal.
      const isFeeRecord =
        recordType.includes('FEE') || sourceType.includes('FEE')

      if (isFeeRecord) {
        return
      }

      const isP2PType =
        recordType.includes('P2P') ||
        recordType.includes('PEER_TO_PEER') ||
        recordType.includes('MEMBER_TRANSFER') ||
        sourceType.includes('P2P') ||
        sourceType.includes('PEER_TO_PEER') ||
        sourceType.includes('MEMBER_TRANSFER')

      const isReceivedType =
        (isP2PType &&
          (recordType.includes('RECEIV') || recordType.includes('CREDIT'))) ||
        (isP2PType &&
          (direction === 'CREDIT' ||
            direction === 'IN' ||
            direction === 'INCOMING' ||
            direction === 'RECEIVE' ||
            direction === 'RECEIVED'))

      const isSentType =
        (isP2PType &&
          (recordType.includes('SEND') ||
            recordType.includes('SENT') ||
            recordType.includes('DEBIT'))) ||
        (isP2PType &&
          (direction === 'DEBIT' ||
            direction === 'OUT' ||
            direction === 'OUTGOING' ||
            direction === 'SEND' ||
            direction === 'SENT'))

      if (
        currentUid &&
        (recipientUid === currentUid ||
          (ownerUid === currentUid && isReceivedType))
      ) {
        received.push(item)
      }

      if (
        currentUid &&
        (senderUid === currentUid || (ownerUid === currentUid && isSentType))
      ) {
        sent.push(item)
      }
    })

    return { received, sent }
  }, [currentUid, p2pTransfers, walletTransactions])

  const allP2PReceived = useMemo(
    () =>
      dedupeP2PRecords([
        ...p2pReceived.filter(isCompletedP2PRecord),
        ...classifiedP2PTransfers.received,
      ]),
    [classifiedP2PTransfers.received, p2pReceived],
  )

  const allP2PSent = useMemo(
    () =>
      dedupeP2PRecords([
        ...p2pSent.filter(isCompletedP2PRecord),
        ...classifiedP2PTransfers.sent,
      ]),
    [classifiedP2PTransfers.sent, p2pSent],
  )

  const normalizedP2PReceived = useMemo<NormalizedActivity[]>(
    () =>
      allP2PReceived.map((item, index) => {
        const transfer = toRecord(item)
        const metadata = toRecord(transfer.metadata)
        const amountCC = readNumber(
          transfer.amountCC,
          transfer.transferAmountCC,
          transfer.creditAmountCC,
          transfer.netAmountCC,
          transfer.amount,
          metadata.amountCC,
          metadata.transferAmountCC,
        )
        const senderLabel = readString(
          transfer.senderMemberId,
          transfer.senderName,
          transfer.fromMemberId,
          metadata.senderMemberId,
          metadata.senderName,
          metadata.fromMemberId,
        )
        const transferId = getP2PRecordId(item, index)

        return {
          id: transferId,
          type: 'P2P_RECEIVE',
          title: 'P2P Transfer Received',
          subtitle: senderLabel
            ? `From ${senderLabel}`
            : 'Received from member',
          referenceNumber: transferId,
          status:
            readString(
              transfer.status,
              transfer.transferStatus,
              transfer.ledgerStatus,
            ) || 'Completed',
          amountCC,
          amountPhp:
            readNumber(
              transfer.phpEquivalent,
              transfer.amountPhp,
              transfer.amountPHP,
              metadata.phpEquivalent,
            ) || amountCC * displayReferenceRatePHP,
          date: readDate(
            transfer.completedAt,
            transfer.createdAt,
            transfer.timestamp,
            transfer.updatedAt,
            metadata.completedAt,
            metadata.createdAt,
          ),
          raw: transfer,
        }
      }),
    [allP2PReceived, displayReferenceRatePHP],
  )

  const normalizedP2PSent = useMemo<NormalizedActivity[]>(
    () =>
      allP2PSent.map((item, index) => {
        const transfer = toRecord(item)
        const metadata = toRecord(transfer.metadata)
        const transferAmountCC = readNumber(
          transfer.amountCC,
          transfer.transferAmountCC,
          transfer.debitAmountCC,
          transfer.amount,
          metadata.amountCC,
          metadata.transferAmountCC,
        )
        const feeCC = readNumber(
          transfer.platformTransferFeeCC,
          transfer.transferFeeCC,
          transfer.feeCC,
          transfer.fee,
          metadata.platformTransferFeeCC,
          metadata.transferFeeCC,
          metadata.feeCC,
        )
        const totalDebitCC =
          readNumber(
            transfer.totalDebitCC,
            transfer.totalAmountCC,
            transfer.grossDebitCC,
            metadata.totalDebitCC,
          ) || transferAmountCC + feeCC
        const recipientLabel = readString(
          transfer.recipientMemberId,
          transfer.recipientName,
          transfer.toMemberId,
          metadata.recipientMemberId,
          metadata.recipientName,
          metadata.toMemberId,
        )
        const transferId = getP2PRecordId(item, index)

        return {
          id: transferId,
          type: 'P2P_SEND',
          title: 'P2P Transfer Sent',
          subtitle: recipientLabel
            ? `To ${recipientLabel}${feeCC > 0 ? ` • Platform Transfer Fee: ${feeCC.toFixed(2)} CC` : ''}`
            : `Sent to member${feeCC > 0 ? ` • Platform Transfer Fee: ${feeCC.toFixed(2)} CC` : ''}`,
          referenceNumber: transferId,
          status:
            readString(
              transfer.status,
              transfer.transferStatus,
              transfer.ledgerStatus,
            ) || 'Completed',
          amountCC: totalDebitCC,
          amountPhp:
            readNumber(
              transfer.totalDebitPhp,
              transfer.totalDebitPHP,
              transfer.phpEquivalent,
              metadata.totalDebitPhp,
              metadata.phpEquivalent,
            ) || totalDebitCC * displayReferenceRatePHP,
          date: readDate(
            transfer.completedAt,
            transfer.createdAt,
            transfer.timestamp,
            transfer.updatedAt,
            metadata.completedAt,
            metadata.createdAt,
          ),
          raw: transfer,
        }
      }),
    [allP2PSent, displayReferenceRatePHP],
  )

  const filteredActivities = useMemo(() => {
    const sortNewestFirst = (
      first: NormalizedActivity,
      second: NormalizedActivity,
    ) => {
      const firstDate = new Date(first.date).getTime()
      const secondDate = new Date(second.date).getTime()
      return (
        (Number.isFinite(secondDate) ? secondDate : 0) -
        (Number.isFinite(firstDate) ? firstDate : 0)
      )
    }

    switch (filter) {
      case 'earnings':
        return [...normalizedPayouts].sort(sortNewestFirst)

      case 'deposits':
        return [
          ...normalizedCashins,
          ...normalizedAdminDeposits,
          ...normalizedP2PReceived,
        ].sort(sortNewestFirst)

      case 'withdrawals':
        return [...normalizedCashouts, ...normalizedP2PSent].sort(
          sortNewestFirst,
        )

      case 'orders':
        return [...normalizedOrders].sort(sortNewestFirst)
    }
  }, [
    filter,
    normalizedAdminDeposits,
    normalizedCashins,
    normalizedCashouts,
    normalizedOrders,
    normalizedP2PReceived,
    normalizedP2PSent,
    normalizedPayouts,
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / ACTIVITIES_PER_PAGE),
  )

  // Clamp during render so async Firestore updates, deduplication, and tab
  // changes never render an out-of-range or partially corrupted page.
  const currentPage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage)
    }
  }, [currentPage, page])

  const pageStartIndex = (currentPage - 1) * ACTIVITIES_PER_PAGE
  const pageEndIndex = pageStartIndex + ACTIVITIES_PER_PAGE

  const visibleActivities = useMemo(
    () =>
      filteredActivities
        .slice(pageStartIndex, pageEndIndex)
        .slice(0, ACTIVITIES_PER_PAGE),
    [filteredActivities, pageEndIndex, pageStartIndex],
  )

  // A unique page render key forces React to discard the previous page rows
  // instead of reconciling them with new records that may reuse ledger IDs.
  const pageRenderKey = `${filter}:${currentPage}:${filteredActivities.length}`

  const firstVisibleItem =
    filteredActivities.length === 0 ? 0 : pageStartIndex + 1

  const lastVisibleItem = Math.min(pageEndIndex, filteredActivities.length)

  const notes = selectedActivity ? readString(selectedActivity.raw.notes) : ''

  const rejectionReason = selectedActivity
    ? readString(selectedActivity.raw.rejectedReason)
    : ''

  const selectedActivityMetadata = selectedActivity
    ? toRecord(selectedActivity.raw.metadata)
    : {}

  const relatedMemberId = selectedActivity
    ? selectedActivity.type === 'P2P_SEND'
      ? readString(
          selectedActivity.raw.recipientMemberId,
          selectedActivity.raw.toMemberId,
          selectedActivityMetadata.recipientMemberId,
          selectedActivityMetadata.toMemberId,
        )
      : selectedActivity.type === 'P2P_RECEIVE'
        ? readString(
            selectedActivity.raw.senderMemberId,
            selectedActivity.raw.fromMemberId,
            selectedActivityMetadata.senderMemberId,
            selectedActivityMetadata.fromMemberId,
          )
        : ''
    : ''

  return (
    <section
      aria-labelledby='recent-activities-title'
      className={[
        'rounded-3xl border border-cyan-800 bg-[#0c0b0c] p-5 sm:p-6',
        layoutVariant === 'wide' ? 'space-y-6' : 'space-y-5',
        className,
      ].join(' ')}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex items-center gap-2'>
          <ClipboardList className='h-5 w-5 shrink-0 text-cyan-400' />

          <h3
            id='recent-activities-title'
            className='text-xs font-extrabold uppercase tracking-tight text-white sm:text-sm'
          >
            Recent Account Activities
          </h3>
        </div>

        <div
          role='tablist'
          aria-label='Account activity filters'
          className='flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950 p-1'
        >
          {resolvedVisibleFilters.map((filterId) => {
            const definition = FILTERS[filterId]

            const selected = filter === filterId

            return (
              <button
                key={filterId}
                type='button'
                role='tab'
                aria-selected={selected}
                onClick={() => setFilter(filterId)}
                className={[
                  'min-h-10 shrink-0 rounded-lg px-3 py-1 !text-[12px] leading-none !font-black uppercase transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                  selected
                    ? 'bg-cyan-500 text-black'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200',
                ].join(' ')}
              >
                {definition.label}
              </button>
            )
          })}
        </div>
      </div>

      <div role='tabpanel'>
        {visibleActivities.length === 0 ? (
          <EmptyState
            title='No Activities Found'
            description={getEmptyDescription(filter)}
          />
        ) : (
          <div
            key={pageRenderKey}
            data-activity-page={currentPage}
            data-activity-page-size={ACTIVITIES_PER_PAGE}
            className={[
              'relative ml-3 space-y-5 border-l border-zinc-800/80 py-1 pl-5 pr-2',
              layoutVariant === 'wide'
                ? 'min-h-[500px]'
                : 'max-h-[350px] overflow-y-auto scrollbar-thin',
            ].join(' ')}
          >
            {visibleActivities.map((activity, visibleIndex) => {
              const colors = getActivityColors(activity.type)
              const rowKey = [
                pageRenderKey,
                activity.type,
                activity.id,
                visibleIndex,
              ].join(':')

              return (
                <button
                  key={rowKey}
                  type='button'
                  onClick={() => setSelectedActivity(activity)}
                  className='group relative block w-full text-left'
                >
                  <span
                    className={[
                      'absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#1D1F26]',
                      colors.dot,
                    ].join(' ')}
                    aria-hidden='true'
                  />

                  <span className='flex items-center justify-between gap-3 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 transition-all duration-300 group-hover:bg-zinc-900/40 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400'>
                    <span className='flex min-w-0 items-start gap-3'>
                      <span
                        className={[
                          'mt-0.5 shrink-0 rounded-xl p-2',
                          colors.icon,
                        ].join(' ')}
                        aria-hidden='true'
                      >
                        {getActivityIcon(activity)}
                      </span>

                      <span className='min-w-0'>
                        <span className='block truncate text-xs font-bold tracking-wide text-white'>
                          {activity.title}
                        </span>

                        <span className='mt-0.5 block truncate text-[10px] tracking-wide text-zinc-500'>
                          {activity.subtitle}
                          {' • Ref: '}
                          {activity.referenceNumber}
                        </span>

                        <span className='mt-1 block text-[9px] font-semibold uppercase text-zinc-600'>
                          {formatDateTime(activity.date)}
                        </span>
                      </span>
                    </span>

                    <span className='flex shrink-0 flex-col items-end gap-1.5'>
                      <span
                        className={[
                          'text-xs font-black leading-none tabular-nums',
                          colors.amount,
                        ].join(' ')}
                      >
                        {formatCC(activity.amountCC, activity.type)}
                      </span>

                      <span className='text-[10px] text-zinc-500 tabular-nums'>
                        {formatPHP(activity.amountPhp)}
                      </span>

                      <ActivityStatusBadge activity={activity} />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {filteredActivities.length > ACTIVITIES_PER_PAGE && (
        <footer className='flex items-center justify-between border-t border-zinc-800 pt-4'>
          <span className='text-xs text-zinc-500 tabular-nums'>
            {firstVisibleItem}–{lastVisibleItem} of {filteredActivities.length}
          </span>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              aria-label='Previous activity page'
              disabled={currentPage <= 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              className='flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>

            <span className='text-xs text-zinc-400 tabular-nums'>
              {currentPage} / {totalPages}
            </span>

            <button
              type='button'
              aria-label='Next activity page'
              disabled={currentPage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              className='flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        </footer>
      )}

      <AnimatePresence>
        {selectedActivity && (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
            onClick={() => setSelectedActivity(null)}
          >
            <motion.div
              role='dialog'
              aria-modal='true'
              aria-labelledby='activity-detail-title'
              initial={{
                scale: 0.95,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.95,
                opacity: 0,
              }}
              onClick={(event) => event.stopPropagation()}
              className='relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-[#1D1F26] p-6 shadow-2xl'
            >
              <div className='mb-5 flex items-start justify-between border-b border-zinc-800 pb-3'>
                <div>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                    Activity Detail
                  </span>

                  <h3
                    id='activity-detail-title'
                    className='mt-0.5 text-sm font-black uppercase tracking-wider text-white'
                  >
                    {getModalTitle(selectedActivity.type)}
                  </h3>
                </div>

                <button
                  type='button'
                  aria-label='Close activity details'
                  onClick={() => setSelectedActivity(null)}
                  className='flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-white'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>

              <div className='space-y-3.5 text-xs'>
                <DetailRow label='Operation' value={selectedActivity.title} />

                {selectedActivity.type === 'PAYOUT' && (
                  <>
                    {getCommissionSourceLabel(selectedActivity.raw) && (
                      <DetailRow
                        label='Commission Source'
                        value={getCommissionSourceLabel(selectedActivity.raw)}
                      />
                    )}

                    {getCommissionLevelLabel(selectedActivity.raw) && (
                      <DetailRow
                        label='Commission Level'
                        value={getCommissionLevelLabel(selectedActivity.raw)}
                      />
                    )}
                  </>
                )}

                <DetailRow
                  label={
                    selectedActivity.type === 'CASHIN'
                      ? 'Request ID'
                      : 'Reference / ID'
                  }
                  value={selectedActivity.referenceNumber}
                />

                {relatedMemberId && (
                  <DetailRow
                    label={
                      selectedActivity.type === 'P2P_SEND'
                        ? 'Recipient Member ID'
                        : 'Sender Member ID'
                    }
                    value={relatedMemberId.toUpperCase()}
                  />
                )}

                <DetailRow
                  label='Amount'
                  value={`${selectedActivity.amountCC.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} CC`}
                />

                <DetailRow
                  label='PHP Reference'
                  value={formatPHP(selectedActivity.amountPhp)}
                />

                <DetailRow
                  label='Date / Time'
                  value={formatDateTime(selectedActivity.date)}
                />

                <div className='flex items-center justify-between gap-5 py-1'>
                  <span className='text-zinc-500'>
                    {selectedActivity.type === 'PAYOUT'
                      ? 'Earning Status:'
                      : 'Ledger Status:'}
                  </span>

                  <ActivityStatusBadge activity={selectedActivity} />
                </div>
              </div>

              {selectedActivity.type === 'CASHIN' && notes && (
                <div className='mt-4 rounded-xl border border-zinc-900 bg-zinc-950/50 p-3 text-[11px] text-zinc-400'>
                  <span className='mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-500'>
                    Sender Note
                  </span>

                  <p className='italic leading-normal'>{notes}</p>
                </div>
              )}

              {selectedActivity.type === 'CASHIN' && rejectionReason && (
                <div className='mt-4 rounded-xl border border-red-500/10 bg-red-500/5 p-3 text-[11px] text-red-400'>
                  <span className='mb-1 block text-[9px] font-bold uppercase tracking-widest'>
                    Rejection Reason
                  </span>

                  <p className='leading-normal'>{rejectionReason}</p>
                </div>
              )}

              <button
                type='button'
                onClick={() => setSelectedActivity(null)}
                className='mt-6 w-full rounded-xl bg-zinc-900 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-800'
              >
                Close Ledger
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className='flex justify-between gap-5 border-b border-zinc-900 py-1'>
      <span className='text-zinc-500'>{label}:</span>

      <span className='text-right font-semibold text-zinc-300 tabular-nums'>
        {value}
      </span>
    </div>
  )
}

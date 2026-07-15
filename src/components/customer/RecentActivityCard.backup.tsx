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

type ActivityType = 'CASHIN' | 'CASHOUT' | 'ORDER' | 'PAYOUT'

export type ActivityFilter =
  | 'all'
  | 'payouts'
  | 'cashins'
  | 'cashouts'
  | 'orders'

type LayoutVariant = 'compact' | 'wide'

type UnknownRecord = Record<string, unknown>

interface RecentActivityCardProps {
  cashins?: unknown[]
  cashouts?: unknown[]
  orders?: unknown[]
  payouts?: unknown[]

  accountType?: AccountType
  layoutVariant?: LayoutVariant
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
  all: {
    id: 'all',
    label: 'All',
  },
  payouts: {
    id: 'payouts',
    label: 'Recent Payouts',
  },
  cashins: {
    id: 'cashins',
    label: 'Cash-Ins',
  },
  cashouts: {
    id: 'cashouts',
    label: 'Cash-Outs',
  },
  orders: {
    id: 'orders',
    label: 'Orders',
  },
}

const CUSTOMER_ACTIVITY_TABS: readonly ActivityFilter[] = ['cashins', 'orders']

const AFFILIATE_ACTIVITY_TABS: readonly ActivityFilter[] = [
  'all',
  'payouts',
  'cashins',
  'cashouts',
  'orders',
]

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
  }

  return 0
}

function normalizeCommissionName(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')

  switch (normalized) {
    case 'DIRECT_REFERRAL':
    case 'DIRECT_REFERRAL_BONUS':
    case 'INDIRECT_REFERRAL':
    case 'INDIRECT_REFERRAL_BONUS':
    case 'REFERRAL_BONUS':
    case 'REFERRAL_BONUSES':
    case 'UNILEVEL':
      return 'Referral Bonus'

    case 'LEADERSHIP':
    case 'LEADERSHIP_BONUS':
      return 'Leadership Bonus'

    case 'INFINITY':
    case 'INFINITY_BONUS':
    case 'INFINITY_MATCHING':
    case 'INFINITY_UNILEVEL':
      return 'Infinity Bonus'

    case 'MARKETING_SUPPORT':
    case 'MARKETING_SUPPORT_ALLOCATION':
    case 'MSA':
      return 'Marketing Support Allocation'

    case 'RETAIL_PROFIT':
      return 'Retail Profit'

    default:
      return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())
  }
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
  const prefix = type === 'CASHOUT' || type === 'ORDER' ? '-' : '+'

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
  if (activity.type === 'CASHIN') {
    return <ArrowDownToLine className='h-4 w-4' />
  }

  if (activity.type === 'CASHOUT') {
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
      return {
        dot: 'bg-emerald-500',
        icon: 'bg-emerald-500/10 text-emerald-400',
        amount: 'text-emerald-400',
      }

    case 'CASHOUT':
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

function getModalTitle(type: ActivityType): string {
  switch (type) {
    case 'CASHIN':
      return 'Cash-In Ledger'

    case 'CASHOUT':
      return 'Cash-Out Ledger'

    case 'ORDER':
      return 'E-Commerce Order Ledger'

    case 'PAYOUT':
      return 'Commission Payout Ledger'
  }
}

function getEmptyDescription(filter: ActivityFilter): string {
  switch (filter) {
    case 'payouts':
      return 'No commission payouts have been recorded yet.'

    case 'cashins':
      return 'No Cash-In requests have been recorded yet.'

    case 'cashouts':
      return 'No Cash-Out requests have been recorded yet.'

    case 'orders':
      return 'No product orders have been recorded yet.'

    case 'all':
      return 'No recent account activities have been recorded yet.'
  }
}

export default function RecentActivityCard({
  cashins = [],
  cashouts = [],
  orders = [],
  payouts = [],
  accountType = 'Customer',
  layoutVariant = 'compact',
  pageSize,
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

  const resolvedPageSize = pageSize ?? (layoutVariant === 'wide' ? 6 : 3)

  const resolvedVisibleFilters = useMemo<ActivityFilter[]>(() => {
    if (visibleTabs && visibleTabs.length > 0) {
      return [...new Set(visibleTabs)]
    }

    return accountType === 'Affiliate'
      ? [...AFFILIATE_ACTIVITY_TABS]
      : [...CUSTOMER_ACTIVITY_TABS]
  }, [accountType, visibleTabs])

  const [filter, setFilter] = useState<ActivityFilter>(
    () => resolvedVisibleFilters[0] ?? 'cashins',
  )

  const [selectedActivity, setSelectedActivity] =
    useState<NormalizedActivity | null>(null)

  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!resolvedVisibleFilters.includes(filter)) {
      setFilter(resolvedVisibleFilters[0] ?? 'cashins')
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
            readString(cashin.referenceNumber, cashin.requestId, cashin.id) ||
            'Unavailable',
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

  const normalizedPayouts = useMemo<NormalizedActivity[]>(
    () =>
      payouts.map((item, index) => {
        const payout = toRecord(item)

        const commissionType = readString(payout.commissionType) || 'Commission'

        const title = normalizeCommissionName(commissionType)

        const amountCC = readNumber(payout.amountCC)

        return {
          id: readString(payout.id, payout.commissionId) || `payout-${index}`,
          type: 'PAYOUT',
          title,
          subtitle: readString(payout.description) || 'Commission income',
          referenceNumber:
            readString(payout.id, payout.commissionId) || 'Unavailable',
          status: readString(payout.status) || 'Completed',
          amountCC,
          amountPhp:
            readNumber(payout.phpEquivalent) ||
            amountCC * displayReferenceRatePHP,
          date: readString(payout.createdAt, payout.completedAt),
          raw: payout,
        }
      }),
    [displayReferenceRatePHP, payouts],
  )

  const combinedActivities = useMemo(() => {
    const activityList = [
      ...normalizedCashins,
      ...normalizedCashouts,
      ...normalizedOrders,
    ]

    if (accountType === 'Affiliate') {
      activityList.push(...normalizedPayouts)
    }

    return activityList.sort((first, second) => {
      const firstDate = new Date(first.date).getTime()

      const secondDate = new Date(second.date).getTime()

      const safeFirstDate = Number.isFinite(firstDate) ? firstDate : 0

      const safeSecondDate = Number.isFinite(secondDate) ? secondDate : 0

      return safeSecondDate - safeFirstDate
    })
  }, [
    accountType,
    normalizedCashins,
    normalizedCashouts,
    normalizedOrders,
    normalizedPayouts,
  ])

  const filteredActivities = useMemo(() => {
    switch (filter) {
      case 'payouts':
        return combinedActivities.filter(
          (activity) => activity.type === 'PAYOUT',
        )

      case 'cashins':
        return combinedActivities.filter(
          (activity) => activity.type === 'CASHIN',
        )

      case 'cashouts':
        return combinedActivities.filter(
          (activity) => activity.type === 'CASHOUT',
        )

      case 'orders':
        return combinedActivities.filter(
          (activity) => activity.type === 'ORDER',
        )

      case 'all':
        return combinedActivities
    }
  }, [combinedActivities, filter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / resolvedPageSize),
  )

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleActivities = filteredActivities.slice(
    (page - 1) * resolvedPageSize,
    page * resolvedPageSize,
  )

  const firstVisibleItem =
    filteredActivities.length === 0 ? 0 : (page - 1) * resolvedPageSize + 1

  const lastVisibleItem = Math.min(
    page * resolvedPageSize,
    filteredActivities.length,
  )

  const notes = selectedActivity ? readString(selectedActivity.raw.notes) : ''

  const rejectionReason = selectedActivity
    ? readString(selectedActivity.raw.rejectedReason)
    : ''

  return (
    <section
      aria-labelledby='recent-activities-title'
      className={[
        'rounded-3xl border border-zinc-800 bg-[#1D1F26] p-5 sm:p-6',
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
                  'min-h-10 shrink-0 rounded-lg px-3 py-1 text-[10px] font-extrabold uppercase transition-all',
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
            className={[
              'relative ml-3 space-y-5 border-l border-zinc-800/80 py-1 pl-5 pr-2',
              layoutVariant === 'wide'
                ? 'min-h-[500px]'
                : 'max-h-[350px] overflow-y-auto scrollbar-thin',
            ].join(' ')}
          >
            {visibleActivities.map((activity) => {
              const colors = getActivityColors(activity.type)

              return (
                <motion.button
                  key={activity.id}
                  type='button'
                  initial={{
                    opacity: 0,
                    x: -10,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
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

                      <StatusBadge status={activity.status} />
                    </span>
                  </span>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {filteredActivities.length > resolvedPageSize && (
        <footer className='flex items-center justify-between border-t border-zinc-800 pt-4'>
          <span className='text-xs text-zinc-500 tabular-nums'>
            {firstVisibleItem}–{lastVisibleItem} of {filteredActivities.length}
          </span>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              aria-label='Previous activity page'
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className='flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>

            <span className='text-xs text-zinc-400 tabular-nums'>
              {page} / {totalPages}
            </span>

            <button
              type='button'
              aria-label='Next activity page'
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
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

                <DetailRow
                  label='Reference / ID'
                  value={selectedActivity.referenceNumber}
                />

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
                  <span className='text-zinc-500'>Ledger Status:</span>

                  <StatusBadge status={selectedActivity.status} />
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

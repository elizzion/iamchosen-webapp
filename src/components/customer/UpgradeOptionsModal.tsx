import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag,
  Crown,
  X,
  Sparkles,
  Loader2,
  Construction,
} from 'lucide-react'

export interface UpgradeOption {
  id: 'smart-customer' | 'affiliate-business'
  optionLabel: string
  title: string
  headline: string
  description: string
  benefits: string[]
  icon: React.ComponentType<any>
  actionLabel: string
  accent: 'emerald' | 'gold'
}

export interface UpgradeOptionCardProps {
  key?: string | number
  option: UpgradeOption
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
  isNavigating?: boolean
}

export function UpgradeOptionCard({
  option,
  isSelected,
  onSelect,
  disabled,
  isNavigating,
}: UpgradeOptionCardProps) {
  const Icon = option.icon
  const isEmerald = option.accent === 'emerald'

  return (
    <div
      onClick={!disabled && !isNavigating ? onSelect : undefined}
      className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 group ${
        disabled || isNavigating
          ? 'opacity-70 cursor-not-allowed'
          : 'cursor-pointer'
      } ${
        isSelected
          ? isEmerald
            ? 'border-emerald-500/80 bg-[#14231E]/90 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
            : 'border-amber-500/80 bg-[#251F12]/90 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
          : 'border-zinc-800 bg-[#16171B] hover:border-zinc-700 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* Decorative Top Accent Light */}
      <div
        className={`absolute inset-x-0 -top-px mx-auto h-px w-2/3 transition-opacity duration-500 ${
          isSelected
            ? isEmerald
              ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-100'
              : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-100'
            : 'bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50 group-hover:opacity-100'
        }`}
      />

      <div className='space-y-5'>
        {/* Card Header Tag & Icon */}
        <div className='flex items-center justify-between'>
          <span
            className={`font-mono text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
              isSelected
                ? isEmerald
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                  : 'border-amber-500/30 text-amber-400 bg-amber-500/5'
                : 'border-zinc-800 text-zinc-500 bg-zinc-900'
            }`}
          >
            {option.optionLabel}
          </span>
          <div
            className={`p-3 rounded-2xl border transition-all duration-300 ${
              isSelected
                ? isEmerald
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 scale-110'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 scale-110'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:text-zinc-200'
            }`}
          >
            <Icon className='h-5 w-5' />
          </div>
        </div>

        {/* Option Titles */}
        <div>
          <h3
            className={`text-xl font-black uppercase tracking-tight ${
              isEmerald ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {option.title}
          </h3>
          <p className='mt-1.5 text-sm font-bold text-zinc-200 leading-snug'>
            {option.headline}
          </p>
          <p className='mt-2 text-xs text-zinc-400 leading-relaxed font-sans'>
            {option.description}
          </p>
        </div>

        <hr className='border-zinc-800/80' />

        {/* Benefits List */}
        {/* <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 font-mono">
            Included Benefits
          </span>
          <ul className="mt-3 space-y-2">
            {option.benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  <Check
                    className={`h-3.5 w-3.5 ${
                      isEmerald ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                </div>
                <span className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div> */}
      </div>

      {/* Action Button at the bottom */}
      <div className='mt-8'>
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          disabled={disabled || isNavigating}
          className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
            isSelected
              ? isEmerald
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] hover:scale-[1.01] focus:ring-2 focus:ring-emerald-500/50'
                : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.4)] hover:scale-[1.01] focus:ring-2 focus:ring-amber-500/50'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50'
          }`}
        >
          {isNavigating && isSelected ? (
            <>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Preparing Path...
            </>
          ) : (
            option.actionLabel
          )}
        </button>
      </div>
    </div>
  )
}

export interface UpgradeOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (option: 'smart-customer' | 'affiliate-business') => void
  isNavigating?: boolean
  navigationError?: string | null
}

const UPGRADE_OPTIONS: UpgradeOption[] = [
  {
    id: 'smart-customer',
    optionLabel: 'OPTION 01',
    title: 'SMART CUSTOMER',
    headline: 'Save more while enjoying premium wellness products.',
    description:
      'Enjoy exclusive member pricing, promotions, wellness rewards, and convenient access to premium I AM CHOSEN products.',
    benefits: [
      'Exclusive Discounts and Rebates',
      'Enjoy Premium Wellness Products',
      'Exclusive Member Benefits',
      'Special Perks and Rewards',
      'Fast Ordering',
      'Community Access',
    ],
    icon: ShoppingBag,
    actionLabel: 'CHOOSE SMART CUSTOMER',
    accent: 'emerald',
  },
  {
    id: 'affiliate-business',
    optionLabel: 'OPTION 02',
    title: 'AFFILIATE BUSINESS',
    headline: 'Turn wellness into a business opportunity.',
    description:
      'Access the I AM CHOSEN business system, referral bonuses, leadership rewards, analytics, and business tools.',
    benefits: [
      'Exclusive Premium Products',
      'Retail Profit',
      'Referral Bonuses',
      'Leadership Rewards',
      'E-Commerce Platform',
      'Complete Business System and Tools',
      'AI Business Coach',
      'Business Analytics',
      'Marketing Support Allocation',
      'Business Growth Opportunities',
      'Supportive Community',
    ],
    icon: Crown,
    actionLabel: 'CHOOSE AFFILIATE BUSINESS',
    accent: 'gold',
  },
]

export default function UpgradeOptionsModal({
  isOpen,
  onClose,
  onSelect,
  isNavigating = false,
  navigationError = null,
}: UpgradeOptionsModalProps) {
  const [selectedPath, setSelectedPath] = useState<
    'smart-customer' | 'affiliate-business' | null
  >(null)
  const [showSmartCustomerNotice, setShowSmartCustomerNotice] =
    useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const prevActiveElement = useRef<HTMLElement | null>(null)

  // Trap Focus and Escape key logic
  useEffect(() => {
    if (isOpen) {
      prevActiveElement.current = document.activeElement as HTMLElement
      // Prevent body scrolling
      document.body.style.overflow = 'hidden'
      // Focus the close button initially
      closeBtnRef.current?.focus()
    } else {
      document.body.style.overflow = ''
      setShowSmartCustomerNotice(false)
      setSelectedPath(null)
      prevActiveElement.current?.focus()
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Trap Focus Key handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSmartCustomerNotice) {
          setShowSmartCustomerNotice(false)
          setSelectedPath(null)
        } else {
          onClose()
        }
        return
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement

        if (e.shiftKey) {
          // If shift + tab
          if (document.activeElement === firstElement) {
            lastElement.focus()
            e.preventDefault()
          }
        } else {
          // If tab
          if (document.activeElement === lastElement) {
            firstElement.focus()
            e.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, showSmartCustomerNotice])

  const handleSelectOption = (
    optionId: 'smart-customer' | 'affiliate-business',
  ) => {
    if (isNavigating) return

    setSelectedPath(optionId)

    if (optionId === 'smart-customer') {
      setShowSmartCustomerNotice(true)
      return
    }

    onSelect(optionId)
  }

  const handleContinueWithAffiliateBusiness = () => {
    if (isNavigating) return
    setShowSmartCustomerNotice(false)
    setSelectedPath('affiliate-business')
    onSelect('affiliate-business')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10'>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className='absolute inset-0 bg-black/80 backdrop-blur-md'
            aria-hidden='true'
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            role='dialog'
            aria-modal='true'
            aria-labelledby='upgrade-modal-title'
            aria-describedby='upgrade-modal-description'
            className='relative w-full max-w-5xl rounded-3xl bg-[#0B0C0E] border border-zinc-800 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]'
          >
            {/* Header Area */}
            <div className='p-6 pb-0 flex items-start justify-between relative z-10 border-b border-zinc-900/50 bg-[#0B0C0E]'>
              <div>
                <div className='flex items-center gap-2'>
                  <h2
                    id='upgrade-modal-title'
                    className='text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2'
                  >
                    Choose Your Chosen Path
                  </h2>
                  <Sparkles className='h-5 w-5 text-amber-400 animate-pulse hidden sm:block' />
                </div>
                <p
                  id='upgrade-modal-description'
                  className='mt-1 text-sm text-zinc-400'
                >
                  Choose the option that best fits your goals.
                </p>
              </div>

              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label='Close upgrade options'
                className='p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-600'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {/* Content Scrollable Area */}
            <div className='flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800'>
              {navigationError && (
                <div className='p-4 bg-red-950/40 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400 flex items-center gap-3'>
                  <span>⚠️</span>
                  <span>{navigationError}</span>
                </div>
              )}

              {/* Grid Layout of options */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6 pb-2'>
                {UPGRADE_OPTIONS.map((opt) => (
                  <UpgradeOptionCard
                    key={opt.id}
                    option={opt}
                    isSelected={selectedPath === opt.id}
                    onSelect={() => handleSelectOption(opt.id)}
                    disabled={isNavigating}
                    isNavigating={isNavigating}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Safe Area Padding for mobile */}
            <div className='h-4 bg-[#0B0C0E]' />

            <AnimatePresence>
              {showSmartCustomerNotice && (
                <div className='absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6'>
                  <motion.button
                    type='button'
                    aria-label='Close Smart Customer development notice'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      setShowSmartCustomerNotice(false)
                      setSelectedPath(null)
                    }}
                    className='absolute inset-0 h-full w-full cursor-default bg-black/80 backdrop-blur-md'
                  />

                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 16 }}
                    transition={{ type: 'spring', duration: 0.4 }}
                    role='alertdialog'
                    aria-modal='true'
                    aria-labelledby='smart-customer-development-title'
                    aria-describedby='smart-customer-development-description'
                    className='relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-emerald-500/25 bg-[#0D1110] shadow-[0_24px_60px_rgba(0,0,0,0.65)]'
                  >
                    <div className='h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400' />

                    <div className='p-6 sm:p-7'>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400'>
                          <Construction className='h-6 w-6' />
                        </div>

                        <button
                          type='button'
                          onClick={() => {
                            setShowSmartCustomerNotice(false)
                            setSelectedPath(null)
                          }}
                          aria-label='Close development notice'
                          className='rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white'
                        >
                          <X className='h-4 w-4' />
                        </button>
                      </div>

                      <div className='mt-5'>
                        <span className='inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400'>
                          Coming Soon
                        </span>

                        <h3
                          id='smart-customer-development-title'
                          className='mt-4 text-xl font-black uppercase tracking-tight text-white'
                        >
                          Smart Customer Path Under Development
                        </h3>

                        <p
                          id='smart-customer-development-description'
                          className='mt-3 text-sm leading-relaxed text-zinc-300'
                        >
                          Thank you for choosing the Smart Customer path. This
                          experience is currently under development while we
                          carefully complete its features, member benefits, and
                          ordering journey.
                        </p>

                        <p className='mt-3 text-xs leading-relaxed text-zinc-500'>
                          This path is temporarily unavailable. We appreciate
                          your patience and look forward to opening it once it
                          is fully ready for our community.
                        </p>
                      </div>

                      <div className='mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <button
                          type='button'
                          onClick={() => {
                            setShowSmartCustomerNotice(false)
                            setSelectedPath(null)
                          }}
                          className='rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
                        >
                          Close
                        </button>

                        <button
                          type='button'
                          onClick={handleContinueWithAffiliateBusiness}
                          disabled={isNavigating}
                          className='rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          Explore Affiliate Business
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

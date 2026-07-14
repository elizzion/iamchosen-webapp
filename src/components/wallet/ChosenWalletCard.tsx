import React, { useState } from 'react'
import { Eye, EyeOff, Download, Sparkles, ArrowLeftRight } from 'lucide-react'

interface ChosenWalletCardProps {
  uid: string
  accountType: 'Customer' | 'Smart Customer' | 'Affiliate'
  packageLevel: string
  balanceCC: number
  displayReferenceRatePHP: number
  isLoading?: boolean
  error?: string | null
  onCashIn: () => void
  onUpgrade: () => void
  onTransfer: () => void
  canUpgrade?: boolean
  canTransfer?: boolean
  className?: string
}

export default function ChosenWalletCard({
  accountType,
  balanceCC,
  displayReferenceRatePHP,
  isLoading = false,
  error = null,
  onCashIn,
  onUpgrade,
  onTransfer,
  canUpgrade = true,
  canTransfer = true,
  className = '',
}: ChosenWalletCardProps) {
  // Local storage for privacy preference so it is non-sensitive and client-only
  const [showBalance, setShowBalance] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('chosen_wallet_balance_visible')
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  const toggleBalance = () => {
    setShowBalance((prev) => {
      const newValue = !prev
      try {
        localStorage.setItem('chosen_wallet_balance_visible', String(newValue))
      } catch (err) {
        console.error('Failed to save balance visibility:', err)
      }
      return newValue
    })
  }

  if (isLoading) {
    return (
      <section
        aria-labelledby='chosen-wallet-heading-loading'
        className={`relative overflow-hidden rounded-2xl border border-cyan-500/10 bg-gradient-to-br from-[#111318] to-[#07090D] p-5 shadow-[0_0_30px_rgba(0,229,210,0.04)] animate-pulse ${className}`}
      >
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center'>
          <div className='space-y-3 w-2/3'>
            <div className='h-4 bg-zinc-800 rounded w-1/3'></div>
            <div className='h-10 bg-zinc-800 rounded w-1/2'></div>
            <div className='h-4 bg-zinc-800 rounded w-1/4'></div>
          </div>
          <div className='mt-4 md:mt-0 h-16 w-16 bg-zinc-800 rounded-full'></div>
        </div>
        <div className='mt-6 grid grid-cols-3 gap-3'>
          <div className='h-11 bg-zinc-800 rounded-xl'></div>
          <div className='h-11 bg-zinc-800 rounded-xl'></div>
          <div className='h-11 bg-zinc-800 rounded-xl'></div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        aria-labelledby='chosen-wallet-heading-error'
        className={`relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-[#111318] to-[#0D0909] p-6 text-center ${className}`}
      >
        <div className='py-4'>
          <p className='text-zinc-400 text-sm mb-3'>
            We could not load your Chosen Wallet. Please refresh and try again.
          </p>
          <p className='text-xs text-red-400 font-mono mb-4'>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold font-sans transition-all active:scale-95'
          >
            Retry Loading
          </button>
        </div>
      </section>
    )
  }

  const phpReference = balanceCC * displayReferenceRatePHP

  const formattedCC = balanceCC.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const formattedPHP = phpReference.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <section
      aria-labelledby='chosen-wallet-heading'
      className={`relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#111318] via-[#10151B] to-[#07090D] p-5 shadow-[0_0_30px_rgba(0,229,210,0.08)] ${className}`}
    >
      {/* Glow */}
      <div className='absolute right-0 top-0 z-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-[45px] pointer-events-none' />

      {/* Wallet Image / CC Coin Artwork */}
      <img
        src='/images/chosen-wallet.png'
        alt='Chosen Wallet Illustration'
        className='absolute right-3 top-8 z-20 w-[120px] sm:w-[150px] md:w-[180px] object-contain pointer-events-none select-none drop-shadow-[0_0_35px_rgba(0,229,210,0.55)]'
      />

      {/* Content wrapper */}
      <div className='relative z-30'>
        {/* Left Balance Details */}
        <div className='mb-2 pr-[130px] sm:pr-[160px] md:pr-[200px]'>
          <div className='mb-2 flex items-center gap-2'>
            <span
              id='chosen-wallet-heading'
              className='text-[11px] font-semibold text-zinc-400 uppercase tracking-widest font-sans'
            >
              CHOSEN WALLET BALANCE
            </span>
            <button
              onClick={toggleBalance}
              className='text-zinc-400 hover:text-white focus:text-white transition-colors cursor-pointer rounded focus:outline-none focus:ring-1 focus:ring-cyan-400 p-0.5'
              aria-label={
                showBalance
                  ? 'Hide Chosen Wallet balance'
                  : 'Show Chosen Wallet balance'
              }
            >
              {showBalance ? (
                <EyeOff className='h-3.5 w-3.5' />
              ) : (
                <Eye className='h-3.5 w-3.5' />
              )}
            </button>
          </div>

          {/* Balance */}
          <div className='text-3xl sm:text-4xl font-black leading-none text-cyan-400 font-sans tracking-tight flex items-baseline gap-1.5'>
            <span className='numeric-value'>
              {showBalance ? formattedCC : '••••••'}
            </span>
            <span className='text-xs sm:text-sm font-extrabold text-zinc-500'>
              CC
            </span>
          </div>

          <div className='mt-2 text-xs sm:text-sm text-zinc-400 font-sans numeric-value'>
            ≈ {showBalance ? formattedPHP : '₱•••••• PHP'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className='mt-5 grid grid-cols-3 gap-3'>
          <button
            onClick={onCashIn}
            aria-label='Open Cash-In'
            className='min-h-[44px] flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-white font-sans bg-gradient-to-br from-cyan-400 to-teal-600 shadow-[0_4px_12px_rgba(0,229,210,0.25)] hover:shadow-[0_6px_20px_rgba(0,229,210,0.4)] hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-all cursor-pointer'
          >
            <Download className='h-4 w-4' />
            <span className='text-[11px] font-bold'>Cash-In</span>
          </button>

          <button
            onClick={onUpgrade}
            disabled={!canUpgrade}
            aria-label='View account upgrade options'
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-white font-sans transition-all
              ${
                canUpgrade
                  ? 'bg-gradient-to-br from-purple-500 via-violet-700 to-amber-500 shadow-[0_4px_12px_rgba(168,85,247,0.25)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.4)] hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-zinc-950 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 opacity-55 cursor-not-allowed border border-zinc-700/50'
              }`}
          >
            <Sparkles className='h-4 w-4 text-amber-300' />
            <span className='text-[11px] font-bold'>Upgrade</span>
          </button>

          <button
            onClick={onTransfer}
            disabled={!canTransfer}
            aria-label='Open Chosen Credit transfer'
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-white font-sans transition-all
              ${
                canTransfer
                  ? 'bg-gradient-to-br from-blue-500 to-blue-800 shadow-[0_4px_12px_rgba(59,130,246,0.25)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 opacity-55 cursor-not-allowed border border-zinc-700/50'
              }`}
          >
            <ArrowLeftRight className='h-4 w-4' />
            <span className='text-[11px] font-bold'>Transfer</span>
          </button>
        </div>
      </div>
    </section>
  )
}

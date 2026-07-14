import React, { useState, useEffect } from 'react'
import {
  Link2,
  Copy,
  Check,
  Send,
  MessageCircle,
  Instagram,
  Facebook,
  Users,
  AlertCircle,
} from 'lucide-react'
import { UserProfile } from '../types'
import {
  getPublicAppUrl,
  buildAffiliateReferralUrl,
  fetchCommunityLinks,
  validateCommunityUrl,
  CommunityLinks,
  CommunityPlatform,
} from '../services/affiliate-config.service'

interface AffiliateGrowthToolsSectionProps {
  userProfile: UserProfile | null
}

export function AffiliateGrowthToolsSection({
  userProfile,
}: AffiliateGrowthToolsSectionProps) {
  // Guard visibility based on uid and accountType === 'Affiliate'
  if (!userProfile || userProfile.accountType !== 'Affiliate') {
    return null
  }

  return (
    <div className='space-y-6 mt-6' id='affiliate-growth-tools'>
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
        {/* Referral Link Card takes 2 columns on extra large screens */}
        <div className='xl:col-span-2'>
          <AffiliateReferralLinkCard sponsorCode={userProfile.sponsorCode} />
        </div>
        {/* Community Card takes 1 column */}
        <div>
          <AffiliateCommunityCard />
        </div>
      </div>
    </div>
  )
}

interface AffiliateReferralLinkCardProps {
  sponsorCode: string | undefined
}

export function AffiliateReferralLinkCard({
  sponsorCode,
}: AffiliateReferralLinkCardProps) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const cleanSponsorCode = sponsorCode?.trim() || ''
  const referralUrl = cleanSponsorCode
    ? buildAffiliateReferralUrl({
        baseUrl: getPublicAppUrl(),
        registrationPath: '/register',
        referralCode: cleanSponsorCode,
        queryParameter: 'ref',
      })
    : ''

  const handleCopy = async () => {
    if (!referralUrl) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy referral link:', err)
      setCopyError(
        'We could not copy the referral link. Please select and copy it manually.',
      )
    }
  }

  // Loading state if sponsorCode is undefined or page is resolving
  if (sponsorCode === undefined) {
    return (
      <div className='bg-[#0e1118]/80 border border-zinc-800/80 rounded-3xl p-6 shadow-xl animate-pulse h-[140px] flex flex-col justify-between'>
        <div className='h-4 bg-zinc-800 rounded w-1/3'></div>
        <div className='h-10 bg-zinc-800 rounded w-full'></div>
      </div>
    )
  }

  return (
    <div
      className='bg-[#0b0d13] border border-cyan-500/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group'
      id='affiliate-referral-card'
    >
      {/* Visual neon line accent */}
      <div className='absolute top-0 inset-x-0 h-[2px] bg-cyan-500/30 group-hover:bg-cyan-500/50 transition-colors' />
      <div className='absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none' />

      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-6'>
        {/* Left Side: Header */}
        <div className='flex items-start gap-4'>
          <div className='w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <Link2 className='w-5 h-5' />
          </div>
          <div>
            <h3 className='font-extrabold text-sm text-white uppercase tracking-tight'>
              Your Referral Link
            </h3>
            <p className='text-xs text-zinc-400 leading-relaxed font-light mt-0.5'>
              Share to grow your network and sponsor new downlines
            </p>
          </div>
        </div>

        {/* Right Side: URL Input and Copy Button */}
        <div className='flex-1 max-w-full lg:max-w-xl'>
          {cleanSponsorCode ? (
            <div className='flex flex-col sm:flex-row items-stretch gap-2.5'>
              <div className='relative flex-1 min-w-0'>
                <input
                  type='text'
                  readOnly
                  value={referralUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className='w-full bg-zinc-950/80 border border-zinc-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-xs text-zinc-300 font-medium select-all focus:outline-none transition-colors overflow-x-auto'
                  aria-label='Referral URL'
                />
              </div>

              <button
                onClick={handleCopy}
                disabled={copySuccess}
                className={`min-h-[44px] px-5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  copySuccess
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-zinc-950 border-zinc-800 hover:border-cyan-500/40 text-cyan-400 active:bg-zinc-900'
                }`}
                aria-label='Copy referral link'
              >
                {copySuccess ? (
                  <>
                    <Check className='w-4 h-4 animate-scale' />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className='w-4 h-4' />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className='flex items-center gap-2 text-amber-500 text-xs bg-amber-500/5 border border-amber-500/10 rounded-xl p-3'>
              <AlertCircle className='w-4 h-4 shrink-0' />
              <span>
                Your referral link is temporarily unavailable. Missing sponsor
                code.
              </span>
            </div>
          )}

          {/* Screen reader live notification */}
          <div aria-live='polite' className='sr-only'>
            {copySuccess ? 'Referral link copied to clipboard' : ''}
          </div>

          {copyError && (
            <p className='text-red-400 text-[11px] mt-2 font-medium'>
              {copyError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface CommunityButtonProps {
  platform: CommunityPlatform
  label: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

function CommunityButton({
  platform,
  label,
  url,
  icon: Icon,
}: CommunityButtonProps) {
  // Generate beautiful custom color accents based on platform
  const getPlatformStyles = () => {
    switch (platform) {
      case 'telegram':
        return 'hover:border-sky-500/30 hover:text-sky-400 text-sky-400/90'
      case 'whatsapp':
        return 'hover:border-emerald-500/30 hover:text-emerald-400 text-emerald-400/90'
      case 'instagram':
        return 'hover:border-pink-500/30 hover:text-pink-400 text-pink-400/90'
      case 'facebook':
        return 'hover:border-blue-500/30 hover:text-blue-400 text-blue-400/90'
      default:
        return 'hover:border-cyan-500/30 hover:text-cyan-400 text-zinc-400'
    }
  }

  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className={`flex items-center gap-3 bg-zinc-950/80 border border-zinc-900 rounded-xl p-3.5 transition-all text-xs font-bold uppercase tracking-wider hover:bg-zinc-900 min-h-[44px] ${getPlatformStyles()}`}
      aria-label={`Open the I AM CHOSEN ${label} community`}
    >
      <Icon className='w-4 h-4 shrink-0' />
      <span>{label}</span>
    </a>
  )
}

export function AffiliateCommunityCard() {
  const [links, setLinks] = useState<CommunityLinks | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchCommunityLinks().then((data) => {
      if (mounted) {
        setLinks(data)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className='bg-[#0b0d13] border border-cyan-500/10 rounded-3xl p-6 shadow-xl animate-pulse h-[140px] flex flex-col justify-between'>
        <div className='h-4 bg-zinc-800 rounded w-1/3'></div>
        <div className='grid grid-cols-2 gap-2 mt-4'>
          <div className='h-10 bg-zinc-800 rounded'></div>
          <div className='h-10 bg-zinc-800 rounded'></div>
        </div>
      </div>
    )
  }

  // Build the list of active links
  const availablePlatforms: CommunityButtonProps[] = []

  if (links?.isActive) {
    if (validateCommunityUrl(links.telegramUrl)) {
      availablePlatforms.push({
        platform: 'telegram',
        label: 'Telegram',
        url: links.telegramUrl!,
        icon: Send,
      })
    }
    if (validateCommunityUrl(links.whatsappUrl)) {
      availablePlatforms.push({
        platform: 'whatsapp',
        label: 'WhatsApp',
        url: links.whatsappUrl!,
        icon: MessageCircle,
      })
    }
    if (validateCommunityUrl(links.instagramUrl)) {
      availablePlatforms.push({
        platform: 'instagram',
        label: 'Instagram',
        url: links.instagramUrl!,
        icon: Instagram,
      })
    }
    if (validateCommunityUrl(links.facebookUrl)) {
      availablePlatforms.push({
        platform: 'facebook',
        label: 'Facebook',
        url: links.facebookUrl!,
        icon: Facebook,
      })
    }
  }

  return (
    <div
      className='bg-[#0b0d13] border border-cyan-500/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group h-full flex flex-col justify-between'
      id='affiliate-community-card'
    >
      {/* Visual neon line accent */}
      <div className='absolute top-0 inset-x-0 h-[2px] bg-cyan-500/30 group-hover:bg-cyan-500/50 transition-colors' />
      <div className='absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none' />

      <div>
        {/* Header aligned left */}
        <div className='flex items-start gap-4 mb-5'>
          <div className='w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <Users className='w-5 h-5' />
          </div>
          <div>
            <h3 className='font-extrabold text-sm text-white uppercase tracking-tight'>
              Community
            </h3>
            <p className='text-xs text-zinc-400 leading-relaxed font-light mt-0.5'>
              Join our channels and stay up to date
            </p>
          </div>
        </div>

        {availablePlatforms.length > 0 ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3'>
            {availablePlatforms.map((btn) => (
              <CommunityButton
                key={btn.platform}
                platform={btn.platform}
                label={btn.label}
                url={btn.url}
                icon={btn.icon}
              />
            ))}
          </div>
        ) : (
          <div className='text-zinc-500 text-xs text-center py-4 border border-zinc-900 bg-zinc-950/40 rounded-2xl'>
            Official community links are temporarily unavailable.
          </div>
        )}
      </div>
    </div>
  )
}

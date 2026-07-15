import { doc, getDoc } from 'firebase/firestore'
import {
  activatePackageWithWallet,
  db,
  type ActivatePackageWithWalletRequest,
  type ActivatePackageWithWalletResponse,
  type PackageActivationAction,
} from '../../firebase'
import type { BusinessCycle } from '../../types'

export type AffiliatePackageLevel =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'City Distributor'
  | 'Regional Distributor'

export type PackageAccountPath = 'Affiliate' | 'Smart Customer'

const IDEMPOTENCY_STORAGE_PREFIX = 'iamchosen:package-activation'

function createRandomId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

function createIdempotencyStorageKey(input: {
  uid: string
  action: PackageActivationAction
  packageId: string
}): string {
  return `${IDEMPOTENCY_STORAGE_PREFIX}:${input.uid}:${input.action}:${input.packageId}`
}

function getOrCreateIdempotencyKey(input: {
  uid: string
  action: PackageActivationAction
  packageId: string
}): { key: string; storageKey: string } {
  const storageKey = createIdempotencyStorageKey(input)

  if (typeof sessionStorage !== 'undefined') {
    const existing = sessionStorage.getItem(storageKey)
    if (existing) return { key: existing, storageKey }
  }

  const key = `${input.action.toLowerCase()}:${input.uid}:${input.packageId}:${createRandomId()}`
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(storageKey, key)
  }

  return { key, storageKey }
}

function clearIdempotencyStorageKey(storageKey: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(storageKey)
  }
}

function normalizeCallableError(error: unknown): Error {
  if (!error || typeof error !== 'object') {
    return new Error('Package activation could not be completed.')
  }

  const rawCode =
    'code' in error ? String((error as { code?: unknown }).code || '') : ''
  const code = rawCode.replace('functions/', '')
  const fallback =
    error instanceof Error && error.message
      ? error.message
      : 'Package activation could not be completed.'

  switch (code) {
    case 'unauthenticated':
      return new Error('Your session expired. Please sign in again.')
    case 'resource-exhausted':
      return new Error(
        'Your Chosen Wallet does not contain enough CC for the full target package price.',
      )
    case 'failed-precondition':
      return new Error(fallback)
    case 'already-exists':
      return new Error(
        'This request key was already used for a different package activation.',
      )
    case 'not-found':
      return new Error(fallback)
    case 'unavailable':
      return new Error(
        'The package engine is temporarily unavailable. Retry using the same request.',
      )
    case 'permission-denied':
      return new Error(
        'The secured package engine rejected this request. Confirm the callable function is deployed in asia-southeast1.',
      )
    case 'internal':
      return new Error(fallback)
    default:
      return new Error(fallback)
  }
}

export const PackageService = {
  async getBusinessCycle(uid: string): Promise<BusinessCycle | null> {
    const snapshot = await getDoc(doc(db, 'business_cycles', uid))
    return snapshot.exists() ? (snapshot.data() as BusinessCycle) : null
  },

  async activatePackage(input: {
    uid: string
    packageId: AffiliatePackageLevel | string
    accountPath: PackageAccountPath
    activationAction: PackageActivationAction
    idempotencyKey?: string
  }): Promise<ActivatePackageWithWalletResponse> {
    const generated = input.idempotencyKey
      ? {
          key: input.idempotencyKey,
          storageKey: createIdempotencyStorageKey({
            uid: input.uid,
            action: input.activationAction,
            packageId: input.packageId,
          }),
        }
      : getOrCreateIdempotencyKey({
          uid: input.uid,
          action: input.activationAction,
          packageId: input.packageId,
        })

    const payload: ActivatePackageWithWalletRequest = {
      packageId: input.packageId,
      accountPath: input.accountPath,
      activationAction: input.activationAction,
      idempotencyKey: generated.key,
    }

    try {
      const response = await activatePackageWithWallet(payload)
      if (!response.data?.success) {
        throw new Error(
          'The package engine did not return a successful result.',
        )
      }
      clearIdempotencyStorageKey(generated.storageKey)
      return response.data
    } catch (error) {
      // Preserve the key after failure so retrying cannot create a second debit.
      throw normalizeCallableError(error)
    }
  },

  async purchasePackage(
    uid: string,
    _email: string,
    data: {
      packageLevel: AffiliatePackageLevel
      packageValueCC?: number
      earningsCapCC?: number
      accountPath?: PackageAccountPath
    },
  ): Promise<ActivatePackageWithWalletResponse> {
    return PackageService.activatePackage({
      uid,
      packageId: data.packageLevel,
      accountPath: data.accountPath || 'Affiliate',
      activationAction: 'INITIAL_ACTIVATION',
    })
  },

  async upgradePackage(
    uid: string,
    _email: string,
    _currentPackageLevel: string,
    targetPackageLevel: AffiliatePackageLevel,
    _clientCalculatedCostCC?: number,
  ): Promise<ActivatePackageWithWalletResponse> {
    // The backend loads and deducts the full authoritative target package price.
    return PackageService.activatePackage({
      uid,
      packageId: targetPackageLevel,
      accountPath: 'Affiliate',
      activationAction: 'PACKAGE_UPGRADE',
    })
  },

  async reactivatePackage(
    uid: string,
    targetPackageLevel: AffiliatePackageLevel,
  ): Promise<ActivatePackageWithWalletResponse> {
    return PackageService.activatePackage({
      uid,
      packageId: targetPackageLevel,
      accountPath: 'Affiliate',
      activationAction: 'BUSINESS_CYCLE_REACTIVATION',
    })
  },
}

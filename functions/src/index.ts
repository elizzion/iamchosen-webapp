import { initializeApp } from 'firebase-admin/app'
import {
  getFirestore,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore'
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from 'firebase-functions/v2/https'
import { createHash } from 'node:crypto'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID?.trim() ||
  'ai-studio-choseninternatio-e8f32de0-3246-4255-97e0-380012b7fd9e'
const FUNCTIONS_REGION = 'asia-southeast1'
const CANONICAL_P2P_TRANSFER_FEE_CC = 1
const TECHNOLOGY_OPERATIONS_TREASURY_ID =
  'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY'

const app = initializeApp()
const db = getFirestore(app, FIRESTORE_DATABASE_ID)

interface PackageConfig {
  name: string
  cc: number
  cap: number
  php: number
}

// Approved, version-controlled emergency package configurations.
// Firestore remains authoritative. These values are used only when a
// package document is genuinely absent, never when Firestore itself fails.
const PACKAGES: Record<string, PackageConfig> = {
  bronze: { name: 'Bronze', cc: 50, cap: 125, php: 3500 },
  silver: { name: 'Silver', cc: 350, cap: 875, php: 24500 },
  gold: { name: 'Gold', cc: 1500, cap: 3750, php: 105000 },
  platinum: { name: 'Platinum', cc: 3000, cap: 7500, php: 210000 },
  diamond: { name: 'Diamond', cc: 5000, cap: 12500, php: 350000 },
  'city distributor': {
    name: 'City Distributor',
    cc: 25000,
    cap: 62500,
    php: 1750000,
  },
  'regional distributor': {
    name: 'Regional Distributor',
    cc: 100000,
    cap: 250000,
    php: 7000000,
  },
  'wellness starter kit': {
    name: 'Wellness Starter Kit',
    cc: 20,
    cap: 50,
    php: 1400,
  },
  'family health essentials': {
    name: 'Family Health Essentials',
    cc: 60,
    cap: 150,
    php: 4200,
  },
  'ultimate longevity system': {
    name: 'Ultimate Longevity System',
    cc: 150,
    cap: 375,
    php: 10500,
  },
}

function parsePackageConfig(
  data: DocumentData,
  fallbackName: string,
): PackageConfig {
  const cc = Number(data.packageValueCC ?? data.cc)
  const cap = Number(data.earningsCapCC ?? data.cap)
  const php = Number(data.pricePHP ?? data.php)

  if (
    !Number.isFinite(cc) ||
    cc <= 0 ||
    !Number.isFinite(cap) ||
    cap <= 0 ||
    !Number.isFinite(php) ||
    php <= 0
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The selected package configuration is invalid.',
    )
  }

  return {
    name: String(data.name || fallbackName),
    cc,
    cap,
    php,
  }
}

/**
 * Configuration-driven package loader from Firestore.
 *
 * Security rule:
 * - Firestore errors fail closed.
 * - The approved fallback is used only when no package document exists.
 */
async function getPackageConfig(
  packageId: string,
): Promise<PackageConfig | null> {
  const normalizedId = packageId.toLowerCase().trim()

  try {
    const packageDoc = await db.collection('packages').doc(normalizedId).get()

    if (packageDoc.exists) {
      const data = packageDoc.data()
      if (!data) {
        throw new HttpsError(
          'failed-precondition',
          'The selected package configuration is unavailable.',
        )
      }
      return parsePackageConfig(data, packageId)
    }

    const packageQuery = await db
      .collection('packages')
      .where('name', '==', packageId)
      .limit(1)
      .get()

    if (!packageQuery.empty) {
      return parsePackageConfig(packageQuery.docs[0].data(), packageId)
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error
    }

    console.error('Package configuration lookup failed', {
      packageId: normalizedId,
      error: error instanceof Error ? error.message : String(error),
    })

    throw new HttpsError(
      'internal',
      'Package configuration could not be loaded.',
    )
  }

  const approvedFallback = PACKAGES[normalizedId] ?? null

  if (approvedFallback) {
    console.warn('Using approved package fallback configuration', {
      packageId: normalizedId,
    })
  }

  return approvedFallback
}

/**
 * Fetch the active, approved CC purchase rate.
 * No silent financial fallback is permitted.
 */
async function getCCRate(): Promise<number> {
  const settingsDoc = await db
    .collection('system_config')
    .doc('cc_settings')
    .get()

  if (!settingsDoc.exists) {
    throw new HttpsError(
      'failed-precondition',
      'Chosen Credit configuration is unavailable.',
    )
  }

  const data = settingsDoc.data() || {}

  if (data.isActive !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Chosen Credit configuration is inactive.',
    )
  }

  const rate = Number(
    data.purchaseRatePHP ?? data.cashInRatePHP ?? data.displayReferenceRatePHP,
  )

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new HttpsError(
      'failed-precondition',
      'Chosen Credit purchase-rate configuration is invalid.',
    )
  }

  return rate
}

/**
 * Submit Package Cash-In Request
 */
export const submitPackageCashInRequest = onCall(
  { region: 'asia-southeast1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Request is missing authentication credentials.',
      )
    }

    const uid = request.auth.uid
    const data = request.data || {}

    const {
      packageId,
      amountPHP,
      paymentMethod,
      referenceNumber,
      senderAccountName,
      senderAccountNumber,
      proofOfPaymentUrl,
      proofOfPaymentPath,
      proofOfPaymentFileName,
      proofOfPaymentContentType,
      proofOfPaymentSizeBytes,
      notes,
      packagePurchaseIntentId,
      accountPath,
    } = data

    if (!packageId) {
      throw new HttpsError('invalid-argument', 'Package ID is required.')
    }

    const pkg = await getPackageConfig(packageId)
    if (!pkg) {
      throw new HttpsError(
        'invalid-argument',
        `Package ${packageId} is not supported.`,
      )
    }

    if (!amountPHP || amountPHP <= 0) {
      throw new HttpsError(
        'invalid-argument',
        'Amount PHP must be greater than zero.',
      )
    }

    if (!referenceNumber) {
      throw new HttpsError('invalid-argument', 'Reference number is required.')
    }

    if (!proofOfPaymentUrl) {
      throw new HttpsError(
        'invalid-argument',
        'Proof of payment URL is required.',
      )
    }

    try {
      const userDocRef = db.collection('users').doc(uid)
      const userDoc = await userDocRef.get()
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.')
      }

      const userData = userDoc.data() || {}
      const timestamp = new Date().toISOString()
      const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`

      const ccRate = await getCCRate()
      const computedCC = Number((amountPHP / ccRate).toFixed(4))

      const cashinData = {
        requestId,
        uid,
        memberId: userData.memberId || '',
        fullName: userData.fullName || '',
        email: userData.email || '',
        amountPHP: Number(amountPHP),
        computedCC: computedCC,
        ratePHPPerCC: ccRate,
        paymentMethod,
        referenceNumber,
        proofOfPaymentUrl,
        proofOfPaymentPath: proofOfPaymentPath || '',
        proofOfPaymentFileName: proofOfPaymentFileName || '',
        proofOfPaymentContentType: proofOfPaymentContentType || '',
        proofOfPaymentSizeBytes: Number(proofOfPaymentSizeBytes || 0),
        notes: notes || '',
        status: 'Pending',
        paymentStatus: 'PENDING_PAYMENT_REVIEW',
        packagePurchaseStatus: 'PENDING',
        packageId: pkg.name,
        requestedAt: timestamp,
        updatedAt: timestamp,
        reviewedBy: null,
        approvedAt: null,
        rejectedReason: null,
        amountCC: computedCC,
        amountPhp: Number(amountPHP),
        paymentChannel: paymentMethod,
        requestDate: timestamp,
        senderAccountName: senderAccountName || '',
        senderAccountNumber: senderAccountNumber || '',
        accountName: senderAccountName || '',
        accountNumber: senderAccountNumber || '',
        packagePurchaseIntentId: packagePurchaseIntentId || null,
        accountPath: accountPath || null,
      }

      await db.collection('cashin_requests').doc(requestId).set(cashinData)

      // If purchase intent is provided, link and update it to CASH_IN_SUBMITTED
      if (packagePurchaseIntentId) {
        const intentRef = db
          .collection('package_purchase_intents')
          .doc(packagePurchaseIntentId)
        await intentRef.update({
          status: 'CASH_IN_SUBMITTED',
          cashInRequestId: requestId,
          updatedAt: timestamp,
        })

        // Audit Log for intent update
        await db
          .collection('audit_logs')
          .doc(`LOG-${Date.now()}-INTENT-SUB`)
          .set({
            id: `LOG-${Date.now()}-INTENT-SUB`,
            actorUid: uid,
            actorEmail: userData.email || '',
            action: 'PACKAGE_PURCHASE_INTENT_UPDATED',
            details: `Updated intent ${packagePurchaseIntentId} status to CASH_IN_SUBMITTED. Cash-in request: ${requestId}.`,
            timestamp,
          })
      }

      // Create general audit log
      await db
        .collection('audit_logs')
        .doc(`LOG-${Date.now()}-CASHIN-SUB`)
        .set({
          id: `LOG-${Date.now()}-CASHIN-SUB`,
          actorUid: uid,
          actorEmail: userData.email || '',
          action: 'PACKAGE_CASH_IN_SUBMITTED',
          details: `Submitted Cash-In of ₱${Number(amountPHP).toLocaleString()} for package ${pkg.name}. Request ID: ${requestId}.`,
          timestamp,
        })

      return { success: true, requestId }
    } catch (error: any) {
      console.error('Error in submitPackageCashInRequest:', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError(
        'internal',
        error.message || 'Failed to submit cash-in request.',
      )
    }
  },
)

/**
 * Preview Package Purchase (checks balance, loads package, calculates shortages, creates intent if short)
 */
export const previewPackagePurchase = onCall(
  { region: 'asia-southeast1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication credentials are required.',
      )
    }

    const uid = request.auth.uid
    const data = request.data || {}
    const { packageId, accountPath } = data

    if (!packageId) {
      throw new HttpsError('invalid-argument', 'Package ID is required.')
    }
    if (
      !accountPath ||
      (accountPath !== 'Smart Customer' && accountPath !== 'Affiliate')
    ) {
      throw new HttpsError(
        'invalid-argument',
        "Valid accountPath ('Smart Customer' or 'Affiliate') is required.",
      )
    }

    try {
      // 1. Load user profile
      const userDoc = await db.collection('users').doc(uid).get()
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.')
      }
      const userData = userDoc.data() || {}

      // 2. Load Chosen Wallet balance
      const walletDoc = await db.collection('wallets').doc(uid).get()
      let availableBalanceCC = 0
      if (walletDoc.exists) {
        availableBalanceCC = Number(walletDoc.data()?.chosenWalletBalance || 0)
      }

      // 3. Load approved package
      const pkg = await getPackageConfig(packageId)
      if (!pkg) {
        throw new HttpsError(
          'not-found',
          `Approved package '${packageId}' not found in canonical configuration.`,
        )
      }

      // Determine purchase type
      const currentPkg = userData.packageLevel || 'None'
      let purchaseType = 'Initial Activation'
      if (currentPkg !== 'None') {
        purchaseType = 'Upgrade'
      }

      const requiredAmountCC = pkg.cc
      const shortageCC = Math.max(requiredAmountCC - availableBalanceCC, 0)
      const remainingBalanceAfterPurchaseCC = Math.max(
        availableBalanceCC - requiredAmountCC,
        0,
      )
      const hasSufficientBalance = availableBalanceCC >= requiredAmountCC

      const timestamp = new Date().toISOString()

      // 4. Create or preserve purchase intent if balance is insufficient
      let intentId = ''
      if (!hasSufficientBalance) {
        // Deterministic idempotency identifier for intent
        const normalizedPkgId = pkg.name.toLowerCase().replace(/\s+/g, '')
        const intentVersion = 'v1'
        intentId = `package-intent:${uid}:${normalizedPkgId}:${accountPath.toLowerCase().replace(/\s+/g, '-')}:${intentVersion}`

        const intentRef = db
          .collection('package_purchase_intents')
          .doc(intentId)
        const ccRate = await getCCRate()
        const estimatedCashInPHP = shortageCC * ccRate

        const intentData = {
          intentId,
          uid,
          memberId: userData.memberId || '',
          packageId: normalizedPkgId,
          packageLevelSnapshot: pkg.name,
          packageValueCCSnapshot: pkg.cc,
          accountPath,
          requiredAmountCC,
          availableBalanceCCAtCheck: availableBalanceCC,
          shortageCCAtCheck: shortageCC,
          conversionRateSnapshot: ccRate,
          estimatedCashInPHP,
          status: 'PENDING_CASH_IN',
          createdAt: timestamp,
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 7 days expiry
          completedAt: null,
          cashInRequestId: null,
          packageTransactionId: null,
          updatedAt: timestamp,
        }

        await intentRef.set(intentData, { merge: true })

        // Create intent audit log
        await db
          .collection('audit_logs')
          .doc(`LOG-${Date.now()}-INTENT-CRE`)
          .set({
            id: `LOG-${Date.now()}-INTENT-CRE`,
            actorUid: uid,
            actorEmail: userData.email || '',
            action: 'PACKAGE_PURCHASE_INTENT_CREATED',
            details: `Created package purchase intent ${intentId} for ${pkg.name}. Shortage: ${shortageCC} CC (≈ ₱${estimatedCashInPHP.toLocaleString()}).`,
            timestamp,
          })

        // Audit Log for package balance insufficient
        await db
          .collection('audit_logs')
          .doc(`LOG-${Date.now()}-BAL-INSUFFICIENT`)
          .set({
            id: `LOG-${Date.now()}-BAL-INSUFFICIENT`,
            actorUid: uid,
            actorEmail: userData.email || '',
            action: 'PACKAGE_BALANCE_INSUFFICIENT',
            details: `Balance check for ${pkg.name} package purchase returned INSUFFICIENT. Required: ${requiredAmountCC} CC, Available: ${availableBalanceCC} CC, Shortage: ${shortageCC} CC.`,
            timestamp,
          })
      } else {
        // Audit Log for package balance checked sufficient
        await db
          .collection('audit_logs')
          .doc(`LOG-${Date.now()}-BAL-SUFFICIENT`)
          .set({
            id: `LOG-${Date.now()}-BAL-SUFFICIENT`,
            actorUid: uid,
            actorEmail: userData.email || '',
            action: 'PACKAGE_BALANCE_SUFFICIENT',
            details: `Balance check for ${pkg.name} package purchase returned SUFFICIENT. Required: ${requiredAmountCC} CC, Available: ${availableBalanceCC} CC.`,
            timestamp,
          })
      }

      // General preview audit log
      await db
        .collection('audit_logs')
        .doc(`LOG-${Date.now()}-PREVIEW`)
        .set({
          id: `LOG-${Date.now()}-PREVIEW`,
          actorUid: uid,
          actorEmail: userData.email || '',
          action: 'PACKAGE_PURCHASE_PREVIEWED',
          details: `Generated package purchase preview for ${pkg.name} (${accountPath}). Has sufficient balance: ${hasSufficientBalance}.`,
          timestamp,
        })

      return {
        success: true,
        packageId: pkg.name.toLowerCase(),
        packageLevel: pkg.name,
        packageValueCC: pkg.cc,
        availableBalanceCC,
        requiredAmountCC,
        shortageCC,
        remainingBalanceAfterPurchaseCC,
        hasSufficientBalance,
        accountPath,
        purchaseType,
        intentId: intentId || null,
        confirmationRequired: true,
      }
    } catch (error: any) {
      console.error('Error in previewPackagePurchase:', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError(
        'internal',
        error.message || 'Balance preview failed.',
      )
    }
  },
)

/**
 * Purchase Package With Wallet (atomic debit, activation, cycle creation, MSA creation, ledger transaction, compensation event)
 */
export const purchasePackageWithWallet = onCall(
  { region: 'asia-southeast1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication credentials are required.',
      )
    }

    const uid = request.auth.uid
    const data = request.data || {}
    const { packageId, accountPath, idempotencyKey } = data

    if (!packageId) {
      throw new HttpsError('invalid-argument', 'Package ID is required.')
    }
    if (
      !accountPath ||
      (accountPath !== 'Smart Customer' && accountPath !== 'Affiliate')
    ) {
      throw new HttpsError(
        'invalid-argument',
        "Valid accountPath ('Smart Customer' or 'Affiliate') is required.",
      )
    }
    if (!idempotencyKey) {
      throw new HttpsError('invalid-argument', 'Idempotency key is required.')
    }

    const normalizedPkgId = packageId.toLowerCase().trim()
    const dbIdempotencyKey = `package-purchase:${uid}:${normalizedPkgId}:${idempotencyKey}`

    try {
      const timestamp = new Date().toISOString()

      // 1. Recheck idempotency before transaction to avoid extra locks
      const preCheckIdempotency = await db
        .collection('processed_idempotencies')
        .doc(dbIdempotencyKey)
        .get()
      if (preCheckIdempotency.exists) {
        // Audit log duplicate blocked
        await db
          .collection('audit_logs')
          .doc(`LOG-${Date.now()}-DUP-BLOCKED`)
          .set({
            id: `LOG-${Date.now()}-DUP-BLOCKED`,
            actorUid: uid,
            actorEmail: '',
            action: 'PACKAGE_PURCHASE_DUPLICATE_BLOCKED',
            details: `Duplicate package purchase blocked for user ${uid}. Idempotency key: ${dbIdempotencyKey}.`,
            timestamp,
          })
        return preCheckIdempotency.data()
      }

      // 2. Execute transaction
      const transactionResult = await db.runTransaction(
        async (transaction: Transaction) => {
          // Read idempotency again inside transaction
          const idempotencyRef = db
            .collection('processed_idempotencies')
            .doc(dbIdempotencyKey)
          const idempotencySnap = await transaction.get(idempotencyRef)
          if (idempotencySnap.exists) {
            return idempotencySnap.data()
          }

          // Re-read user profile
          const userRef = db.collection('users').doc(uid)
          const userSnap = await transaction.get(userRef)
          if (!userSnap.exists) {
            throw new Error('USER_NOT_FOUND')
          }
          const userData = userSnap.data() || {}

          // Re-read wallet
          const walletRef = db.collection('wallets').doc(uid)
          const walletSnap = await transaction.get(walletRef)
          if (!walletSnap.exists) {
            throw new Error('WALLET_NOT_FOUND')
          }
          const walletData = walletSnap.data() || {}
          const availableBalanceCC = Number(walletData.chosenWalletBalance || 0)

          // Re-read package configuration
          const pkg = await getPackageConfig(packageId)
          if (!pkg) {
            throw new Error('PACKAGE_NOT_FOUND')
          }

          const requiredAmountCC = pkg.cc
          if (availableBalanceCC < requiredAmountCC) {
            throw new Error('INSUFFICIENT_BALANCE')
          }

          // Prohibit downgrade
          const currentPkgName = userData.packageLevel || 'None'
          const downgradesAreBlocked = true // Business requirement: no prohibited downgrade
          if (currentPkgName !== 'None' && downgradesAreBlocked) {
            // Map packages order to compare
            const orderMap: Record<string, number> = {
              none: 0,
              bronze: 1,
              silver: 2,
              gold: 3,
              platinum: 4,
              diamond: 5,
              'city distributor': 6,
              'regional distributor': 7,
            }
            const currentOrder = orderMap[currentPkgName.toLowerCase()] || 0
            const newOrder = orderMap[pkg.name.toLowerCase()] || 0
            if (newOrder < currentOrder) {
              throw new Error('PROHIBITED_DOWNGRADE')
            }
          }

          const balanceAfter = availableBalanceCC - requiredAmountCC
          const packageTransactionId = `PKG-TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
          const activationType =
            currentPkgName === 'None'
              ? 'INITIAL_ACCOUNT_ACTIVATION'
              : 'PACKAGE_UPGRADE_ACTIVATION'

          // Write PACKAGE_PURCHASE_DEBIT ledger record
          const ledgerRef = db
            .collection('wallet_transactions')
            .doc(packageTransactionId)
          transaction.set(ledgerRef, {
            id: packageTransactionId,
            uid,
            memberId: userData.memberId || '',
            walletType: 'Chosen Wallet',
            transactionType: 'PACKAGE_PURCHASE_DEBIT',
            direction: 'Debit',
            amount: requiredAmountCC,
            amountCC: requiredAmountCC,
            balanceBefore: availableBalanceCC,
            balanceAfter: balanceAfter,
            packageId: normalizedPkgId,
            packageLevel: pkg.name,
            accountPath,
            packageTransactionId,
            activationType,
            idempotencyKey,
            configurationVersion: 'v1',
            status: 'Completed',
            createdAt: timestamp,
            completedAt: timestamp,
            description: `Purchased ${pkg.name} Package using Chosen Wallet balance.`,
          })

          // Deduct balance from Chosen Wallet
          transaction.update(walletRef, {
            chosenWalletBalance: balanceAfter,
            updatedAt: timestamp,
          })

          // Update User accountType and packageLevel
          const isAffiliate = accountPath === 'Affiliate'
          const userUpdates: Record<string, any> = {
            accountType: isAffiliate ? 'Affiliate' : 'SmartCustomer',
            packageLevel: pkg.name,
            role: isAffiliate ? 'Affiliate' : 'Customer',
            status: 'Active',
            walletEnabled: true,
            activatedAt: timestamp,
            updatedAt: timestamp,
          }

          if (isAffiliate) {
            userUpdates.commissionEligible = true
            userUpdates.genealogyEnabled = true
            userUpdates.businessCycleEnabled = true
            userUpdates.msaStartDate = timestamp
          }
          transaction.update(userRef, userUpdates)

          // Affiliate specific writes
          if (isAffiliate) {
            // Business Cycle Doc
            const cycleRef = db.collection('business_cycles').doc(uid)
            const businessCycleId = `BC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
            const earningsCapCC = requiredAmountCC * 2.5

            transaction.set(cycleRef, {
              id: businessCycleId,
              uid,
              packageLevel: pkg.name,
              packageValueCC: requiredAmountCC,
              earningsCapCC: earningsCapCC,
              currentQualifiedEarningsCC: 0,
              remainingCapacityCC: earningsCapCC,
              progressPercentage: 0,
              status: 'Active',
              createdAt: timestamp,
              updatedAt: timestamp,
            })

            // MSA Entitlement Doc
            const msaRef = db.collection('msa_entitlements').doc(uid)
            transaction.set(msaRef, {
              uid,
              packageLevel: pkg.name,
              status: 'Active',
              startDate: timestamp,
              accruedDailyCC: 0,
              lastCreditedDate: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            })

            // Compensation Event
            const compensationEventId = `COMP-EVENT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
            transaction.set(
              db
                .collection('package_compensation_events')
                .doc(compensationEventId),
              {
                id: compensationEventId,
                uid,
                packageId: normalizedPkgId,
                packageName: pkg.name,
                packageValueCC: requiredAmountCC,
                paymentTransactionId: packageTransactionId,
                activationType,
                idempotencyKey: `package-compensation:${packageTransactionId}`,
                status: 'Pending',
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            )
          }

          // If purchase intent exists for this user and package, mark as completed
          const normalizedPkgIdNoSpaces = pkg.name
            .toLowerCase()
            .replace(/\s+/g, '')
          const intentVersion = 'v1'
          const possibleIntentId = `package-intent:${uid}:${normalizedPkgIdNoSpaces}:${accountPath.toLowerCase().replace(/\s+/g, '-')}:${intentVersion}`
          const intentRef = db
            .collection('package_purchase_intents')
            .doc(possibleIntentId)

          transaction.set(
            intentRef,
            {
              status: 'PURCHASE_COMPLETED',
              completedAt: timestamp,
              packageTransactionId,
              updatedAt: timestamp,
            },
            { merge: true },
          )

          // Create success idempotency result
          const resultPayload = {
            success: true,
            packageTransactionId,
            packageName: pkg.name,
            amountCC: requiredAmountCC,
            balanceBefore: availableBalanceCC,
            balanceAfter: balanceAfter,
            activationType,
            accountPath,
          }

          transaction.set(idempotencyRef, {
            processed: true,
            completedAt: timestamp,
            result: resultPayload,
          })

          // General audit log for purchase processing and completion
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-PURCHASE-REQ`),
            {
              id: `LOG-${Date.now()}-PURCHASE-REQ`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'PACKAGE_PURCHASE_REQUESTED',
              details: `Requested purchase of ${pkg.name} package.`,
              timestamp,
            },
          )
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-PURCHASE-PROC`),
            {
              id: `LOG-${Date.now()}-PURCHASE-PROC`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'PACKAGE_PURCHASE_PROCESSING',
              details: `Processing atomic package purchase of ${pkg.name}.`,
              timestamp,
            },
          )
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-DEBITED`),
            {
              id: `LOG-${Date.now()}-DEBITED`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'PACKAGE_PURCHASE_DEBITED',
              details: `Debited ${requiredAmountCC} CC for ${pkg.name} package. Transaction ID: ${packageTransactionId}.`,
              timestamp,
            },
          )
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-PURCHASE-COMP`),
            {
              id: `LOG-${Date.now()}-PURCHASE-COMP`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'PACKAGE_PURCHASE_COMPLETED',
              details: `Successfully completed purchase of ${pkg.name} package. Account activated as ${accountPath}.`,
              timestamp,
            },
          )
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-ACT-UPD`),
            {
              id: `LOG-${Date.now()}-ACT-UPD`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'ACCOUNT_TYPE_UPDATED',
              details: `Updated user accountType to '${accountPath}' and packageLevel to '${pkg.name}'.`,
              timestamp,
            },
          )
          transaction.set(
            db.collection('audit_logs').doc(`LOG-${Date.now()}-PKG-ACT`),
            {
              id: `LOG-${Date.now()}-PKG-ACT`,
              actorUid: uid,
              actorEmail: userData.email || '',
              action: 'PACKAGE_ACTIVATED',
              details: `Activated ${pkg.name} package subscription.`,
              timestamp,
            },
          )

          if (isAffiliate) {
            transaction.set(
              db.collection('audit_logs').doc(`LOG-${Date.now()}-BC-CRE`),
              {
                id: `LOG-${Date.now()}-BC-CRE`,
                actorUid: uid,
                actorEmail: userData.email || '',
                action: 'BUSINESS_CYCLE_CREATED',
                details: `Created Business Cycle for Affiliate track. Cap: ${requiredAmountCC * 2.5} CC.`,
                timestamp,
              },
            )
            transaction.set(
              db.collection('audit_logs').doc(`LOG-${Date.now()}-MSA-ACT`),
              {
                id: `LOG-${Date.now()}-MSA-ACT`,
                actorUid: uid,
                actorEmail: userData.email || '',
                action: 'MSA_ENTITLEMENT_ACTIVATED',
                details: `Activated MSA entitlement for ${pkg.name} package.`,
                timestamp,
              },
            )
            transaction.set(
              db.collection('audit_logs').doc(`LOG-${Date.now()}-COMP-CRE`),
              {
                id: `LOG-${Date.now()}-COMP-CRE`,
                actorUid: uid,
                actorEmail: userData.email || '',
                action: 'COMPENSATION_EVENT_CREATED',
                details: `Registered package compensation source event for genealogy.`,
                timestamp,
              },
            )
          }

          return resultPayload
        },
      )

      return transactionResult
    } catch (error: any) {
      console.error('Error in purchasePackageWithWallet:', error)
      const errMsg = error.message || ''

      // Write failed audit log
      await db
        .collection('audit_logs')
        .doc(`LOG-${Date.now()}-PURCHASE-FAIL`)
        .set({
          id: `LOG-${Date.now()}-PURCHASE-FAIL`,
          actorUid: uid,
          actorEmail: '',
          action: 'PACKAGE_PURCHASE_FAILED',
          details: `Failed purchase of package ${packageId}. Error: ${errMsg}.`,
          timestamp: new Date().toISOString(),
        })

      if (errMsg === 'USER_NOT_FOUND') {
        throw new HttpsError('not-found', 'User profile not found.')
      }
      if (errMsg === 'WALLET_NOT_FOUND') {
        throw new HttpsError('not-found', 'User wallet profile not found.')
      }
      if (errMsg === 'PACKAGE_NOT_FOUND') {
        throw new HttpsError(
          'not-found',
          `Approved package '${packageId}' not found in canonical configuration.`,
        )
      }
      if (errMsg === 'PROHIBITED_DOWNGRADE') {
        throw new HttpsError(
          'failed-precondition',
          'Prohibited downgrade. You cannot select a package lower than your current active level.',
        )
      }
      if (errMsg === 'INSUFFICIENT_BALANCE') {
        // Reload values to construct precise Failed Precondition response
        const walletDoc = await db.collection('wallets').doc(uid).get()
        const walletBalance = walletDoc.exists
          ? Number(walletDoc.data()?.chosenWalletBalance || 0)
          : 0
        const pkg = await getPackageConfig(packageId)
        const reqAmount = pkg ? pkg.cc : 0
        const shortage = Math.max(reqAmount - walletBalance, 0)

        throw new HttpsError(
          'failed-precondition',
          'Insufficient Chosen Wallet balance.',
          {
            reason: 'INSUFFICIENT_CHOSEN_WALLET_BALANCE',
            requiredAmountCC: reqAmount,
            availableBalanceCC: walletBalance,
            shortageCC: shortage,
            packageId,
            accountPath,
          },
        )
      }

      throw new HttpsError(
        'internal',
        error.message || 'Purchase transaction failed.',
      )
    }
  },
)

/**
 * Approve Cash-In (credits Chosen Wallet, links intent, updates intent status to READY_TO_PURCHASE when balance is sufficient)
 */
export const approveCashInAndActivatePackage = onCall(
  { region: 'asia-southeast1' },
  async (request: any) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Request is missing authentication credentials.',
      )
    }

    const adminUid = request.auth.uid
    const data = request.data || {}
    const requestId =
      typeof data.requestId === 'string' ? data.requestId.trim() : ''

    if (!requestId) {
      throw new HttpsError('invalid-argument', 'Request ID is required.')
    }

    const timestamp = new Date().toISOString()
    const idempotencyKey = `cash-in-approval:${requestId}`

    try {
      // 1. Verify admin permissions outside the settlement transaction.
      const adminDoc = await db.collection('users').doc(adminUid).get()
      if (!adminDoc.exists) {
        throw new HttpsError(
          'permission-denied',
          'Admin user profile not found.',
        )
      }

      const adminData = adminDoc.data() || {}
      const adminRole = String(adminData.role || '').trim()
      if (adminRole !== 'Admin' && adminRole !== 'Super Admin') {
        throw new HttpsError(
          'permission-denied',
          'Unauthorized. Only Admin and Super Admin can approve cash-in requests.',
        )
      }

      const adminFullName = String(adminData.fullName || 'Admin')
      const adminEmail = String(adminData.email || '')

      // Fast idempotency pre-check. The transaction repeats this read.
      const idempotencyRef = db
        .collection('processed_idempotencies')
        .doc(idempotencyKey)
      const preCheckIdempotency = await idempotencyRef.get()
      if (preCheckIdempotency.exists) {
        const existing = preCheckIdempotency.data() || {}
        return existing.result || existing
      }

      // 2. Atomically approve the request and credit the Chosen Wallet.
      const transactionResult = await db.runTransaction(
        async (transaction: Transaction) => {
          const requestRef = db.collection('cashin_requests').doc(requestId)

          // Firestore requires every read to happen before the first write.
          const idempotencySnap = await transaction.get(idempotencyRef)
          if (idempotencySnap.exists) {
            const existing = idempotencySnap.data() || {}
            return existing.result || existing
          }

          const requestSnap = await transaction.get(requestRef)
          if (!requestSnap.exists) {
            throw new Error('CASHIN_REQUEST_NOT_FOUND')
          }

          const reqData = requestSnap.data() || {}
          const requestStatus = String(reqData.status || '')
            .trim()
            .toLowerCase()
          if (requestStatus !== 'pending' && requestStatus !== 'submitted') {
            throw new Error('CASHIN_REQUEST_NOT_PENDING')
          }

          const targetUid =
            typeof reqData.uid === 'string' ? reqData.uid.trim() : ''
          if (!targetUid) {
            throw new Error('INVALID_CASHIN_TARGET_UID')
          }

          const amountCC = Number(
            reqData.amountCC ?? reqData.computedCC ?? Number.NaN,
          )
          if (!Number.isFinite(amountCC) || amountCC <= 0) {
            throw new Error('INVALID_CASHIN_AMOUNT')
          }

          const amountPHP = Number(reqData.amountPHP ?? reqData.amountPhp ?? 0)
          if (!Number.isFinite(amountPHP) || amountPHP < 0) {
            throw new Error('INVALID_CASHIN_PHP_AMOUNT')
          }

          const userRef = db.collection('users').doc(targetUid)
          const walletRef = db.collection('wallets').doc(targetUid)

          let linkedIntentId =
            typeof reqData.packagePurchaseIntentId === 'string' &&
            reqData.packagePurchaseIntentId.trim()
              ? reqData.packagePurchaseIntentId.trim()
              : null

          if (!linkedIntentId && reqData.packageId && reqData.accountPath) {
            const normalizedPkgIdNoSpaces = String(reqData.packageId)
              .toLowerCase()
              .replace(/\s+/g, '')
            const normalizedAccountPath = String(reqData.accountPath)
              .toLowerCase()
              .replace(/\s+/g, '-')
            linkedIntentId = `package-intent:${targetUid}:${normalizedPkgIdNoSpaces}:${normalizedAccountPath}:v1`
          }

          const intentRef = linkedIntentId
            ? db.collection('package_purchase_intents').doc(linkedIntentId)
            : null

          // Complete all remaining reads before any update/set operation.
          const userSnap = await transaction.get(userRef)
          if (!userSnap.exists) {
            throw new Error('USER_NOT_FOUND')
          }

          const walletSnap = await transaction.get(walletRef)
          const intentSnap = intentRef ? await transaction.get(intentRef) : null

          const userData = userSnap.data() || {}

          let balanceBefore = 0
          if (walletSnap.exists) {
            balanceBefore = Number(walletSnap.data()?.chosenWalletBalance ?? 0)
            if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
              throw new Error('INVALID_WALLET_BALANCE')
            }
          }

          const balanceAfter = Number((balanceBefore + amountCC).toFixed(4))
          let isReadyToPurchase = false
          let intentUpdatedStatus: string | null = null
          let requiredAmountCC = 0

          if (intentSnap?.exists) {
            const intentData = intentSnap.data() || {}
            requiredAmountCC = Number(intentData.requiredAmountCC ?? 0)
            if (!Number.isFinite(requiredAmountCC) || requiredAmountCC < 0) {
              throw new Error('INVALID_PURCHASE_INTENT_AMOUNT')
            }

            isReadyToPurchase = balanceAfter >= requiredAmountCC
            intentUpdatedStatus = isReadyToPurchase
              ? 'READY_TO_PURCHASE'
              : 'CASH_IN_APPROVED'
          }

          // All reads are complete. Writes begin here.
          transaction.update(requestRef, {
            status: 'Approved',
            paymentStatus: 'APPROVED',
            amountCC,
            computedCC: amountCC,
            amountPHP,
            amountPhp: amountPHP,
            requestedAt:
              reqData.requestedAt ||
              reqData.requestDate ||
              reqData.createdAt ||
              timestamp,
            requestDate:
              reqData.requestDate ||
              reqData.requestedAt ||
              reqData.createdAt ||
              timestamp,
            approvedAt: timestamp,
            approvedBy: adminFullName,
            reviewedBy: adminUid,
            updatedAt: timestamp,
            rejectedReason: null,
          })

          if (!walletSnap.exists) {
            transaction.set(walletRef, {
              uid: targetUid,
              chosenWalletBalance: balanceAfter,
              commissionWalletBalance: 0,
              marketingSupportWalletBalance: 0,
              rewardWalletBalance: 0,
              cashWalletStatus: 'Active',
              walletVersion: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
          } else {
            const walletData = walletSnap.data() || {}
            transaction.update(walletRef, {
              chosenWalletBalance: balanceAfter,
              cashWalletStatus: 'Active',
              walletVersion: Number(walletData.walletVersion || 0) + 1,
              updatedAt: timestamp,
            })
          }

          const ledgerTxId = `TX-CREDIT-${Date.now()}-${Math.floor(
            100 + Math.random() * 900,
          )}`
          const walletTxRef = db
            .collection('wallet_transactions')
            .doc(ledgerTxId)

          transaction.set(walletTxRef, {
            id: ledgerTxId,
            uid: targetUid,
            memberId: String(userData.memberId || ''),
            amount: amountCC,
            amountCC,
            direction: 'Credit',
            type: 'CREDIT',
            walletType: 'Chosen Wallet',
            transactionType: 'CASH_IN_CREDIT',
            balanceBefore,
            balanceAfter,
            sourceType: 'CASH_IN',
            sourceId: requestId,
            referenceNumber: String(reqData.referenceNumber || requestId),
            description: `Approved Cash-In of ₱${amountPHP.toLocaleString()} (Credited ${amountCC} CC)`,
            status: 'Completed',
            createdAt: timestamp,
            completedAt: timestamp,
            timestamp,
          })

          if (intentRef && intentSnap?.exists && intentUpdatedStatus) {
            transaction.update(intentRef, {
              status: intentUpdatedStatus,
              cashInRequestId: requestId,
              availableBalanceCCAtCheck: balanceAfter,
              shortageCCAtCheck: Math.max(requiredAmountCC - balanceAfter, 0),
              updatedAt: timestamp,
            })

            const intentAuditId = `LOG-${Date.now()}-INTENT-UPD`
            transaction.set(db.collection('audit_logs').doc(intentAuditId), {
              id: intentAuditId,
              actorUid: adminUid,
              actorEmail: adminEmail,
              action: 'PACKAGE_PURCHASE_INTENT_UPDATED',
              details: `Updated package purchase intent ${linkedIntentId} status to ${intentUpdatedStatus}.`,
              timestamp,
            })

            if (isReadyToPurchase) {
              const readyAuditId = `LOG-${Date.now()}-READY-PUR`
              transaction.set(db.collection('audit_logs').doc(readyAuditId), {
                id: readyAuditId,
                actorUid: targetUid,
                actorEmail: String(userData.email || ''),
                action: 'PACKAGE_READY_TO_PURCHASE',
                details: `Package purchase intent ${linkedIntentId} is READY_TO_PURCHASE with balance ${balanceAfter} CC.`,
                timestamp,
              })
            }
          }

          const auditLogId = `LOG-${Date.now()}-APPROVE`
          transaction.set(db.collection('audit_logs').doc(auditLogId), {
            id: auditLogId,
            actorUid: adminUid,
            actorEmail: adminEmail,
            action: 'CASH_IN_APPROVED',
            details: `Approved Cash-In of ₱${amountPHP.toLocaleString()} (Credited ${amountCC} CC) for ${String(
              userData.fullName || targetUid,
            )} (${targetUid}).`,
            metadata: {
              requestId,
              targetUid,
              amountCC,
              amountPHP,
              ledgerTransactionId: ledgerTxId,
              linkedIntentId,
              isReadyToPurchase,
            },
            timestamp,
          })

          const resultPayload = {
            success: true,
            requestId,
            ledgerTransactionId: ledgerTxId,
            isReadyToPurchase,
            creditedCC: amountCC,
            balanceBefore,
            balanceAfter,
          }

          transaction.set(idempotencyRef, {
            processed: true,
            completedAt: timestamp,
            result: resultPayload,
          })

          return resultPayload
        },
      )

      return transactionResult
    } catch (error: any) {
      console.error('Error in approveCashInAndActivatePackage:', error)

      if (error instanceof HttpsError) {
        throw error
      }

      const errMsg = error?.message || ''

      if (errMsg === 'CASHIN_REQUEST_NOT_FOUND') {
        throw new HttpsError('not-found', 'Cash-in request record not found.')
      }

      if (errMsg === 'CASHIN_REQUEST_NOT_PENDING') {
        throw new HttpsError(
          'failed-precondition',
          'Cash-in request is no longer pending.',
        )
      }

      if (errMsg === 'USER_NOT_FOUND') {
        throw new HttpsError(
          'not-found',
          'The user profile associated with this request could not be found.',
        )
      }

      if (errMsg === 'INVALID_CASHIN_TARGET_UID') {
        throw new HttpsError(
          'failed-precondition',
          'The Cash-In request is not linked to a valid member account.',
        )
      }

      if (
        errMsg === 'INVALID_CASHIN_AMOUNT' ||
        errMsg === 'INVALID_CASHIN_PHP_AMOUNT'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The Cash-In request contains an invalid payment or Chosen Credit amount.',
        )
      }

      if (errMsg === 'INVALID_WALLET_BALANCE') {
        throw new HttpsError(
          'failed-precondition',
          'The member wallet balance requires administrative review.',
        )
      }

      if (errMsg === 'INVALID_PURCHASE_INTENT_AMOUNT') {
        throw new HttpsError(
          'failed-precondition',
          'The linked package purchase intent contains an invalid required amount.',
        )
      }

      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Approval process failed.',
      )
    }
  },
)

interface ExecuteP2PTransferRequest {
  recipientMemberId: string
  amountCC: number
  memo?: string
  idempotencyKey: string
}

interface ExecuteP2PTransferResult {
  success: true
  transferId: string
  feeTransactionId: string
  amountCC: number
  feeCC: number
  totalDebitCC: number
  recipientName: string
  recipientId: string
  referenceId: string
  createdAt: string
  status: 'Completed'
  isDuplicate?: boolean
  message?: string
}

function normalizeMemberId(value: string): string {
  return value.trim().toUpperCase()
}

function displayMemberId(value: unknown): string {
  const normalized = normalizeMemberId(String(value || ''))
  return normalized.startsWith('IAM-') ? normalized : `IAM-${normalized}`
}

function isActiveAccountStatus(value: unknown): boolean {
  return (
    String(value || '')
      .trim()
      .toLowerCase() === 'active'
  )
}

function hasSupportedCCPrecision(value: number): boolean {
  const scaledValue = Math.round(value * 10000)
  return Math.abs(value - scaledValue / 10000) <= 1e-9
}

function createP2PRequestFingerprint(input: {
  senderUid: string
  recipientUid: string
  recipientMemberId: string
  amountCC: number
  memo: string | null
  idempotencyKey: string
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function deterministicP2PId(idempotencyKey: string, suffix: string): string {
  const keyHash = createHash('sha256')
    .update(idempotencyKey)
    .digest('hex')
    .slice(0, 24)
    .toUpperCase()

  return `${suffix}-${keyHash}`
}

async function recordP2PFailureAudit(input: {
  senderUid: string
  recipientMemberId: string
  amountCC: number
  idempotencyKey: string
  failureCategory: string
}): Promise<void> {
  try {
    const logId = deterministicP2PId(
      `${input.idempotencyKey}:${Date.now()}`,
      'LOG-P2P-FAILED',
    )

    await db
      .collection('audit_logs')
      .doc(logId)
      .set({
        id: logId,
        actorUid: input.senderUid,
        actorEmail: '',
        action: 'P2P_TRANSFER_FAILED',
        details:
          `P2P transfer ${input.idempotencyKey} failed. ` +
          `Recipient: ${input.recipientMemberId}. ` +
          `Amount: ${input.amountCC} CC. ` +
          `Category: ${input.failureCategory}.`,
        metadata: {
          recipientMemberId: input.recipientMemberId,
          amountCC: input.amountCC,
          idempotencyKey: input.idempotencyKey,
          failureCategory: input.failureCategory,
        },
        timestamp: new Date().toISOString(),
      })
  } catch (auditError) {
    console.error('Unable to record P2P failure audit', {
      senderUid: input.senderUid,
      idempotencyKey: input.idempotencyKey,
      error:
        auditError instanceof Error ? auditError.message : String(auditError),
    })
  }
}

/**
 * Execute an atomic P2P Chosen Credit transfer.
 *
 * The browser submits only:
 * - recipientMemberId
 * - amountCC
 * - memo
 * - idempotencyKey
 *
 * All identity resolution, fee configuration, wallet mutation, treasury
 * crediting, ledgers, audit records, and idempotency are server-authoritative.
 */
export const executeP2PTransferV2 = onCall<ExecuteP2PTransferRequest>(
  { region: FUNCTIONS_REGION },
  async (
    request: CallableRequest<ExecuteP2PTransferRequest>,
  ): Promise<ExecuteP2PTransferResult> => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Unable to verify your session. Please sign in again.',
      )
    }

    const startedAtMs = Date.now()
    const senderUid = request.auth.uid
    const data = request.data

    if (!data || typeof data !== 'object') {
      throw new HttpsError(
        'invalid-argument',
        'Transfer request data is required.',
      )
    }

    const allowedFields = new Set([
      'recipientMemberId',
      'amountCC',
      'memo',
      'idempotencyKey',
    ])

    const unexpectedFields = Object.keys(data).filter(
      (field) => !allowedFields.has(field),
    )

    if (unexpectedFields.length > 0) {
      throw new HttpsError(
        'invalid-argument',
        'The transfer request contains unsupported fields.',
      )
    }

    const { recipientMemberId, amountCC, memo, idempotencyKey } = data

    if (
      typeof recipientMemberId !== 'string' ||
      recipientMemberId.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'The recipient member ID is required.',
      )
    }

    const normalizedRecipientMemberId = normalizeMemberId(recipientMemberId)

    if (typeof amountCC !== 'number' || !Number.isFinite(amountCC)) {
      throw new HttpsError(
        'invalid-argument',
        'The transfer amount must be a valid number.',
      )
    }

    if (amountCC < 1) {
      throw new HttpsError(
        'invalid-argument',
        'Minimum transfer amount is 1 CC.',
      )
    }

    if (amountCC > 50000) {
      throw new HttpsError(
        'invalid-argument',
        'Maximum transfer amount is 50,000 CC.',
      )
    }

    if (!hasSupportedCCPrecision(amountCC)) {
      throw new HttpsError(
        'invalid-argument',
        'The transfer amount exceeds the supported precision of four decimal places.',
      )
    }

    const normalizedAmountCC = Math.round(amountCC * 10000) / 10000

    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'The idempotency key is required.',
      )
    }

    const canonicalIdempotencyPattern = /^P2P-TX-\d{10,17}-[A-Z0-9]{6,16}$/

    if (
      idempotencyKey.length > 128 ||
      !canonicalIdempotencyPattern.test(idempotencyKey)
    ) {
      throw new HttpsError(
        'invalid-argument',
        'The idempotency key has an invalid format.',
      )
    }

    if (memo !== undefined && typeof memo !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'The transfer memo must be text.',
      )
    }

    const cleanMemo =
      typeof memo === 'string' && memo.trim().length > 0 ? memo.trim() : null

    if (cleanMemo && cleanMemo.length > 100) {
      throw new HttpsError(
        'invalid-argument',
        'The transfer memo cannot exceed 100 characters.',
      )
    }

    console.info('P2P transfer request received', {
      idempotencyKey,
      senderUid,
      recipientMemberId: normalizedRecipientMemberId,
      amountCC: normalizedAmountCC,
    })

    try {
      // Server-authoritative maintenance preflight.
      //
      // This check intentionally runs before recipient lookup so a disabled
      // Transfer Gate returns the maintenance response without resolving or
      // disclosing whether a recipient member ID exists. The same checks
      // remain inside the settlement transaction to prevent a configuration
      // change between preflight and atomic completion.
      const preflightSettingsSnapshot = await db
        .collection('system_config')
        .doc('cc_settings')
        .get()

      if (!preflightSettingsSnapshot.exists) {
        throw new Error('MISSING_CC_SETTINGS')
      }

      const preflightSettings = preflightSettingsSnapshot.data() || {}

      if (preflightSettings.isActive !== true) {
        throw new Error('INACTIVE_CC_SETTINGS')
      }

      if (preflightSettings.p2pTransfersEnabled !== true) {
        throw new Error('P2P_TRANSFERS_DISABLED')
      }

      // Resolve by member ID using the Admin SDK. Browser clients must not
      // query the private users collection for P2P recipient resolution.
      const recipientQuerySnapshot = await db
        .collection('users')
        .where('memberId', '==', normalizedRecipientMemberId)
        .limit(2)
        .get()

      if (recipientQuerySnapshot.empty) {
        throw new HttpsError(
          'not-found',
          'The recipient account is unavailable.',
        )
      }

      if (recipientQuerySnapshot.size > 1) {
        throw new Error('DUPLICATE_RECIPIENT_MEMBER_ID')
      }

      const recipientUid = recipientQuerySnapshot.docs[0].id

      if (recipientUid === senderUid) {
        throw new HttpsError(
          'invalid-argument',
          'You cannot transfer credits to yourself.',
        )
      }

      const requestFingerprint = createP2PRequestFingerprint({
        senderUid,
        recipientUid,
        recipientMemberId: normalizedRecipientMemberId,
        amountCC: normalizedAmountCC,
        memo: cleanMemo,
        idempotencyKey,
      })

      const transferResult = await db.runTransaction(
        async (transaction: Transaction): Promise<ExecuteP2PTransferResult> => {
          const transferRef = db.collection('p2p_transfers').doc(idempotencyKey)

          const senderUserRef = db.collection('users').doc(senderUid)

          const recipientUserRef = db.collection('users').doc(recipientUid)

          const senderWalletRef = db.collection('wallets').doc(senderUid)

          const recipientWalletRef = db.collection('wallets').doc(recipientUid)

          const ccSettingsRef = db
            .collection('system_config')
            .doc('cc_settings')

          const treasuryRef = db
            .collection('system_treasuries')
            .doc(TECHNOLOGY_OPERATIONS_TREASURY_ID)

          // Firestore requires all reads to occur before any writes.
          const transferSnapshot = await transaction.get(transferRef)

          if (transferSnapshot.exists) {
            const existing = transferSnapshot.data() || {}

            const legacyRequestMatches =
              existing.senderUid === senderUid &&
              normalizeMemberId(String(existing.recipientMemberId || '')) ===
                normalizedRecipientMemberId &&
              Number(existing.amountCC) === normalizedAmountCC &&
              (existing.memo ?? null) === cleanMemo

            const fingerprintMatches =
              existing.requestFingerprint === requestFingerprint

            if (
              existing.status === 'Completed' &&
              (fingerprintMatches || legacyRequestMatches)
            ) {
              return {
                success: true,
                transferId: idempotencyKey,
                feeTransactionId: String(existing.feeTransactionId || ''),
                amountCC: Number(existing.amountCC),
                feeCC: Number(
                  existing.platformTransferFeeCC ??
                    existing.feeCC ??
                    CANONICAL_P2P_TRANSFER_FEE_CC,
                ),
                totalDebitCC: Number(existing.totalDebitCC),
                recipientName: String(existing.recipientName || ''),
                recipientId: String(
                  existing.recipientMemberId || normalizedRecipientMemberId,
                ),
                referenceId: idempotencyKey,
                createdAt: String(
                  existing.completedAt ||
                    existing.createdAt ||
                    new Date().toISOString(),
                ),
                status: 'Completed',
                isDuplicate: true,
                message: 'This transfer was already completed.',
              }
            }

            throw new Error('IDEMPOTENCY_KEY_CONFLICT')
          }

          const senderUserSnapshot = await transaction.get(senderUserRef)

          const recipientUserSnapshot = await transaction.get(recipientUserRef)

          const senderWalletSnapshot = await transaction.get(senderWalletRef)

          const recipientWalletSnapshot =
            await transaction.get(recipientWalletRef)

          const ccSettingsSnapshot = await transaction.get(ccSettingsRef)

          const treasurySnapshot = await transaction.get(treasuryRef)

          if (!senderUserSnapshot.exists) {
            throw new Error('SENDER_NOT_FOUND')
          }

          if (!recipientUserSnapshot.exists) {
            throw new Error('RECIPIENT_NOT_FOUND')
          }

          if (!senderWalletSnapshot.exists) {
            throw new Error('SENDER_WALLET_NOT_INITIALIZED')
          }

          if (!recipientWalletSnapshot.exists) {
            throw new Error('RECIPIENT_WALLET_NOT_INITIALIZED')
          }

          if (!ccSettingsSnapshot.exists) {
            throw new Error('MISSING_CC_SETTINGS')
          }

          const senderUser = senderUserSnapshot.data() || {}

          const recipientUser = recipientUserSnapshot.data() || {}

          const senderWallet = senderWalletSnapshot.data() || {}

          const recipientWallet = recipientWalletSnapshot.data() || {}

          const ccSettings = ccSettingsSnapshot.data() || {}

          const storedRecipientMemberId = normalizeMemberId(
            String(recipientUser.memberId || ''),
          )

          if (storedRecipientMemberId !== normalizedRecipientMemberId) {
            throw new Error('RECIPIENT_MEMBER_ID_CHANGED')
          }

          if (!isActiveAccountStatus(senderUser.status)) {
            throw new Error('SENDER_INACTIVE')
          }

          if (!isActiveAccountStatus(recipientUser.status)) {
            throw new Error('RECIPIENT_INACTIVE')
          }

          if (senderUser.walletEnabled === false) {
            throw new Error('SENDER_WALLET_DISABLED')
          }

          if (ccSettings.isActive !== true) {
            throw new Error('INACTIVE_CC_SETTINGS')
          }
          if (ccSettings.p2pTransfersEnabled !== true) {
            throw new Error('P2P_TRANSFERS_DISABLED')
          }

          if (ccSettings.transferFeeEnabled === false) {
            throw new Error('INACTIVE_TRANSFER_FEE')
          }

          const feeCC = Number(ccSettings.p2pTransferFeeCC)

          if (!Number.isFinite(feeCC) || feeCC <= 0) {
            throw new Error('INVALID_FEE_VALUE')
          }

          if (feeCC !== CANONICAL_P2P_TRANSFER_FEE_CC) {
            throw new Error('FEE_VALUE_CONFLICT')
          }

          const configVersion = Number(ccSettings.version)

          if (!Number.isInteger(configVersion) || configVersion < 1) {
            throw new Error('INVALID_FEE_CONFIG_VERSION')
          }

          const senderBalance = Number(senderWallet.chosenWalletBalance)

          const recipientBalance = Number(recipientWallet.chosenWalletBalance)

          if (!Number.isFinite(senderBalance) || senderBalance < 0) {
            throw new Error('INVALID_SENDER_WALLET_BALANCE')
          }

          if (!Number.isFinite(recipientBalance) || recipientBalance < 0) {
            throw new Error('INVALID_RECIPIENT_WALLET_BALANCE')
          }

          const totalDebitCC =
            Math.round((normalizedAmountCC + feeCC) * 10000) / 10000

          if (senderBalance < totalDebitCC) {
            throw new Error('INSUFFICIENT_BALANCE')
          }

          const treasuryData = treasurySnapshot.exists
            ? treasurySnapshot.data() || {}
            : {}

          if (
            treasurySnapshot.exists &&
            String(treasuryData.status || '').toUpperCase() !== 'ACTIVE'
          ) {
            throw new Error('TREASURY_INACTIVE')
          }

          const treasuryBalance = treasurySnapshot.exists
            ? Number(treasuryData.balanceCC)
            : 0

          if (!Number.isFinite(treasuryBalance) || treasuryBalance < 0) {
            throw new Error('INVALID_TREASURY_BALANCE')
          }

          const newSenderBalance =
            Math.round((senderBalance - totalDebitCC) * 10000) / 10000

          const senderBalanceAfterTransfer =
            Math.round((senderBalance - normalizedAmountCC) * 10000) / 10000

          const newRecipientBalance =
            Math.round((recipientBalance + normalizedAmountCC) * 10000) / 10000

          const newTreasuryBalance =
            Math.round((treasuryBalance + feeCC) * 10000) / 10000

          const timestamp = new Date().toISOString()

          const senderTransferLedgerId = deterministicP2PId(
            idempotencyKey,
            'TX-P2P-SENDER',
          )

          const senderFeeLedgerId = deterministicP2PId(
            idempotencyKey,
            'TX-P2P-FEE',
          )

          const recipientCreditLedgerId = deterministicP2PId(
            idempotencyKey,
            'TX-P2P-RECIPIENT',
          )

          const treasuryCreditLedgerId = deterministicP2PId(
            idempotencyKey,
            'TX-P2P-TREASURY',
          )

          const feeTransactionId = deterministicP2PId(idempotencyKey, 'FEE-P2P')

          const auditLogId = deterministicP2PId(
            idempotencyKey,
            'LOG-P2P-COMPLETED',
          )

          // Wallet balance updates.
          transaction.update(senderWalletRef, {
            chosenWalletBalance: newSenderBalance,
            walletVersion: Number(senderWallet.walletVersion || 0) + 1,
            updatedAt: timestamp,
          })

          transaction.update(recipientWalletRef, {
            chosenWalletBalance: newRecipientBalance,
            walletVersion: Number(recipientWallet.walletVersion || 0) + 1,
            updatedAt: timestamp,
          })

          if (treasurySnapshot.exists) {
            transaction.update(treasuryRef, {
              balanceCC: newTreasuryBalance,
              treasuryVersion: Number(treasuryData.treasuryVersion || 0) + 1,
              updatedAt: timestamp,
            })
          } else {
            transaction.set(treasuryRef, {
              id: TECHNOLOGY_OPERATIONS_TREASURY_ID,
              displayName: 'Technology Operations Treasury',
              accountType: 'SYSTEM_TREASURY',
              classification: 'CORPORATE_TECHNOLOGY_REVENUE',
              status: 'ACTIVE',
              balanceCC: newTreasuryBalance,
              treasuryVersion: 1,
              isMemberWallet: false,
              isCommissionWallet: false,
              isPubliclyVisible: false,
              countsTowardBusinessCycle: false,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
          }

          // Public/member-readable transfer record.
          // It deliberately excludes internal treasury ownership.
          transaction.set(transferRef, {
            id: idempotencyKey,
            transferId: idempotencyKey,
            idempotencyKey,
            requestFingerprint,
            senderUid,
            senderMemberId: String(senderUser.memberId || ''),
            recipientUid,
            recipientMemberId: storedRecipientMemberId,
            recipientName: String(recipientUser.fullName || ''),
            amountCC: normalizedAmountCC,
            platformTransferFeeCC: feeCC,
            totalDebitCC,
            feePayerUid: senderUid,
            publicFeeLabel: 'Platform Transfer Fee',
            memo: cleanMemo,
            status: 'Completed',
            completedAt: timestamp,
            createdAt: timestamp,
            initiatedBy: senderUid,
            source: 'P2P_TRANSFER_GATE',
            configVersion,
            feeTransactionId,
            senderTransferLedgerId,
            senderFeeLedgerId,
            recipientCreditLedgerId,
            transferType: 'P2P_TRANSFER',
          })

          transaction.set(
            db.collection('wallet_transactions').doc(senderTransferLedgerId),
            {
              id: senderTransferLedgerId,
              uid: senderUid,
              memberId: String(senderUser.memberId || ''),
              amount: normalizedAmountCC,
              amountCC: normalizedAmountCC,
              type: 'DEBIT',
              direction: 'Debit',
              walletType: 'Chosen Wallet',
              transactionType: 'TRANSFER_DEBIT',
              balanceBefore: senderBalance,
              balanceAfter: senderBalanceAfterTransfer,
              sourceTransferId: idempotencyKey,
              sourceTransferType: 'P2P_TRANSFER',
              payerUid: senderUid,
              receiverUid: recipientUid,
              status: 'Completed',
              referenceNumber: idempotencyKey,
              description: `Transfer to ${displayMemberId(
                storedRecipientMemberId,
              )}`,
              idempotencyKey: `${idempotencyKey}:sender-transfer-debit`,
              createdAt: timestamp,
              completedAt: timestamp,
            },
          )

          transaction.set(
            db.collection('wallet_transactions').doc(senderFeeLedgerId),
            {
              id: senderFeeLedgerId,
              uid: senderUid,
              memberId: String(senderUser.memberId || ''),
              amount: feeCC,
              amountCC: feeCC,
              type: 'DEBIT',
              direction: 'Debit',
              walletType: 'Chosen Wallet',
              transactionType: 'PLATFORM_TRANSFER_FEE_DEBIT',
              balanceBefore: senderBalanceAfterTransfer,
              balanceAfter: newSenderBalance,
              sourceTransferId: idempotencyKey,
              sourceTransferType: 'P2P_TRANSFER',
              sourceFeeTransactionId: feeTransactionId,
              payerUid: senderUid,
              receiverUid: recipientUid,
              feeConfigurationVersion: configVersion,
              publicFeeLabel: 'Platform Transfer Fee',
              status: 'Completed',
              referenceNumber: idempotencyKey,
              description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
              idempotencyKey: `${idempotencyKey}:sender-fee-debit`,
              createdAt: timestamp,
              completedAt: timestamp,
            },
          )

          transaction.set(
            db.collection('wallet_transactions').doc(recipientCreditLedgerId),
            {
              id: recipientCreditLedgerId,
              uid: recipientUid,
              memberId: String(recipientUser.memberId || ''),
              amount: normalizedAmountCC,
              amountCC: normalizedAmountCC,
              type: 'CREDIT',
              direction: 'Credit',
              walletType: 'Chosen Wallet',
              transactionType: 'TRANSFER_CREDIT',
              balanceBefore: recipientBalance,
              balanceAfter: newRecipientBalance,
              sourceTransferId: idempotencyKey,
              sourceTransferType: 'P2P_TRANSFER',
              payerUid: senderUid,
              receiverUid: recipientUid,
              status: 'Completed',
              referenceNumber: idempotencyKey,
              description: `Transfer from ${displayMemberId(
                senderUser.memberId,
              )}`,
              idempotencyKey: `${idempotencyKey}:recipient-transfer-credit`,
              createdAt: timestamp,
              completedAt: timestamp,
            },
          )

          transaction.set(
            db.collection('wallet_transactions').doc(treasuryCreditLedgerId),
            {
              id: treasuryCreditLedgerId,
              systemAccountId: TECHNOLOGY_OPERATIONS_TREASURY_ID,
              amount: feeCC,
              amountCC: feeCC,
              type: 'CREDIT',
              direction: 'Credit',
              walletType: 'System Treasury',
              transactionType: 'TECHNOLOGY_TREASURY_FEE_CREDIT',
              balanceBefore: treasuryBalance,
              balanceAfter: newTreasuryBalance,
              sourceTransferId: idempotencyKey,
              sourceTransferType: 'P2P_TRANSFER',
              sourceFeeTransactionId: feeTransactionId,
              payerUid: senderUid,
              receiverUid: recipientUid,
              destinationTreasuryId: TECHNOLOGY_OPERATIONS_TREASURY_ID,
              feeConfigurationVersion: configVersion,
              status: 'Completed',
              referenceNumber: idempotencyKey,
              description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
              idempotencyKey: `${idempotencyKey}:treasury-fee-credit`,
              createdAt: timestamp,
              completedAt: timestamp,
            },
          )

          // Restricted internal transfer-fee record.
          transaction.set(
            db.collection('transfer_fee_transactions').doc(feeTransactionId),
            {
              feeTransactionId,
              sourceTransferId: idempotencyKey,
              sourceTransferType: 'P2P_TRANSFER',
              sourceTransferStatus: 'Completed',
              payerUid: senderUid,
              payerMemberId: String(senderUser.memberId || ''),
              payerName: String(senderUser.fullName || ''),
              receiverUid: recipientUid,
              receiverMemberId: storedRecipientMemberId,
              receiverName: String(recipientUser.fullName || ''),
              feeType: 'PLATFORM_TRANSFER_FEE',
              feeAmountType: 'FIXED',
              feeAmountCC: feeCC,
              transferAmountCC: normalizedAmountCC,
              totalSenderDeductionCC: totalDebitCC,
              destinationTreasuryId: TECHNOLOGY_OPERATIONS_TREASURY_ID,
              internalDestinationName:
                'Corporate CTO Technology Operations Treasury',
              publicDescription: 'Platform Transfer Fee',
              internalClassification: 'CORPORATE_TECHNOLOGY_REVENUE',
              senderFeeLedgerTransactionId: senderFeeLedgerId,
              treasuryLedgerTransactionId: treasuryCreditLedgerId,
              configurationVersion: configVersion,
              idempotencyKey: `platform-transfer-fee:${idempotencyKey}`,
              status: 'Completed',
              reversalStatus: 'NOT_REVERSED',
              reversedAmountCC: 0,
              reversalTransactionId: null,
              createdAt: timestamp,
              completedAt: timestamp,
              updatedAt: timestamp,
            },
          )

          transaction.set(db.collection('audit_logs').doc(auditLogId), {
            id: auditLogId,
            actorUid: senderUid,
            actorEmail: String(senderUser.email || ''),
            action: 'P2P_TRANSFER_COMPLETED',
            details:
              `Transferred ${normalizedAmountCC} CC to ` +
              `${displayMemberId(storedRecipientMemberId)}. ` +
              `Platform Transfer Fee: ${feeCC} CC. ` +
              `Reference: ${idempotencyKey}.`,
            metadata: {
              transferId: idempotencyKey,
              senderUid,
              senderMemberId: String(senderUser.memberId || ''),
              recipientUid,
              recipientMemberId: storedRecipientMemberId,
              amountCC: normalizedAmountCC,
              platformTransferFeeCC: feeCC,
              totalDebitCC,
              feePayerUid: senderUid,
              feeTransactionId,
              destinationTreasuryId: TECHNOLOGY_OPERATIONS_TREASURY_ID,
              source: 'P2P_TRANSFER_GATE',
              configVersion,
            },
            timestamp,
          })

          return {
            success: true,
            transferId: idempotencyKey,
            feeTransactionId,
            amountCC: normalizedAmountCC,
            feeCC,
            totalDebitCC,
            recipientName: String(recipientUser.fullName || ''),
            recipientId: storedRecipientMemberId,
            referenceId: idempotencyKey,
            createdAt: timestamp,
            status: 'Completed',
          }
        },
      )

      console.info('P2P transfer completed', {
        transferId: transferResult.transferId,
        senderUid,
        recipientMemberId: normalizedRecipientMemberId,
        amountCC: normalizedAmountCC,
        feeCC: transferResult.feeCC,
        duplicate: transferResult.isDuplicate === true,
        durationMs: Date.now() - startedAtMs,
      })

      return transferResult
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'UNKNOWN_ERROR'

      console.error('P2P transfer failed', {
        idempotencyKey,
        senderUid,
        recipientMemberId: normalizedRecipientMemberId,
        amountCC: normalizedAmountCC,
        failureCategory: errorMessage,
        durationMs: Date.now() - startedAtMs,
      })

      await recordP2PFailureAudit({
        senderUid,
        recipientMemberId: normalizedRecipientMemberId,
        amountCC: normalizedAmountCC,
        idempotencyKey,
        failureCategory: errorMessage,
      })

      if (error instanceof HttpsError) {
        throw error
      }

      if (errorMessage === 'INSUFFICIENT_BALANCE') {
        throw new HttpsError(
          'failed-precondition',
          'Your Chosen Wallet balance is insufficient for the transfer and Platform Transfer Fee.',
        )
      }

      if (errorMessage === 'IDEMPOTENCY_KEY_CONFLICT') {
        throw new HttpsError(
          'already-exists',
          'This idempotency key has already been used for a different transfer request.',
        )
      }

      if (
        errorMessage === 'SENDER_INACTIVE' ||
        errorMessage === 'SENDER_NOT_FOUND'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Unable to verify your active account.',
        )
      }

      if (
        errorMessage === 'RECIPIENT_INACTIVE' ||
        errorMessage === 'RECIPIENT_NOT_FOUND' ||
        errorMessage === 'RECIPIENT_MEMBER_ID_CHANGED'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The recipient account is unavailable.',
        )
      }

      if (errorMessage === 'DUPLICATE_RECIPIENT_MEMBER_ID') {
        throw new HttpsError(
          'failed-precondition',
          'The recipient account cannot be resolved safely.',
        )
      }

      if (errorMessage === 'SENDER_WALLET_NOT_INITIALIZED') {
        throw new HttpsError(
          'failed-precondition',
          'Your Chosen Wallet is not initialized.',
        )
      }

      if (errorMessage === 'RECIPIENT_WALLET_NOT_INITIALIZED') {
        throw new HttpsError(
          'failed-precondition',
          'The recipient wallet is unavailable.',
        )
      }

      if (errorMessage === 'SENDER_WALLET_DISABLED') {
        throw new HttpsError(
          'permission-denied',
          'P2P transfers are disabled for your account.',
        )
      }

      if (errorMessage === 'P2P_TRANSFERS_DISABLED') {
        throw new HttpsError(
          'failed-precondition',
          'Chosen Credit transfers are temporarily unavailable.',
        )
      }

      if (
        errorMessage === 'MISSING_CC_SETTINGS' ||
        errorMessage === 'INACTIVE_CC_SETTINGS' ||
        errorMessage === 'INACTIVE_TRANSFER_FEE' ||
        errorMessage === 'INVALID_FEE_VALUE' ||
        errorMessage === 'FEE_VALUE_CONFLICT' ||
        errorMessage === 'INVALID_FEE_CONFIG_VERSION'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Platform Transfer Fee configuration conflicts with the approved version.',
        )
      }

      if (
        errorMessage === 'TREASURY_INACTIVE' ||
        errorMessage === 'INVALID_TREASURY_BALANCE'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The transfer settlement service is temporarily unavailable.',
        )
      }

      if (
        errorMessage === 'INVALID_SENDER_WALLET_BALANCE' ||
        errorMessage === 'INVALID_RECIPIENT_WALLET_BALANCE'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'A wallet balance requires administrative review.',
        )
      }

      throw new HttpsError(
        'internal',
        'The transfer could not be completed. No credits were deducted.',
      )
    }
  },
)

// -----------------------------------------------------------------------------
// PACKAGE ACTIVATION & COMPENSATION ENGINE V2
// -----------------------------------------------------------------------------

type PackageActivationActionV2 =
  | 'INITIAL_ACTIVATION'
  | 'PACKAGE_UPGRADE'
  | 'BUSINESS_CYCLE_REACTIVATION'

type PackageAccountPathV2 = 'Affiliate' | 'Smart Customer'

type ReferralBonusTypeV2 = 'Direct' | 'Indirect'

type LeadershipSourceTypeV2 = 'REFERRAL_BONUS' | 'MSA_CREDIT'

interface ActivatePackageRequestV2 {
  packageId: string
  accountPath: PackageAccountPathV2
  activationAction: PackageActivationActionV2
  idempotencyKey: string
}

interface ActivatePackageResultV2 {
  success: true
  activationEventId: string
  packageTransactionId: string
  businessCycleId: string | null
  msaEntitlementId: string | null
  packageLevel: string
  walletDebitedCC: number
  walletBalanceAfterCC: number
  directReferralTotalCC: number
  indirectReferralTotalCC: number
  leadershipFromReferralTotalCC: number
  compensationStatus: string
  overallStatus: string
  idempotentReplay?: boolean
}

interface UplineNodeV2 {
  uid: string
  data: DocumentData
  genealogyLevel: number
}

interface CommissionCreditInputV2 {
  idempotencyKey: string
  activationEventId: string
  sourceUid: string
  sourceMemberId: string
  earnerUid: string
  commissionType: 'Referral Bonus' | 'Leadership Bonus'
  referralBonusType?: ReferralBonusTypeV2
  leadershipSourceType?: LeadershipSourceTypeV2
  sourceCommissionId?: string
  sourceMsaCreditId?: string
  sourceCommissionAmountCC?: number
  level: number
  rate: number
  calculationBaseCC: number
  amountCC: number
  requiredDepth: number
  ruleId: string
  ruleVersion: string
  configurationVersion: string
}

interface CommissionCreditResultV2 {
  commissionId: string
  status: string
  creditedAmountCC: number
  flushedAmountCC: number
  earnerUid: string
  earnerMemberId: string
}

interface CompensationConfigurationV2 {
  version: string
  referralRuleId: string
  referralRuleVersion: string
  referralRates: number[]
  leadershipRuleId: string
  leadershipRuleVersion: string
  leadershipRates: number[]
  packageDepths: Record<string, number>
  msaRuleId: string
  msaRuleVersion: string
  msaFundPercentage: number
  msaDurationMonths: number
  msaMonthlyRates: Array<{
    fromMonth: number
    toMonth: number
    percentage: number
  }>
}

const APPROVED_COMPENSATION_BOOTSTRAP_V2: CompensationConfigurationV2 = {
  version: 'manual-v3.0-bootstrap',
  referralRuleId: 'referral-bonus-activation-v1',
  referralRuleVersion: '1.0',
  // Referral Bonuses replace the previous package-activation unilevel program.
  // Level 1 is Direct; Levels 2-15 are Indirect.
  referralRates: [
    4, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25, 0.25, 0.2, 0.2, 0.2, 0.2, 0.2,
  ],
  leadershipRuleId: 'leadership-qualified-commission-v1',
  leadershipRuleVersion: '1.0',
  leadershipRates: [
    4, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25, 0.25, 0.2, 0.2, 0.2, 0.2, 0.2,
  ],
  packageDepths: {
    bronze: 1,
    silver: 5,
    gold: 10,
    platinum: 13,
    diamond: 15,
    'city distributor': 15,
    'regional distributor': 15,
  },
  msaRuleId: 'msa-semi-monthly-v1',
  msaRuleVersion: '1.0',
  msaFundPercentage: 50,
  msaDurationMonths: 50,
  msaMonthlyRates: [
    { fromMonth: 1, toMonth: 12, percentage: 5 },
    { fromMonth: 13, toMonth: 24, percentage: 3 },
    { fromMonth: 25, toMonth: 36, percentage: 2 },
    { fromMonth: 37, toMonth: 50, percentage: 1 },
  ],
}

function roundCCV2(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function cleanStringV2(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizedPackageNameV2(value: unknown): string {
  return cleanStringV2(value).toLowerCase()
}

function isActiveMemberV2(data: DocumentData): boolean {
  const status = cleanStringV2(data.status || data.accountStatus).toLowerCase()
  // Legacy records sometimes used Completed as an account status when only the
  // Business Cycle was completed. Treat those package-bearing records as active.
  return (
    status === 'active' ||
    (status === 'completed' &&
      normalizedPackageNameV2(data.packageLevel) !== 'none')
  )
}

function packageDepthV2(
  packageLevel: unknown,
  config: CompensationConfigurationV2,
): number {
  return config.packageDepths[normalizedPackageNameV2(packageLevel)] || 0
}

const AFFILIATE_PACKAGE_ORDER_V2: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
  'city distributor': 6,
  'regional distributor': 7,
}

const SMART_CUSTOMER_PACKAGE_ORDER_V2: Record<string, number> = {
  'wellness starter kit': 1,
  'family health essentials': 2,
  'ultimate longevity system': 3,
}

function packageOrderForPathV2(
  packageLevel: unknown,
  accountPath: PackageAccountPathV2,
): number {
  const normalized = normalizedPackageNameV2(packageLevel)
  return accountPath === 'Affiliate'
    ? AFFILIATE_PACKAGE_ORDER_V2[normalized] || 0
    : SMART_CUSTOMER_PACKAGE_ORDER_V2[normalized] || 0
}

function inferPackagePathV2(
  packageLevel: unknown,
  userData: DocumentData,
): PackageAccountPathV2 | null {
  const normalizedPackage = normalizedPackageNameV2(packageLevel)

  if (AFFILIATE_PACKAGE_ORDER_V2[normalizedPackage]) {
    return 'Affiliate'
  }

  if (SMART_CUSTOMER_PACKAGE_ORDER_V2[normalizedPackage]) {
    return 'Smart Customer'
  }

  const normalizedAccountType = normalizedPackageNameV2(userData.accountType)
  const normalizedRole = normalizedPackageNameV2(userData.role)

  if (
    normalizedAccountType === 'affiliate' ||
    normalizedRole === 'affiliate' ||
    normalizedRole === 'city distributor' ||
    normalizedRole === 'regional distributor'
  ) {
    return 'Affiliate'
  }

  if (
    normalizedAccountType === 'smartcustomer' ||
    normalizedAccountType === 'smart customer'
  ) {
    return 'Smart Customer'
  }

  return null
}

function deterministicFinancialIdV2(prefix: string, value: string): string {
  const digest = createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 30)
    .toUpperCase()
  return `${prefix}-${digest}`
}

function requestFingerprintV2(
  input: ActivatePackageRequestV2 & { uid: string },
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        uid: input.uid,
        packageId: normalizedPackageNameV2(input.packageId),
        accountPath: input.accountPath,
        activationAction: input.activationAction,
        idempotencyKey: input.idempotencyKey,
      }),
    )
    .digest('hex')
}

function parseLevelRatesV2(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null

  const rates = value
    .map((entry, index) => {
      if (typeof entry === 'number') return entry
      if (!entry || typeof entry !== 'object') return Number.NaN
      const record = entry as Record<string, unknown>
      const enabled = record.enabled
      if (enabled === false) return 0
      const configuredLevel = Number(record.level ?? index + 1)
      if (configuredLevel !== index + 1) return Number.NaN
      return Number(record.percentage ?? record.rate ?? record.value)
    })
    .slice(0, 15)

  if (
    rates.length === 0 ||
    rates.some((rate) => !Number.isFinite(rate) || rate < 0)
  ) {
    return null
  }

  while (rates.length < 15) rates.push(0)
  return rates
}

function parsePackageDepthsV2(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null
  const result: Record<string, number> = {}
  for (const [key, rawValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const depth = Number(rawValue)
    if (Number.isInteger(depth) && depth >= 0 && depth <= 15) {
      result[key.toLowerCase()] = depth
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

function parseMsaMonthlyRatesV2(
  value: unknown,
): Array<{ fromMonth: number; toMonth: number; percentage: number }> | null {
  if (!Array.isArray(value)) return null
  const result = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const fromMonth = Number(record.fromMonth ?? record.startMonth)
      const toMonth = Number(record.toMonth ?? record.endMonth)
      const percentage = Number(record.percentage ?? record.rate)
      if (
        !Number.isInteger(fromMonth) ||
        !Number.isInteger(toMonth) ||
        fromMonth < 1 ||
        toMonth < fromMonth ||
        !Number.isFinite(percentage) ||
        percentage < 0
      ) {
        return null
      }
      return { fromMonth, toMonth, percentage }
    })
    .filter(
      (
        entry,
      ): entry is { fromMonth: number; toMonth: number; percentage: number } =>
        entry !== null,
    )
  return result.length > 0 ? result : null
}

async function loadCompensationConfigurationV2(): Promise<CompensationConfigurationV2> {
  const [
    commissionRulesSnap,
    leadershipRulesSnap,
    msaRulesSnap,
    genealogyRulesSnap,
  ] = await Promise.all([
    db.collection('system_config').doc('commission_rules').get(),
    db.collection('system_config').doc('leadership_rules').get(),
    db.collection('system_config').doc('msa_rules').get(),
    db.collection('system_config').doc('genealogy_rules').get(),
  ])

  const result: CompensationConfigurationV2 = {
    ...APPROVED_COMPENSATION_BOOTSTRAP_V2,
    referralRates: [...APPROVED_COMPENSATION_BOOTSTRAP_V2.referralRates],
    leadershipRates: [...APPROVED_COMPENSATION_BOOTSTRAP_V2.leadershipRates],
    packageDepths: { ...APPROVED_COMPENSATION_BOOTSTRAP_V2.packageDepths },
    msaMonthlyRates: APPROVED_COMPENSATION_BOOTSTRAP_V2.msaMonthlyRates.map(
      (entry) => ({ ...entry }),
    ),
  }

  const commissionData = commissionRulesSnap.data() || {}
  const leadershipData = leadershipRulesSnap.data() || {}
  const msaData = msaRulesSnap.data() || {}
  const genealogyData = genealogyRulesSnap.data() || {}

  const referralNode =
    (commissionData.referralBonus as Record<string, unknown> | undefined) ||
    (commissionData.ReferralBonus as Record<string, unknown> | undefined) ||
    commissionData
  const configuredReferralRates = parseLevelRatesV2(
    referralNode.levels ||
      referralNode.referralLevels ||
      commissionData.referralBonusLevels,
  )
  if (configuredReferralRates) result.referralRates = configuredReferralRates

  const configuredLeadershipRates = parseLevelRatesV2(
    leadershipData.levels || leadershipData.leadershipLevels,
  )
  if (configuredLeadershipRates)
    result.leadershipRates = configuredLeadershipRates

  const configuredDepths = parsePackageDepthsV2(
    genealogyData.packageDepths ||
      genealogyData.referralDepthByPackage ||
      leadershipData.packageDepths,
  )
  if (configuredDepths) {
    result.packageDepths = { ...result.packageDepths, ...configuredDepths }
  }

  const configuredMsaRates = parseMsaMonthlyRatesV2(
    msaData.monthlyRates || msaData.allocationSchedule,
  )
  if (configuredMsaRates) result.msaMonthlyRates = configuredMsaRates

  const msaFundPercentage = Number(msaData.fundPercentage)
  if (Number.isFinite(msaFundPercentage) && msaFundPercentage > 0) {
    result.msaFundPercentage = msaFundPercentage
  }

  const msaDurationMonths = Number(
    msaData.durationMonths || msaData.maximumMonths,
  )
  if (Number.isInteger(msaDurationMonths) && msaDurationMonths > 0) {
    result.msaDurationMonths = msaDurationMonths
  }

  result.version = cleanStringV2(
    commissionData.configurationVersion ||
      commissionData.version ||
      leadershipData.configurationVersion ||
      leadershipData.version ||
      APPROVED_COMPENSATION_BOOTSTRAP_V2.version,
  )
  result.referralRuleId = cleanStringV2(
    referralNode.ruleId || result.referralRuleId,
  )
  result.referralRuleVersion = cleanStringV2(
    referralNode.version || result.referralRuleVersion,
  )
  result.leadershipRuleId = cleanStringV2(
    leadershipData.ruleId || result.leadershipRuleId,
  )
  result.leadershipRuleVersion = cleanStringV2(
    leadershipData.version || result.leadershipRuleVersion,
  )
  result.msaRuleId = cleanStringV2(msaData.ruleId || result.msaRuleId)
  result.msaRuleVersion = cleanStringV2(
    msaData.version || result.msaRuleVersion,
  )

  if (
    !commissionRulesSnap.exists ||
    !leadershipRulesSnap.exists ||
    !msaRulesSnap.exists ||
    !genealogyRulesSnap.exists
  ) {
    console.warn(
      'Package engine is using approved bootstrap compensation values. Seed all versioned system_config rule documents before production launch.',
      {
        commissionRulesExists: commissionRulesSnap.exists,
        leadershipRulesExists: leadershipRulesSnap.exists,
        msaRulesExists: msaRulesSnap.exists,
        genealogyRulesExists: genealogyRulesSnap.exists,
        bootstrapVersion: APPROVED_COMPENSATION_BOOTSTRAP_V2.version,
      },
    )
  }

  return result
}

async function resolveUplineReferenceV2(
  referenceValue: unknown,
): Promise<UplineNodeV2 | null> {
  const reference = cleanStringV2(referenceValue)
  if (!reference) return null

  const directDoc = await db.collection('users').doc(reference).get()
  if (directDoc.exists) {
    return {
      uid: directDoc.id,
      data: directDoc.data() || {},
      genealogyLevel: 0,
    }
  }

  const sponsorCodeQuery = await db
    .collection('users')
    .where('sponsorCode', '==', reference)
    .limit(2)
    .get()

  if (sponsorCodeQuery.size > 1) {
    throw new Error('DUPLICATE_SPONSOR_CODE')
  }

  if (sponsorCodeQuery.empty) return null
  const sponsorDoc = sponsorCodeQuery.docs[0]
  return {
    uid: sponsorDoc.id,
    data: sponsorDoc.data() || {},
    genealogyLevel: 0,
  }
}

async function buildUplineChainV2(
  sourceUserData: DocumentData,
  maximumLevels = 15,
): Promise<UplineNodeV2[]> {
  const chain: UplineNodeV2[] = []
  const seen = new Set<string>()
  let nextReference = sourceUserData.sponsorUid || sourceUserData.referredBy

  for (let level = 1; level <= maximumLevels; level += 1) {
    const node = await resolveUplineReferenceV2(nextReference)
    if (!node) break
    if (seen.has(node.uid)) throw new Error('GENEALOGY_CYCLE_DETECTED')
    seen.add(node.uid)
    chain.push({ ...node, genealogyLevel: level })
    nextReference = node.data.sponsorUid || node.data.referredBy
  }

  return chain
}

function commissionRecordResultV2(
  data: DocumentData,
): CommissionCreditResultV2 {
  return {
    commissionId: cleanStringV2(data.commissionId || data.id),
    status: cleanStringV2(data.status || 'Unknown'),
    creditedAmountCC: roundCCV2(
      Number(data.creditedAmountCC ?? data.amountCC ?? 0),
    ),
    flushedAmountCC: roundCCV2(Number(data.flushedAmountCC ?? 0)),
    earnerUid: cleanStringV2(data.earnerUid),
    earnerMemberId: cleanStringV2(data.earnerMemberId),
  }
}

async function creditCommissionV2(
  input: CommissionCreditInputV2,
  config: CompensationConfigurationV2,
): Promise<CommissionCreditResultV2> {
  const commissionId = deterministicFinancialIdV2('COMM', input.idempotencyKey)
  const commissionRef = db.collection('commissions').doc(commissionId)
  const earnerUserRef = db.collection('users').doc(input.earnerUid)
  const walletRef = db.collection('wallets').doc(input.earnerUid)
  const cycleRef = db.collection('business_cycles').doc(input.earnerUid)
  const flushBankRef = db.collection('flush_out_cc_bank').doc('GLOBAL')

  return db.runTransaction(async (transaction: Transaction) => {
    // All reads occur before writes.
    const commissionSnap = await transaction.get(commissionRef)
    if (commissionSnap.exists) {
      return commissionRecordResultV2(commissionSnap.data() || {})
    }

    const userSnap = await transaction.get(earnerUserRef)
    const walletSnap = await transaction.get(walletRef)
    const cycleSnap = await transaction.get(cycleRef)
    const flushBankSnap = await transaction.get(flushBankRef)

    const timestamp = new Date().toISOString()
    const requestedAmountCC = roundCCV2(input.amountCC)

    if (!userSnap.exists || !walletSnap.exists || !cycleSnap.exists) {
      const status = 'Not Qualified'
      const reason = !userSnap.exists
        ? 'EARNER_NOT_FOUND'
        : !walletSnap.exists
          ? 'WALLET_NOT_FOUND'
          : 'BUSINESS_CYCLE_NOT_FOUND'

      // Never spread an input object containing optional undefined fields into
      // a Firestore write. Firestore rejects undefined values unless the SDK is
      // explicitly configured to ignore them, which is not appropriate for an
      // authoritative financial ledger.
      transaction.set(commissionRef, {
        id: commissionId,
        commissionId,
        activationEventId: input.activationEventId,
        sourceUid: input.sourceUid,
        sourceMemberId: input.sourceMemberId,
        earnerUid: input.earnerUid,
        earnerMemberId: '',
        commissionType: input.commissionType,
        referralBonusType: input.referralBonusType || null,
        leadershipSourceType: input.leadershipSourceType || null,
        sourceCommissionId: input.sourceCommissionId || null,
        sourceMsaCreditId: input.sourceMsaCreditId || null,
        sourceCommissionAmountCC: input.sourceCommissionAmountCC ?? null,
        level: input.level,
        referralLevel: input.referralBonusType ? input.level : null,
        leadershipLevel: input.leadershipSourceType ? input.level : null,
        calculationBaseCC: input.calculationBaseCC,
        rate: input.rate,
        requiredDepth: input.requiredDepth,
        requestedAmountCC,
        amountCC: 0,
        creditedAmountCC: 0,
        flushedAmountCC: 0,
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        configurationVersion: input.configurationVersion,
        status,
        reason,
        idempotencyKey: input.idempotencyKey,
        createdAt: timestamp,
        completedAt: timestamp,
      })
      return {
        commissionId,
        status,
        creditedAmountCC: 0,
        flushedAmountCC: 0,
        earnerUid: input.earnerUid,
        earnerMemberId: '',
      }
    }

    const userData = userSnap.data() || {}
    const walletData = walletSnap.data() || {}
    const cycleData = cycleSnap.data() || {}
    const earnerMemberId = cleanStringV2(userData.memberId)
    const activeAccount = isActiveMemberV2(userData)
    const activeCycle =
      cleanStringV2(cycleData.status).toLowerCase() === 'active'
    const eligibleDepth = packageDepthV2(userData.packageLevel, config)
    const depthQualified = eligibleDepth >= input.requiredDepth
    const commissionEligible = userData.commissionEligible !== false
    const walletEnabled = userData.walletEnabled !== false

    const earningsCapCC = Number(cycleData.earningsCapCC || 0)
    const currentQualifiedEarningsCC = Number(
      cycleData.currentQualifiedEarningsCC || 0,
    )
    const derivedRemainingCapacityCC = Math.max(
      earningsCapCC - currentQualifiedEarningsCC,
      0,
    )
    const remainingCapacityCC = Math.max(
      Number.isFinite(Number(cycleData.remainingCapacityCC))
        ? Number(cycleData.remainingCapacityCC)
        : derivedRemainingCapacityCC,
      0,
    )

    const qualified =
      activeAccount &&
      activeCycle &&
      depthQualified &&
      commissionEligible &&
      walletEnabled &&
      requestedAmountCC > 0

    let creditedAmountCC = 0
    let flushedAmountCC = 0
    let status = 'Not Qualified'
    let reason = 'NOT_QUALIFIED'

    if (qualified) {
      creditedAmountCC = roundCCV2(
        Math.min(requestedAmountCC, remainingCapacityCC),
      )
      flushedAmountCC = roundCCV2(requestedAmountCC - creditedAmountCC)
      status = creditedAmountCC > 0 ? 'Credited' : 'Flushed'
      reason = flushedAmountCC > 0 ? 'BUSINESS_CYCLE_CAP_APPLIED' : 'QUALIFIED'
    } else if (!activeCycle || remainingCapacityCC <= 0) {
      status = 'Flushed'
      reason = 'BUSINESS_CYCLE_COMPLETED'
      flushedAmountCC = requestedAmountCC
    } else if (!activeAccount) {
      reason = 'ACCOUNT_NOT_ACTIVE'
    } else if (!depthQualified) {
      reason = 'BUSINESS_LICENSE_DEPTH_NOT_QUALIFIED'
    } else if (!commissionEligible) {
      reason = 'COMMISSION_NOT_ELIGIBLE'
    } else if (!walletEnabled) {
      reason = 'WALLET_DISABLED'
    }

    const commissionWalletBefore = Number(
      walletData.commissionWalletBalance || 0,
    )
    const commissionWalletAfter = roundCCV2(
      commissionWalletBefore + creditedAmountCC,
    )
    const newCycleEarnings = roundCCV2(
      currentQualifiedEarningsCC + creditedAmountCC,
    )
    const newRemainingCapacity = roundCCV2(
      Math.max(remainingCapacityCC - creditedAmountCC, 0),
    )
    const cycleCompleted = newRemainingCapacity <= 0 && earningsCapCC > 0

    if (creditedAmountCC > 0) {
      transaction.update(walletRef, {
        commissionWalletBalance: commissionWalletAfter,
        walletVersion: Number(walletData.walletVersion || 0) + 1,
        updatedAt: timestamp,
      })

      transaction.update(cycleRef, {
        currentQualifiedEarningsCC: newCycleEarnings,
        remainingCapacityCC: newRemainingCapacity,
        progressPercentage:
          earningsCapCC > 0
            ? Math.min(
                100,
                Math.round((newCycleEarnings / earningsCapCC) * 100),
              )
            : 0,
        status: cycleCompleted ? 'Completed' : 'Active',
        updatedAt: timestamp,
      })

      if (cycleCompleted) {
        transaction.update(earnerUserRef, {
          commissionEligible: false,
          updatedAt: timestamp,
        })
      }

      const ledgerId = deterministicFinancialIdV2(
        'TX-COMM',
        `${commissionId}:credit`,
      )
      transaction.set(db.collection('wallet_transactions').doc(ledgerId), {
        id: ledgerId,
        uid: input.earnerUid,
        memberId: earnerMemberId,
        amount: creditedAmountCC,
        amountCC: creditedAmountCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Commission Wallet',
        transactionType: 'COMMISSION_CREDIT',
        commissionType: input.commissionType,
        referralBonusType: input.referralBonusType || null,
        leadershipSourceType: input.leadershipSourceType || null,
        sourceCommissionId: input.sourceCommissionId || null,
        sourceMsaCreditId: input.sourceMsaCreditId || null,
        sourceActivationEventId: input.activationEventId,
        balanceBefore: commissionWalletBefore,
        balanceAfter: commissionWalletAfter,
        status: 'Completed',
        referenceNumber: commissionId,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        createdAt: timestamp,
        completedAt: timestamp,
      })
    }

    if (flushedAmountCC > 0) {
      const flushId = deterministicFinancialIdV2(
        'FLUSH',
        `${commissionId}:flush`,
      )
      const flushBankData = flushBankSnap.exists
        ? flushBankSnap.data() || {}
        : {}
      const flushBalanceBefore = Number(flushBankData.balanceCC || 0)
      const flushBalanceAfter = roundCCV2(flushBalanceBefore + flushedAmountCC)

      transaction.set(
        flushBankRef,
        {
          id: 'GLOBAL',
          balanceCC: flushBalanceAfter,
          version: Number(flushBankData.version || 0) + 1,
          updatedAt: timestamp,
          createdAt: flushBankData.createdAt || timestamp,
        },
        { merge: true },
      )

      transaction.set(db.collection('flushed_commissions').doc(flushId), {
        id: flushId,
        flushedCommissionId: flushId,
        originalCommissionId: commissionId,
        originalEarnerUid: input.earnerUid,
        originalEarnerMemberId: earnerMemberId,
        sourceUid: input.sourceUid,
        sourceMemberId: input.sourceMemberId,
        activationEventId: input.activationEventId,
        commissionType: input.commissionType,
        referralBonusType: input.referralBonusType || null,
        leadershipSourceType: input.leadershipSourceType || null,
        level: input.level,
        amountCC: flushedAmountCC,
        reason,
        businessCycleId: cleanStringV2(cycleData.id || input.earnerUid),
        businessCycleStatus: cleanStringV2(cycleData.status || 'Unknown'),
        status: 'Flushed',
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        configurationVersion: input.configurationVersion,
        createdAt: timestamp,
      })
    }

    transaction.set(commissionRef, {
      id: commissionId,
      commissionId,
      activationEventId: input.activationEventId,
      sourceUid: input.sourceUid,
      sourceMemberId: input.sourceMemberId,
      earnerUid: input.earnerUid,
      earnerMemberId,
      commissionType: input.commissionType,
      referralBonusType: input.referralBonusType || null,
      leadershipSourceType: input.leadershipSourceType || null,
      sourceCommissionId: input.sourceCommissionId || null,
      sourceMsaCreditId: input.sourceMsaCreditId || null,
      sourceCommissionAmountCC: input.sourceCommissionAmountCC || null,
      level: input.level,
      referralLevel: input.referralBonusType ? input.level : null,
      leadershipLevel: input.leadershipSourceType ? input.level : null,
      calculationBaseCC: input.calculationBaseCC,
      rate: input.rate,
      requestedAmountCC,
      amountCC: creditedAmountCC,
      creditedAmountCC,
      flushedAmountCC,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      configurationVersion: input.configurationVersion,
      packageLevelAtCalculation: cleanStringV2(userData.packageLevel),
      businessCycleId: cleanStringV2(cycleData.id || input.earnerUid),
      status,
      reason,
      idempotencyKey: input.idempotencyKey,
      createdAt: timestamp,
      completedAt: timestamp,
    })

    const auditId = deterministicFinancialIdV2(
      'LOG-COMM',
      `${commissionId}:audit`,
    )
    transaction.set(db.collection('audit_logs').doc(auditId), {
      id: auditId,
      actorUid: 'system',
      actorEmail: '',
      actorRole: 'System',
      action:
        status === 'Credited'
          ? 'COMMISSION_GENERATED'
          : status === 'Flushed'
            ? 'COMMISSION_FLUSHED'
            : 'COMMISSION_NOT_QUALIFIED',
      targetCollection: 'commissions',
      targetId: commissionId,
      details: `${input.commissionType} ${commissionId}: requested ${requestedAmountCC} CC, credited ${creditedAmountCC} CC, flushed ${flushedAmountCC} CC.`,
      metadata: {
        activationEventId: input.activationEventId,
        earnerUid: input.earnerUid,
        sourceUid: input.sourceUid,
        commissionType: input.commissionType,
        referralBonusType: input.referralBonusType || null,
        leadershipSourceType: input.leadershipSourceType || null,
        level: input.level,
        reason,
      },
      timestamp,
      createdAt: timestamp,
    })

    return {
      commissionId,
      status,
      creditedAmountCC,
      flushedAmountCC,
      earnerUid: input.earnerUid,
      earnerMemberId,
    }
  })
}

async function processLeadershipFromQualifiedSourceV2(input: {
  activationEventId: string
  sourceType: LeadershipSourceTypeV2
  sourceRecordId: string
  sourceEarnerUid: string
  sourceEarnerMemberId: string
  qualifiedAmountCC: number
  config: CompensationConfigurationV2
}): Promise<{ count: number; totalCC: number }> {
  if (input.qualifiedAmountCC <= 0) return { count: 0, totalCC: 0 }

  const sourceUserSnap = await db
    .collection('users')
    .doc(input.sourceEarnerUid)
    .get()
  if (!sourceUserSnap.exists) return { count: 0, totalCC: 0 }

  const uplines = await buildUplineChainV2(sourceUserSnap.data() || {}, 15)
  let count = 0
  let totalCC = 0

  for (const upline of uplines) {
    const leadershipLevel = upline.genealogyLevel
    const rate = Number(input.config.leadershipRates[leadershipLevel - 1] || 0)
    if (rate <= 0) continue

    const calculatedAmountCC = roundCCV2(input.qualifiedAmountCC * (rate / 100))
    if (calculatedAmountCC <= 0) continue

    const idempotencyKey =
      input.sourceType === 'REFERRAL_BONUS'
        ? `leadership-referral:${input.sourceRecordId}:${upline.uid}:${leadershipLevel}:${input.config.leadershipRuleVersion}`
        : `leadership-msa:${input.sourceRecordId}:${upline.uid}:${leadershipLevel}:${input.config.leadershipRuleVersion}`

    const result = await creditCommissionV2(
      {
        idempotencyKey,
        activationEventId: input.activationEventId,
        sourceUid: input.sourceEarnerUid,
        sourceMemberId: input.sourceEarnerMemberId,
        earnerUid: upline.uid,
        commissionType: 'Leadership Bonus',
        leadershipSourceType: input.sourceType,
        sourceCommissionId:
          input.sourceType === 'REFERRAL_BONUS'
            ? input.sourceRecordId
            : undefined,
        sourceMsaCreditId:
          input.sourceType === 'MSA_CREDIT' ? input.sourceRecordId : undefined,
        sourceCommissionAmountCC: input.qualifiedAmountCC,
        level: leadershipLevel,
        rate,
        calculationBaseCC: input.qualifiedAmountCC,
        amountCC: calculatedAmountCC,
        requiredDepth: leadershipLevel,
        ruleId: input.config.leadershipRuleId,
        ruleVersion: input.config.leadershipRuleVersion,
        configurationVersion: input.config.version,
      },
      input.config,
    )

    if (result.creditedAmountCC > 0) {
      count += 1
      totalCC = roundCCV2(totalCC + result.creditedAmountCC)
    }
  }

  return { count, totalCC }
}

async function processReferralAndLeadershipV2(
  activationEventId: string,
  config: CompensationConfigurationV2,
): Promise<{
  directReferralCount: number
  directReferralTotalCC: number
  indirectReferralCount: number
  indirectReferralTotalCC: number
  leadershipFromReferralCount: number
  leadershipFromReferralTotalCC: number
}> {
  const eventRef = db
    .collection('package_activation_events')
    .doc(activationEventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) throw new Error('ACTIVATION_EVENT_NOT_FOUND')
  const eventData = eventSnap.data() || {}

  const sourceUid = cleanStringV2(eventData.uid)
  const sourceUserSnap = await db.collection('users').doc(sourceUid).get()
  if (!sourceUserSnap.exists) throw new Error('ACTIVATION_SOURCE_NOT_FOUND')
  const sourceUserData = sourceUserSnap.data() || {}
  const sourceMemberId = cleanStringV2(sourceUserData.memberId)
  const packageValueCC = Number(eventData.packageValueCC || 0)
  if (!Number.isFinite(packageValueCC) || packageValueCC <= 0) {
    throw new Error('INVALID_ACTIVATION_PACKAGE_VALUE')
  }

  const uplines = await buildUplineChainV2(sourceUserData, 15)
  let directReferralCount = 0
  let directReferralTotalCC = 0
  let indirectReferralCount = 0
  let indirectReferralTotalCC = 0
  let leadershipFromReferralCount = 0
  let leadershipFromReferralTotalCC = 0

  for (const upline of uplines) {
    const referralLevel = upline.genealogyLevel
    const rate = Number(config.referralRates[referralLevel - 1] || 0)
    if (rate <= 0) continue

    const referralBonusType: ReferralBonusTypeV2 =
      referralLevel === 1 ? 'Direct' : 'Indirect'
    const amountCC = roundCCV2(packageValueCC * (rate / 100))
    if (amountCC <= 0) continue

    const referralResult = await creditCommissionV2(
      {
        idempotencyKey: `referral:${activationEventId}:${upline.uid}:${referralLevel}:${config.referralRuleVersion}`,
        activationEventId,
        sourceUid,
        sourceMemberId,
        earnerUid: upline.uid,
        commissionType: 'Referral Bonus',
        referralBonusType,
        level: referralLevel,
        rate,
        calculationBaseCC: packageValueCC,
        amountCC,
        requiredDepth: referralLevel,
        ruleId: config.referralRuleId,
        ruleVersion: config.referralRuleVersion,
        configurationVersion: config.version,
      },
      config,
    )

    if (referralResult.creditedAmountCC <= 0) continue

    if (referralBonusType === 'Direct') {
      directReferralCount += 1
      directReferralTotalCC = roundCCV2(
        directReferralTotalCC + referralResult.creditedAmountCC,
      )
    } else {
      indirectReferralCount += 1
      indirectReferralTotalCC = roundCCV2(
        indirectReferralTotalCC + referralResult.creditedAmountCC,
      )
    }

    const leadership = await processLeadershipFromQualifiedSourceV2({
      activationEventId,
      sourceType: 'REFERRAL_BONUS',
      sourceRecordId: referralResult.commissionId,
      sourceEarnerUid: referralResult.earnerUid,
      sourceEarnerMemberId: referralResult.earnerMemberId,
      qualifiedAmountCC: referralResult.creditedAmountCC,
      config,
    })
    leadershipFromReferralCount += leadership.count
    leadershipFromReferralTotalCC = roundCCV2(
      leadershipFromReferralTotalCC + leadership.totalCC,
    )
  }

  return {
    directReferralCount,
    directReferralTotalCC,
    indirectReferralCount,
    indirectReferralTotalCC,
    leadershipFromReferralCount,
    leadershipFromReferralTotalCC,
  }
}

async function finalizeActivationCompensationV2(
  activationEventId: string,
  compensation: Awaited<ReturnType<typeof processReferralAndLeadershipV2>>,
): Promise<ActivatePackageResultV2> {
  const eventRef = db
    .collection('package_activation_events')
    .doc(activationEventId)
  const reportRef = db
    .collection('package_activation_reports')
    .doc(activationEventId)

  return db.runTransaction(async (transaction: Transaction) => {
    const eventSnap = await transaction.get(eventRef)
    const reportSnap = await transaction.get(reportRef)
    if (!eventSnap.exists || !reportSnap.exists) {
      throw new Error('ACTIVATION_REPORT_NOT_FOUND')
    }

    const eventData = eventSnap.data() || {}
    const reportData = reportSnap.data() || {}
    const idempotencyDocumentId = cleanStringV2(eventData.idempotencyDocumentId)
    if (!idempotencyDocumentId)
      throw new Error('IDEMPOTENCY_DOCUMENT_NOT_FOUND')
    const idempotencyRef = db
      .collection('processed_idempotencies')
      .doc(idempotencyDocumentId)
    const idempotencySnap = await transaction.get(idempotencyRef)
    if (!idempotencySnap.exists)
      throw new Error('IDEMPOTENCY_DOCUMENT_NOT_FOUND')

    const timestamp = new Date().toISOString()
    const result: ActivatePackageResultV2 = {
      success: true,
      activationEventId,
      packageTransactionId: cleanStringV2(reportData.packageTransactionId),
      businessCycleId: cleanStringV2(reportData.businessCycleId) || null,
      msaEntitlementId: cleanStringV2(reportData.msaEntitlementId) || null,
      packageLevel: cleanStringV2(reportData.newPackageLevel),
      walletDebitedCC: Number(reportData.walletDebitedCC || 0),
      walletBalanceAfterCC: Number(reportData.walletBalanceAfterCC || 0),
      directReferralTotalCC: compensation.directReferralTotalCC,
      indirectReferralTotalCC: compensation.indirectReferralTotalCC,
      leadershipFromReferralTotalCC: compensation.leadershipFromReferralTotalCC,
      compensationStatus: 'COMPENSATION_COMPLETED',
      overallStatus: 'COMPLETED',
    }

    transaction.update(eventRef, {
      status: 'COMPLETED',
      compensationStatus: 'COMPENSATION_COMPLETED',
      completedAt: timestamp,
      updatedAt: timestamp,
    })
    transaction.update(reportRef, {
      ...compensation,
      referralProcessingStatus: 'COMPLETED',
      leadershipProcessingStatus: 'COMPLETED',
      compensationStatus: 'COMPENSATION_COMPLETED',
      overallStatus: 'COMPLETED',
      completedAt: timestamp,
      updatedAt: timestamp,
    })
    transaction.update(idempotencyRef, {
      status: 'COMPLETED',
      result,
      completedAt: timestamp,
      updatedAt: timestamp,
    })

    const auditId = deterministicFinancialIdV2(
      'LOG-PKG-COMP',
      `${activationEventId}:completed`,
    )
    transaction.set(db.collection('audit_logs').doc(auditId), {
      id: auditId,
      actorUid: 'system',
      actorRole: 'System',
      action: 'PACKAGE_COMPENSATION_COMPLETED',
      targetCollection: 'package_activation_events',
      targetId: activationEventId,
      details: `Completed Referral and Leadership processing for activation ${activationEventId}.`,
      metadata: compensation,
      timestamp,
      createdAt: timestamp,
    })

    return result
  })
}

async function markActivationCompensationFailureV2(
  activationEventId: string,
  error: unknown,
): Promise<void> {
  const timestamp = new Date().toISOString()
  const failureMessage = error instanceof Error ? error.message : String(error)
  const batch = db.batch()
  batch.set(
    db.collection('package_activation_events').doc(activationEventId),
    {
      status: 'FAILED_RETRYABLE',
      compensationStatus: 'FAILED_RETRYABLE',
      failureMessage,
      updatedAt: timestamp,
    },
    { merge: true },
  )
  batch.set(
    db.collection('package_activation_reports').doc(activationEventId),
    {
      referralProcessingStatus: 'FAILED_RETRYABLE',
      leadershipProcessingStatus: 'FAILED_RETRYABLE',
      overallStatus: 'FAILED_RETRYABLE',
      failureMessage,
      updatedAt: timestamp,
    },
    { merge: true },
  )
  const auditId = deterministicFinancialIdV2(
    'LOG-PKG-FAILED',
    `${activationEventId}:${timestamp}`,
  )
  batch.set(db.collection('audit_logs').doc(auditId), {
    id: auditId,
    actorUid: 'system',
    actorRole: 'System',
    action: 'PACKAGE_COMPENSATION_FAILED_RETRYABLE',
    targetCollection: 'package_activation_events',
    targetId: activationEventId,
    details: failureMessage,
    timestamp,
    createdAt: timestamp,
  })
  await batch.commit()
}

async function createOrLoadActivationCoreV2(input: {
  uid: string
  data: ActivatePackageRequestV2
  pkg: PackageConfig
  config: CompensationConfigurationV2
}): Promise<{
  activationEventId: string
  idempotencyDocumentId: string
  existingCompletedResult: ActivatePackageResultV2 | null
}> {
  const fingerprint = requestFingerprintV2({ ...input.data, uid: input.uid })
  const idempotencyDocumentId = deterministicFinancialIdV2(
    'PKG-IDEMP',
    `package-activation:${input.uid}:${input.data.idempotencyKey}`,
  )
  const activationEventId = deterministicFinancialIdV2(
    'PKG-ACT',
    `package-activation:${input.uid}:${input.data.idempotencyKey}`,
  )
  const packageTransactionId = deterministicFinancialIdV2(
    'TX-PKG',
    `${activationEventId}:wallet-debit`,
  )
  const businessCycleId =
    input.data.accountPath === 'Affiliate'
      ? deterministicFinancialIdV2('BC', `${activationEventId}:cycle`)
      : null
  const msaEntitlementId =
    input.data.accountPath === 'Affiliate'
      ? deterministicFinancialIdV2(
          'MSA-ENT',
          `${activationEventId}:entitlement`,
        )
      : null
  const packageHistoryId = deterministicFinancialIdV2(
    'PKG-HIST',
    `${activationEventId}:history`,
  )

  return db.runTransaction(async (transaction: Transaction) => {
    const idempotencyRef = db
      .collection('processed_idempotencies')
      .doc(idempotencyDocumentId)
    const userRef = db.collection('users').doc(input.uid)
    const walletRef = db.collection('wallets').doc(input.uid)
    const cycleRef = db.collection('business_cycles').doc(input.uid)

    // All reads before writes.
    const idempotencySnap = await transaction.get(idempotencyRef)
    const userSnap = await transaction.get(userRef)
    const walletSnap = await transaction.get(walletRef)
    const cycleSnap = await transaction.get(cycleRef)

    if (idempotencySnap.exists) {
      const existing = idempotencySnap.data() || {}
      if (cleanStringV2(existing.requestFingerprint) !== fingerprint) {
        throw new Error('IDEMPOTENCY_KEY_CONFLICT')
      }
      const existingResult = existing.result as
        | ActivatePackageResultV2
        | undefined
      return {
        activationEventId:
          cleanStringV2(existing.activationEventId) || activationEventId,
        idempotencyDocumentId,
        existingCompletedResult:
          existing.status === 'COMPLETED' && existingResult
            ? { ...existingResult, idempotentReplay: true }
            : null,
      }
    }

    if (!userSnap.exists) throw new Error('USER_NOT_FOUND')
    if (!walletSnap.exists) throw new Error('WALLET_NOT_FOUND')

    const userData = userSnap.data() || {}
    const walletData = walletSnap.data() || {}
    const currentPackage =
      cleanStringV2(userData.packageLevel || 'None') || 'None'
    const currentPackagePath = inferPackagePathV2(currentPackage, userData)
    const currentOrder = currentPackagePath
      ? packageOrderForPathV2(currentPackage, currentPackagePath)
      : 0
    const targetOrder = packageOrderForPathV2(
      input.pkg.name,
      input.data.accountPath,
    )
    const cycleData = cycleSnap.exists ? cycleSnap.data() || {} : {}
    const cycleStatus = cleanStringV2(cycleData.status).toLowerCase()

    if (!isActiveMemberV2(userData)) throw new Error('ACCOUNT_NOT_ACTIVE')

    if (targetOrder <= 0) {
      throw new Error('PACKAGE_NOT_SUPPORTED_FOR_ACTIVATION')
    }

    if (input.data.activationAction === 'INITIAL_ACTIVATION') {
      if (normalizedPackageNameV2(currentPackage) !== 'none') {
        throw new Error('INVALID_INITIAL_ACTIVATION')
      }
    } else if (input.data.activationAction === 'PACKAGE_UPGRADE') {
      if (
        normalizedPackageNameV2(currentPackage) === 'none' ||
        currentOrder <= 0
      ) {
        throw new Error('INVALID_UPGRADE')
      }

      if (input.data.accountPath === 'Smart Customer') {
        // Affiliate Business cannot be downgraded to a customer-only package.
        if (currentPackagePath !== 'Smart Customer') {
          throw new Error('PROHIBITED_ACCOUNT_PATH_CHANGE')
        }
        if (targetOrder <= currentOrder) throw new Error('INVALID_UPGRADE')
      } else if (currentPackagePath === 'Affiliate') {
        if (targetOrder <= currentOrder) throw new Error('INVALID_UPGRADE')
      }
      // Smart Customer -> Affiliate is a supported full-price upgrade. Any
      // valid Affiliate package may be selected because the two tracks use
      // different package ladders.
    } else if (input.data.activationAction === 'BUSINESS_CYCLE_REACTIVATION') {
      if (
        input.data.accountPath !== 'Affiliate' ||
        currentPackagePath !== 'Affiliate'
      ) {
        throw new Error('INVALID_REACTIVATION_ACCOUNT_PATH')
      }
      if (!cycleSnap.exists || cycleStatus !== 'completed') {
        throw new Error('BUSINESS_CYCLE_NOT_COMPLETED')
      }
      if (targetOrder < currentOrder) throw new Error('PROHIBITED_DOWNGRADE')
    }

    const walletBalanceBeforeCC = Number(walletData.chosenWalletBalance || 0)
    if (!Number.isFinite(walletBalanceBeforeCC) || walletBalanceBeforeCC < 0) {
      throw new Error('INVALID_WALLET_BALANCE')
    }
    // Full target package price is always charged. Current package value is not deducted.
    const walletDebitedCC = roundCCV2(input.pkg.cc)
    if (walletBalanceBeforeCC < walletDebitedCC) {
      throw new Error('INSUFFICIENT_BALANCE')
    }
    const walletBalanceAfterCC = roundCCV2(
      walletBalanceBeforeCC - walletDebitedCC,
    )
    const timestamp = new Date().toISOString()
    const isAffiliate = input.data.accountPath === 'Affiliate'
    const earningsCapCC = roundCCV2(input.pkg.cc * 2.5)
    const msaFundCC = roundCCV2(
      input.pkg.cc * (input.config.msaFundPercentage / 100),
    )

    transaction.update(walletRef, {
      chosenWalletBalance: walletBalanceAfterCC,
      walletVersion: Number(walletData.walletVersion || 0) + 1,
      updatedAt: timestamp,
    })

    transaction.update(userRef, {
      accountType: isAffiliate ? 'Affiliate' : 'SmartCustomer',
      role: isAffiliate ? 'Affiliate' : 'Customer',
      packageLevel: input.pkg.name,
      status: 'Active',
      commissionEligible: isAffiliate,
      walletEnabled: true,
      genealogyEnabled: isAffiliate,
      businessCycleEnabled: isAffiliate,
      activatedAt: timestamp,
      updatedAt: timestamp,
    })

    transaction.set(
      db.collection('wallet_transactions').doc(packageTransactionId),
      {
        id: packageTransactionId,
        uid: input.uid,
        memberId: cleanStringV2(userData.memberId),
        amount: walletDebitedCC,
        amountCC: walletDebitedCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen Wallet',
        transactionType: 'PACKAGE_PURCHASE_DEBIT',
        activationAction: input.data.activationAction,
        packageLevel: input.pkg.name,
        packageValueCC: input.pkg.cc,
        balanceBefore: walletBalanceBeforeCC,
        balanceAfter: walletBalanceAfterCC,
        sourceActivationEventId: activationEventId,
        status: 'Completed',
        referenceNumber: activationEventId,
        idempotencyKey: `${input.data.idempotencyKey}:wallet-debit`,
        description: `${input.data.activationAction}: paid full ${input.pkg.name} package price of ${walletDebitedCC} CC.`,
        createdAt: timestamp,
        completedAt: timestamp,
        timestamp,
      },
    )

    if (isAffiliate && businessCycleId && msaEntitlementId) {
      transaction.set(cycleRef, {
        id: businessCycleId,
        cycleId: businessCycleId,
        uid: input.uid,
        activationEventId,
        activationAction: input.data.activationAction,
        packageLevel: input.pkg.name,
        packageValueCC: input.pkg.cc,
        earningsCapCC,
        currentQualifiedEarningsCC: 0,
        remainingCapacityCC: earningsCapCC,
        progressPercentage: 0,
        status: 'Active',
        activatedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      transaction.set(db.collection('msa_entitlements').doc(msaEntitlementId), {
        id: msaEntitlementId,
        entitlementId: msaEntitlementId,
        activationEventId,
        uid: input.uid,
        memberId: cleanStringV2(userData.memberId),
        packageLevel: input.pkg.name,
        packageValueCC: input.pkg.cc,
        msaFundPercentage: input.config.msaFundPercentage,
        entitlementAmountCC: msaFundCC,
        amountCC: msaFundCC,
        pendingTransferCC: 0,
        accruedTotalCC: 0,
        totalReleasedCC: 0,
        durationMonths: input.config.msaDurationMonths,
        status: 'Active',
        startDate: timestamp,
        lastAccruedDate: null,
        lastCreditedDate: null,
        nextTransferSchedule: '15TH_AND_LAST_DAY_AT_13:00_ASIA_MANILA',
        ruleId: input.config.msaRuleId,
        ruleVersion: input.config.msaRuleVersion,
        configurationVersion: input.config.version,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }

    transaction.set(db.collection('package_history').doc(packageHistoryId), {
      id: packageHistoryId,
      historyId: packageHistoryId,
      activationEventId,
      uid: input.uid,
      memberId: cleanStringV2(userData.memberId),
      oldPackage: currentPackage,
      newPackage: input.pkg.name,
      priceCC: walletDebitedCC,
      paymentTransactionId: packageTransactionId,
      activationAction: input.data.activationAction,
      activatedBy: input.uid,
      activationSource: 'SECURED_CALLABLE',
      createdAt: timestamp,
    })

    transaction.set(
      db.collection('package_activation_events').doc(activationEventId),
      {
        id: activationEventId,
        activationEventId,
        uid: input.uid,
        memberId: cleanStringV2(userData.memberId),
        accountPath: input.data.accountPath,
        activationAction: input.data.activationAction,
        previousPackageLevel: currentPackage,
        packageId: normalizedPackageNameV2(input.pkg.name),
        packageLevel: input.pkg.name,
        packageValueCC: input.pkg.cc,
        walletTransactionId: packageTransactionId,
        businessCycleId,
        msaEntitlementId,
        idempotencyDocumentId,
        status: isAffiliate ? 'CORE_COMMITTED' : 'COMPLETED',
        compensationStatus: isAffiliate ? 'PENDING' : 'NOT_APPLICABLE',
        ruleVersion: input.config.version,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    )

    transaction.set(
      db.collection('package_activation_reports').doc(activationEventId),
      {
        id: activationEventId,
        activationEventId,
        uid: input.uid,
        memberId: cleanStringV2(userData.memberId),
        activationAction: input.data.activationAction,
        accountPath: input.data.accountPath,
        previousPackageLevel: currentPackage,
        newPackageLevel: input.pkg.name,
        packageValueCC: input.pkg.cc,
        packageTransactionId,
        businessCycleId,
        msaEntitlementId,
        walletDebitedCC,
        walletBalanceBeforeCC,
        walletBalanceAfterCC,
        directReferralCount: 0,
        directReferralTotalCC: 0,
        indirectReferralCount: 0,
        indirectReferralTotalCC: 0,
        leadershipFromReferralCount: 0,
        leadershipFromReferralTotalCC: 0,
        leadershipFromMsaCount: 0,
        leadershipFromMsaTotalCC: 0,
        compensationRuleVersion: input.config.version,
        coreTransactionStatus: 'COMPLETED',
        referralProcessingStatus: isAffiliate ? 'PENDING' : 'NOT_APPLICABLE',
        leadershipProcessingStatus: isAffiliate ? 'PENDING' : 'NOT_APPLICABLE',
        msaEntitlementStatus: isAffiliate ? 'ACTIVE' : 'NOT_APPLICABLE',
        overallStatus: isAffiliate ? 'CORE_COMMITTED' : 'COMPLETED',
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: isAffiliate ? null : timestamp,
      },
    )

    const coreResult: ActivatePackageResultV2 = {
      success: true,
      activationEventId,
      packageTransactionId,
      businessCycleId,
      msaEntitlementId,
      packageLevel: input.pkg.name,
      walletDebitedCC,
      walletBalanceAfterCC,
      directReferralTotalCC: 0,
      indirectReferralTotalCC: 0,
      leadershipFromReferralTotalCC: 0,
      compensationStatus: isAffiliate ? 'PENDING' : 'NOT_APPLICABLE',
      overallStatus: isAffiliate ? 'CORE_COMMITTED' : 'COMPLETED',
    }

    transaction.set(idempotencyRef, {
      id: idempotencyDocumentId,
      uid: input.uid,
      requestFingerprint: fingerprint,
      clientIdempotencyKey: input.data.idempotencyKey,
      activationEventId,
      status: isAffiliate ? 'CORE_COMMITTED' : 'COMPLETED',
      result: coreResult,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: isAffiliate ? null : timestamp,
    })

    const auditId = deterministicFinancialIdV2(
      'LOG-PKG-CORE',
      `${activationEventId}:core`,
    )
    transaction.set(db.collection('audit_logs').doc(auditId), {
      id: auditId,
      actorUid: input.uid,
      actorEmail: cleanStringV2(userData.email),
      action: 'PACKAGE_ACTIVATION_CORE_COMMITTED',
      targetCollection: 'package_activation_events',
      targetId: activationEventId,
      details: `Committed ${input.data.activationAction} for ${input.pkg.name}. Full package price ${walletDebitedCC} CC was deducted.`,
      metadata: {
        activationEventId,
        packageTransactionId,
        businessCycleId,
        msaEntitlementId,
        walletBalanceBeforeCC,
        walletBalanceAfterCC,
      },
      timestamp,
      createdAt: timestamp,
    })

    const notificationId = deterministicFinancialIdV2(
      'NOTIF-PKG',
      `${activationEventId}:notification`,
    )
    transaction.set(db.collection('notifications').doc(notificationId), {
      id: notificationId,
      uid: input.uid,
      title: 'Package Activation Confirmed',
      message: `${input.pkg.name} was activated successfully. Reference: ${activationEventId}.`,
      type: 'Success',
      unread: true,
      isRead: false,
      actionUrl: null,
      createdAt: timestamp,
    })

    return {
      activationEventId,
      idempotencyDocumentId,
      existingCompletedResult: null,
    }
  })
}

/**
 * Unified secured endpoint for initial activation, full-price package upgrade,
 * and Business Cycle reactivation.
 *
 * Core package mutation is atomic. Referral and Leadership processing is
 * resumable and idempotent. A repeated request with the same key resumes an
 * incomplete compensation event and never deducts the wallet twice.
 */
export const activatePackageWithWallet = onCall<ActivatePackageRequestV2>(
  { region: FUNCTIONS_REGION },
  async (
    request: CallableRequest<ActivatePackageRequestV2>,
  ): Promise<ActivatePackageResultV2> => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication credentials are required.',
      )
    }

    const uid = request.auth.uid
    const data = request.data
    if (!data || typeof data !== 'object') {
      throw new HttpsError(
        'invalid-argument',
        'Package activation data is required.',
      )
    }

    const allowedFields = new Set([
      'packageId',
      'accountPath',
      'activationAction',
      'idempotencyKey',
    ])
    const unexpectedFields = Object.keys(data).filter(
      (field) => !allowedFields.has(field),
    )
    if (unexpectedFields.length > 0) {
      throw new HttpsError(
        'invalid-argument',
        'The package request contains unsupported client-controlled fields.',
      )
    }

    const packageId = cleanStringV2(data.packageId)
    const accountPath = data.accountPath
    const activationAction = data.activationAction
    const idempotencyKey = cleanStringV2(data.idempotencyKey)

    if (!packageId) {
      throw new HttpsError('invalid-argument', 'Package ID is required.')
    }
    if (accountPath !== 'Affiliate' && accountPath !== 'Smart Customer') {
      throw new HttpsError(
        'invalid-argument',
        'A valid account path is required.',
      )
    }
    if (
      activationAction !== 'INITIAL_ACTIVATION' &&
      activationAction !== 'PACKAGE_UPGRADE' &&
      activationAction !== 'BUSINESS_CYCLE_REACTIVATION'
    ) {
      throw new HttpsError(
        'invalid-argument',
        'A valid activation action is required.',
      )
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 180) {
      throw new HttpsError(
        'invalid-argument',
        'The idempotency key is invalid.',
      )
    }

    let activationEventId = ''

    try {
      const [pkg, config] = await Promise.all([
        getPackageConfig(packageId),
        loadCompensationConfigurationV2(),
      ])
      if (!pkg) throw new Error('PACKAGE_NOT_FOUND')

      const core = await createOrLoadActivationCoreV2({
        uid,
        data: { packageId, accountPath, activationAction, idempotencyKey },
        pkg,
        config,
      })
      activationEventId = core.activationEventId

      if (core.existingCompletedResult) {
        return core.existingCompletedResult
      }

      if (accountPath === 'Smart Customer') {
        const reportSnap = await db
          .collection('package_activation_reports')
          .doc(activationEventId)
          .get()
        const reportData = reportSnap.data() || {}
        return {
          success: true,
          activationEventId,
          packageTransactionId: cleanStringV2(reportData.packageTransactionId),
          businessCycleId: null,
          msaEntitlementId: null,
          packageLevel: cleanStringV2(reportData.newPackageLevel),
          walletDebitedCC: Number(reportData.walletDebitedCC || 0),
          walletBalanceAfterCC: Number(reportData.walletBalanceAfterCC || 0),
          directReferralTotalCC: 0,
          indirectReferralTotalCC: 0,
          leadershipFromReferralTotalCC: 0,
          compensationStatus: 'NOT_APPLICABLE',
          overallStatus: 'COMPLETED',
        }
      }

      const compensation = await processReferralAndLeadershipV2(
        activationEventId,
        config,
      )
      return await finalizeActivationCompensationV2(
        activationEventId,
        compensation,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('activatePackageWithWallet failed', {
        uid,
        packageId,
        accountPath,
        activationAction,
        idempotencyKey,
        activationEventId,
        error: message,
      })

      if (activationEventId) {
        await markActivationCompensationFailureV2(activationEventId, error)
      }

      if (error instanceof HttpsError) throw error
      if (message === 'USER_NOT_FOUND') {
        throw new HttpsError('not-found', 'User profile not found.')
      }
      if (message === 'WALLET_NOT_FOUND') {
        throw new HttpsError('not-found', 'Chosen Wallet is not initialized.')
      }
      if (message === 'PACKAGE_NOT_FOUND') {
        throw new HttpsError(
          'not-found',
          'The selected package is unavailable.',
        )
      }
      if (message === 'ACCOUNT_NOT_ACTIVE') {
        throw new HttpsError(
          'failed-precondition',
          'The account is not active.',
        )
      }
      if (message === 'INSUFFICIENT_BALANCE') {
        throw new HttpsError(
          'resource-exhausted',
          'The Chosen Wallet balance is insufficient for the full target package price.',
        )
      }
      if (
        message === 'INVALID_UPGRADE' ||
        message === 'PROHIBITED_DOWNGRADE' ||
        message === 'INVALID_INITIAL_ACTIVATION' ||
        message === 'BUSINESS_CYCLE_NOT_COMPLETED' ||
        message === 'INVALID_REACTIVATION_ACCOUNT_PATH' ||
        message === 'PROHIBITED_ACCOUNT_PATH_CHANGE'
      ) {
        throw new HttpsError(
          'failed-precondition',
          message.replaceAll('_', ' '),
        )
      }
      if (message === 'IDEMPOTENCY_KEY_CONFLICT') {
        throw new HttpsError(
          'already-exists',
          'This idempotency key was already used for a different package request.',
        )
      }
      if (message === 'PACKAGE_NOT_SUPPORTED_FOR_ACTIVATION') {
        throw new HttpsError(
          'failed-precondition',
          'The selected package is not supported by the secured activation engine.',
        )
      }
      if (message === 'INVALID_WALLET_BALANCE') {
        throw new HttpsError(
          'failed-precondition',
          'The Chosen Wallet balance requires administrative review before upgrading.',
        )
      }
      if (
        message === 'ACTIVATION_EVENT_NOT_FOUND' ||
        message === 'ACTIVATION_SOURCE_NOT_FOUND' ||
        message === 'ACTIVATION_REPORT_NOT_FOUND' ||
        message === 'IDEMPOTENCY_DOCUMENT_NOT_FOUND' ||
        message === 'INVALID_ACTIVATION_PACKAGE_VALUE'
      ) {
        throw new HttpsError(
          'failed-precondition',
          activationEventId
            ? `The package core is secured under ${activationEventId}. Retry the same request to resume compensation processing.`
            : 'The package activation record requires administrative review.',
        )
      }
      if (
        message === 'GENEALOGY_CYCLE_DETECTED' ||
        message === 'DUPLICATE_SPONSOR_CODE'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The genealogy path requires administrative review. No duplicate package debit was created.',
        )
      }

      throw new HttpsError(
        'internal',
        activationEventId
          ? `The package core is secured under ${activationEventId}, but compensation processing requires a retry using the same idempotency key.`
          : 'Package activation failed. No package debit was committed.',
      )
    }
  },
)

// -----------------------------------------------------------------------------
// MSA ACCRUAL, SEMI-MONTHLY CREDIT, AND LEADERSHIP INTEGRATION
// -----------------------------------------------------------------------------

function manilaDatePartsV2(date: Date): {
  year: number
  month: number
  day: number
  isoDate: string
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values: Record<string, string> = {}
  for (const part of parts) values[part.type] = part.value
  const year = Number(values.year)
  const month = Number(values.month)
  const day = Number(values.day)
  return {
    year,
    month,
    day,
    isoDate: `${values.year}-${values.month}-${values.day}`,
  }
}

function monthsSinceStartV2(startDate: string, now: Date): number {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return 1
  const startParts = manilaDatePartsV2(start)
  const nowParts = manilaDatePartsV2(now)
  return Math.max(
    1,
    (nowParts.year - startParts.year) * 12 +
      (nowParts.month - startParts.month) +
      1,
  )
}

function msaRateForMonthV2(
  monthNumber: number,
  config: CompensationConfigurationV2,
): number {
  const bracket = config.msaMonthlyRates.find(
    (entry) => monthNumber >= entry.fromMonth && monthNumber <= entry.toMonth,
  )
  return bracket?.percentage || 0
}

function isMsaTransferDayV2(now: Date): boolean {
  const { year, month, day } = manilaDatePartsV2(now)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day === 15 || day === lastDay
}

async function processSingleMsaEntitlementV2(
  entitlementId: string,
  now: Date,
  config: CompensationConfigurationV2,
): Promise<{
  msaCreditId: string | null
  activationEventId: string
  beneficiaryUid: string
  beneficiaryMemberId: string
  creditedCC: number
}> {
  const entitlementRef = db.collection('msa_entitlements').doc(entitlementId)
  const today = manilaDatePartsV2(now).isoDate
  const transferDay = isMsaTransferDayV2(now)
  const msaCreditId = deterministicFinancialIdV2(
    'MSA-CREDIT',
    `${entitlementId}:${today}`,
  )

  return db.runTransaction(async (transaction: Transaction) => {
    const entitlementSnap = await transaction.get(entitlementRef)
    if (!entitlementSnap.exists) {
      return {
        msaCreditId: null,
        activationEventId: '',
        beneficiaryUid: '',
        beneficiaryMemberId: '',
        creditedCC: 0,
      }
    }

    const entitlementData = entitlementSnap.data() || {}
    const beneficiaryUid = cleanStringV2(entitlementData.uid)
    const activationEventId = cleanStringV2(entitlementData.activationEventId)
    const userRef = db.collection('users').doc(beneficiaryUid)
    const walletRef = db.collection('wallets').doc(beneficiaryUid)
    const cycleRef = db.collection('business_cycles').doc(beneficiaryUid)
    const creditRef = db.collection('msa_credits').doc(msaCreditId)
    const flushBankRef = db.collection('flush_out_cc_bank').doc('GLOBAL')

    // Remaining reads before writes.
    const userSnap = await transaction.get(userRef)
    const walletSnap = await transaction.get(walletRef)
    const cycleSnap = await transaction.get(cycleRef)
    const creditSnap = await transaction.get(creditRef)
    const flushBankSnap = await transaction.get(flushBankRef)

    if (creditSnap.exists) {
      const creditData = creditSnap.data() || {}
      return {
        msaCreditId,
        activationEventId,
        beneficiaryUid,
        beneficiaryMemberId: cleanStringV2(creditData.memberId),
        creditedCC: Number(creditData.amountCC || 0),
      }
    }

    if (
      cleanStringV2(entitlementData.status).toLowerCase() !== 'active' ||
      !userSnap.exists ||
      !walletSnap.exists ||
      !cycleSnap.exists
    ) {
      return {
        msaCreditId: null,
        activationEventId,
        beneficiaryUid,
        beneficiaryMemberId: '',
        creditedCC: 0,
      }
    }

    const userData = userSnap.data() || {}
    const walletData = walletSnap.data() || {}
    const cycleData = cycleSnap.data() || {}
    const timestamp = now.toISOString()
    const beneficiaryMemberId = cleanStringV2(userData.memberId)
    const cycleActive =
      cleanStringV2(cycleData.status).toLowerCase() === 'active'
    const qualified =
      isActiveMemberV2(userData) &&
      userData.accountType === 'Affiliate' &&
      userData.commissionEligible !== false &&
      cycleActive

    if (!qualified) {
      transaction.update(entitlementRef, {
        status: cycleActive ? 'Paused' : 'Paused - Business Cycle Completed',
        updatedAt: timestamp,
      })
      return {
        msaCreditId: null,
        activationEventId,
        beneficiaryUid,
        beneficiaryMemberId,
        creditedCC: 0,
      }
    }

    const startDate = cleanStringV2(
      entitlementData.startDate || entitlementData.createdAt,
    )
    const monthNumber = monthsSinceStartV2(startDate, now)
    if (
      monthNumber >
      Number(entitlementData.durationMonths || config.msaDurationMonths)
    ) {
      transaction.update(entitlementRef, {
        status: 'Completed',
        completedAt: timestamp,
        updatedAt: timestamp,
      })
      return {
        msaCreditId: null,
        activationEventId,
        beneficiaryUid,
        beneficiaryMemberId,
        creditedCC: 0,
      }
    }

    const rate = msaRateForMonthV2(monthNumber, config)
    const fundCC = Number(
      entitlementData.entitlementAmountCC ?? entitlementData.amountCC ?? 0,
    )
    const { year, month } = manilaDatePartsV2(now)
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const rawDailyAllocationCC = roundCCV2(
      (fundCC * (rate / 100)) / daysInMonth,
    )
    const alreadyAccruedToday =
      cleanStringV2(entitlementData.lastAccruedDate) === today

    const earningsCapCC = Number(cycleData.earningsCapCC || 0)
    const currentCycleEarnings = Number(
      cycleData.currentQualifiedEarningsCC || 0,
    )
    const remainingCapacity = Math.max(
      Number(
        cycleData.remainingCapacityCC ?? earningsCapCC - currentCycleEarnings,
      ),
      0,
    )
    const qualifiedDailyAllocationCC = alreadyAccruedToday
      ? 0
      : roundCCV2(Math.min(rawDailyAllocationCC, remainingCapacity))
    const flushedDailyAllocationCC = alreadyAccruedToday
      ? 0
      : roundCCV2(rawDailyAllocationCC - qualifiedDailyAllocationCC)

    const marketingBalanceBefore = Number(
      walletData.marketingSupportWalletBalance || 0,
    )
    const pendingBefore = Number(entitlementData.pendingTransferCC || 0)
    const accruedTotalBefore = Number(entitlementData.accruedTotalCC || 0)
    const pendingAfterAccrual = roundCCV2(
      pendingBefore + qualifiedDailyAllocationCC,
    )
    const marketingAfterAccrual = roundCCV2(
      marketingBalanceBefore + qualifiedDailyAllocationCC,
    )
    const cycleEarningsAfter = roundCCV2(
      currentCycleEarnings + qualifiedDailyAllocationCC,
    )
    const cycleRemainingAfter = roundCCV2(
      Math.max(remainingCapacity - qualifiedDailyAllocationCC, 0),
    )

    let chosenBalanceAfter = Number(walletData.chosenWalletBalance || 0)
    let marketingBalanceAfter = marketingAfterAccrual
    let transferAmountCC = 0

    if (transferDay && pendingAfterAccrual > 0) {
      transferAmountCC = pendingAfterAccrual
      chosenBalanceAfter = roundCCV2(chosenBalanceAfter + transferAmountCC)
      marketingBalanceAfter = roundCCV2(
        Math.max(marketingAfterAccrual - transferAmountCC, 0),
      )
    }

    transaction.update(walletRef, {
      chosenWalletBalance: chosenBalanceAfter,
      marketingSupportWalletBalance: marketingBalanceAfter,
      walletVersion: Number(walletData.walletVersion || 0) + 1,
      updatedAt: timestamp,
    })

    if (qualifiedDailyAllocationCC > 0) {
      transaction.update(cycleRef, {
        currentQualifiedEarningsCC: cycleEarningsAfter,
        remainingCapacityCC: cycleRemainingAfter,
        progressPercentage:
          earningsCapCC > 0
            ? Math.min(
                100,
                Math.round((cycleEarningsAfter / earningsCapCC) * 100),
              )
            : 0,
        status: cycleRemainingAfter <= 0 ? 'Completed' : 'Active',
        updatedAt: timestamp,
      })
      if (cycleRemainingAfter <= 0) {
        transaction.update(userRef, {
          commissionEligible: false,
          updatedAt: timestamp,
        })
      }
    }

    transaction.update(entitlementRef, {
      monthlyRatePercentage: rate,
      currentMonthNumber: monthNumber,
      dailyAllocationCC: rawDailyAllocationCC,
      lastAccruedDate: alreadyAccruedToday
        ? entitlementData.lastAccruedDate
        : today,
      pendingTransferCC: transferAmountCC > 0 ? 0 : pendingAfterAccrual,
      accruedTotalCC: roundCCV2(
        accruedTotalBefore + qualifiedDailyAllocationCC,
      ),
      totalReleasedCC: roundCCV2(
        Number(entitlementData.totalReleasedCC || 0) + transferAmountCC,
      ),
      lastCreditedDate:
        transferAmountCC > 0 ? today : entitlementData.lastCreditedDate || null,
      updatedAt: timestamp,
    })

    if (flushedDailyAllocationCC > 0) {
      const flushBankData = flushBankSnap.exists
        ? flushBankSnap.data() || {}
        : {}
      transaction.set(
        flushBankRef,
        {
          id: 'GLOBAL',
          balanceCC: roundCCV2(
            Number(flushBankData.balanceCC || 0) + flushedDailyAllocationCC,
          ),
          version: Number(flushBankData.version || 0) + 1,
          createdAt: flushBankData.createdAt || timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      )
      const flushId = deterministicFinancialIdV2(
        'FLUSH-MSA',
        `${entitlementId}:${today}`,
      )
      transaction.set(db.collection('flushed_commissions').doc(flushId), {
        id: flushId,
        flushedCommissionId: flushId,
        originalCommissionId: msaCreditId,
        originalEarnerUid: beneficiaryUid,
        originalEarnerMemberId: beneficiaryMemberId,
        activationEventId,
        commissionType: 'Marketing Support Allocation',
        amountCC: flushedDailyAllocationCC,
        reason: 'BUSINESS_CYCLE_CAP_APPLIED',
        status: 'Flushed',
        ruleId: config.msaRuleId,
        ruleVersion: config.msaRuleVersion,
        configurationVersion: config.version,
        createdAt: timestamp,
      })
    }

    if (transferAmountCC > 0) {
      const marketingDebitId = deterministicFinancialIdV2(
        'TX-MSA-DEBIT',
        `${msaCreditId}:marketing-debit`,
      )
      const chosenCreditId = deterministicFinancialIdV2(
        'TX-MSA-CREDIT',
        `${msaCreditId}:chosen-credit`,
      )

      transaction.set(creditRef, {
        id: msaCreditId,
        msaCreditId,
        entitlementId,
        activationEventId,
        uid: beneficiaryUid,
        memberId: beneficiaryMemberId,
        packageLevel: cleanStringV2(entitlementData.packageLevel),
        amountCC: transferAmountCC,
        creditPeriod: today,
        status: 'Credited',
        leadershipStatus: 'PENDING',
        leadershipTotalCC: 0,
        ruleId: config.msaRuleId,
        ruleVersion: config.msaRuleVersion,
        configurationVersion: config.version,
        createdAt: timestamp,
        completedAt: timestamp,
      })

      transaction.set(
        db.collection('wallet_transactions').doc(marketingDebitId),
        {
          id: marketingDebitId,
          uid: beneficiaryUid,
          memberId: beneficiaryMemberId,
          amount: transferAmountCC,
          amountCC: transferAmountCC,
          type: 'DEBIT',
          direction: 'Debit',
          walletType: 'Marketing Support Wallet',
          transactionType: 'MSA_TRANSFER_DEBIT',
          sourceMsaCreditId: msaCreditId,
          balanceBefore: marketingAfterAccrual,
          balanceAfter: marketingBalanceAfter,
          status: 'Completed',
          createdAt: timestamp,
          completedAt: timestamp,
        },
      )

      transaction.set(
        db.collection('wallet_transactions').doc(chosenCreditId),
        {
          id: chosenCreditId,
          uid: beneficiaryUid,
          memberId: beneficiaryMemberId,
          amount: transferAmountCC,
          amountCC: transferAmountCC,
          type: 'CREDIT',
          direction: 'Credit',
          walletType: 'Chosen Wallet',
          transactionType: 'MSA_CREDIT',
          sourceMsaCreditId: msaCreditId,
          balanceBefore: Number(walletData.chosenWalletBalance || 0),
          balanceAfter: chosenBalanceAfter,
          status: 'Completed',
          createdAt: timestamp,
          completedAt: timestamp,
        },
      )

      const auditId = deterministicFinancialIdV2(
        'LOG-MSA-CREDIT',
        `${msaCreditId}:audit`,
      )
      transaction.set(db.collection('audit_logs').doc(auditId), {
        id: auditId,
        actorUid: 'system',
        actorRole: 'System',
        action: 'MSA_CREDIT_COMPLETED',
        targetCollection: 'msa_credits',
        targetId: msaCreditId,
        details: `Credited ${transferAmountCC} CC from Marketing Support Wallet to Chosen Wallet.`,
        metadata: { entitlementId, activationEventId, beneficiaryUid },
        timestamp,
        createdAt: timestamp,
      })
    }

    return {
      msaCreditId: transferAmountCC > 0 ? msaCreditId : null,
      activationEventId,
      beneficiaryUid,
      beneficiaryMemberId,
      creditedCC: transferAmountCC,
    }
  })
}

async function finalizeMsaLeadershipV2(input: {
  msaCreditId: string
  activationEventId: string
  leadershipCount: number
  leadershipTotalCC: number
}): Promise<void> {
  const creditRef = db.collection('msa_credits').doc(input.msaCreditId)
  const reportRef = db
    .collection('package_activation_reports')
    .doc(input.activationEventId)

  await db.runTransaction(async (transaction: Transaction) => {
    const creditSnap = await transaction.get(creditRef)
    const reportSnap = await transaction.get(reportRef)
    if (!creditSnap.exists) return
    const creditData = creditSnap.data() || {}
    if (creditData.leadershipStatus === 'COMPLETED') return

    const reportData = reportSnap.exists ? reportSnap.data() || {} : {}
    const timestamp = new Date().toISOString()
    transaction.update(creditRef, {
      leadershipStatus: 'COMPLETED',
      leadershipCount: input.leadershipCount,
      leadershipTotalCC: input.leadershipTotalCC,
      updatedAt: timestamp,
    })
    if (reportSnap.exists) {
      transaction.update(reportRef, {
        leadershipFromMsaCount:
          Number(reportData.leadershipFromMsaCount || 0) +
          input.leadershipCount,
        leadershipFromMsaTotalCC: roundCCV2(
          Number(reportData.leadershipFromMsaTotalCC || 0) +
            input.leadershipTotalCC,
        ),
        updatedAt: timestamp,
      })
    }
  })
}

async function processMsaEntitlementsV2(now: Date): Promise<{
  processed: number
  credited: number
  leadershipTotalCC: number
}> {
  const config = await loadCompensationConfigurationV2()
  const snapshot = await db
    .collection('msa_entitlements')
    .where('status', '==', 'Active')
    .limit(500)
    .get()

  let processed = 0
  let credited = 0
  let leadershipTotalCC = 0

  for (const entitlementDoc of snapshot.docs) {
    const result = await processSingleMsaEntitlementV2(
      entitlementDoc.id,
      now,
      config,
    )
    processed += 1

    if (result.msaCreditId && result.creditedCC > 0) {
      credited += 1
      const leadership = await processLeadershipFromQualifiedSourceV2({
        activationEventId: result.activationEventId,
        sourceType: 'MSA_CREDIT',
        sourceRecordId: result.msaCreditId,
        sourceEarnerUid: result.beneficiaryUid,
        sourceEarnerMemberId: result.beneficiaryMemberId,
        qualifiedAmountCC: result.creditedCC,
        config,
      })
      leadershipTotalCC = roundCCV2(leadershipTotalCC + leadership.totalCC)
      await finalizeMsaLeadershipV2({
        msaCreditId: result.msaCreditId,
        activationEventId: result.activationEventId,
        leadershipCount: leadership.count,
        leadershipTotalCC: leadership.totalCC,
      })
    }
  }

  return { processed, credited, leadershipTotalCC }
}

/** Runs every day at exactly 1:00 PM Asia/Manila. */
export const processMsaCreditsSchedule = onSchedule(
  {
    schedule: '0 13 * * *',
    timeZone: 'Asia/Manila',
    region: FUNCTIONS_REGION,
  },
  async () => {
    const result = await processMsaEntitlementsV2(new Date())
    console.info('MSA schedule completed', result)
  },
)

/** Admin/Super Admin manual recovery endpoint for staging and retry operations. */
export const processMsaCreditsNow = onCall(
  { region: FUNCTIONS_REGION },
  async (request: CallableRequest<Record<string, never>>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication is required.')
    }
    const adminSnap = await db.collection('users').doc(request.auth.uid).get()
    const role = cleanStringV2(adminSnap.data()?.role)
    if (!adminSnap.exists || (role !== 'Admin' && role !== 'Super Admin')) {
      throw new HttpsError(
        'permission-denied',
        'Only Admin and Super Admin may run MSA recovery processing.',
      )
    }
    return {
      success: true,
      ...(await processMsaEntitlementsV2(new Date())),
    }
  },
)

/**
 * Accepts non-authoritative client telemetry/audit events without granting the
 * browser direct access to the immutable audit_logs collection.
 */
export const recordClientAuditEvent = onCall(
  { region: FUNCTIONS_REGION },
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication is required.')
    }
    const action = cleanStringV2(request.data?.action).slice(0, 100)
    const details = cleanStringV2(request.data?.details).slice(0, 2000)
    if (!action || !details) {
      throw new HttpsError(
        'invalid-argument',
        'Action and details are required.',
      )
    }
    const userSnap = await db.collection('users').doc(request.auth.uid).get()
    const userData = userSnap.data() || {}
    const timestamp = new Date().toISOString()
    const logId = deterministicFinancialIdV2(
      'LOG-CLIENT',
      `${request.auth.uid}:${action}:${timestamp}:${details}`,
    )
    await db
      .collection('audit_logs')
      .doc(logId)
      .set({
        id: logId,
        actorUid: request.auth.uid,
        actorEmail: cleanStringV2(userData.email),
        actorRole: cleanStringV2(userData.role),
        action: `CLIENT_EVENT_${action}`,
        details,
        authoritativeFinancialEvent: false,
        timestamp,
        createdAt: timestamp,
      })
    return { success: true, logId }
  },
)

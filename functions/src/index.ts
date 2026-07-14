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

const FIRESTORE_DATABASE_ID =
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
    cc: 25750,
    cap: 64375,
    php: 1802500,
  },
  'regional distributor': {
    name: 'Regional Distributor',
    cc: 105000,
    cap: 262500,
    php: 7350000,
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
    const { requestId } = data

    if (!requestId) {
      throw new HttpsError('invalid-argument', 'Request ID is required.')
    }

    const timestamp = new Date().toISOString()
    const idempotencyKey = `cash-in-approval:${requestId}`

    try {
      // 1. Verify admin permissions
      const adminDoc = await db.collection('users').doc(adminUid).get()
      if (!adminDoc.exists) {
        throw new HttpsError(
          'permission-denied',
          'Admin user profile not found.',
        )
      }
      const adminData = adminDoc.data() || {}
      const adminRole = adminData.role || ''
      if (adminRole !== 'Admin' && adminRole !== 'Super Admin') {
        throw new HttpsError(
          'permission-denied',
          'Unauthorized. Only Admin and Super Admin can approve cash-in requests.',
        )
      }

      const adminFullName = adminData.fullName || 'Admin'
      const adminEmail = adminData.email || ''

      // Check pre-existing idempotency
      const preCheckIdempotency = await db
        .collection('processed_idempotencies')
        .doc(idempotencyKey)
        .get()
      if (preCheckIdempotency.exists) {
        return preCheckIdempotency.data()
      }

      // 2. Run the atomic approval and wallet crediting inside transaction
      const transactionResult = await db.runTransaction(
        async (transaction: Transaction) => {
          // Re-read idempotency
          const idempotencyRef = db
            .collection('processed_idempotencies')
            .doc(idempotencyKey)
          const idempotencySnap = await transaction.get(idempotencyRef)
          if (idempotencySnap.exists) {
            return idempotencySnap.data()
          }

          const requestRef = db.collection('cashin_requests').doc(requestId)
          const requestSnap = await transaction.get(requestRef)

          if (!requestSnap.exists) {
            throw new Error('CASHIN_REQUEST_NOT_FOUND')
          }

          const reqData = requestSnap.data() || {}
          if (reqData.status !== 'Pending') {
            throw new Error('CASHIN_REQUEST_NOT_PENDING')
          }

          const targetUid = reqData.uid
          const userRef = db.collection('users').doc(targetUid)
          const userSnap = await transaction.get(userRef)

          if (!userSnap.exists) {
            throw new Error('USER_NOT_FOUND')
          }

          const userData = userSnap.data() || {}
          const amountCC = Number(reqData.computedCC || reqData.amountCC || 0)

          // update cashin request to Approved (credits cash-in)
          transaction.update(requestRef, {
            status: 'Approved',
            paymentStatus: 'APPROVED',
            approvedAt: timestamp,
            approvedBy: adminFullName,
            updatedAt: timestamp,
          })

          // Credit wallet
          const walletRef = db.collection('wallets').doc(targetUid)
          const walletSnap = await transaction.get(walletRef)
          let balanceBefore = 0
          let balanceAfter = amountCC

          if (!walletSnap.exists) {
            transaction.set(walletRef, {
              uid: targetUid,
              chosenWalletBalance: amountCC,
              commissionWalletBalance: 0,
              marketingSupportWalletBalance: 0,
              rewardWalletBalance: 0,
              cashWalletStatus: 'Active',
              createdAt: timestamp,
              updatedAt: timestamp,
            })
          } else {
            const walletData = walletSnap.data() || {}
            balanceBefore = Number(walletData.chosenWalletBalance || 0)
            balanceAfter = balanceBefore + amountCC
            transaction.update(walletRef, {
              chosenWalletBalance: balanceAfter,
              cashWalletStatus: 'Active',
              updatedAt: timestamp,
            })
          }

          // immutable ledger ledger debit/credit record
          const ledgerTxId = `TX-CREDIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
          const walletTxRef = db
            .collection('wallet_transactions')
            .doc(ledgerTxId)
          transaction.set(walletTxRef, {
            id: ledgerTxId,
            uid: targetUid,
            memberId: userData.memberId || '',
            amount: amountCC,
            amountCC: amountCC,
            direction: 'Credit',
            type: 'CREDIT',
            walletType: 'Chosen Wallet',
            transactionType: 'CASH_IN_CREDIT',
            description: `Approved Cash-In of ₱${Number(reqData.amountPHP || 0).toLocaleString()} (Credited ${amountCC} CC)`,
            status: 'Completed',
            createdAt: timestamp,
            completedAt: timestamp,
          })

          // Link cash-in to package purchase intent
          let linkedIntentId = reqData.packagePurchaseIntentId || null
          let isReadyToPurchase = false

          // If intent isn't explicitly linked but user has one pending, find it
          if (!linkedIntentId) {
            // We can't query inside a Firestore transaction cleanly, but we can search for the deterministic ID
            // for any package of this user! If a packageId was stored on the request, we construct the deterministic ID.
            if (reqData.packageId && reqData.accountPath) {
              const normalizedPkgIdNoSpaces = reqData.packageId
                .toLowerCase()
                .replace(/\s+/g, '')
              const intentVersion = 'v1'
              linkedIntentId = `package-intent:${targetUid}:${normalizedPkgIdNoSpaces}:${reqData.accountPath.toLowerCase().replace(/\s+/g, '-')}:${intentVersion}`
            }
          }

          if (linkedIntentId) {
            const intentRef = db
              .collection('package_purchase_intents')
              .doc(linkedIntentId)
            const intentSnap = await transaction.get(intentRef)

            if (intentSnap.exists) {
              const intentData = intentSnap.data() || {}
              const requiredAmountCC = Number(intentData.requiredAmountCC || 0)
              isReadyToPurchase = balanceAfter >= requiredAmountCC

              const updatedStatus = isReadyToPurchase
                ? 'READY_TO_PURCHASE'
                : 'CASH_IN_APPROVED'

              transaction.update(intentRef, {
                status: updatedStatus,
                cashInRequestId: requestId,
                availableBalanceCCAtCheck: balanceAfter,
                shortageCCAtCheck: Math.max(requiredAmountCC - balanceAfter, 0),
                updatedAt: timestamp,
              })

              // Write audit logs for intent status updates
              transaction.set(
                db.collection('audit_logs').doc(`LOG-${Date.now()}-INTENT-UPD`),
                {
                  id: `LOG-${Date.now()}-INTENT-UPD`,
                  actorUid: adminUid,
                  actorEmail: adminEmail,
                  action: 'PACKAGE_PURCHASE_INTENT_UPDATED',
                  details: `Updated package purchase intent ${linkedIntentId} status to ${updatedStatus}.`,
                  timestamp,
                },
              )

              if (isReadyToPurchase) {
                transaction.set(
                  db
                    .collection('audit_logs')
                    .doc(`LOG-${Date.now()}-READY-PUR`),
                  {
                    id: `LOG-${Date.now()}-READY-PUR`,
                    actorUid: targetUid,
                    actorEmail: userData.email || '',
                    action: 'PACKAGE_READY_TO_PURCHASE',
                    details: `Package purchase intent ${linkedIntentId} is READY_TO_PURCHASE with balance ${balanceAfter} CC.`,
                    timestamp,
                  },
                )
              }
            }
          }

          // audit log for approval
          const auditLogId = `LOG-${Date.now()}-APPROVE`
          transaction.set(db.collection('audit_logs').doc(auditLogId), {
            id: auditLogId,
            actorUid: adminUid,
            actorEmail: adminEmail,
            action: 'PACKAGE_CASH_IN_APPROVED',
            details: `Approved Cash-In of ₱${Number(reqData.amountPHP || 0).toLocaleString()} (Credited ${amountCC} CC) for ${userData.fullName} (${targetUid}).`,
            timestamp: timestamp,
          })

          // Save processed idempotency
          const resPayload = {
            success: true,
            requestId,
            isReadyToPurchase,
            creditedCC: amountCC,
          }
          transaction.set(idempotencyRef, {
            processed: true,
            completedAt: timestamp,
            result: resPayload,
          })

          return resPayload
        },
      )

      return transactionResult
    } catch (error: any) {
      console.error('Error in approveCashInAndActivatePackage:', error)
      const errMsg = error.message || ''
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
      throw new HttpsError(
        'internal',
        error.message || 'Approval process failed.',
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

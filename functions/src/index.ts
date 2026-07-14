import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as fs from "fs";
import * as path from "path";

const app = initializeApp();

function getFirestoreDatabaseId(): string {
  const paths = [
    path.join(__dirname, "firebase-applet-config.json"),
    path.join(__dirname, "..", "firebase-applet-config.json"),
    path.join(__dirname, "..", "..", "firebase-applet-config.json"),
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "..", "firebase-applet-config.json")
  ];

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const config = JSON.parse(fs.readFileSync(p, "utf8"));
        if (config.firestoreDatabaseId) {
          return config.firestoreDatabaseId;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return "ai-studio-choseninternatio-e8f32de0-3246-4255-97e0-380012b7fd9e";
}

const db = getFirestore(app, getFirestoreDatabaseId());

// Approved package configurations (fallbacks)
const PACKAGES: Record<string, { name: string; cc: number; cap: number; php: number }> = {
  bronze: { name: "Bronze", cc: 50, cap: 150, php: 3500 },
  silver: { name: "Silver", cc: 350, cap: 1050, php: 24500 },
  gold: { name: "Gold", cc: 1500, cap: 4500, php: 105000 },
  platinum: { name: "Platinum", cc: 3000, cap: 9000, php: 210000 },
  diamond: { name: "Diamond", cc: 5000, cap: 15000, php: 350000 },
  "city distributor": { name: "City Distributor", cc: 10000, cap: 30000, php: 700000 },
  "regional distributor": { name: "Regional Distributor", cc: 25000, cap: 75000, php: 1750000 },
  // Smart Customer packages
  "wellness starter kit": { name: "Wellness Starter Kit", cc: 20, cap: 50, php: 1400 },
  "family health essentials": { name: "Family Health Essentials", cc: 60, cap: 150, php: 4200 },
  "ultimate longevity system": { name: "Ultimate Longevity System", cc: 150, cap: 375, php: 10500 }
};

/**
 * Configuration-driven package loader from Firestore
 */
async function getPackageConfig(packageId: string): Promise<{ name: string; cc: number; cap: number; php: number } | null> {
  const normalizedId = packageId.toLowerCase().trim();
  
  try {
    // 1. Try loading from 'packages' collection
    const pkgDoc = await db.collection("packages").doc(normalizedId).get();
    if (pkgDoc.exists) {
      const data = pkgDoc.data();
      if (data) {
        const cc = Number(data.packageValueCC || data.cc || 0);
        const cap = Number(data.earningsCapCC || data.cap || (cc * 2.5));
        const php = Number(data.pricePHP || data.php || (cc * 70));
        return {
          name: data.name || packageId,
          cc,
          cap,
          php
        };
      }
    }
    
    // 2. Try matching by name
    const pkgQuery = await db.collection("packages").where("name", "==", packageId).limit(1).get();
    if (!pkgQuery.empty) {
      const data = pkgQuery.docs[0].data();
      const cc = Number(data.packageValueCC || data.cc || 0);
      const cap = Number(data.earningsCapCC || data.cap || (cc * 2.5));
      const php = Number(data.pricePHP || data.php || (cc * 70));
      return {
        name: data.name || packageId,
        cc,
        cap,
        php
      };
    }
  } catch (err) {
    console.warn("Failed to retrieve package from Firestore collection:", err);
  }

  // 3. Fallback to hardcoded list
  return PACKAGES[normalizedId] || null;
}

/**
 * Fetch approved CC conversion rate
 */
async function getCCRate(): Promise<number> {
  try {
    const doc = await db.collection("system_config").doc("cc_settings").get();
    if (doc.exists) {
      const data = doc.data();
      if (data && typeof data.cashInRatePHP === 'number') {
        return data.cashInRatePHP;
      }
    }
  } catch (err) {
    console.warn("Error reading cc_settings:", err);
  }
  return 70; // canonical default rate
}

/**
 * Submit Package Cash-In Request
 */
export const submitPackageCashInRequest = onCall({ region: "asia-southeast1" }, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Request is missing authentication credentials.");
  }

  const uid = request.auth.uid;
  const data = request.data || {};

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
    accountPath
  } = data;

  if (!packageId) {
    throw new HttpsError("invalid-argument", "Package ID is required.");
  }

  const pkg = await getPackageConfig(packageId);
  if (!pkg) {
    throw new HttpsError("invalid-argument", `Package ${packageId} is not supported.`);
  }

  if (!amountPHP || amountPHP <= 0) {
    throw new HttpsError("invalid-argument", "Amount PHP must be greater than zero.");
  }

  if (!referenceNumber) {
    throw new HttpsError("invalid-argument", "Reference number is required.");
  }

  if (!proofOfPaymentUrl) {
    throw new HttpsError("invalid-argument", "Proof of payment URL is required.");
  }

  try {
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data() || {};
    const timestamp = new Date().toISOString();
    const requestId = `CI-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const ccRate = await getCCRate();
    const computedCC = Number((amountPHP / ccRate).toFixed(4));

    const cashinData = {
      requestId,
      uid,
      memberId: userData.memberId || "",
      fullName: userData.fullName || "",
      email: userData.email || "",
      amountPHP: Number(amountPHP),
      computedCC: computedCC,
      ratePHPPerCC: ccRate,
      paymentMethod,
      referenceNumber,
      proofOfPaymentUrl,
      proofOfPaymentPath: proofOfPaymentPath || "",
      proofOfPaymentFileName: proofOfPaymentFileName || "",
      proofOfPaymentContentType: proofOfPaymentContentType || "",
      proofOfPaymentSizeBytes: Number(proofOfPaymentSizeBytes || 0),
      notes: notes || "",
      status: "Pending",
      paymentStatus: "PENDING_PAYMENT_REVIEW",
      packagePurchaseStatus: "PENDING",
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
      senderAccountName: senderAccountName || "",
      senderAccountNumber: senderAccountNumber || "",
      accountName: senderAccountName || "",
      accountNumber: senderAccountNumber || "",
      packagePurchaseIntentId: packagePurchaseIntentId || null,
      accountPath: accountPath || null
    };

    await db.collection("cashin_requests").doc(requestId).set(cashinData);

    // If purchase intent is provided, link and update it to CASH_IN_SUBMITTED
    if (packagePurchaseIntentId) {
      const intentRef = db.collection("package_purchase_intents").doc(packagePurchaseIntentId);
      await intentRef.update({
        status: "CASH_IN_SUBMITTED",
        cashInRequestId: requestId,
        updatedAt: timestamp
      });

      // Audit Log for intent update
      await db.collection("audit_logs").doc(`LOG-${Date.now()}-INTENT-SUB`).set({
        id: `LOG-${Date.now()}-INTENT-SUB`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_INTENT_UPDATED",
        details: `Updated intent ${packagePurchaseIntentId} status to CASH_IN_SUBMITTED. Cash-in request: ${requestId}.`,
        timestamp
      });
    }

    // Create general audit log
    await db.collection("audit_logs").doc(`LOG-${Date.now()}-CASHIN-SUB`).set({
      id: `LOG-${Date.now()}-CASHIN-SUB`,
      actorUid: uid,
      actorEmail: userData.email || "",
      action: "PACKAGE_CASH_IN_SUBMITTED",
      details: `Submitted Cash-In of ₱${Number(amountPHP).toLocaleString()} for package ${pkg.name}. Request ID: ${requestId}.`,
      timestamp
    });

    return { success: true, requestId };
  } catch (error: any) {
    console.error("Error in submitPackageCashInRequest:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Failed to submit cash-in request.");
  }
});

/**
 * Preview Package Purchase (checks balance, loads package, calculates shortages, creates intent if short)
 */
export const previewPackagePurchase = onCall({ region: "asia-southeast1" }, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication credentials are required.");
  }

  const uid = request.auth.uid;
  const data = request.data || {};
  const { packageId, accountPath } = data;

  if (!packageId) {
    throw new HttpsError("invalid-argument", "Package ID is required.");
  }
  if (!accountPath || (accountPath !== "Smart Customer" && accountPath !== "Affiliate")) {
    throw new HttpsError("invalid-argument", "Valid accountPath ('Smart Customer' or 'Affiliate') is required.");
  }

  try {
    // 1. Load user profile
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }
    const userData = userDoc.data() || {};

    // 2. Load Chosen Wallet balance
    const walletDoc = await db.collection("wallets").doc(uid).get();
    let availableBalanceCC = 0;
    if (walletDoc.exists) {
      availableBalanceCC = Number(walletDoc.data()?.chosenWalletBalance || 0);
    }

    // 3. Load approved package
    const pkg = await getPackageConfig(packageId);
    if (!pkg) {
      throw new HttpsError("not-found", `Approved package '${packageId}' not found in canonical configuration.`);
    }

    // Determine purchase type
    const currentPkg = userData.packageLevel || "None";
    let purchaseType = "Initial Activation";
    if (currentPkg !== "None") {
      purchaseType = "Upgrade";
    }

    const requiredAmountCC = pkg.cc;
    const shortageCC = Math.max(requiredAmountCC - availableBalanceCC, 0);
    const remainingBalanceAfterPurchaseCC = Math.max(availableBalanceCC - requiredAmountCC, 0);
    const hasSufficientBalance = availableBalanceCC >= requiredAmountCC;

    const timestamp = new Date().toISOString();

    // 4. Create or preserve purchase intent if balance is insufficient
    let intentId = "";
    if (!hasSufficientBalance) {
      // Deterministic idempotency identifier for intent
      const normalizedPkgId = pkg.name.toLowerCase().replace(/\s+/g, "");
      const intentVersion = "v1";
      intentId = `package-intent:${uid}:${normalizedPkgId}:${accountPath.toLowerCase().replace(/\s+/g, "-")}:${intentVersion}`;

      const intentRef = db.collection("package_purchase_intents").doc(intentId);
      const ccRate = await getCCRate();
      const estimatedCashInPHP = shortageCC * ccRate;

      const intentData = {
        intentId,
        uid,
        memberId: userData.memberId || "",
        packageId: normalizedPkgId,
        packageLevelSnapshot: pkg.name,
        packageValueCCSnapshot: pkg.cc,
        accountPath,
        requiredAmountCC,
        availableBalanceCCAtCheck: availableBalanceCC,
        shortageCCAtCheck: shortageCC,
        conversionRateSnapshot: ccRate,
        estimatedCashInPHP,
        status: "PENDING_CASH_IN",
        createdAt: timestamp,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days expiry
        completedAt: null,
        cashInRequestId: null,
        packageTransactionId: null,
        updatedAt: timestamp
      };

      await intentRef.set(intentData, { merge: true });

      // Create intent audit log
      await db.collection("audit_logs").doc(`LOG-${Date.now()}-INTENT-CRE`).set({
        id: `LOG-${Date.now()}-INTENT-CRE`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_INTENT_CREATED",
        details: `Created package purchase intent ${intentId} for ${pkg.name}. Shortage: ${shortageCC} CC (≈ ₱${estimatedCashInPHP.toLocaleString()}).`,
        timestamp
      });

      // Audit Log for package balance insufficient
      await db.collection("audit_logs").doc(`LOG-${Date.now()}-BAL-INSUFFICIENT`).set({
        id: `LOG-${Date.now()}-BAL-INSUFFICIENT`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_BALANCE_INSUFFICIENT",
        details: `Balance check for ${pkg.name} package purchase returned INSUFFICIENT. Required: ${requiredAmountCC} CC, Available: ${availableBalanceCC} CC, Shortage: ${shortageCC} CC.`,
        timestamp
      });
    } else {
      // Audit Log for package balance checked sufficient
      await db.collection("audit_logs").doc(`LOG-${Date.now()}-BAL-SUFFICIENT`).set({
        id: `LOG-${Date.now()}-BAL-SUFFICIENT`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_BALANCE_SUFFICIENT",
        details: `Balance check for ${pkg.name} package purchase returned SUFFICIENT. Required: ${requiredAmountCC} CC, Available: ${availableBalanceCC} CC.`,
        timestamp
      });
    }

    // General preview audit log
    await db.collection("audit_logs").doc(`LOG-${Date.now()}-PREVIEW`).set({
      id: `LOG-${Date.now()}-PREVIEW`,
      actorUid: uid,
      actorEmail: userData.email || "",
      action: "PACKAGE_PURCHASE_PREVIEWED",
      details: `Generated package purchase preview for ${pkg.name} (${accountPath}). Has sufficient balance: ${hasSufficientBalance}.`,
      timestamp
    });

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
      confirmationRequired: true
    };
  } catch (error: any) {
    console.error("Error in previewPackagePurchase:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Balance preview failed.");
  }
});

/**
 * Purchase Package With Wallet (atomic debit, activation, cycle creation, MSA creation, ledger transaction, compensation event)
 */
export const purchasePackageWithWallet = onCall({ region: "asia-southeast1" }, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication credentials are required.");
  }

  const uid = request.auth.uid;
  const data = request.data || {};
  const { packageId, accountPath, idempotencyKey } = data;

  if (!packageId) {
    throw new HttpsError("invalid-argument", "Package ID is required.");
  }
  if (!accountPath || (accountPath !== "Smart Customer" && accountPath !== "Affiliate")) {
    throw new HttpsError("invalid-argument", "Valid accountPath ('Smart Customer' or 'Affiliate') is required.");
  }
  if (!idempotencyKey) {
    throw new HttpsError("invalid-argument", "Idempotency key is required.");
  }

  const normalizedPkgId = packageId.toLowerCase().trim();
  const dbIdempotencyKey = `package-purchase:${uid}:${normalizedPkgId}:${idempotencyKey}`;

  try {
    const timestamp = new Date().toISOString();

    // 1. Recheck idempotency before transaction to avoid extra locks
    const preCheckIdempotency = await db.collection("processed_idempotencies").doc(dbIdempotencyKey).get();
    if (preCheckIdempotency.exists) {
      // Audit log duplicate blocked
      await db.collection("audit_logs").doc(`LOG-${Date.now()}-DUP-BLOCKED`).set({
        id: `LOG-${Date.now()}-DUP-BLOCKED`,
        actorUid: uid,
        actorEmail: "",
        action: "PACKAGE_PURCHASE_DUPLICATE_BLOCKED",
        details: `Duplicate package purchase blocked for user ${uid}. Idempotency key: ${dbIdempotencyKey}.`,
        timestamp
      });
      return preCheckIdempotency.data();
    }

    // 2. Execute transaction
    const transactionResult = await db.runTransaction(async (transaction) => {
      // Read idempotency again inside transaction
      const idempotencyRef = db.collection("processed_idempotencies").doc(dbIdempotencyKey);
      const idempotencySnap = await transaction.get(idempotencyRef);
      if (idempotencySnap.exists) {
        return idempotencySnap.data();
      }

      // Re-read user profile
      const userRef = db.collection("users").doc(uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error("USER_NOT_FOUND");
      }
      const userData = userSnap.data() || {};

      // Re-read wallet
      const walletRef = db.collection("wallets").doc(uid);
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists) {
        throw new Error("WALLET_NOT_FOUND");
      }
      const walletData = walletSnap.data() || {};
      const availableBalanceCC = Number(walletData.chosenWalletBalance || 0);

      // Re-read package configuration
      const pkg = await getPackageConfig(packageId);
      if (!pkg) {
        throw new Error("PACKAGE_NOT_FOUND");
      }

      const requiredAmountCC = pkg.cc;
      if (availableBalanceCC < requiredAmountCC) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Prohibit downgrade
      const currentPkgName = userData.packageLevel || "None";
      const downgradesAreBlocked = true; // Business requirement: no prohibited downgrade
      if (currentPkgName !== "None" && downgradesAreBlocked) {
        // Map packages order to compare
        const orderMap: Record<string, number> = {
          "none": 0, "bronze": 1, "silver": 2, "gold": 3, "platinum": 4, "diamond": 5, "city distributor": 6, "regional distributor": 7
        };
        const currentOrder = orderMap[currentPkgName.toLowerCase()] || 0;
        const newOrder = orderMap[pkg.name.toLowerCase()] || 0;
        if (newOrder < currentOrder) {
          throw new Error("PROHIBITED_DOWNGRADE");
        }
      }

      const balanceAfter = availableBalanceCC - requiredAmountCC;
      const packageTransactionId = `PKG-TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const activationType = currentPkgName === "None" ? "INITIAL_ACCOUNT_ACTIVATION" : "PACKAGE_UPGRADE_ACTIVATION";

      // Write PACKAGE_PURCHASE_DEBIT ledger record
      const ledgerRef = db.collection("wallet_transactions").doc(packageTransactionId);
      transaction.set(ledgerRef, {
        id: packageTransactionId,
        uid,
        memberId: userData.memberId || "",
        walletType: "Chosen Wallet",
        transactionType: "PACKAGE_PURCHASE_DEBIT",
        direction: "Debit",
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
        configurationVersion: "v1",
        status: "Completed",
        createdAt: timestamp,
        completedAt: timestamp,
        description: `Purchased ${pkg.name} Package using Chosen Wallet balance.`
      });

      // Deduct balance from Chosen Wallet
      transaction.update(walletRef, {
        chosenWalletBalance: balanceAfter,
        updatedAt: timestamp
      });

      // Update User accountType and packageLevel
      const isAffiliate = accountPath === "Affiliate";
      const userUpdates: Record<string, any> = {
        accountType: accountPath,
        packageLevel: pkg.name,
        role: isAffiliate ? "Affiliate" : "Customer",
        status: "Active",
        walletEnabled: true,
        activatedAt: timestamp,
        updatedAt: timestamp
      };

      if (isAffiliate) {
        userUpdates.commissionEligible = true;
        userUpdates.genealogyEnabled = true;
        userUpdates.businessCycleEnabled = true;
        userUpdates.msaStartDate = timestamp;
      }
      transaction.update(userRef, userUpdates);

      // Affiliate specific writes
      if (isAffiliate) {
        // Business Cycle Doc
        const cycleRef = db.collection("business_cycles").doc(uid);
        const businessCycleId = `BC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const earningsCapCC = requiredAmountCC * 2.5;

        transaction.set(cycleRef, {
          id: businessCycleId,
          uid,
          packageLevel: pkg.name,
          packageValueCC: requiredAmountCC,
          earningsCapCC: earningsCapCC,
          currentQualifiedEarningsCC: 0,
          remainingCapacityCC: earningsCapCC,
          progressPercentage: 0,
          status: "Active",
          createdAt: timestamp,
          updatedAt: timestamp
        });

        // MSA Entitlement Doc
        const msaRef = db.collection("msa_entitlements").doc(uid);
        transaction.set(msaRef, {
          uid,
          packageLevel: pkg.name,
          status: "Active",
          startDate: timestamp,
          accruedDailyCC: 0,
          lastCreditedDate: null,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        // Compensation Event
        const compensationEventId = `COMP-EVENT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        transaction.set(db.collection("package_compensation_events").doc(compensationEventId), {
          id: compensationEventId,
          uid,
          packageId: normalizedPkgId,
          packageName: pkg.name,
          packageValueCC: requiredAmountCC,
          paymentTransactionId: packageTransactionId,
          activationType,
          idempotencyKey: `package-compensation:${packageTransactionId}`,
          status: "Pending",
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      // If purchase intent exists for this user and package, mark as completed
      const normalizedPkgIdNoSpaces = pkg.name.toLowerCase().replace(/\s+/g, "");
      const intentVersion = "v1";
      const possibleIntentId = `package-intent:${uid}:${normalizedPkgIdNoSpaces}:${accountPath.toLowerCase().replace(/\s+/g, "-")}:${intentVersion}`;
      const intentRef = db.collection("package_purchase_intents").doc(possibleIntentId);
      
      transaction.set(intentRef, {
        status: "PURCHASE_COMPLETED",
        completedAt: timestamp,
        packageTransactionId,
        updatedAt: timestamp
      }, { merge: true });

      // Create success idempotency result
      const resultPayload = {
        success: true,
        packageTransactionId,
        packageName: pkg.name,
        amountCC: requiredAmountCC,
        balanceBefore: availableBalanceCC,
        balanceAfter: balanceAfter,
        activationType,
        accountPath
      };

      transaction.set(idempotencyRef, {
        processed: true,
        completedAt: timestamp,
        result: resultPayload
      });

      // General audit log for purchase processing and completion
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-PURCHASE-REQ`), {
        id: `LOG-${Date.now()}-PURCHASE-REQ`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_REQUESTED",
        details: `Requested purchase of ${pkg.name} package.`,
        timestamp
      });
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-PURCHASE-PROC`), {
        id: `LOG-${Date.now()}-PURCHASE-PROC`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_PROCESSING",
        details: `Processing atomic package purchase of ${pkg.name}.`,
        timestamp
      });
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-DEBITED`), {
        id: `LOG-${Date.now()}-DEBITED`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_DEBITED",
        details: `Debited ${requiredAmountCC} CC for ${pkg.name} package. Transaction ID: ${packageTransactionId}.`,
        timestamp
      });
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-PURCHASE-COMP`), {
        id: `LOG-${Date.now()}-PURCHASE-COMP`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_PURCHASE_COMPLETED",
        details: `Successfully completed purchase of ${pkg.name} package. Account activated as ${accountPath}.`,
        timestamp
      });
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-ACT-UPD`), {
        id: `LOG-${Date.now()}-ACT-UPD`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "ACCOUNT_TYPE_UPDATED",
        details: `Updated user accountType to '${accountPath}' and packageLevel to '${pkg.name}'.`,
        timestamp
      });
      transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-PKG-ACT`), {
        id: `LOG-${Date.now()}-PKG-ACT`,
        actorUid: uid,
        actorEmail: userData.email || "",
        action: "PACKAGE_ACTIVATED",
        details: `Activated ${pkg.name} package subscription.`,
        timestamp
      });

      if (isAffiliate) {
        transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-BC-CRE`), {
          id: `LOG-${Date.now()}-BC-CRE`,
          actorUid: uid,
          actorEmail: userData.email || "",
          action: "BUSINESS_CYCLE_CREATED",
          details: `Created Business Cycle for Affiliate track. Cap: ${requiredAmountCC * 2.5} CC.`,
          timestamp
        });
        transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-MSA-ACT`), {
          id: `LOG-${Date.now()}-MSA-ACT`,
          actorUid: uid,
          actorEmail: userData.email || "",
          action: "MSA_ENTITLEMENT_ACTIVATED",
          details: `Activated MSA entitlement for ${pkg.name} package.`,
          timestamp
        });
        transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-COMP-CRE`), {
          id: `LOG-${Date.now()}-COMP-CRE`,
          actorUid: uid,
          actorEmail: userData.email || "",
          action: "COMPENSATION_EVENT_CREATED",
          details: `Registered package compensation source event for genealogy.`,
          timestamp
        });
      }

      return resultPayload;
    });

    return transactionResult;
  } catch (error: any) {
    console.error("Error in purchasePackageWithWallet:", error);
    const errMsg = error.message || "";

    // Write failed audit log
    await db.collection("audit_logs").doc(`LOG-${Date.now()}-PURCHASE-FAIL`).set({
      id: `LOG-${Date.now()}-PURCHASE-FAIL`,
      actorUid: uid,
      actorEmail: "",
      action: "PACKAGE_PURCHASE_FAILED",
      details: `Failed purchase of package ${packageId}. Error: ${errMsg}.`,
      timestamp: new Date().toISOString()
    });

    if (errMsg === "USER_NOT_FOUND") {
      throw new HttpsError("not-found", "User profile not found.");
    }
    if (errMsg === "WALLET_NOT_FOUND") {
      throw new HttpsError("not-found", "User wallet profile not found.");
    }
    if (errMsg === "PACKAGE_NOT_FOUND") {
      throw new HttpsError("not-found", `Approved package '${packageId}' not found in canonical configuration.`);
    }
    if (errMsg === "PROHIBITED_DOWNGRADE") {
      throw new HttpsError("failed-precondition", "Prohibited downgrade. You cannot select a package lower than your current active level.");
    }
    if (errMsg === "INSUFFICIENT_BALANCE") {
      // Reload values to construct precise Failed Precondition response
      const walletDoc = await db.collection("wallets").doc(uid).get();
      const walletBalance = walletDoc.exists ? Number(walletDoc.data()?.chosenWalletBalance || 0) : 0;
      const pkg = await getPackageConfig(packageId);
      const reqAmount = pkg ? pkg.cc : 0;
      const shortage = Math.max(reqAmount - walletBalance, 0);

      throw new HttpsError("failed-precondition", "Insufficient Chosen Wallet balance.", {
        reason: "INSUFFICIENT_CHOSEN_WALLET_BALANCE",
        requiredAmountCC: reqAmount,
        availableBalanceCC: walletBalance,
        shortageCC: shortage,
        packageId,
        accountPath
      });
    }

    throw new HttpsError("internal", error.message || "Purchase transaction failed.");
  }
});

/**
 * Approve Cash-In (credits Chosen Wallet, links intent, updates intent status to READY_TO_PURCHASE when balance is sufficient)
 */
export const approveCashInAndActivatePackage = onCall({ region: "asia-southeast1" }, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Request is missing authentication credentials.");
  }

  const adminUid = request.auth.uid;
  const data = request.data || {};
  const { requestId } = data;

  if (!requestId) {
    throw new HttpsError("invalid-argument", "Request ID is required.");
  }

  const timestamp = new Date().toISOString();
  const idempotencyKey = `cash-in-approval:${requestId}`;

  try {
    // 1. Verify admin permissions
    const adminDoc = await db.collection("users").doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new HttpsError("permission-denied", "Admin user profile not found.");
    }
    const adminData = adminDoc.data() || {};
    const adminRole = adminData.role || "";
    if (adminRole !== "Admin" && adminRole !== "Super Admin") {
      throw new HttpsError("permission-denied", "Unauthorized. Only Admin and Super Admin can approve cash-in requests.");
    }

    const adminFullName = adminData.fullName || "Admin";
    const adminEmail = adminData.email || "";

    // Check pre-existing idempotency
    const preCheckIdempotency = await db.collection("processed_idempotencies").doc(idempotencyKey).get();
    if (preCheckIdempotency.exists) {
      return preCheckIdempotency.data();
    }

    // 2. Run the atomic approval and wallet crediting inside transaction
    const transactionResult = await db.runTransaction(async (transaction) => {
      // Re-read idempotency
      const idempotencyRef = db.collection("processed_idempotencies").doc(idempotencyKey);
      const idempotencySnap = await transaction.get(idempotencyRef);
      if (idempotencySnap.exists) {
        return idempotencySnap.data();
      }

      const requestRef = db.collection("cashin_requests").doc(requestId);
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists) {
        throw new Error("CASHIN_REQUEST_NOT_FOUND");
      }

      const reqData = requestSnap.data() || {};
      if (reqData.status !== "Pending") {
        throw new Error("CASHIN_REQUEST_NOT_PENDING");
      }

      const targetUid = reqData.uid;
      const userRef = db.collection("users").doc(targetUid);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userSnap.data() || {};
      const amountCC = Number(reqData.computedCC || reqData.amountCC || 0);

      // update cashin request to Approved (credits cash-in)
      transaction.update(requestRef, {
        status: "Approved",
        paymentStatus: "APPROVED",
        approvedAt: timestamp,
        approvedBy: adminFullName,
        updatedAt: timestamp
      });

      // Credit wallet
      const walletRef = db.collection("wallets").doc(targetUid);
      const walletSnap = await transaction.get(walletRef);
      let balanceBefore = 0;
      let balanceAfter = amountCC;

      if (!walletSnap.exists) {
        transaction.set(walletRef, {
          uid: targetUid,
          chosenWalletBalance: amountCC,
          commissionWalletBalance: 0,
          marketingSupportWalletBalance: 0,
          rewardWalletBalance: 0,
          cashWalletStatus: "Active",
          createdAt: timestamp,
          updatedAt: timestamp
        });
      } else {
        const walletData = walletSnap.data() || {};
        balanceBefore = Number(walletData.chosenWalletBalance || 0);
        balanceAfter = balanceBefore + amountCC;
        transaction.update(walletRef, {
          chosenWalletBalance: balanceAfter,
          cashWalletStatus: "Active",
          updatedAt: timestamp
        });
      }

      // immutable ledger ledger debit/credit record
      const ledgerTxId = `TX-CREDIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const walletTxRef = db.collection("wallet_transactions").doc(ledgerTxId);
      transaction.set(walletTxRef, {
        id: ledgerTxId,
        uid: targetUid,
        memberId: userData.memberId || "",
        amount: amountCC,
        amountCC: amountCC,
        direction: "Credit",
        type: "CREDIT",
        walletType: "Chosen Wallet",
        transactionType: "CASH_IN_CREDIT",
        description: `Approved Cash-In of ₱${Number(reqData.amountPHP || 0).toLocaleString()} (Credited ${amountCC} CC)`,
        status: "Completed",
        createdAt: timestamp,
        completedAt: timestamp
      });

      // Link cash-in to package purchase intent
      let linkedIntentId = reqData.packagePurchaseIntentId || null;
      let isReadyToPurchase = false;

      // If intent isn't explicitly linked but user has one pending, find it
      if (!linkedIntentId) {
        // We can't query inside a Firestore transaction cleanly, but we can search for the deterministic ID
        // for any package of this user! If a packageId was stored on the request, we construct the deterministic ID.
        if (reqData.packageId && reqData.accountPath) {
          const normalizedPkgIdNoSpaces = reqData.packageId.toLowerCase().replace(/\s+/g, "");
          const intentVersion = "v1";
          linkedIntentId = `package-intent:${targetUid}:${normalizedPkgIdNoSpaces}:${reqData.accountPath.toLowerCase().replace(/\s+/g, "-")}:${intentVersion}`;
        }
      }

      if (linkedIntentId) {
        const intentRef = db.collection("package_purchase_intents").doc(linkedIntentId);
        const intentSnap = await transaction.get(intentRef);
        
        if (intentSnap.exists) {
          const intentData = intentSnap.data() || {};
          const requiredAmountCC = Number(intentData.requiredAmountCC || 0);
          isReadyToPurchase = balanceAfter >= requiredAmountCC;

          const updatedStatus = isReadyToPurchase ? "READY_TO_PURCHASE" : "CASH_IN_APPROVED";

          transaction.update(intentRef, {
            status: updatedStatus,
            cashInRequestId: requestId,
            availableBalanceCCAtCheck: balanceAfter,
            shortageCCAtCheck: Math.max(requiredAmountCC - balanceAfter, 0),
            updatedAt: timestamp
          });

          // Write audit logs for intent status updates
          transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-INTENT-UPD`), {
            id: `LOG-${Date.now()}-INTENT-UPD`,
            actorUid: adminUid,
            actorEmail: adminEmail,
            action: "PACKAGE_PURCHASE_INTENT_UPDATED",
            details: `Updated package purchase intent ${linkedIntentId} status to ${updatedStatus}.`,
            timestamp
          });

          if (isReadyToPurchase) {
            transaction.set(db.collection("audit_logs").doc(`LOG-${Date.now()}-READY-PUR`), {
              id: `LOG-${Date.now()}-READY-PUR`,
              actorUid: targetUid,
              actorEmail: userData.email || "",
              action: "PACKAGE_READY_TO_PURCHASE",
              details: `Package purchase intent ${linkedIntentId} is READY_TO_PURCHASE with balance ${balanceAfter} CC.`,
              timestamp
            });
          }
        }
      }

      // audit log for approval
      const auditLogId = `LOG-${Date.now()}-APPROVE`;
      transaction.set(db.collection("audit_logs").doc(auditLogId), {
        id: auditLogId,
        actorUid: adminUid,
        actorEmail: adminEmail,
        action: "PACKAGE_CASH_IN_APPROVED",
        details: `Approved Cash-In of ₱${Number(reqData.amountPHP || 0).toLocaleString()} (Credited ${amountCC} CC) for ${userData.fullName} (${targetUid}).`,
        timestamp: timestamp
      });

      // Save processed idempotency
      const resPayload = { success: true, requestId, isReadyToPurchase, creditedCC: amountCC };
      transaction.set(idempotencyRef, {
        processed: true,
        completedAt: timestamp,
        result: resPayload
      });

      return resPayload;
    });

    return transactionResult;
  } catch (error: any) {
    console.error("Error in approveCashInAndActivatePackage:", error);
    const errMsg = error.message || "";
    if (errMsg === "CASHIN_REQUEST_NOT_FOUND") {
      throw new HttpsError("not-found", "Cash-in request record not found.");
    }
    if (errMsg === "CASHIN_REQUEST_NOT_PENDING") {
      throw new HttpsError("failed-precondition", "Cash-in request is no longer pending.");
    }
    if (errMsg === "USER_NOT_FOUND") {
      throw new HttpsError("not-found", "The user profile associated with this request could not be found.");
    }
    throw new HttpsError("internal", error.message || "Approval process failed.");
  }
});

export const executeP2PTransferV2 = onCall({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Unable to verify your session. Please sign in again.");
  }
  const senderUid = request.auth.uid;

  const { recipientMemberId, amountCC, memo, idempotencyKey } = request.data || {};

  // 1. INPUT VALIDATION
  if (!recipientMemberId || typeof recipientMemberId !== 'string') {
    throw new HttpsError("invalid-argument", "The recipient member ID is required and must be a string.");
  }
  if (typeof amountCC !== 'number' || !isFinite(amountCC)) {
    throw new HttpsError("invalid-argument", "The transfer amount must be a valid number.");
  }
  if (amountCC < 1) {
    throw new HttpsError("invalid-argument", "Minimum transfer amount is 1 CC.");
  }
  if (amountCC > 50000) {
    throw new HttpsError("invalid-argument", "Maximum transfer amount is 50,000 CC.");
  }

  // Validate decimal precision (maximum 4 decimal places)
  const amountString = amountCC.toString();
  const decimalParts = amountString.split('.');
  if (decimalParts.length > 1 && decimalParts[1].length > 4) {
    throw new HttpsError("invalid-argument", "The transfer amount exceeds the supported precision of 4 decimal places.");
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new HttpsError("invalid-argument", "The idempotency key is required.");
  }
  const keyRegex = /^[a-zA-Z0-9_:-]+$/;
  if (!keyRegex.test(idempotencyKey) || idempotencyKey.length > 128) {
    throw new HttpsError("invalid-argument", "The idempotency key matches an invalid format or exceeds length limitations.");
  }

  const cleanMemo = memo ? memo.toString().trim().slice(0, 100) : null;

  try {
    // 2. RESOLVE RECIPIENT PROFILE
    const recipientQuerySnap = await db.collection("users")
      .where("memberId", "==", recipientMemberId.trim().toUpperCase())
      .limit(1)
      .get();

    if (recipientQuerySnap.empty) {
      throw new HttpsError("not-found", "The recipient account is unavailable.");
    }
    const recipientUserDoc = recipientQuerySnap.docs[0];
    const recipientUserData = recipientUserDoc.data();
    const recipientUid = recipientUserDoc.id;

    if (recipientUid === senderUid) {
      throw new HttpsError("invalid-argument", "You cannot transfer credits to yourself.");
    }

    // 3. RUN TRANSACTION
    const transactionResult = await db.runTransaction(async (transaction) => {
      // A. Check idempotency
      const p2pDocRef = db.collection("p2p_transfers").doc(idempotencyKey);
      const p2pDocSnap = await transaction.get(p2pDocRef);
      if (p2pDocSnap.exists) {
        const existingData = p2pDocSnap.data();
        if (existingData && existingData.senderUid === senderUid && existingData.recipientMemberId === recipientMemberId && existingData.amountCC === amountCC) {
          return {
            success: true,
            transferId: idempotencyKey,
            feeTransactionId: existingData.feeTransactionId || "",
            amountCC: existingData.amountCC,
            feeCC: existingData.feeCC || existingData.platformTransferFeeCC,
            totalDebitCC: existingData.totalDebitCC,
            recipientName: existingData.recipientName || "",
            recipientId: existingData.recipientMemberId,
            referenceId: idempotencyKey,
            createdAt: existingData.createdAt,
            isDuplicate: true,
            message: 'This transfer was already completed.'
          };
        } else {
          throw new Error("ALREADY_COMPLETED");
        }
      }

      // B. Read Profile documents & configurations
      const senderUserRef = db.collection("users").doc(senderUid);
      const senderUserSnap = await transaction.get(senderUserRef);
      if (!senderUserSnap.exists) {
        throw new Error("SENDER_NOT_FOUND");
      }
      const senderUserData = senderUserSnap.data() || {};

      const recipientUserRef = db.collection("users").doc(recipientUid);
      const recipientUserSnap = await transaction.get(recipientUserRef);
      if (!recipientUserSnap.exists) {
        throw new Error("RECIPIENT_NOT_FOUND");
      }
      const recipientUserDataFromTrans = recipientUserSnap.data() || {};

      // Check account statuses
      if (senderUserData.status !== 'Active') {
        throw new Error("SENDER_INACTIVE");
      }
      if (recipientUserDataFromTrans.status !== 'Active') {
        throw new Error("RECIPIENT_INACTIVE");
      }
      if (senderUserData.walletEnabled === false) {
        throw new Error("SENDER_WALLET_DISABLED");
      }

      // Read wallets
      const senderWalletRef = db.collection("wallets").doc(senderUid);
      const senderWalletSnap = await transaction.get(senderWalletRef);
      if (!senderWalletSnap.exists) {
        throw new Error("SENDER_WALLET_NOT_INITIALIZED");
      }
      const senderWalletData = senderWalletSnap.data() || {};

      const recipientWalletRef = db.collection("wallets").doc(recipientUid);
      const recipientWalletSnap = await transaction.get(recipientWalletRef);
      if (!recipientWalletSnap.exists) {
        throw new Error("RECIPIENT_WALLET_NOT_INITIALIZED");
      }
      const recipientWalletData = recipientWalletSnap.data() || {};

      // Read system_config/cc_settings
      const ccSettingsRef = db.collection("system_config").doc("cc_settings");
      const ccSettingsSnap = await transaction.get(ccSettingsRef);
      if (!ccSettingsSnap.exists) {
        throw new Error("MISSING_CC_SETTINGS");
      }
      const ccSettingsData = ccSettingsSnap.data() || {};
      if (ccSettingsData.transferFeeEnabled === false) {
        throw new Error("INACTIVE_CC_SETTINGS");
      }
      const feeCC = ccSettingsData.p2pTransferFeeCC;
      if (typeof feeCC !== 'number' || isNaN(feeCC) || feeCC <= 0) {
        throw new Error("INVALID_FEE_VALUE");
      }
      if (feeCC !== 1) {
        throw new Error("FEE_VALUE_CONFLICT");
      }

      const totalDebitCC = amountCC + feeCC;

      // Read corporate treasury
      const treasuryRef = db.collection("system_treasuries").doc("SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY");
      const treasurySnap = await transaction.get(treasuryRef);

      // Confirm balance
      const senderBalance = Number(senderWalletData.chosenWalletBalance || 0);
      if (senderBalance < totalDebitCC) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // C. Update Wallet Balances
      const newSenderBalance = Number((senderBalance - totalDebitCC).toFixed(4));
      transaction.update(senderWalletRef, {
        chosenWalletBalance: newSenderBalance,
        updatedAt: new Date().toISOString()
      });

      const recipientBalance = Number(recipientWalletData.chosenWalletBalance || 0);
      const newRecipientBalance = Number((recipientBalance + amountCC).toFixed(4));
      transaction.update(recipientWalletRef, {
        chosenWalletBalance: newRecipientBalance,
        updatedAt: new Date().toISOString()
      });

      const currentTreasuryBalance = treasurySnap.exists ? Number(treasurySnap.data()?.balanceCC || 0) : 0;
      const newTreasuryBalance = Number((currentTreasuryBalance + feeCC).toFixed(4));
      if (!treasurySnap.exists) {
        transaction.set(treasuryRef, {
          id: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
          displayName: 'Technology Operations Treasury',
          accountType: 'SYSTEM_TREASURY',
          classification: 'CORPORATE_TECHNOLOGY_REVENUE',
          status: 'ACTIVE',
          balanceCC: newTreasuryBalance,
          isMemberWallet: false,
          isCommissionWallet: false,
          isPubliclyVisible: false,
          countsTowardBusinessCycle: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        transaction.update(treasuryRef, {
          balanceCC: newTreasuryBalance,
          updatedAt: new Date().toISOString()
        });
      }

      const timestamp = new Date().toISOString();
      const requestFingerprint = Buffer.from(JSON.stringify({
        senderUid,
        recipientUid,
        amountCC,
        memo: cleanMemo,
        idempotencyKey
      })).toString('base64');

      // D. Create P2P document
      const p2pTransferDoc = {
        id: idempotencyKey,
        transferId: idempotencyKey,
        idempotencyKey: idempotencyKey,
        requestFingerprint: requestFingerprint,
        senderUid: senderUid,
        senderMemberId: senderUserData.memberId || "",
        senderName: senderUserData.fullName || "",
        recipientUid: recipientUid,
        recipientMemberId: recipientUserData.memberId || "",
        recipientName: recipientUserData.fullName || "",
        amountCC: Number(amountCC),
        platformTransferFeeCC: feeCC,
        totalDebitCC: Number(totalDebitCC),
        feePayerUid: senderUid,
        publicFeeLabel: "Platform Transfer Fee",
        internalFeeDestination: "Corporate CTO Technology Operations Treasury",
        memo: cleanMemo,
        status: "Completed",
        completedAt: timestamp,
        createdAt: timestamp,
        initiatedBy: senderUid,
        source: "P2P_TRANSFER_GATE",
        configVersion: 2,
        feeCC: feeCC,
        transferType: "P2P_TRANSFER"
      };
      transaction.set(p2pDocRef, p2pTransferDoc);

      // E. Ledger Entry A: Sender transfer debit
      const txIdSenderDebit = `TX-${Date.now()}-SD-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.set(db.collection("wallet_transactions").doc(txIdSenderDebit), {
        id: txIdSenderDebit,
        uid: senderUid,
        memberId: senderUserData.memberId || '',
        amount: amountCC,
        amountCC: amountCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_DEBIT',
        balanceBefore: senderBalance,
        balanceAfter: senderBalance - amountCC,
        sourceTransferId: idempotencyKey,
        sourceTransferType: 'P2P_TRANSFER',
        payerUid: senderUid,
        receiverUid: recipientUid,
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Transfer to ${recipientUserData.fullName} (IAM-${recipientUserData.memberId})`,
        idempotencyKey: `${idempotencyKey}:sender_transfer_debit`,
        createdAt: timestamp,
        completedAt: timestamp
      });

      // Ledger Entry B: Sender Platform Transfer Fee debit
      const txIdSenderFeeDebit = `TX-${Date.now()}-SFD-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.set(db.collection("wallet_transactions").doc(txIdSenderFeeDebit), {
        id: txIdSenderFeeDebit,
        uid: senderUid,
        memberId: senderUserData.memberId || '',
        amount: feeCC,
        amountCC: feeCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen',
        transactionType: 'PLATFORM_TRANSFER_FEE_DEBIT',
        balanceBefore: senderBalance - amountCC,
        balanceAfter: newSenderBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: 'P2P_TRANSFER',
        sourceFeeTransactionId: `${idempotencyKey}:fee_tx`,
        payerUid: senderUid,
        receiverUid: recipientUid,
        destinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        feeConfigurationVersion: 'v2.0',
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
        idempotencyKey: `${idempotencyKey}:sender_fee_debit`,
        createdAt: timestamp,
        completedAt: timestamp
      });

      // Ledger Entry C: Receiver transfer credit
      const txIdRecipientCredit = `TX-${Date.now()}-RC-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.set(db.collection("wallet_transactions").doc(txIdRecipientCredit), {
        id: txIdRecipientCredit,
        uid: recipientUid,
        memberId: recipientUserData.memberId || '',
        amount: amountCC,
        amountCC: amountCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_CREDIT',
        balanceBefore: recipientBalance,
        balanceAfter: newRecipientBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: 'P2P_TRANSFER',
        payerUid: senderUid,
        receiverUid: recipientUid,
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Transfer from ${senderUserData.fullName} (IAM-${senderUserData.memberId})`,
        idempotencyKey: `${idempotencyKey}:recipient_transfer_credit`,
        createdAt: timestamp,
        completedAt: timestamp
      });

      // Ledger Entry D: Technology Operations Treasury fee credit
      const txIdTreasuryCredit = `TX-${Date.now()}-TC-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.set(db.collection("wallet_transactions").doc(txIdTreasuryCredit), {
        id: txIdTreasuryCredit,
        systemAccountId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        amount: feeCC,
        amountCC: feeCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'System',
        transactionType: 'TECHNOLOGY_TREASURY_FEE_CREDIT',
        balanceBefore: currentTreasuryBalance,
        balanceAfter: newTreasuryBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: 'P2P_TRANSFER',
        sourceFeeTransactionId: `${idempotencyKey}:fee_tx`,
        payerUid: senderUid,
        receiverUid: recipientUid,
        destinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        feeConfigurationVersion: 'v2.0',
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
        idempotencyKey: `${idempotencyKey}:treasury_fee_credit`,
        createdAt: timestamp,
        completedAt: timestamp
      });

      // Create transfer_fee_transactions
      const feeTxId = `FEE-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.set(db.collection("transfer_fee_transactions").doc(feeTxId), {
        feeTransactionId: feeTxId,
        sourceTransferId: idempotencyKey,
        sourceTransferType: 'P2P_TRANSFER',
        sourceTransferStatus: 'COMPLETED',
        payerUid: senderUid,
        payerMemberId: senderUserData.memberId || '',
        payerName: senderUserData.fullName || '',
        receiverUid: recipientUid,
        receiverMemberId: recipientUserData.memberId || '',
        receiverName: recipientUserData.fullName || '',
        feeType: 'PLATFORM_TRANSFER_FEE',
        feeAmountType: 'FIXED',
        feeAmountCC: feeCC,
        transferAmountCC: amountCC,
        totalSenderDeductionCC: totalDebitCC,
        destinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        publicDescription: 'Platform Transfer Fee',
        internalClassification: 'CORPORATE_TECHNOLOGY_REVENUE',
        senderFeeLedgerTransactionId: txIdSenderFeeDebit,
        treasuryLedgerTransactionId: txIdTreasuryCredit,
        configurationVersion: 'v2.0',
        idempotencyKey: `platform-transfer-fee:${idempotencyKey}:PLATFORM_TRANSFER_FEE`,
        status: 'COMPLETED',
        reversalStatus: 'NOT_REVERSED',
        reversedAmountCC: 0,
        reversalTransactionId: null,
        createdAt: timestamp,
        completedAt: timestamp,
        updatedAt: timestamp
      });

      // Create audit_logs record
      const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      transaction.set(db.collection("audit_logs").doc(logId), {
        id: logId,
        actorUid: senderUid,
        actorEmail: senderUserData.email || '',
        action: 'P2P_TRANSFER',
        details: `Transferred ${amountCC} CC to member IAM-${recipientUserData.memberId} (${recipientUserData.fullName}). Fee: 1 CC. Ref: ${idempotencyKey}`,
        timestamp: timestamp
      });

      return {
        success: true,
        transferId: idempotencyKey,
        feeTransactionId: feeTxId,
        amountCC: Number(amountCC),
        feeCC: Number(feeCC),
        totalDebitCC: Number(totalDebitCC),
        recipientName: recipientUserData.fullName,
        recipientId: recipientUserData.memberId,
        referenceId: idempotencyKey,
        createdAt: timestamp
      };
    });

    return transactionResult;
  } catch (error: any) {
    console.error("Error in executeP2PTransferV2:", error);
    const errMsg = error.message || "";
    if (errMsg === "INSUFFICIENT_BALANCE") {
      throw new HttpsError("failed-precondition", "Your Chosen Wallet balance is insufficient for the transfer and Platform Transfer Fee.");
    }
    if (errMsg === "ALREADY_COMPLETED") {
      throw new HttpsError("already-exists", "This transfer was already completed.");
    }
    if (errMsg === "SENDER_INACTIVE" || errMsg === "SENDER_NOT_FOUND") {
      throw new HttpsError("failed-precondition", "Unable to verify your session. Please sign in again.");
    }
    if (errMsg === "RECIPIENT_INACTIVE" || errMsg === "RECIPIENT_NOT_FOUND") {
      throw new HttpsError("failed-precondition", "The recipient account is unavailable.");
    }
    if (errMsg === "SENDER_WALLET_DISABLED") {
      throw new HttpsError("permission-denied", "P2P transfers are disabled for your account.");
    }
    if (errMsg === "MISSING_CC_SETTINGS" || errMsg === "INACTIVE_CC_SETTINGS" || errMsg === "INVALID_FEE_VALUE" || errMsg === "FEE_VALUE_CONFLICT") {
      throw new HttpsError("failed-precondition", "Platform transfer fee configuration conflicts with the current approved version.");
    }
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "The transfer could not be completed. No credits were deducted.");
  }
});

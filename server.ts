import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { getApps, initializeApp as initializeAdminApp, getApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

// Initialize Firebase App for the server using the configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Enforce production project ID configuration and prevent staging mismatch
firebaseConfig.projectId = 'iamchosen-web-app';

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Detect if we are running in a Google Cloud Platform runtime
const isGoogleCloud = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.K_SERVICE);

// Initialize firebase-admin SDK with fallback for local development
const adminApp = getApps().length === 0 
  ? initializeAdminApp(isGoogleCloud ? {} : { projectId: firebaseConfig.projectId })
  : getApp();

const resolvedProjectId = adminApp.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || firebaseConfig.projectId;
const EXPECTED_PROJECT_ID = 'iamchosen-web-app';

// Structured safe diagnostics
console.log('--- STARTUP DIAGNOSTICS ---');
console.log(`GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT || 'undefined'}`);
console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT || 'undefined'}`);
console.log(`FIREBASE_CONFIG projectId: ${process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : 'undefined'}`);
console.log(`Firebase Admin app projectId: ${adminApp.options.projectId || 'undefined'}`);
console.log(`Expected project: ${EXPECTED_PROJECT_ID}`);
console.log(`Resolved project: ${resolvedProjectId}`);
console.log(`Function name: ${process.env.K_SERVICE || 'N/A'}`);
console.log(`Function region: asia-southeast1`);
console.log('---------------------------');

// Startup assertion
if (resolvedProjectId !== EXPECTED_PROJECT_ID) {
  console.error(`FATAL ERROR: Resolved Firebase project ID "${resolvedProjectId}" is not "${EXPECTED_PROJECT_ID}". Stopping backend.`);
  process.exit(1);
}

const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
const adminAuth = getAdminAuth(adminApp);

const PACKAGES: Record<string, { name: string; cc: number; php: number; cap: number }> = {
  bronze: { name: 'Bronze', cc: 50, php: 3500, cap: 125 },
  silver: { name: 'Silver', cc: 350, php: 24500, cap: 875 },
  gold: { name: 'Gold', cc: 1500, php: 105000, cap: 3750 },
  platinum: { name: 'Platinum', cc: 3000, php: 210000, cap: 7500 },
  diamond: { name: 'Diamond', cc: 5000, php: 350000, cap: 12500 }
};

const LEVEL_RATES: Record<number, number> = {
  1: 0.04, // Level 1 (Direct Referral)
  2: 0.025, // Level 2
  3: 0.025, // Level 3
  4: 0.025, // Level 4
  5: 0.025, // Level 5
  6: 0.01,  // Level 6
  7: 0.01,  // Level 7
  8: 0.01,  // Level 8
  9: 0.01,  // Level 9
  10: 0.01, // Level 10
  11: 0.005, // Level 11
  12: 0.005, // Level 12
  13: 0.005, // Level 13
  14: 0.005, // Level 14
  15: 0.005  // Level 15
};

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for secure commission simulation (server-authoritative)
app.post('/api/simulate-commission', async (req, res) => {
  const { uid, amountCC, bonusType } = req.body;

  if (!uid || typeof amountCC !== 'number' || !bonusType) {
    res.status(400).json({ error: 'Missing required parameters' });
    return;
  }

  try {
    // 1. Fetch Earner's User Profile
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    const userProfile = userDocSnap.data();

    // 2. Fetch Earner's Wallet
    const walletDocRef = doc(db, 'wallets', uid);
    const walletDocSnap = await getDoc(walletDocRef);
    if (!walletDocSnap.exists()) {
      res.status(404).json({ error: 'User wallet not found' });
      return;
    }
    const wallet = walletDocSnap.data();

    // 3. Fetch Earner's Active Business Cycle
    const cycleDocRef = doc(db, 'business_cycles', uid);
    const cycleDocSnap = await getDoc(cycleDocRef);
    const businessCycle = cycleDocSnap.exists() ? cycleDocSnap.data() : null;

    // 4. Fetch System Settings (for conversion rates)
    const settingsDocRef = doc(db, 'system_config', 'cc_settings');
    const settingsDocSnap = await getDoc(settingsDocRef);
    const ccSettings = settingsDocSnap.exists() ? settingsDocSnap.data() : { cashInRatePHP: 70, cashOutRatePHP: 69, currency: 'PHP' };

    // 5. Find Super Admin to flush to if needed
    let adminUid = '';
    const adminQuery = query(
      collection(db, 'users'),
      where('email', '==', 'admin@iamchosen.app'),
      where('role', '==', 'Super Admin')
    );
    const adminSnap = await getDocs(adminQuery);
    if (!adminSnap.empty) {
      adminUid = adminSnap.docs[0].id;
    } else {
      const fallbackQuery = query(
        collection(db, 'users'),
        where('role', '==', 'Super Admin')
      );
      const fallbackSnap = await getDocs(fallbackQuery);
      if (!fallbackSnap.empty) {
        adminUid = fallbackSnap.docs[0].id;
      }
    }

    let cycleCompleted = false;
    let newEarnings = amountCC;
    let isFlushed = false;

    const batch = writeBatch(db);

    if (businessCycle) {
      if (businessCycle.status === 'Completed') {
        isFlushed = true;
        newEarnings = 0;
      } else {
        const potentialCap = (businessCycle.currentQualifiedEarningsCC || 0) + amountCC;
        if (potentialCap >= (businessCycle.earningsCapCC || 0)) {
          newEarnings = Number(((businessCycle.earningsCapCC || 0) - (businessCycle.currentQualifiedEarningsCC || 0)).toFixed(2));
          cycleCompleted = true;
        }

        const finalEarnings = Number(((businessCycle.currentQualifiedEarningsCC || 0) + newEarnings).toFixed(2));
        const remaining = Number(((businessCycle.earningsCapCC || 0) - finalEarnings).toFixed(2));

        batch.update(doc(db, 'business_cycles', uid), {
          currentQualifiedEarningsCC: finalEarnings,
          remainingCapacityCC: remaining,
          progressPercentage: Number(((finalEarnings / (businessCycle.earningsCapCC || 1)) * 100).toFixed(0)),
          status: cycleCompleted ? 'Completed' : 'Active',
          completedAt: cycleCompleted ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString()
        });

        if (cycleCompleted) {
          batch.update(doc(db, 'users', uid), {
            status: 'Completed',
            commissionEligible: false,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    if (!isFlushed) {
      // Update earner's balances
      batch.update(doc(db, 'wallets', uid), {
        commissionWalletBalance: Number(((wallet.commissionWalletBalance || 0) + newEarnings).toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      // Write commissions log
      const commissionId = `COMM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'commissions', commissionId), {
        id: commissionId,
        earnerUid: uid,
        earnerMemberId: userProfile.memberId || '',
        earnerFullName: userProfile.fullName || '',
        amountCC: newEarnings,
        commissionType: 'Direct Referral',
        description: `Simulated: ${bonusType}`,
        status: 'Credited',
        createdAt: new Date().toISOString()
      });

      // Write wallet transaction logs
      const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'wallet_transactions', txId), {
        id: txId,
        uid: uid,
        amount: newEarnings,
        amountCC: newEarnings,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Commission',
        transactionType: 'Commission',
        description: `Simulated Earn: ${bonusType}`,
        status: 'Completed',
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      // Write audit log
      const logId = `LOG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'audit_logs', logId), {
        id: logId,
        actorUid: uid,
        actorEmail: userProfile.email || '',
        action: 'COMMISSION_SIMULATED',
        details: `Simulated receipt of ${newEarnings} CC ${bonusType}. Business Cycle update: ${cycleCompleted ? 'COMPLETED' : 'ACTIVE'}`,
        timestamp: new Date().toISOString()
      });

    } else if (adminUid) {
      // Process flushed commission simulation
      const adminWalletDocRef = doc(db, 'wallets', adminUid);
      const adminWalletSnap = await getDoc(adminWalletDocRef);
      let currentAdminBalance = 0;
      if (adminWalletSnap.exists()) {
        const adminWalletData = adminWalletSnap.data();
        currentAdminBalance = adminWalletData.commissionWalletBalance || 0;
      }

      batch.update(doc(db, 'wallets', adminUid), {
        commissionWalletBalance: Number((currentAdminBalance + amountCC).toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      const flushedCommissionId = `FLUSH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const originalCommissionId = `COMM-FLUSH-${Date.now()}`;

      batch.set(doc(db, 'flushed_commissions', flushedCommissionId), {
        flushedCommissionId,
        originalCommissionId,
        originalEarnerUid: uid,
        originalEarnerMemberId: userProfile.memberId || '',
        originalEarnerName: userProfile.fullName || '',
        sourceUid: 'SIMULATED_SOURCE',
        sourceMemberId: 'SIM-001',
        sourceTransactionId: `TX-SIM-${Date.now()}`,
        commissionType: 'Direct Referral',
        amountCC: amountCC,
        packageLevel: userProfile.packageLevel || 'Bronze',
        phpEquivalent: Number((amountCC * (ccSettings.cashInRatePHP || 70)).toFixed(2)),
        reason: 'BUSINESS_CYCLE_COMPLETED',
        businessCycleId: uid,
        businessCycleStatus: 'Completed',
        earningsCapCC: businessCycle?.earningsCapCC || 0,
        currentQualifiedEarningsCC: businessCycle?.currentQualifiedEarningsCC || 0,
        flushedToEmail: 'admin@iamchosen.app',
        status: 'Flushed',
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      });

      // Create wallet transaction for Super Admin
      const adminTxId = `TX-FLUSH-${Date.now()}`;
      batch.set(doc(db, 'wallet_transactions', adminTxId), {
        id: adminTxId,
        uid: adminUid,
        amount: amountCC,
        type: 'CREDIT',
        walletType: 'Commission',
        description: `Flushed Direct Commission from ${userProfile.fullName || ''} (${userProfile.memberId || ''})`,
        status: 'Completed',
        createdAt: new Date().toISOString()
      });

      // Create notifications for Super Admin
      const adminNotifId = `NOTIF-ADMIN-${Date.now()}`;
      batch.set(doc(db, 'notifications', adminNotifId), {
        id: adminNotifId,
        uid: adminUid,
        title: 'Business Cycle Commission Flushed',
        message: `${amountCC} CC was flushed from ${userProfile.fullName || ''} because their Business Cycle is completed.`,
        type: 'system',
        unread: true,
        createdAt: new Date().toISOString()
      });

      // Create notification for original earner
      const memberNotifId = `NOTIF-MEMBER-${Date.now()}`;
      batch.set(doc(db, 'notifications', memberNotifId), {
        id: memberNotifId,
        uid: uid,
        title: 'Commission Eligibility Paused',
        message: 'Your commission eligibility is paused because your Business Cycle is completed. Reactivate or upgrade to continue earning.',
        type: 'warning',
        unread: true,
        createdAt: new Date().toISOString()
      });

      // Log to audit logs for flushing
      const flushLogId = `LOG-FLUSH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      batch.set(doc(db, 'audit_logs', flushLogId), {
        id: flushLogId,
        actorUid: 'system',
        actorRole: 'System',
        action: 'COMMISSION_FLUSHED_BUSINESS_CYCLE_COMPLETED',
        targetCollection: 'flushed_commissions',
        targetId: flushedCommissionId,
        beforeData: null,
        afterData: {
          originalEarnerUid: uid,
          originalEarnerMemberId: userProfile.memberId || '',
          commissionType: 'Direct Referral',
          amountCC: amountCC,
          reason: 'BUSINESS_CYCLE_COMPLETED',
          flushedToEmail: 'admin@iamchosen.app'
        },
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });
    }

    await batch.commit();

    res.json({
      success: true,
      newEarnings: isFlushed ? 0 : newEarnings,
      cycleCompleted,
      isFlushed
    });
  } catch (error: any) {
    console.error('Server commission simulation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Secure backend multi-level compensation calculator and distributor
async function processActivationCompensation(uid: string, pkg: any, idempotencyKey: string) {
  try {
    // 1. Check if already processed
    const compCheckRef = adminDb.collection('processed_compensations').doc(idempotencyKey);
    const compCheckSnap = await compCheckRef.get();
    if (compCheckSnap.exists) {
      console.log('Compensation already processed for', idempotencyKey);
      return;
    }

    // 2. Fetch direct user
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return;
    const user = userSnap.data() || {};

    let currentParentUid = user.referredBy || '';
    if (!currentParentUid) {
      await compCheckRef.set({ processedAt: new Date().toISOString() });
      return;
    }

    // Find Super Admin info
    let adminUid = '';
    const adminSnap = await adminDb.collection('users')
      .where('email', '==', 'admin@iamchosen.app')
      .where('role', '==', 'Super Admin')
      .get();
    if (!adminSnap.empty) {
      adminUid = adminSnap.docs[0].id;
    }

    // We will collect all database writes to perform them inside an atomic transaction at the end
    const dbWrites: Array<{
      type: 'set' | 'update';
      ref: any;
      data: any;
    }> = [];

    // Map to keep track of running updates in memory so we don't double-credit or read stale balances
    const walletBalancesMemory: Record<string, number> = {};
    const cycleEarningsMemory: Record<string, number> = {};

    const getWalletBalance = async (userId: string) => {
      if (walletBalancesMemory[userId] !== undefined) {
        return walletBalancesMemory[userId];
      }
      const snap = await adminDb.collection('wallets').doc(userId).get();
      const bal = snap.exists ? (snap.data()?.commissionWalletBalance || 0) : 0;
      walletBalancesMemory[userId] = bal;
      return bal;
    };

    const getCycleQualifiedEarnings = async (userId: string) => {
      if (cycleEarningsMemory[userId] !== undefined) {
        return cycleEarningsMemory[userId];
      }
      const snap = await adminDb.collection('business_cycles').doc(userId).get();
      const earn = snap.exists ? (snap.data()?.currentQualifiedEarningsCC || 0) : 0;
      cycleEarningsMemory[userId] = earn;
      return earn;
    };

    // Traverse up to 15 levels
    for (let level = 1; level <= 15; level++) {
      if (!currentParentUid) break;

      const parentSnap = await adminDb.collection('users').doc(currentParentUid).get();
      if (!parentSnap.exists) break;
      const parent = parentSnap.data() || {};

      const parentPackage = parent.packageLevel || 'Bronze';
      let maxDepth = 5;
      if (parentPackage === 'Silver') maxDepth = 10;
      if (parentPackage === 'Gold' || parentPackage === 'Platinum' || parentPackage === 'Diamond') maxDepth = 15;

      if (level <= maxDepth) {
        const rate = LEVEL_RATES[level] || 0.005;
        const rawAmount = Number((pkg.cc * rate).toFixed(2));

        const isEligible = parent.accountType === 'Affiliate' && parent.status === 'Active' && parent.commissionEligible !== false;

        const parentCycleSnap = await adminDb.collection('business_cycles').doc(currentParentUid).get();

        let creditedAmount = rawAmount;
        let flushedAmount = 0;
        let cycleCompleted = false;

        if (parentCycleSnap.exists && isEligible) {
          const cycle = parentCycleSnap.data() || {};
          if (cycle.status === 'Active') {
            const earningsCap = cycle.earningsCapCC || 0;
            const currentEarnings = await getCycleQualifiedEarnings(currentParentUid);
            const remaining = Number((earningsCap - currentEarnings).toFixed(2));

            if (rawAmount >= remaining) {
              creditedAmount = remaining;
              flushedAmount = Number((rawAmount - remaining).toFixed(2));
              cycleCompleted = true;
            } else {
              creditedAmount = rawAmount;
              flushedAmount = 0;
            }

            const newEarnings = Number((currentEarnings + creditedAmount).toFixed(2));
            const newRemaining = Number((earningsCap - newEarnings).toFixed(2));
            const progress = Number(((newEarnings / (earningsCap || 1)) * 100).toFixed(0));

            cycleEarningsMemory[currentParentUid] = newEarnings;

            dbWrites.push({
              type: 'update',
              ref: adminDb.collection('business_cycles').doc(currentParentUid),
              data: {
                currentQualifiedEarningsCC: newEarnings,
                remainingCapacityCC: newRemaining,
                progressPercentage: progress,
                status: cycleCompleted ? 'Completed' : 'Active',
                completedAt: cycleCompleted ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
              }
            });

            if (cycleCompleted) {
              dbWrites.push({
                type: 'update',
                ref: adminDb.collection('users').doc(currentParentUid),
                data: {
                  status: 'Completed',
                  commissionEligible: false,
                  updatedAt: new Date().toISOString()
                }
              });

              const cycleCompletedNotifId = `NOTIF-BC-${Date.now()}-${currentParentUid}`;
              dbWrites.push({
                type: 'set',
                ref: adminDb.collection('notifications').doc(cycleCompletedNotifId),
                data: {
                  id: cycleCompletedNotifId,
                  uid: currentParentUid,
                  title: 'Business Cycle Completed',
                  message: `Congratulations! Your business cycle for ${parentPackage} has reached its earnings cap. Please reactivate or upgrade to resume commission earnings.`,
                  type: 'warning',
                  unread: true,
                  createdAt: new Date().toISOString()
                }
              });
            }
          } else {
            creditedAmount = 0;
            flushedAmount = rawAmount;
          }
        } else {
          creditedAmount = 0;
          flushedAmount = rawAmount;
        }

        if (creditedAmount > 0) {
          const currentBal = await getWalletBalance(currentParentUid);
          const newBal = Number((currentBal + creditedAmount).toFixed(2));
          walletBalancesMemory[currentParentUid] = newBal;

          dbWrites.push({
            type: 'update',
            ref: adminDb.collection('wallets').doc(currentParentUid),
            data: {
              commissionWalletBalance: newBal,
              updatedAt: new Date().toISOString()
            }
          });

          const commEarnedNotifId = `NOTIF-COMM-${Date.now()}-${currentParentUid}`;
          dbWrites.push({
            type: 'set',
            ref: adminDb.collection('notifications').doc(commEarnedNotifId),
            data: {
              id: commEarnedNotifId,
              uid: currentParentUid,
              title: level === 1 ? 'Direct Referral Commission Credited' : 'Unilevel Commission Credited',
              message: `You earned ${creditedAmount} CC from the activation of ${user.fullName || ''}.`,
              type: 'commission',
              unread: true,
              createdAt: new Date().toISOString()
            }
          });
        }

        const commissionId = `COMM-${Date.now()}-L${level}-${Math.floor(100 + Math.random() * 900)}`;
        dbWrites.push({
          type: 'set',
          ref: adminDb.collection('commissions').doc(commissionId),
          data: {
            id: commissionId,
            earnerUid: currentParentUid,
            earnerMemberId: parent.memberId || '',
            earnerFullName: parent.fullName || '',
            sourceUid: uid,
            sourceMemberId: user.memberId || '',
            sourceFullName: user.fullName || '',
            amountCC: creditedAmount,
            commissionType: level === 1 ? 'Direct Referral' : 'Unilevel',
            level: level,
            packageLevel: pkg.name,
            status: 'Credited',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });

        if (creditedAmount > 0) {
          const wTxId = `TX-CREDIT-${Date.now()}-L${level}-${Math.floor(100 + Math.random() * 900)}`;
          dbWrites.push({
            type: 'set',
            ref: adminDb.collection('wallet_transactions').doc(wTxId),
            data: {
              id: wTxId,
              uid: currentParentUid,
              amount: creditedAmount,
              amountCC: creditedAmount,
              type: 'CREDIT',
              direction: 'Credit',
              walletType: 'Commission',
              transactionType: 'Commission',
              description: level === 1 ? `Direct Referral Commission - ${user.fullName || ''}` : `Unilevel Commission Level ${level} - ${user.fullName || ''}`,
              status: 'Completed',
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString()
            }
          });
        }

        if (flushedAmount > 0) {
          const flushedId = `FLUSH-${Date.now()}-L${level}-${Math.floor(100 + Math.random() * 900)}`;
          
          if (adminUid) {
            const adminBal = await getWalletBalance(adminUid);
            const newAdminBal = Number((adminBal + flushedAmount).toFixed(2));
            walletBalancesMemory[adminUid] = newAdminBal;

            dbWrites.push({
              type: 'update',
              ref: adminDb.collection('wallets').doc(adminUid),
              data: {
                commissionWalletBalance: newAdminBal,
                updatedAt: new Date().toISOString()
              }
            });

            const adminTxId = `TX-FLUSH-CREDIT-${Date.now()}-L${level}`;
            dbWrites.push({
              type: 'set',
              ref: adminDb.collection('wallet_transactions').doc(adminTxId),
              data: {
                id: adminTxId,
                uid: adminUid,
                amount: flushedAmount,
                amountCC: flushedAmount,
                type: 'CREDIT',
                direction: 'Credit',
                walletType: 'Commission',
                transactionType: 'Commission',
                description: `Flushed commission (Level ${level}) from original earner ${parent.fullName || ''} for source ${user.fullName || ''}`,
                status: 'Completed',
                createdAt: new Date().toISOString(),
                timestamp: new Date().toISOString()
              }
            });
          }

          dbWrites.push({
            type: 'set',
            ref: adminDb.collection('flushed_commissions').doc(flushedId),
            data: {
              flushedCommissionId: flushedId,
              originalCommissionId: commissionId,
              originalEarnerUid: currentParentUid,
              originalEarnerMemberId: parent.memberId || '',
              originalEarnerName: parent.fullName || '',
              sourceUid: uid,
              sourceMemberId: user.memberId || '',
              sourceTransactionId: `TX-SOURCE-${idempotencyKey}`,
              commissionType: level === 1 ? 'Direct Referral' : 'Unilevel',
              packageLevel: pkg.name,
              amountCC: flushedAmount,
              phpEquivalent: Number((flushedAmount * 70).toFixed(2)),
              reason: cycleCompleted ? 'BUSINESS_CYCLE_COMPLETED' : 'INACTIVE',
              businessCycleId: currentParentUid,
              businessCycleStatus: cycleCompleted ? 'Completed' : 'Active',
              flushedToEmail: 'admin@iamchosen.app',
              status: 'Flushed',
              createdAt: new Date().toISOString()
            }
          });
        }

        // 3. Process Leadership Bonus (10% of credited Referral/Unilevel amount)
        if (creditedAmount > 0) {
          const grandparentUid = parent.referredBy || '';
          if (grandparentUid) {
            const grandparentSnap = await adminDb.collection('users').doc(grandparentUid).get();
            if (grandparentSnap.exists) {
              const grandparent = grandparentSnap.data() || {};
              const gpCycleSnap = await adminDb.collection('business_cycles').doc(grandparentUid).get();

              const leadershipRate = 0.10; // 10%
              const rawLeadershipAmount = Number((creditedAmount * leadershipRate).toFixed(2));

              let creditedLeadership = rawLeadershipAmount;
              let flushedLeadership = 0;
              let gpCycleCompleted = false;

              const gpEligible = grandparent.accountType === 'Affiliate' && grandparent.status === 'Active' && grandparent.commissionEligible !== false;

              if (gpCycleSnap.exists && gpEligible) {
                const gpCycle = gpCycleSnap.data() || {};
                if (gpCycle.status === 'Active') {
                  const gpEarningsCap = gpCycle.earningsCapCC || 0;
                  const gpCurrentEarnings = await getCycleQualifiedEarnings(grandparentUid);
                  const gpRemaining = Number((gpEarningsCap - gpCurrentEarnings).toFixed(2));

                  if (rawLeadershipAmount >= gpRemaining) {
                    creditedLeadership = gpRemaining;
                    flushedLeadership = Number((rawLeadershipAmount - gpRemaining).toFixed(2));
                    gpCycleCompleted = true;
                  } else {
                    creditedLeadership = rawLeadershipAmount;
                    flushedLeadership = 0;
                  }

                  const newGPEarnings = Number((gpCurrentEarnings + creditedLeadership).toFixed(2));
                  const newGPRemaining = Number((gpEarningsCap - newGPEarnings).toFixed(2));
                  const gpProgress = Number(((newGPEarnings / (gpEarningsCap || 1)) * 100).toFixed(0));

                  cycleEarningsMemory[grandparentUid] = newGPEarnings;

                  dbWrites.push({
                    type: 'update',
                    ref: adminDb.collection('business_cycles').doc(grandparentUid),
                    data: {
                      currentQualifiedEarningsCC: newGPEarnings,
                      remainingCapacityCC: newGPRemaining,
                      progressPercentage: gpProgress,
                      status: gpCycleCompleted ? 'Completed' : 'Active',
                      completedAt: gpCycleCompleted ? new Date().toISOString() : null,
                      updatedAt: new Date().toISOString()
                    }
                  });

                  if (gpCycleCompleted) {
                    dbWrites.push({
                      type: 'update',
                      ref: adminDb.collection('users').doc(grandparentUid),
                      data: {
                        status: 'Completed',
                        commissionEligible: false,
                        updatedAt: new Date().toISOString()
                      }
                    });
                  }
                } else {
                  creditedLeadership = 0;
                  flushedLeadership = rawLeadershipAmount;
                }
              } else {
                creditedLeadership = 0;
                flushedLeadership = rawLeadershipAmount;
              }

              if (creditedLeadership > 0) {
                const gpBal = await getWalletBalance(grandparentUid);
                const newGPBal = Number((gpBal + creditedLeadership).toFixed(2));
                walletBalancesMemory[grandparentUid] = newGPBal;

                dbWrites.push({
                  type: 'update',
                  ref: adminDb.collection('wallets').doc(grandparentUid),
                  data: {
                    commissionWalletBalance: newGPBal,
                    updatedAt: new Date().toISOString()
                  }
                });

                const gpNotifId = `NOTIF-GP-${Date.now()}-${grandparentUid}`;
                dbWrites.push({
                  type: 'set',
                  ref: adminDb.collection('notifications').doc(gpNotifId),
                  data: {
                    id: gpNotifId,
                    uid: grandparentUid,
                    title: 'Leadership Bonus Credited',
                    message: `You earned ${creditedLeadership} CC Leadership Bonus from the commission credited to ${parent.fullName || ''}.`,
                    type: 'commission',
                    unread: true,
                    createdAt: new Date().toISOString()
                  }
                });
              }

              const gpCommId = `COMM-LEAD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
              dbWrites.push({
                type: 'set',
                ref: adminDb.collection('commissions').doc(gpCommId),
                data: {
                  id: gpCommId,
                  earnerUid: grandparentUid,
                  earnerMemberId: grandparent.memberId || '',
                  earnerFullName: grandparent.fullName || '',
                  sourceUid: currentParentUid,
                  sourceMemberId: parent.memberId || '',
                  sourceFullName: parent.fullName || '',
                  amountCC: creditedLeadership,
                  commissionType: 'Leadership',
                  status: 'Credited',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              });

              if (creditedLeadership > 0) {
                const gpWTxId = `TX-LEAD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
                dbWrites.push({
                  type: 'set',
                  ref: adminDb.collection('wallet_transactions').doc(gpWTxId),
                  data: {
                    id: gpWTxId,
                    uid: grandparentUid,
                    amount: creditedLeadership,
                    amountCC: creditedLeadership,
                    type: 'CREDIT',
                    direction: 'Credit',
                    walletType: 'Commission',
                    transactionType: 'Commission',
                    description: `Leadership Bonus from ${parent.fullName || ''} (Direct Referral)`,
                    status: 'Completed',
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString()
                  }
                });
              }

              if (flushedLeadership > 0) {
                const gpFlushId = `FLUSH-LEAD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
                dbWrites.push({
                  type: 'set',
                  ref: adminDb.collection('flushed_commissions').doc(gpFlushId),
                  data: {
                    flushedCommissionId: gpFlushId,
                    originalCommissionId: gpCommId,
                    originalEarnerUid: grandparentUid,
                    originalEarnerMemberId: grandparent.memberId || '',
                    originalEarnerName: grandparent.fullName || '',
                    sourceUid: currentParentUid,
                    sourceMemberId: parent.memberId || '',
                    sourceTransactionId: `TX-LEAD-SOURCE-${idempotencyKey}`,
                    commissionType: 'Leadership',
                    packageLevel: grandparent.packageLevel || 'Bronze',
                    amountCC: flushedLeadership,
                    phpEquivalent: Number((flushedLeadership * 70).toFixed(2)),
                    reason: gpCycleCompleted ? 'BUSINESS_CYCLE_COMPLETED' : 'INACTIVE',
                    businessCycleId: grandparentUid,
                    businessCycleStatus: gpCycleCompleted ? 'Completed' : 'Active',
                    flushedToEmail: 'admin@iamchosen.app',
                    status: 'Flushed',
                    createdAt: new Date().toISOString()
                  }
                });
              }
            }
          }
        }
      }

      currentParentUid = parent.referredBy || '';
    }

    // Add final status writes
    dbWrites.push({
      type: 'set',
      ref: compCheckRef,
      data: { processedAt: new Date().toISOString() }
    });

    // Run the atomic writes inside transaction/batch
    await adminDb.runTransaction(async (transaction) => {
      // Complete the pending compensation event record
      const q = adminDb.collection('package_compensation_events').where('idempotencyKey', '==', `package-compensation:${idempotencyKey}`);
      const qSnap = await transaction.get(q);
      if (!qSnap.empty) {
        qSnap.forEach(doc => {
          transaction.update(doc.ref, { status: 'Completed', updatedAt: new Date().toISOString() });
        });
      }

      // Execute all compiled writes!
      for (const write of dbWrites) {
        if (write.type === 'set') {
          transaction.set(write.ref, write.data);
        } else if (write.type === 'update') {
          transaction.update(write.ref, write.data);
        }
      }
    });

    console.log('Compensation successfully processed and committed atomically!');
  } catch (error) {
    console.error('Failed to run processActivationCompensation:', error);
    throw error;
  }
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

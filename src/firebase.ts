import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  writeBatch,
  getDocFromServer,
  Firestore,
  limit,
  runTransaction
} from 'firebase/firestore';
import { UserProfile, Wallet, BusinessCycle, UserRole, AccountType } from './types';

// Web App's Firebase configuration from firebase-applet-config.json
export const firebaseConfig = {
  apiKey: "AIzaSyDfvP9Y2kRCXhFHTmaWywdRX_n1Y_HU_5w",
  authDomain: "iamchosen-web-app.firebaseapp.com",
  projectId: "iamchosen-web-app",
  storageBucket: "iamchosen-web-app.firebasestorage.app",
  messagingSenderId: "648215034889",
  appId: "1:648215034889:web:001fd26fdfbe85e1364cd8",
  measurementId: "G-9SKT23D8QD",
  firestoreDatabaseId: "ai-studio-choseninternatio-e8f32de0-3246-4255-97e0-380012b7fd9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Use the correct custom database ID as provisioned in the AI Studio environment
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Validate Connection to Firestore (Skill Mandatory Requirement)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('client is offline')) {
      console.error("Please check your Firebase configuration or connection. The client is offline.");
    }
  }
}
testConnection();

// Helpers for Generating Unique IDs
export function generateMemberId(): string {
  const num = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `IAM-${num}`;
}

export function generateSponsorCode(fullName: string): string {
  const cleanName = fullName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  const randNum = Math.floor(100 + Math.random() * 900); // 3 digits
  return `${cleanName}${randNum}`;
}

// Create an Audit Log
export async function createAuditLog(actorUid: string, actorEmail: string, action: string, details: string) {
  try {
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      actorUid,
      actorEmail,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Failed to create audit log", e);
  }
}

// Check if sponsor code exists and return user email / full name if found
export async function verifySponsorCode(code: string): Promise<UserProfile | null> {
  if (!code) return null;
  try {
    const q = query(collection(db, 'users'), where('sponsorCode', '==', code.toUpperCase().trim()), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as UserProfile;
    }
  } catch (e) {
    console.error("Error verifying sponsor code:", e);
  }
  return null;
}

// Automatically create a profile and wallet for an authenticated user if it doesn't exist
export async function ensureUserProfile(firebaseUser: any): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    return userDocSnap.data() as UserProfile;
  }

  // Create a new profile if it doesn't exist
  const memberId = generateMemberId();
  const email = firebaseUser.email || '';
  const fullName = firebaseUser.displayName || email.split('@')[0] || "Valued Member";
  const sponsorCode = generateSponsorCode(fullName);
  const timestamp = new Date().toISOString();

  const isSuperAdmin = email.trim().toLowerCase() === 'nifled.kenjaktrading@gmail.com';

  const userProfileData: UserProfile = {
    uid: firebaseUser.uid,
    memberId,
    fullName,
    email,
    mobileNumber: firebaseUser.phoneNumber || '',
    role: isSuperAdmin ? 'Super Admin' : 'Customer',
    accountType: isSuperAdmin ? 'System' : 'Customer',
    sponsorCode,
    referredBy: '',
    status: 'Active',
    kycStatus: 'Unverified',
    packageLevel: 'None',
    commissionEligible: false,
    walletEnabled: !isSuperAdmin,
    genealogyEnabled: false,
    businessCycleEnabled: false,
    permissions: isSuperAdmin ? {
      manageMembers: true,
      manageProducts: true,
      manageInventory: true,
      manageWallets: true,
      approveCashOut: true,
      manageCommissions: true,
      viewAnalytics: true,
      systemSettings: true,
      manageRoles: true,
      viewAuditLogs: true
    } : {
      manageMembers: false,
      manageProducts: false,
      manageInventory: false,
      manageWallets: false,
      approveCashOut: false,
      manageCommissions: false,
      viewAnalytics: false,
      systemSettings: false,
      manageRoles: false,
      viewAuditLogs: false
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const walletData: Wallet = {
    uid: firebaseUser.uid,
    chosenWalletBalance: 0,
    commissionWalletBalance: 0,
    marketingSupportWalletBalance: 0,
    rewardWalletBalance: 0,
    cashWalletStatus: 'Active',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const batch = writeBatch(db);
  batch.set(userDocRef, userProfileData);
  batch.set(doc(db, 'wallets', firebaseUser.uid), walletData);
  await batch.commit();

  await createAuditLog(
    firebaseUser.uid,
    email,
    'USER_REPAIR',
    `Auto-created missing profile and wallet for user ${memberId}`
  );

  return userProfileData;
}

// v1.1.0: Register New Member By Sponsor (Atomic Transaction)
export interface RegisterMemberParams {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  packageLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  sponsorUid: string;
  sponsorEmail: string;
}

export async function registerNewMemberBySponsor(params: RegisterMemberParams): Promise<void> {
  const packages = {
    Bronze: { cc: 50, php: 3500, cap: 125 },
    Silver: { cc: 350, php: 24500, cap: 875 },
    Gold: { cc: 1500, php: 105000, cap: 3750 },
    Platinum: { cc: 3000, php: 210000, cap: 7500 },
    Diamond: { cc: 5000, php: 350000, cap: 12500 }
  };

  const pkg = packages[params.packageLevel];
  const packageCost = pkg.cc;
  const commissionAmount = Number((packageCost * 0.04).toFixed(2)); // 4% Direct Referral Bonus

  // 1. Initialize secondary app and create user in Auth (Isolated client-side)
  const { initializeApp, deleteApp } = await import('firebase/app');
  const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

  const appName = `SecondaryReg-${Date.now()}`;
  const secApp = initializeApp(firebaseConfig, appName);
  const secAuth = getAuth(secApp);
  const userCredential = await createUserWithEmailAndPassword(secAuth, params.email.trim(), params.password);
  const newUid = userCredential.user.uid;
  await signOut(secAuth);
  await deleteApp(secApp);

  // 2. Run Atomic Transaction in Firestore
  await runTransaction(db, async (transaction) => {
    // A. Read Sponsor's Wallet
    const sponsorWalletRef = doc(db, 'wallets', params.sponsorUid);
    const sponsorWalletSnap = await transaction.get(sponsorWalletRef);
    if (!sponsorWalletSnap.exists()) {
      throw new Error("Sponsor wallet not found. Please activate your account first.");
    }
    const sponsorWalletData = sponsorWalletSnap.data() as Wallet;
    const currentSponsorBalance = sponsorWalletData.chosenWalletBalance || 0;

    // B. Check balance
    if (currentSponsorBalance < packageCost) {
      throw new Error("Insufficient Chosen Credits.");
    }

    // C. Read Sponsor's Profile to get sponsorCode and generationLevel
    const sponsorProfileRef = doc(db, 'users', params.sponsorUid);
    const sponsorProfileSnap = await transaction.get(sponsorProfileRef);
    if (!sponsorProfileSnap.exists()) {
      throw new Error("Sponsor profile not found.");
    }
    const sponsorProfileData = sponsorProfileSnap.data() as UserProfile;
    const sponsorSponsorCode = sponsorProfileData.sponsorCode || '';
    const sponsorGenLevel = sponsorProfileData.generationLevel || 1;

    // D. Read Sponsor's Business Cycle (if applicable)
    let sponsorCycleCompleted = false;
    let creditedCommission = commissionAmount;
    
    const sponsorCycleRef = doc(db, 'business_cycles', params.sponsorUid);
    const sponsorCycleSnap = await transaction.get(sponsorCycleRef);
    
    if (sponsorCycleSnap.exists()) {
      const sponsorCycleData = sponsorCycleSnap.data() as BusinessCycle;
      if (sponsorCycleData.status === 'Active') {
        const currentEarnings = sponsorCycleData.currentQualifiedEarningsCC || 0;
        const remainingCapacity = sponsorCycleData.remainingCapacityCC || 0;

        if (commissionAmount >= remainingCapacity) {
          creditedCommission = remainingCapacity;
          sponsorCycleCompleted = true;
        }

        const updatedCycle: Partial<BusinessCycle> = {
          currentQualifiedEarningsCC: Number((currentEarnings + creditedCommission).toFixed(2)),
          remainingCapacityCC: Number((remainingCapacity - creditedCommission).toFixed(2)),
          status: sponsorCycleCompleted ? 'Completed' : 'Active',
          updatedAt: new Date().toISOString()
        };
        transaction.update(sponsorCycleRef, updatedCycle);
      } else {
        // Cycle is completed, so they cannot earn commission
        creditedCommission = 0;
      }
    }

    // E. Deduct from Sponsor's Chosen Wallet, add credited commission to Sponsor's Commission Wallet
    const updatedSponsorWallet: Partial<Wallet> = {
      chosenWalletBalance: Number((currentSponsorBalance - packageCost).toFixed(2)),
      commissionWalletBalance: Number(((sponsorWalletData.commissionWalletBalance || 0) + creditedCommission).toFixed(2)),
      updatedAt: new Date().toISOString()
    };
    transaction.update(sponsorWalletRef, updatedSponsorWallet);

    if (sponsorCycleCompleted) {
      transaction.update(sponsorProfileRef, { status: 'Completed', updatedAt: new Date().toISOString() });
    }

    // F. Create New Member documents
    const memberId = generateMemberId();
    const newSponsorCode = generateSponsorCode(params.fullName);
    const timestamp = new Date().toISOString();

    const newMemberProfile = {
      uid: newUid,
      memberId,
      fullName: params.fullName.trim(),
      email: params.email.trim().toLowerCase(),
      mobileNumber: params.mobileNumber.trim(),
      role: 'Affiliate' as UserRole,
      accountType: 'Affiliate' as AccountType,
      sponsorCode: newSponsorCode,
      referredBy: params.sponsorUid,
      status: 'Active',
      kycStatus: 'Unverified',
      packageLevel: params.packageLevel,
      commissionEligible: true,
      walletEnabled: true,
      genealogyEnabled: true,
      businessCycleEnabled: true,
      permissions: {
        manageMembers: false,
        manageProducts: false,
        manageInventory: false,
        manageWallets: false,
        approveCashOut: false,
        manageCommissions: false,
        viewAnalytics: false,
        systemSettings: false,
        manageRoles: false,
        viewAuditLogs: false
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      // Genealogy fields
      placement: 'Left',
      generationLevel: sponsorGenLevel + 1
    };

    const newMemberWallet: Wallet = {
      uid: newUid,
      chosenWalletBalance: 0,
      commissionWalletBalance: 0,
      marketingSupportWalletBalance: 0,
      rewardWalletBalance: 0,
      cashWalletStatus: 'Active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const newMemberCycle: BusinessCycle = {
      uid: newUid,
      packageLevel: params.packageLevel,
      packageValueCC: pkg.cc,
      earningsCapCC: pkg.cap,
      currentQualifiedEarningsCC: 0,
      remainingCapacityCC: pkg.cap,
      status: 'Active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Set all docs
    transaction.set(doc(db, 'users', newUid), newMemberProfile);
    transaction.set(doc(db, 'wallets', newUid), newMemberWallet);
    transaction.set(doc(db, 'business_cycles', newUid), newMemberCycle);

    // G. Create Wallet Transactions
    const refNumber = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Transaction 1: Sponsor Debit (package cost)
    const txSponsorDebitId = `TX-${Date.now()}-SDEB`;
    const txSponsorDebit = {
      id: txSponsorDebitId,
      uid: params.sponsorUid,
      amount: packageCost,
      type: 'DEBIT',
      walletType: 'Chosen',
      description: `${params.packageLevel} Package Registration - ${params.fullName}`,
      status: 'Completed',
      createdAt: timestamp,
      referenceNumber: refNumber
    };
    transaction.set(doc(db, 'wallet_transactions', txSponsorDebitId), txSponsorDebit);

    // Transaction 2: Sponsor Commission Credit (referral bonus)
    if (creditedCommission > 0) {
      const txSponsorCreditId = `TX-${Date.now()}-SCRE`;
      const txSponsorCredit = {
        id: txSponsorCreditId,
        uid: params.sponsorUid,
        amount: creditedCommission,
        type: 'CREDIT',
        walletType: 'Commission',
         description: `Direct Commission: 4% on ${params.fullName}'s ${params.packageLevel}`,
        status: 'Completed',
        createdAt: timestamp,
        referenceNumber: refNumber
      };
      transaction.set(doc(db, 'wallet_transactions', txSponsorCreditId), txSponsorCredit);
    }

    // Transaction 3: New Member Package Registration Entry
    const txNewMemberId = `TX-${Date.now()}-NREG`;
    const txNewMember = {
      id: txNewMemberId,
      uid: newUid,
      amount: packageCost,
      type: 'REGISTRATION',
      walletType: 'Chosen',
      description: `Registration - ${params.packageLevel} Package`,
      status: 'Completed',
      createdAt: timestamp,
      referenceNumber: refNumber
    };
    transaction.set(doc(db, 'wallet_transactions', txNewMemberId), txNewMember);

    // H. Create Audit Log
    const auditLogId = `LOG-${Date.now()}-MREG`;
    const auditLog = {
      id: auditLogId,
      actorUid: params.sponsorUid,
      actorEmail: params.sponsorEmail,
      action: 'MEMBER_REGISTRATION',
      details: `Registered new Affiliate ${params.fullName} (${memberId}) with ${params.packageLevel} package. Deducted ${packageCost} CC. Generated ${creditedCommission} CC referral bonus for Sponsor.`,
      timestamp: timestamp
    };
    transaction.set(doc(db, 'audit_logs', auditLogId), auditLog);
  });
}

// v1.1.0: Approve Pending Affiliate registration (Direct Company Purchase)
export async function approvePendingAffiliate(userId: string, adminUid: string, adminEmail: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const walletRef = doc(db, 'wallets', userId);
  const cycleRef = doc(db, 'business_cycles', userId);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User profile not found.");
    }
    const userData = userSnap.data() as UserProfile;
    if (userData.status === 'Active') {
      throw new Error("User is already active.");
    }

    const packageLevel = userData.packageLevel || 'Bronze';
    if (packageLevel === 'None') {
      throw new Error("Invalid package for Affiliate approval.");
    }

    const packages = {
      Bronze: { cc: 50, php: 3500, cap: 125 },
      Silver: { cc: 350, php: 24500, cap: 875 },
      Gold: { cc: 1500, php: 105000, cap: 3750 },
      Platinum: { cc: 3000, php: 210000, cap: 7500 },
      Diamond: { cc: 5000, php: 350000, cap: 12500 }
    };

    const pkg = packages[packageLevel as keyof typeof packages] || packages.Bronze;
    const timestamp = new Date().toISOString();

    // 1. Activate Profile
    transaction.update(userRef, {
      status: 'Active',
      accountType: 'Affiliate',
      role: 'Affiliate',
      commissionEligible: true,
      walletEnabled: true,
      genealogyEnabled: true,
      businessCycleEnabled: true,
      permissions: {
        manageMembers: false,
        manageProducts: false,
        manageInventory: false,
        manageWallets: false,
        approveCashOut: false,
        manageCommissions: false,
        viewAnalytics: false,
        systemSettings: false,
        manageRoles: false,
        viewAuditLogs: false
      },
      updatedAt: timestamp
    });

    // 2. Create Chosen Wallet
    const walletData: Wallet = {
      uid: userId,
      chosenWalletBalance: 0,
      commissionWalletBalance: 0,
      marketingSupportWalletBalance: 0,
      rewardWalletBalance: 0,
      cashWalletStatus: 'Active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    transaction.set(walletRef, walletData);

    // 3. Create Business Cycle
    const businessCycleData: BusinessCycle = {
      uid: userId,
      packageLevel: packageLevel as any,
      packageValueCC: pkg.cc,
      earningsCapCC: pkg.cap,
      currentQualifiedEarningsCC: 0,
      remainingCapacityCC: pkg.cap,
      status: 'Active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    transaction.set(cycleRef, businessCycleData);

    // 4. Create Transaction log
    const refNumber = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const txId = `TX-${Date.now()}-APPROVE`;
    const txRecord = {
      id: txId,
      uid: userId,
      amount: pkg.cc,
      type: 'REGISTRATION',
      walletType: 'Chosen',
      description: `Direct Package Activation: ${packageLevel}`,
      status: 'Completed',
      createdAt: timestamp,
      referenceNumber: refNumber
    };
    transaction.set(doc(db, 'wallet_transactions', txId), txRecord);

    // 5. Create Audit log
    const auditLogId = `LOG-${Date.now()}-APPROVE`;
    const auditLog = {
      id: auditLogId,
      actorUid: adminUid,
      actorEmail: adminEmail,
      action: 'AFFILIATE_APPROVAL',
      details: `Approved Direct Company Purchase Affiliate registration for ${userData.fullName} (${userId}). Package: ${packageLevel} (${pkg.cc} CC). Activated Chosen Wallet & Business Cycle.`,
      timestamp: timestamp
    };
    transaction.set(doc(db, 'audit_logs', auditLogId), auditLog);
  });
}

import { db } from '../../firebase';
import { doc, getDoc, getDocs, collection, query, where, writeBatch, setDoc } from 'firebase/firestore';
import { BusinessCycle, UserProfile } from '../../types';
import { createAuditLog } from '../../firebase';

export const PackageService = {
  async getBusinessCycle(uid: string): Promise<BusinessCycle | null> {
    const docRef = doc(db, 'business_cycles', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as BusinessCycle;
    }
    return null;
  },

  async purchasePackage(uid: string, email: string, data: {
    packageLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
    packageValueCC: number;
    earningsCapCC: number;
  }) {
    const batch = writeBatch(db);

    // Create Business Cycle
    const cycleRef = doc(db, 'business_cycles', uid);
    batch.set(cycleRef, {
      uid,
      packageLevel: data.packageLevel,
      packageValueCC: data.packageValueCC,
      earningsCapCC: data.earningsCapCC,
      currentQualifiedEarningsCC: 0,
      remainingCapacityCC: data.earningsCapCC,
      progressPercentage: 0,
      status: 'Active',
      activatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Update User packageLevel
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, {
      packageLevel: data.packageLevel,
      updatedAt: new Date().toISOString()
    });

    await batch.commit();

    await createAuditLog(
      uid,
      email,
      'PACKAGE_PURCHASED',
      `Activated Affiliate ${data.packageLevel} Package (${data.packageValueCC} CC). Safety cap set to ${data.earningsCapCC} CC.`
    );

    return { success: true };
  },

  async upgradePackage(uid: string, email: string, currentPackageLevel: string, targetPackageLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'City Distributor' | 'Regional Distributor', costCC: number) {
    const walletRef = doc(db, 'wallets', uid);
    const walletSnap = await getDoc(walletRef);
    if (!walletSnap.exists()) {
      throw new Error('Wallet not initialized.');
    }
    const wallet = walletSnap.data();
    if ((wallet.chosenWalletBalance || 0) < costCC) {
      throw new Error(`Insufficient Chosen Wallet balance. You need ${costCC} CC to upgrade, but you only have ${(wallet.chosenWalletBalance || 0).toFixed(2)} CC.`);
    }

    const capCCMap: Record<string, number> = {
      Bronze: 125,
      Silver: 875,
      Gold: 3750,
      Platinum: 7500,
      Diamond: 12500,
      'City Distributor': 25000,
      'Regional Distributor': 62500
    };
    const valCCMap: Record<string, number> = {
      Bronze: 50,
      Silver: 350,
      Gold: 1500,
      Platinum: 3000,
      Diamond: 5000,
      'City Distributor': 10000,
      'Regional Distributor': 25000
    };

    const targetVal = valCCMap[targetPackageLevel] || 0;
    const targetCap = capCCMap[targetPackageLevel] || 0;

    const batch = writeBatch(db);

    batch.update(walletRef, {
      chosenWalletBalance: Number(((wallet.chosenWalletBalance || 0) - costCC).toFixed(2)),
      updatedAt: new Date().toISOString()
    });

    const cycleRef = doc(db, 'business_cycles', uid);
    const cycleSnap = await getDoc(cycleRef);
    if (cycleSnap.exists()) {
      const cycle = cycleSnap.data();
      const currentEarned = cycle.currentQualifiedEarningsCC || 0;
      const remaining = Number((targetCap - currentEarned).toFixed(2));
      const progress = Number(((currentEarned / targetCap) * 100).toFixed(0));

      batch.update(cycleRef, {
        packageLevel: targetPackageLevel as any,
        packageValueCC: targetVal,
        earningsCapCC: targetCap,
        remainingCapacityCC: remaining,
        progressPercentage: Math.min(100, progress),
        status: currentEarned >= targetCap ? 'Completed' : 'Active',
        updatedAt: new Date().toISOString()
      });
    } else {
      batch.set(cycleRef, {
        uid,
        packageLevel: targetPackageLevel as any,
        packageValueCC: targetVal,
        earningsCapCC: targetCap,
        currentQualifiedEarningsCC: 0,
        remainingCapacityCC: targetCap,
        progressPercentage: 0,
        status: 'Active',
        activatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const userRef = doc(db, 'users', uid);
    batch.update(userRef, {
      packageLevel: targetPackageLevel,
      status: 'Active',
      commissionEligible: true,
      updatedAt: new Date().toISOString()
    });

    const txId = `TX-UPG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    batch.set(doc(db, 'wallet_transactions', txId), {
      id: txId,
      uid,
      amount: costCC,
      amountCC: costCC,
      type: 'DEBIT',
      direction: 'Debit',
      walletType: 'Chosen',
      transactionType: 'Upgrade',
      description: `Package Upgrade: ${currentPackageLevel} to ${targetPackageLevel}`,
      status: 'Completed',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    await createAuditLog(
      uid,
      email,
      'PACKAGE_UPGRADED',
      `Upgraded package from ${currentPackageLevel} to ${targetPackageLevel} using ${costCC} CC from Chosen Wallet.`
    );

    return { success: true };
  }
};

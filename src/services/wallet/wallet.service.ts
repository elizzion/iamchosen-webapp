import { db, storage } from '../../firebase';
import { doc, getDoc, getDocs, collection, query, where, writeBatch, setDoc, limit, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Wallet, AuditLog } from '../../types';
import { createAuditLog } from '../../firebase';
import { TechOpsTreasuryService } from './tech-ops-treasury.service';
import { P2PTransferService } from '../p2pTransferService';

export const WalletService = {
  async getWallet(uid: string): Promise<Wallet | null> {
    const docRef = doc(db, 'wallets', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Wallet;
    }
    return null;
  },

  async getWalletTransactions(uid: string) {
    const q = query(
      collection(db, 'wallet_transactions'),
      where('uid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  async uploadReceipt(uid: string, requestId: string, file: File): Promise<{
    proofOfPaymentUrl: string;
    proofOfPaymentPath: string;
    proofOfPaymentFileName: string;
    proofOfPaymentContentType: string;
    proofOfPaymentSizeBytes: number;
  }> {
    // Validate: JPG, PNG, WebP, PDF
    const mime = file.type.toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

    if (!allowedMimes.includes(mime) && !allowedExtensions.includes(fileExtension)) {
      throw new Error("Unsupported file type. Please upload a JPG, PNG, WebP, or PDF file.");
    }

    // Validate: Maximum 5 MB
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size allowed is 5 MB.");
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `cashin_proofs/${uid}/${requestId}/${timestamp}-${sanitizedFileName}`;
    
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    return {
      proofOfPaymentUrl: downloadUrl,
      proofOfPaymentPath: path,
      proofOfPaymentFileName: file.name,
      proofOfPaymentContentType: file.type || mime || ('application/' + fileExtension),
      proofOfPaymentSizeBytes: file.size
    };
  },

  async createCashInRequest(uid: string, data: {
    memberId: string;
    fullName: string;
    email: string;
    amountPHP: number;
    computedCC: number;
    paymentMethod: string;
    referenceNumber: string;
    proofOfPaymentUrl: string;
    proofOfPaymentPath?: string;
    proofOfPaymentFileName?: string;
    proofOfPaymentContentType?: string;
    proofOfPaymentSizeBytes?: number;
    notes?: string;
    requestId?: string;
    [key: string]: any;
  }) {
    const requestId = data.requestId || `CW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const requestDocRef = doc(db, 'cashin_requests', requestId);
    
    const { requestId: removedId, ...restData } = data;
    const requestData = {
      requestId,
      uid,
      status: 'Pending',
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...restData
    };

    await setDoc(requestDocRef, requestData);

    // Write a pending wallet transaction to show in history
    const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const txDocRef = doc(db, 'wallet_transactions', txId);
    await setDoc(txDocRef, {
      id: txId,
      uid,
      memberId: data.memberId,
      walletType: 'Chosen',
      transactionType: 'Cash-In',
      direction: 'Credit',
      amountCC: data.computedCC,
      balanceBefore: 0, // Filled upon approval
      balanceAfter: 0,  // Filled upon approval
      referenceCollection: 'cashin_requests',
      referenceId: requestId,
      description: `Cash-In: ${data.paymentMethod}`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    await createAuditLog(
      uid,
      data.email,
      'CASH_IN_REQUEST_CREATED',
      `Requested cash-in of ₱${data.amountPHP.toLocaleString()} (${data.computedCC} CC)`
    );

    return { success: true, requestId };
  },

  async createCashOutRequest(uid: string, email: string, wallet: Wallet, data: {
    memberId: string;
    fullName: string;
    amountCC: number;
    payoutChannel: 'Bank' | 'GCash' | 'Maya';
    destinationDetails: string;
    cashOutRatePHP: number;
  }) {
    if (wallet.commissionWalletBalance < data.amountCC) {
      throw new Error(`Insufficient balance. Your Commission Wallet balance is ${wallet.commissionWalletBalance} CC.`);
    }

    const grossPhp = data.amountCC * data.cashOutRatePHP;
    const withholdingTax = grossPhp * 0.10;
    const adminFeePhp = 70;
    const netPhp = grossPhp - withholdingTax - adminFeePhp;

    const batch = writeBatch(db);

    // Deduct from wallet
    const walletRef = doc(db, 'wallets', uid);
    batch.update(walletRef, {
      commissionWalletBalance: Number((wallet.commissionWalletBalance - data.amountCC).toFixed(2)),
      updatedAt: new Date().toISOString()
    });

    // Write Cashout Request
    const requestId = `CW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const requestDocRef = doc(db, 'cashout_requests', requestId);
    batch.set(requestDocRef, {
      requestId,
      uid,
      memberId: data.memberId,
      fullName: data.fullName,
      amountCC: data.amountCC,
      grossPhp,
      withholdingTax,
      adminFeePHP: adminFeePhp,
      netPHP: netPhp,
      payoutChannel: data.payoutChannel,
      destinationDetails: data.destinationDetails,
      status: 'Submitted',
      requestDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add to transaction log
    const txId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    batch.set(doc(db, 'wallet_transactions', txId), {
      id: txId,
      uid,
      amount: data.amountCC,
      amountCC: data.amountCC,
      type: 'DEBIT',
      direction: 'Debit',
      walletType: 'Commission',
      transactionType: 'Cash-Out',
      description: `Cash-Out Request: ${data.payoutChannel}`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    await createAuditLog(
      uid,
      email,
      'CASH_OUT_REQUEST_CREATED',
      `Submitted cashout of ${data.amountCC} CC (Net: ₱${netPhp.toLocaleString()}) to ${data.payoutChannel}`
    );

    return { success: true, requestId, netPhp };
  },

  async createTransferRequest(uid: string, email: string, wallet: Wallet, data: {
    recipientEmail: string;
    amountCC: number;
    memberId: string;
  }) {
    // Resolve recipient user by email first
    const recipientQuery = query(
      collection(db, 'users'),
      where('email', '==', data.recipientEmail.trim().toLowerCase()),
      limit(1)
    );
    const recipientSnap = await getDocs(recipientQuery);
    if (recipientSnap.empty) {
      throw new Error('Recipient account email not found in IAM CHOSEN International system.');
    }
    const recipientUser = recipientSnap.docs[0].data();
    const recipientMemberId = recipientUser.memberId;

    const idempotencyKey = `P2P-M2M-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const res = await P2PTransferService.executeTransfer({
      recipientMemberId,
      amountCC: data.amountCC,
      idempotencyKey,
      memo: `M2M Transfer from Affiliate Dashboard`
    });

    return res;
  },

  async findRecipientByMemberId(memberId: string): Promise<{ uid: string, memberId: string, fullName: string } | null> {
    const q = query(
      collection(db, 'users'),
      where('memberId', '==', memberId.trim().toUpperCase()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return null;
    }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    return {
      uid: docSnap.id,
      memberId: data.memberId,
      fullName: data.fullName
    };
  },

  async executeP2PTransfer(senderUid: string, senderEmail: string, data: {
    recipientMemberId: string;
    amountCC: number;
    idempotencyKey: string;
    note?: string;
  }) {
    return await P2PTransferService.executeTransfer({
      recipientMemberId: data.recipientMemberId,
      amountCC: data.amountCC,
      idempotencyKey: data.idempotencyKey,
      memo: data.note
    });
  },

  calculateCashInCC(amountPHP: number): number {
    return Number((amountPHP / 70).toFixed(2));
  },

  calculateCashOutPHP(amountCC: number, rate: number = 69): number {
    return Number((amountCC * rate).toFixed(2));
  }
};

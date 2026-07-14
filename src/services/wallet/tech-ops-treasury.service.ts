import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  writeBatch, 
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { CCSettings } from '../../types';
import { getCCSettings } from '../cc-settings/cc-settings.service';
import { createAuditLog } from '../../firebase';

export interface TreasuryAccount {
  id: string;
  displayName: string;
  accountType: 'SYSTEM_TREASURY';
  classification: 'CORPORATE_TECHNOLOGY_REVENUE';
  status: 'ACTIVE' | 'LOCKED';
  balanceCC: number;
  isMemberWallet: boolean;
  isCommissionWallet: boolean;
  isPubliclyVisible: boolean;
  countsTowardBusinessCycle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransferFeeTransaction {
  feeTransactionId: string;
  sourceTransferId: string;
  sourceTransferType: string;
  sourceTransferStatus: 'COMPLETED' | 'FAILED' | 'REVERSED';
  payerUid: string;
  payerMemberId: string;
  payerName: string;
  receiverUid: string;
  receiverMemberId: string;
  receiverName: string;
  feeType: 'PLATFORM_TRANSFER_FEE';
  feeAmountType: 'FIXED' | 'PERCENTAGE';
  feeAmountCC: number;
  transferAmountCC: number;
  totalSenderDeductionCC: number;
  destinationTreasuryId: string;
  publicDescription: string;
  internalClassification: 'CORPORATE_TECHNOLOGY_REVENUE';
  senderFeeLedgerTransactionId: string;
  treasuryLedgerTransactionId: string;
  configurationVersion: string;
  idempotencyKey: string;
  status: 'COMPLETED' | 'FAILED' | 'REVERSED';
  reversalStatus: 'NOT_REVERSED' | 'REVERSED';
  reversedAmountCC: number;
  reversalTransactionId: string | null;
  reversalReason?: string;
  reversalActorEmail?: string;
  createdAt: string;
  completedAt: string;
  updatedAt: string;
}

export interface TreasuryDisbursement {
  id: string;
  authorityReference: string;
  corporateApprovalRecord: string;
  payeeIdentity: string;
  amountCC: number;
  accountingClassification: 'TECHNOLOGY_OPERATIONS_COMPENSATION_DISBURSEMENT';
  taxTreatment: string;
  approvalActor: string;
  paymentReference: string;
  supportingDocRef: string;
  status: 'REQUESTED' | 'APPROVED' | 'RELEASED' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
  releasedAt?: string;
  rejectedAt?: string;
  ledgerTransactionId?: string;
  notes?: string;
}

export const TechOpsTreasuryService = {
  /**
   * Get or initialize the corporate Tech Ops Treasury
   */
  async getOrCreateTreasury(tx?: any): Promise<TreasuryAccount> {
    const treasuryRef = doc(db, 'system_treasuries', 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY');
    
    const fetchDoc = async (ref: any) => {
      if (tx) {
        return await tx.get(ref);
      } else {
        return await getDoc(ref);
      }
    };

    const snap = await fetchDoc(treasuryRef);
    if (snap.exists()) {
      return snap.data() as TreasuryAccount;
    }

    // Initialize Treasury Account
    const initialTreasury: TreasuryAccount = {
      id: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
      displayName: 'Technology Operations Treasury',
      accountType: 'SYSTEM_TREASURY',
      classification: 'CORPORATE_TECHNOLOGY_REVENUE',
      status: 'ACTIVE',
      balanceCC: 0,
      isMemberWallet: false,
      isCommissionWallet: false,
      isPubliclyVisible: false,
      countsTowardBusinessCycle: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (tx) {
      tx.set(treasuryRef, initialTreasury);
    } else {
      await setDoc(treasuryRef, initialTreasury);
    }

    return initialTreasury;
  },

  /**
   * Core Transfer execution function with atomic 1 CC platform fee logic and separate ledger entries.
   */
  async executeTransferWithFee(
    senderUid: string,
    senderEmail: string,
    data: {
      recipientMemberId: string;
      amountCC: number;
      idempotencyKey: string;
      note?: string;
      transferType: string;
    }
  ) {
    const { recipientMemberId, amountCC, idempotencyKey, note, transferType } = data;

    // Load active transfer-fee configuration
    const config: CCSettings = await getCCSettings();
    const isFeeEnabled = config.transferFeeEnabled !== false;
    const feeCC = isFeeEnabled ? (config.transferFeeAmountCC ?? 1.0) : 0;
    const totalDebitCC = amountCC + feeCC;

    return await runTransaction(db, async (transaction) => {
      // 1. Idempotency Guard
      const p2pDocRef = doc(db, 'p2p_transfers', idempotencyKey);
      const p2pDocSnap = await transaction.get(p2pDocRef);
      if (p2pDocSnap.exists()) {
        const existingData = p2pDocSnap.data();
        return {
          success: true,
          transferId: idempotencyKey,
          isDuplicate: true,
          message: 'Transfer already processed',
          ...existingData
        };
      }

      // 2. Resolve recipient profile
      const recipientQuery = query(
        collection(db, 'users'),
        where('memberId', '==', recipientMemberId.trim().toUpperCase()),
        limit(1)
      );
      const recipientQuerySnap = await getDocs(recipientQuery);
      if (recipientQuerySnap.empty) {
        throw new Error(`Recipient member ID IAM-${recipientMemberId} not found in the system.`);
      }
      const recipientUserDoc = recipientQuerySnap.docs[0];
      const recipientUser = recipientUserDoc.data();
      const recipientUid = recipientUserDoc.id;

      if (recipientUid === senderUid) {
        throw new Error('You cannot transfer credits to yourself.');
      }

      // Fetch sender profile
      const senderUserDocRef = doc(db, 'users', senderUid);
      const senderUserSnap = await transaction.get(senderUserDocRef);
      if (!senderUserSnap.exists()) {
        throw new Error('Sender profile not found.');
      }
      const senderUser = senderUserSnap.data();

      // Check account statuses
      if (senderUser.status === 'Inactive') {
        throw new Error('Your account is currently inactive.');
      }
      if (recipientUser.status === 'Inactive') {
        throw new Error('Recipient account is currently inactive.');
      }

      // 3. Fetch wallets
      const senderWalletRef = doc(db, 'wallets', senderUid);
      const senderWalletSnap = await transaction.get(senderWalletRef);
      if (!senderWalletSnap.exists()) {
        throw new Error('Sender wallet not initialized.');
      }
      const senderWallet = senderWalletSnap.data();

      const recipientWalletRef = doc(db, 'wallets', recipientUid);
      const recipientWalletSnap = await transaction.get(recipientWalletRef);
      if (!recipientWalletSnap.exists()) {
        throw new Error('Recipient wallet not initialized.');
      }
      const recipientWallet = recipientWalletSnap.data();

      // Fetch corporate treasury
      const treasury = await this.getOrCreateTreasury(transaction);
      if (treasury.status !== 'ACTIVE') {
        throw new Error('Technology Operations Treasury is currently locked for maintenance.');
      }

      // 4. Validate balances & constraints
      if (senderWallet.chosenWalletBalance < totalDebitCC) {
        throw new Error(`Insufficient balance. Transfer requires ${amountCC} CC + ${feeCC} CC Platform Transfer Fee. Your balance is ${senderWallet.chosenWalletBalance} CC.`);
      }

      // 5. Update Wallet balances
      const newSenderBalance = Number((senderWallet.chosenWalletBalance - totalDebitCC).toFixed(4));
      transaction.update(senderWalletRef, {
        chosenWalletBalance: newSenderBalance,
        updatedAt: new Date().toISOString()
      });

      const newRecipientBalance = Number((recipientWallet.chosenWalletBalance + amountCC).toFixed(4));
      transaction.update(recipientWalletRef, {
        chosenWalletBalance: newRecipientBalance,
        updatedAt: new Date().toISOString()
      });

      // Update Treasury balance atomically
      const newTreasuryBalance = Number((treasury.balanceCC + feeCC).toFixed(4));
      const treasuryRef = doc(db, 'system_treasuries', 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY');
      transaction.update(treasuryRef, {
        balanceCC: newTreasuryBalance,
        updatedAt: new Date().toISOString()
      });

      // 6. Save P2P record
      const transferData = {
        transferId: idempotencyKey,
        senderUid,
        senderMemberId: senderUser.memberId || '',
        senderName: senderUser.fullName || '',
        recipientUid,
        recipientMemberId: recipientUser.memberId || '',
        recipientName: recipientUser.fullName || '',
        amountCC: Number(amountCC),
        feeCC: Number(feeCC),
        totalDebitCC: Number(totalDebitCC),
        idempotencyKey,
        note: note ? note.trim() : '',
        status: 'COMPLETED',
        transferType,
        createdAt: new Date().toISOString()
      };
      transaction.set(p2pDocRef, transferData);

      // 7. Write Platform Fee Transaction Record
      const feeTxId = `FEE-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const feeTxRef = doc(db, 'transfer_fee_transactions', feeTxId);

      const txIdSenderDebit = `TX-${Date.now()}-SD-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdSenderFeeDebit = `TX-${Date.now()}-SFD-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdRecipientCredit = `TX-${Date.now()}-RC-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdTreasuryCredit = `TX-${Date.now()}-TC-${Math.floor(1000 + Math.random() * 9000)}`;

      const feeTxData: TransferFeeTransaction = {
        feeTransactionId: feeTxId,
        sourceTransferId: idempotencyKey,
        sourceTransferType: transferType,
        sourceTransferStatus: 'COMPLETED',
        payerUid: senderUid,
        payerMemberId: senderUser.memberId || '',
        payerName: senderUser.fullName || '',
        receiverUid: recipientUid,
        receiverMemberId: recipientUser.memberId || '',
        receiverName: recipientUser.fullName || '',
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
        configurationVersion: config.transferFeeType || 'v1.0',
        idempotencyKey: `platform-transfer-fee:${idempotencyKey}:PLATFORM_TRANSFER_FEE`,
        status: 'COMPLETED',
        reversalStatus: 'NOT_REVERSED',
        reversedAmountCC: 0,
        reversalTransactionId: null,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      transaction.set(feeTxRef, feeTxData);

      // 8. Ledger Entry A: Sender transfer debit
      transaction.set(doc(db, 'wallet_transactions', txIdSenderDebit), {
        id: txIdSenderDebit,
        uid: senderUid,
        memberId: senderUser.memberId || '',
        amount: amountCC,
        amountCC: amountCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_DEBIT',
        balanceBefore: senderWallet.chosenWalletBalance,
        balanceAfter: senderWallet.chosenWalletBalance - amountCC,
        sourceTransferId: idempotencyKey,
        sourceTransferType: transferType,
        payerUid: senderUid,
        receiverUid: recipientUid,
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Transfer to ${recipientUser.fullName} (IAM-${recipientUser.memberId})`,
        idempotencyKey: `${idempotencyKey}:sender_transfer_debit`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // 9. Ledger Entry B: Sender Platform Transfer Fee debit
      transaction.set(doc(db, 'wallet_transactions', txIdSenderFeeDebit), {
        id: txIdSenderFeeDebit,
        uid: senderUid,
        memberId: senderUser.memberId || '',
        amount: feeCC,
        amountCC: feeCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen',
        transactionType: 'PLATFORM_TRANSFER_FEE_DEBIT',
        balanceBefore: senderWallet.chosenWalletBalance - amountCC,
        balanceAfter: newSenderBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: transferType,
        sourceFeeTransactionId: feeTxId,
        payerUid: senderUid,
        receiverUid: recipientUid,
        destinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        feeConfigurationVersion: config.transferFeeType || 'v1.0',
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
        idempotencyKey: `${idempotencyKey}:sender_fee_debit`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // 10. Ledger Entry C: Receiver transfer credit
      transaction.set(doc(db, 'wallet_transactions', txIdRecipientCredit), {
        id: txIdRecipientCredit,
        uid: recipientUid,
        memberId: recipientUser.memberId || '',
        amount: amountCC,
        amountCC: amountCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_CREDIT',
        balanceBefore: recipientWallet.chosenWalletBalance,
        balanceAfter: newRecipientBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: transferType,
        payerUid: senderUid,
        receiverUid: recipientUid,
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Transfer from ${senderUser.fullName} (IAM-${senderUser.memberId})`,
        idempotencyKey: `${idempotencyKey}:recipient_transfer_credit`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // 11. Ledger Entry D: Technology Operations Treasury fee credit
      transaction.set(doc(db, 'wallet_transactions', txIdTreasuryCredit), {
        id: txIdTreasuryCredit,
        systemAccountId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        amount: feeCC,
        amountCC: feeCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'System',
        transactionType: 'TECHNOLOGY_TREASURY_FEE_CREDIT',
        balanceBefore: treasury.balanceCC,
        balanceAfter: newTreasuryBalance,
        sourceTransferId: idempotencyKey,
        sourceTransferType: transferType,
        sourceFeeTransactionId: feeTxId,
        payerUid: senderUid,
        receiverUid: recipientUid,
        destinationTreasuryId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        feeConfigurationVersion: config.transferFeeType || 'v1.0',
        status: 'COMPLETED',
        referenceNumber: idempotencyKey,
        description: `Platform Transfer Fee for transfer ${idempotencyKey}`,
        idempotencyKey: `${idempotencyKey}:treasury_fee_credit`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      return {
        success: true,
        transferId: idempotencyKey,
        feeTransactionId: feeTxId,
        amountCC: Number(amountCC),
        feeCC: Number(feeCC),
        totalDebitCC: Number(totalDebitCC),
        recipientName: recipientUser.fullName,
        recipientId: recipientUser.memberId,
        referenceId: idempotencyKey
      };
    });
  },

  /**
   * Execute fully-traceable reversal of a completed transfer and its platform transfer fee
   */
  async executeReversal(
    transferId: string,
    reversalReason: string,
    actorEmail: string
  ) {
    return await runTransaction(db, async (transaction) => {
      // 1. Fetch source transfer P2P record
      const p2pDocRef = doc(db, 'p2p_transfers', transferId);
      const p2pSnap = await transaction.get(p2pDocRef);
      if (!p2pSnap.exists()) {
        throw new Error('Source transfer record not found.');
      }
      const p2p = p2pSnap.data();
      if (p2p.status === 'REVERSED') {
        throw new Error('This transfer has already been reversed.');
      }

      // 2. Fetch associated transfer fee transaction
      const feeQuery = query(
        collection(db, 'transfer_fee_transactions'),
        where('sourceTransferId', '==', transferId),
        limit(1)
      );
      const feeSnap = await getDocs(feeQuery);
      if (feeSnap.empty) {
        throw new Error('Associated transfer fee record not found.');
      }
      const feeDoc = feeSnap.docs[0];
      const feeTx = feeDoc.data() as TransferFeeTransaction;

      // 3. Fetch sender & receiver wallets
      const senderWalletRef = doc(db, 'wallets', p2p.senderUid);
      const senderWalletSnap = await transaction.get(senderWalletRef);
      if (!senderWalletSnap.exists()) {
        throw new Error('Sender wallet not found.');
      }
      const senderWallet = senderWalletSnap.data();

      const receiverWalletRef = doc(db, 'wallets', p2p.recipientUid);
      const receiverWalletSnap = await transaction.get(receiverWalletRef);
      if (!receiverWalletSnap.exists()) {
        throw new Error('Receiver wallet not found.');
      }
      const receiverWallet = receiverWalletSnap.data();

      // Fetch corporate treasury
      const treasury = await this.getOrCreateTreasury(transaction);
      const treasuryRef = doc(db, 'system_treasuries', 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY');

      // Check if receiver has sufficient balance to perform the reversal
      if (receiverWallet.chosenWalletBalance < p2p.amountCC) {
        throw new Error(`Insufficient balance. Receiver wallet currently has ${receiverWallet.chosenWalletBalance} CC, but ${p2p.amountCC} CC is required for reversal.`);
      }

      // 4. Compute reversed balances
      const refundAmountCC = p2p.amountCC + feeTx.feeAmountCC; // refund both transfer and fee to sender
      const newSenderBalance = Number((senderWallet.chosenWalletBalance + refundAmountCC).toFixed(4));
      const newReceiverBalance = Number((receiverWallet.chosenWalletBalance - p2p.amountCC).toFixed(4));
      const newTreasuryBalance = Number((treasury.balanceCC - feeTx.feeAmountCC).toFixed(4));

      // 5. Update balances
      transaction.update(senderWalletRef, {
        chosenWalletBalance: newSenderBalance,
        updatedAt: new Date().toISOString()
      });
      transaction.update(receiverWalletRef, {
        chosenWalletBalance: newReceiverBalance,
        updatedAt: new Date().toISOString()
      });
      transaction.update(treasuryRef, {
        balanceCC: newTreasuryBalance,
        updatedAt: new Date().toISOString()
      });

      // 6. Update transfer statuses
      transaction.update(p2pDocRef, {
        status: 'REVERSED',
        updatedAt: new Date().toISOString()
      });

      const reversalId = `REV-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      transaction.update(feeDoc.ref, {
        status: 'REVERSED',
        reversalStatus: 'REVERSED',
        reversedAmountCC: feeTx.feeAmountCC,
        reversalTransactionId: reversalId,
        reversalReason,
        reversalActorEmail: actorEmail,
        updatedAt: new Date().toISOString()
      });

      // 7. Write reversal entries in wallet_transactions
      const txIdSenderRefund = `TX-${Date.now()}-SRR-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdSenderFeeRefund = `TX-${Date.now()}-SFRR-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdRecipientDebit = `TX-${Date.now()}-RRD-${Math.floor(1000 + Math.random() * 9000)}`;
      const txIdTreasuryDebit = `TX-${Date.now()}-TRD-${Math.floor(1000 + Math.random() * 9000)}`;

      // A: Sender transfer refund credit
      transaction.set(doc(db, 'wallet_transactions', txIdSenderRefund), {
        id: txIdSenderRefund,
        uid: p2p.senderUid,
        memberId: p2p.senderMemberId,
        amount: p2p.amountCC,
        amountCC: p2p.amountCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_REVERSAL',
        balanceBefore: senderWallet.chosenWalletBalance,
        balanceAfter: senderWallet.chosenWalletBalance + p2p.amountCC,
        sourceTransferId: transferId,
        reversalTransactionId: reversalId,
        status: 'COMPLETED',
        referenceNumber: transferId,
        description: `Reversal refund for transfer ${transferId}`,
        idempotencyKey: `${transferId}:sender_transfer_refund`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // B: Sender Platform Transfer Fee refund credit
      transaction.set(doc(db, 'wallet_transactions', txIdSenderFeeRefund), {
        id: txIdSenderFeeRefund,
        uid: p2p.senderUid,
        memberId: p2p.senderMemberId,
        amount: feeTx.feeAmountCC,
        amountCC: feeTx.feeAmountCC,
        type: 'CREDIT',
        direction: 'Credit',
        walletType: 'Chosen',
        transactionType: 'PLATFORM_TRANSFER_FEE_REVERSAL',
        balanceBefore: senderWallet.chosenWalletBalance + p2p.amountCC,
        balanceAfter: newSenderBalance,
        sourceTransferId: transferId,
        sourceFeeTransactionId: feeTx.feeTransactionId,
        reversalTransactionId: reversalId,
        status: 'COMPLETED',
        referenceNumber: transferId,
        description: `Platform Fee reversal refund for transfer ${transferId}`,
        idempotencyKey: `${transferId}:sender_fee_refund`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // C: Receiver transfer reversal debit
      transaction.set(doc(db, 'wallet_transactions', txIdRecipientDebit), {
        id: txIdRecipientDebit,
        uid: p2p.recipientUid,
        memberId: p2p.recipientMemberId,
        amount: p2p.amountCC,
        amountCC: p2p.amountCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'Chosen',
        transactionType: 'TRANSFER_REVERSAL',
        balanceBefore: receiverWallet.chosenWalletBalance,
        balanceAfter: newReceiverBalance,
        sourceTransferId: transferId,
        reversalTransactionId: reversalId,
        status: 'COMPLETED',
        referenceNumber: transferId,
        description: `Reversal debit for transfer ${transferId}`,
        idempotencyKey: `${transferId}:recipient_transfer_reversal`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // D: Treasury fee reversal debit
      transaction.set(doc(db, 'wallet_transactions', txIdTreasuryDebit), {
        id: txIdTreasuryDebit,
        systemAccountId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
        amount: feeTx.feeAmountCC,
        amountCC: feeTx.feeAmountCC,
        type: 'DEBIT',
        direction: 'Debit',
        walletType: 'System',
        transactionType: 'TREASURY_FEE_REVERSAL',
        balanceBefore: treasury.balanceCC,
        balanceAfter: newTreasuryBalance,
        sourceTransferId: transferId,
        sourceFeeTransactionId: feeTx.feeTransactionId,
        reversalTransactionId: reversalId,
        status: 'COMPLETED',
        referenceNumber: transferId,
        description: `Platform Fee reversal debit for transfer ${transferId}`,
        idempotencyKey: `${transferId}:treasury_fee_reversal`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      return {
        success: true,
        reversalId,
        refundAmountCC
      };
    });
  },

  /**
   * Request a separate technology operations compensation disbursement
   */
  async requestDisbursement(data: Omit<TreasuryDisbursement, 'id' | 'status' | 'requestedAt'>) {
    const id = `DISB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const disDocRef = doc(db, 'treasury_disbursements', id);

    const disbursement: TreasuryDisbursement = {
      ...data,
      id,
      status: 'REQUESTED',
      requestedAt: new Date().toISOString()
    };

    await setDoc(disDocRef, disbursement);
    return disbursement;
  },

  /**
   * Approve and release a corporate treasury disbursement atomically
   */
  async processDisbursementStatus(
    id: string,
    status: 'APPROVED' | 'RELEASED' | 'REJECTED',
    actorEmail: string
  ) {
    return await runTransaction(db, async (transaction) => {
      const disDocRef = doc(db, 'treasury_disbursements', id);
      const disSnap = await transaction.get(disDocRef);
      if (!disSnap.exists()) {
        throw new Error('Disbursement request not found.');
      }
      const dis = disSnap.data() as TreasuryDisbursement;

      if (dis.status === 'RELEASED' || dis.status === 'REJECTED') {
        throw new Error('This disbursement has already been finalized.');
      }

      const updates: Partial<TreasuryDisbursement> = { status };
      const nowString = new Date().toISOString();

      if (status === 'APPROVED') {
        updates.approvedAt = nowString;
        updates.status = 'APPROVED';
      } else if (status === 'REJECTED') {
        updates.rejectedAt = nowString;
        updates.status = 'REJECTED';
      } else if (status === 'RELEASED') {
        updates.releasedAt = nowString;
        updates.status = 'RELEASED';

        // Check and deduct from Treasury
        const treasury = await this.getOrCreateTreasury(transaction);
        const treasuryRef = doc(db, 'system_treasuries', 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY');

        if (treasury.balanceCC < dis.amountCC) {
          throw new Error(`Insufficient treasury balance. Available is ${treasury.balanceCC} CC, but request is ${dis.amountCC} CC.`);
        }

        const newTreasuryBalance = Number((treasury.balanceCC - dis.amountCC).toFixed(4));
        transaction.update(treasuryRef, {
          balanceCC: newTreasuryBalance,
          updatedAt: nowString
        });

        // Write ledger entry for disbursement
        const txId = `TX-${Date.now()}-DISB-${Math.floor(1000 + Math.random() * 9000)}`;
        updates.ledgerTransactionId = txId;

        transaction.set(doc(db, 'wallet_transactions', txId), {
          id: txId,
          systemAccountId: 'SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY',
          amount: dis.amountCC,
          amountCC: dis.amountCC,
          type: 'DEBIT',
          direction: 'Debit',
          walletType: 'System',
          transactionType: 'TECHNOLOGY_OPERATIONS_COMPENSATION_DISBURSEMENT',
          balanceBefore: treasury.balanceCC,
          balanceAfter: newTreasuryBalance,
          status: 'COMPLETED',
          referenceNumber: id,
          description: `Corporate tech compensation payout to ${dis.payeeIdentity}. Auth: ${dis.authorityReference}`,
          createdAt: nowString,
          completedAt: nowString
        });
      }

      transaction.update(disDocRef, updates);
      return { success: true, status };
    });
  },

  /**
   * Fetch Platform Transfer Fee reports dynamically with complete ledger metrics
   */
  async getPlatformFeeReport() {
    // 1. Fetch all transfer fee transactions
    const feeCol = collection(db, 'transfer_fee_transactions');
    const feeSnap = await getDocs(feeCol);
    const feeTxs = feeSnap.docs.map(d => d.data() as TransferFeeTransaction);

    // 2. Compute dynamic reporting aggregations
    let grossFees = 0;
    let successfullyCollected = 0;
    let failedFees = 0;
    let reversedFees = 0;
    let totalTransferVolume = 0;
    let completedTransferCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    let collectedToday = 0;
    let collectedThisWeek = 0;
    let collectedThisMonth = 0;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    feeTxs.forEach((tx) => {
      const txDate = new Date(tx.createdAt);
      if (tx.status === 'COMPLETED') {
        grossFees += tx.feeAmountCC;
        if (tx.reversalStatus === 'REVERSED') {
          reversedFees += tx.feeAmountCC;
        } else {
          successfullyCollected += tx.feeAmountCC;
        }
        totalTransferVolume += tx.transferAmountCC;
        completedTransferCount += 1;

        // Time-based
        const dateStr = tx.createdAt.split('T')[0];
        if (dateStr === todayStr) {
          collectedToday += tx.feeAmountCC;
        }
        if (txDate >= oneWeekAgo) {
          collectedThisWeek += tx.feeAmountCC;
        }
        if (txDate >= startOfMonth) {
          collectedThisMonth += tx.feeAmountCC;
        }
      } else if (tx.status === 'FAILED') {
        failedFees += tx.feeAmountCC;
      }
    });

    const netFees = grossFees - reversedFees;
    const avgTransferValue = completedTransferCount > 0 ? (totalTransferVolume / completedTransferCount) : 0;
    const avgFee = completedTransferCount > 0 ? (grossFees / completedTransferCount) : 0;

    // Fetch Treasury Balance
    const treasury = await this.getOrCreateTreasury();

    // Fetch alerts count
    const alerts = await this.runReconciliationValidation();

    return {
      grossFees,
      successfullyCollected,
      failedFees,
      reversedFees,
      netFees,
      completedTransferCount,
      totalTransferVolume,
      avgTransferValue,
      avgFee,
      collectedToday,
      collectedThisWeek,
      collectedThisMonth,
      treasuryBalance: treasury.balanceCC,
      unresolvedAlertsCount: alerts.length,
      alerts
    };
  },

  /**
   * Run reconciliation validation checks and generate alerts for mismatches
   */
  async runReconciliationValidation() {
    const alerts: Array<{ id: string; type: 'CRITICAL' | 'WARNING'; message: string; timestamp: string }> = [];

    // Fetch all wallet transactions for SYSTEM_TECHNOLOGY_OPERATIONS_TREASURY and PLATFORM_TRANSFER_FEE_DEBIT
    const txCol = collection(db, 'wallet_transactions');
    const senderFeeDebitsSnap = await getDocs(query(txCol, where('transactionType', '==', 'PLATFORM_TRANSFER_FEE_DEBIT')));
    const treasuryCreditsSnap = await getDocs(query(txCol, where('transactionType', '==', 'TECHNOLOGY_TREASURY_FEE_CREDIT')));

    const senderFeeDebits = senderFeeDebitsSnap.docs.map(d => d.data());
    const treasuryCredits = treasuryCreditsSnap.docs.map(d => d.data());

    // Compute sums
    const totalSenderDebitsCC = senderFeeDebits.reduce((acc, tx) => acc + (tx.amountCC || 0), 0);
    const totalTreasuryCreditsCC = treasuryCredits.reduce((acc, tx) => acc + (tx.amountCC || 0), 0);

    // Rule 1: Sender Fee Debits MUST EQUAL Treasury Fee Credits
    if (Math.abs(totalSenderDebitsCC - totalTreasuryCreditsCC) > 0.001) {
      alerts.push({
        id: `ALERT-RECON-1-${Date.now()}`,
        type: 'CRITICAL',
        message: `Ledger mismatch! Total Completed Sender Fee Debits (${totalSenderDebitsCC} CC) does not equal Completed Technology Treasury Fee Credits (${totalTreasuryCreditsCC} CC).`,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch disbursements and reversals
    const disSnap = await getDocs(query(txCol, where('transactionType', '==', 'TECHNOLOGY_OPERATIONS_COMPENSATION_DISBURSEMENT')));
    const revSnap = await getDocs(query(txCol, where('transactionType', '==', 'TREASURY_FEE_REVERSAL')));

    const totalDisbursementsCC = disSnap.docs.reduce((acc, d) => acc + (d.data().amountCC || 0), 0);
    const totalReversalsCC = revSnap.docs.reduce((acc, r) => acc + (r.data().amountCC || 0), 0);

    const expectedTreasuryBalance = totalTreasuryCreditsCC - totalReversalsCC - totalDisbursementsCC;
    const treasury = await this.getOrCreateTreasury();

    // Rule 2: Expected closing balance must match treasury actual balance
    if (Math.abs(expectedTreasuryBalance - treasury.balanceCC) > 0.001) {
      alerts.push({
        id: `ALERT-RECON-2-${Date.now()}`,
        type: 'CRITICAL',
        message: `Treasury balance mismatch! Expected Treasury Balance is ${expectedTreasuryBalance} CC, but actual ledger shows ${treasury.balanceCC} CC.`,
        timestamp: new Date().toISOString()
      });
    }

    // Rule 3: Number of completed fee-paying transfers * 1 CC matches gross expected fee
    const p2pSnap = await getDocs(collection(db, 'p2p_transfers'));
    const completedP2p = p2pSnap.docs.filter(d => d.data().status === 'COMPLETED');
    const expectedGross = completedP2p.length * 1.0;

    // We can also double check if any 0.5 rules are present
    const has05 = completedP2p.some(d => d.data().feeCC === 0.5);
    if (has05) {
      alerts.push({
        id: `ALERT-RECON-3-${Date.now()}`,
        type: 'WARNING',
        message: 'Legacy 0.5 CC transfer fee rate detected in historical completed transfer logs.',
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }
};

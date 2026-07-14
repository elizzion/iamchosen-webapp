import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface P2PTransferParams {
  recipientMemberId: string;
  amountCC: number;
  memo?: string;
  idempotencyKey: string;
}

export interface P2PTransferResult {
  success: boolean;
  transferId: string;
  feeTransactionId?: string;
  amountCC: number;
  feeCC: number;
  totalDebitCC: number;
  recipientName: string;
  recipientId: string;
  referenceId: string;
  createdAt: string;
  isDuplicate?: boolean;
  message?: string;
}

export const P2PTransferService = {
  /**
   * Securely execute a P2P transfer of Chosen Credits from the current member's Chosen Wallet.
   * Calls the secure server-side Callable Cloud Function `executeP2PTransferV2`.
   */
  async executeTransfer(params: P2PTransferParams): Promise<P2PTransferResult> {
    try {
      const executeCallable = httpsCallable<P2PTransferParams, P2PTransferResult>(
        functions,
        'executeP2PTransferV2'
      );
      
      const response = await executeCallable(params);
      return response.data;
    } catch (error: any) {
      console.error('P2P Transfer execution error on client:', error);
      
      // Extract Firebase Cloud Function HttpsError message
      const message = error.message || 'The transfer could not be completed. No credits were deducted.';
      throw new Error(message);
    }
  }
};

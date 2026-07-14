import { db } from '../../firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

export const CommissionService = {
  async getCommissions(uid: string) {
    const q = query(
      collection(db, 'commissions'),
      where('earnerUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  },

  async getCommissionSummary(uid: string) {
    const list = await this.getCommissions(uid);
    let totalDirectReferral = 0;
    let totalUnilevel = 0;
    let totalLeadership = 0;
    let totalInfinity = 0;
    let totalRetailProfit = 0;
    let totalMsaLeadership = 0;
    let grandTotal = 0;

    list.forEach(c => {
      const amt = c.amountCC || 0;
      grandTotal += amt;
      switch (c.commissionType) {
        case 'Direct Referral':
          totalDirectReferral += amt;
          break;
        case 'Unilevel':
          totalUnilevel += amt;
          break;
        case 'Leadership':
          totalLeadership += amt;
          break;
        case 'Infinity':
          totalInfinity += amt;
          break;
        case 'Retail Profit':
          totalRetailProfit += amt;
          break;
        case 'MSA Leadership':
          totalMsaLeadership += amt;
          break;
        default:
          break;
      }
    });

    return {
      grandTotal,
      totalDirectReferral,
      totalUnilevel,
      totalLeadership,
      totalInfinity,
      totalRetailProfit,
      totalMsaLeadership,
      count: list.length
    };
  }
};

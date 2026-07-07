export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Customer'
  | 'Affiliate'
  | 'City Distributor'
  | 'Regional Distributor';

export type AccountType = 'Customer' | 'Affiliate' | 'System' | 'Admin';

export interface UserPermissions {
  manageMembers: boolean;
  manageProducts: boolean;
  manageInventory: boolean;
  manageWallets: boolean;
  approveCashOut: boolean;
  manageCommissions: boolean;
  viewAnalytics: boolean;
  systemSettings: boolean;
  manageRoles: boolean;
  viewAuditLogs: boolean;
}

export interface UserProfile {
  uid: string;
  memberId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  accountType: AccountType;
  sponsorCode: string;
  referredBy: string;
  status: 'Active' | 'Inactive' | 'Completed';
  kycStatus: 'Unverified' | 'Pending' | 'Verified';
  packageLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'None';
  generationLevel?: number;
  placement?: string;
  paymentStatus?: 'Pending Approval' | 'Approved' | 'None';
  paymentMethod?: string;
  paymentAmountPhp?: number;
  receiptNumber?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  commissionEligible?: boolean;
  walletEnabled?: boolean;
  genealogyEnabled?: boolean;
  businessCycleEnabled?: boolean;
  permissions?: UserPermissions;
}

export interface Wallet {
  uid: string;
  chosenWalletBalance: number;
  commissionWalletBalance: number;
  marketingSupportWalletBalance: number;
  rewardWalletBalance: number;
  cashWalletStatus: 'Active' | 'Inactive';
  createdAt: any;
  updatedAt: any;
}

export interface BusinessCycle {
  uid: string;
  packageLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'None';
  packageValueCC: number;
  earningsCapCC: number;
  currentQualifiedEarningsCC: number;
  remainingCapacityCC: number;
  status: 'Active' | 'Completed' | 'None';
  createdAt: any;
  updatedAt: any;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  details: string;
  timestamp: any;
}

export type PageRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'business-opportunity'
  | 'dashboard'
  | 'profile'
  | 'admin-dashboard'
  | 'super-admin-dashboard'
  | 'user-management'
  | 'role-management'
  | 'member-registration'
  | 'access-denied'
  | 'affiliate-dashboard'
  | 'customer-dashboard'
  | 'package-selection'
  | 'cash-in';

export interface CCSettings {
  cashInRatePHP: number;
  cashOutRatePHP: number;
  currency: string;
}

import { db } from '../../firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { Notification } from '../../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, uid?: string) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: uid || 'unknown',
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const NotificationService = {
  /**
   * Listen to real-time notifications for a user.
   */
  subscribeToNotifications(
    uid: string,
    accountType: 'Customer' | 'Affiliate' | string,
    onUpdate: (notifications: Notification[]) => void,
    onError?: (error: any) => void
  ) {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );

    // Initial check to see if we need to seed
    getDocs(q)
      .then(async (snapshot) => {
        if (snapshot.empty) {
          try {
            await this.seedDefaultNotifications(uid, accountType);
          } catch (err) {
            console.error('Failed to seed default notifications:', err);
          }
        }
      })
      .catch((err) => {
        console.error('Error checking notifications for seeding:', err);
      });

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Notification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            uid: data.uid,
            title: data.title,
            desc: data.desc,
            date: data.date,
            unread: data.unread,
            createdAt: data.createdAt,
          });
        });
        onUpdate(list);
      },
      (error) => {
        if (onError) {
          onError(error);
        } else {
          handleFirestoreError(error, OperationType.LIST, 'notifications', uid);
        }
      }
    );
  },

  /**
   * Seed default notifications for a user based on their account type.
   */
  async seedDefaultNotifications(uid: string, accountType: 'Customer' | 'Affiliate' | string) {
    const batch = writeBatch(db);
    const notificationsRef = collection(db, 'notifications');

    const customerDefaults = [
      {
        title: 'Welcome to I AM CHOSEN',
        desc: 'Your customer profile is secured. Start purchasing premium wellness products now.',
        date: 'Just now',
        unread: true,
      },
      {
        title: 'KYC Verification Status',
        desc: 'Your identity profile is verified by corporate compliance.',
        date: '2 hours ago',
        unread: false,
      },
      {
        title: 'Cash-In Request Update',
        desc: 'Standard Cash-In requests usually process in 1-2 hours.',
        date: '1 day ago',
        unread: false,
      },
      {
        title: 'Product Recommendation',
        desc: 'Try our top-selling Chosen 15-in-1 Latte Coffee for clear daily energy.',
        date: '2 days ago',
        unread: false,
      },
    ];

    const affiliateDefaults = [
      {
        title: 'Commission Payout Cleared',
        desc: 'Your unilevel referral matching bonus has been successfully credited to your Commission Wallet.',
        date: 'Just now',
        unread: true,
      },
      {
        title: 'Business Cycle Reset Alert',
        desc: 'You are on Cycle 1 of 4. Finish 4 cycles to receive additional package bonuses.',
        date: '3 hours ago',
        unread: false,
      },
      {
        title: 'Member Registered Successfully',
        desc: 'A new affiliate has successfully registered using your sponsor code.',
        date: '1 day ago',
        unread: false,
      },
      {
        title: 'Weekly Leaderboard Open',
        desc: 'The top referring affiliates receive bonus reward points on Friday.',
        date: '2 days ago',
        unread: false,
      },
    ];

    const defaults = accountType === 'Affiliate' ? affiliateDefaults : customerDefaults;

    defaults.forEach((item, index) => {
      // Create clean deterministic or random IDs
      const newDocRef = doc(notificationsRef);
      // Stagger creation times slightly
      const timeOffset = index * 1000 * 60 * 10; // 10 minutes apart
      batch.set(newDocRef, {
        uid,
        title: item.title,
        desc: item.desc,
        date: item.date,
        unread: item.unread,
        createdAt: new Date(Date.now() - timeOffset).toISOString(),
      });
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications', uid);
    }
  },

  /**
   * Create a single new notification.
   */
  async createNotification(uid: string, title: string, desc: string, date: string = 'Just now') {
    const notificationsRef = collection(db, 'notifications');
    const newDocRef = doc(notificationsRef);
    try {
      await setDoc(newDocRef, {
        uid,
        title,
        desc,
        date,
        unread: true,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notifications/${newDocRef.id}`, uid);
    }
  },

  /**
   * Mark an individual notification as read.
   */
  async markAsRead(notificationId: string, uid?: string) {
    const docRef = doc(db, 'notifications', notificationId);
    try {
      await updateDoc(docRef, {
        unread: false,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`, uid);
    }
  },

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(uid: string) {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('uid', '==', uid),
      where('unread', '==', true)
    );

    try {
      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.update(docSnap.ref, { unread: false });
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications', uid);
    }
  },
};

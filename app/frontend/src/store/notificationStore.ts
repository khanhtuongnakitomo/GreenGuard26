/**
 * GreenGuard — Notification Store (Zustand)
 * Manages a queue of app-wide notifications.
 */
import { create } from 'zustand';

export type NotificationType =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'reward_claimed'
  | 'points_earned'
  | 'mission_completed'
  | 'voucher_redeemed';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, default 3500
}

interface NotificationState {
  queue: NotificationItem[];
  current: NotificationItem | null;
  showNotification: (item: Omit<NotificationItem, 'id'>) => void;
  dismissCurrent: () => void;
  _processQueue: () => void;
}

let _idCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  queue: [],
  current: null,

  showNotification: (item) => {
    const notification: NotificationItem = {
      ...item,
      id: `notif_${++_idCounter}_${Date.now()}`,
      duration: item.duration ?? 3500,
    };

    const { current } = get();
    if (!current) {
      set({ current: notification });
    } else {
      set((state) => ({ queue: [...state.queue, notification] }));
    }
  },

  dismissCurrent: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
    } else {
      set({ current: null });
    }
  },

  _processQueue: () => {
    const { queue, current } = get();
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
    }
  },
}));

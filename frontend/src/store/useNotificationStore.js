import { create } from "zustand";
import api from "../api/axios";

const TYPE_MAP = {
  BACKTEST_COMPLETE: "backtest",
  SUBSCRIPTION_ACTIVATED: "system",
  SUBSCRIPTION_EXPIRING_SOON: "system",
  SUBSCRIPTION_EXPIRED: "system",
};

function toLocal(n) {
  return {
    id: n.id,
    type: TYPE_MAP[n.notificationType] || "system",
    title: n.title,
    body: n.message,
    read: n.read ?? n.isRead ?? false,
    time: n.createdAt,
  };
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get("/notifications");
      const incoming = Array.isArray(data) ? data.map(toLocal) : [];
      set((s) => {
        // PATCH가 아직 in-flight인 경우 낙관적 읽음 상태를 보존 (race condition 방지)
        const locallyRead = new Set(s.notifications.filter(n => n.read).map(n => n.id));
        return {
          notifications: incoming.map(n => ({
            ...n,
            read: n.read || locallyRead.has(n.id),
          })),
          loading: false,
        };
      });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const prev = get().notifications;
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      set({ notifications: prev });
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await api.patch("/notifications/read-all");
    } catch {
      set({ notifications: prev });
    }
  },

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));

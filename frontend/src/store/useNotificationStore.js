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
    read: n.isRead,
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
      set({ notifications: Array.isArray(data) ? data.map(toLocal) : [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    try { await api.patch(`/notifications/${id}/read`); } catch {}
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    try { await api.patch("/notifications/read-all"); } catch {}
  },

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));

import { create } from "zustand";
import api from "../api/axios";

const TYPE_MAP = {
  BACKTEST_COMPLETE: "backtest",
  BRIEFING_GENERATED: "briefing",
  SUBSCRIPTION_ACTIVATED: "system",
  SUBSCRIPTION_EXPIRING_SOON: "system",
  SUBSCRIPTION_EXPIRED: "system",
  ACCOUNT_CREATED: "system",
  ORDER_FILLED: "order",
  ORDER_PARTIAL: "order",
};

function toLocal(n) {
  return {
    id: n.id,
    type: TYPE_MAP[n.notificationType] || "system",
    title: n.title,
    body: n.message,
    read: n.read ?? n.isRead ?? false,
    time: n.createdAt,
    relatedEntityId: n.relatedEntityId ?? null,
    relatedEntityType: n.relatedEntityType ?? null,
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

  // SSE 실시간 구독 — 새 알림 서버 push 수신
  // 반환값: cleanup 함수 (컴포넌트 unmount 시 호출)
  subscribeSSE: () => {
    const es = new EventSource("/api/notifications/stream", { withCredentials: true });

    es.addEventListener("notification", (e) => {
      try {
        const raw = JSON.parse(e.data);
        const n = toLocal(raw);
        set((s) => ({
          notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)],
        }));
      } catch {}
    });

    es.onerror = () => {
      // EventSource가 자동 재연결 — 여기서는 아무것도 하지 않음
    };

    return () => es.close();
  },
}));

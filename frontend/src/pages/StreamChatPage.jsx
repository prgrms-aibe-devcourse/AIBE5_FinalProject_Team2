import { useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageComposer,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import useStore from "../store/useStore";
import Header_partner from "../components/Header_partner";
import Header_client from "../components/Header_client";

export default function StreamChatPage() {
  const { dbId, username, userRole } = useStore();

  const [client, setClient]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [targetUsername, setTargetUsername] = useState("");
  const [dmLoading, setDmLoading]           = useState(false);
  const [dmError, setDmError]               = useState(null);
  const [activeChannel, setActiveChannel]   = useState(null);
  const [channelListKey, setChannelListKey] = useState(0);
  const [unreadCount, setUnreadCount]       = useState(0);

  // ── Inject Stream CSS only while this page is mounted ────────
  useEffect(() => {
    if (document.getElementById("stream-chat-css")) return;
    const link = document.createElement("link");
    link.id = "stream-chat-css";
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/stream-chat-react@14/dist/css/index.css";
    document.head.appendChild(link);
    return () => document.getElementById("stream-chat-css")?.remove();
  }, []);

  // ── Connect to Stream Chat ────────────────────────────────────
  useEffect(() => {
    if (!dbId) return;

    let chatClient;

    const connect = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`/api/chat/token?userId=${dbId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch Stream token");
        const { apiKey, token: streamToken, streamUserId } = await res.json();

        chatClient = StreamChat.getInstance(apiKey);
        await chatClient.connectUser(
          { id: streamUserId, name: username || streamUserId },
          streamToken
        );
        setClient(chatClient);

        const refreshList = () => setChannelListKey(k => k + 1);
        const handleMessageNew = (event) => {
          if (event.user?.id !== chatClient.userID) {
            setUnreadCount(c => c + 1);
          }
          refreshList();
        };

        chatClient.on("notification.added_to_channel", refreshList);
        chatClient.on("notification.message_new",      handleMessageNew);
        chatClient.on("message.new",                   handleMessageNew);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    connect();

    return () => {
      if (chatClient) {
        chatClient.off("notification.added_to_channel");
        chatClient.off("notification.message_new");
        chatClient.off("message.new");
        chatClient.disconnectUser();
      }
    };
  }, [dbId]);

  // ── Start DM by username ──────────────────────────────────────
  const startDm = async () => {
    const trimmed = targetUsername.trim();
    if (!trimmed) return;
    setDmLoading(true);
    setDmError(null);

    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // 1. Look up target user's DB id by username
      const lookupRes = await fetch(`/api/users/search?username=${encodeURIComponent(trimmed)}`, { headers });
      if (!lookupRes.ok) throw new Error(`User "${trimmed}" not found`);
      const targetUser = await lookupRes.json();

      if (targetUser.id === dbId) throw new Error("자기 자신과는 채팅할 수 없습니다.");

      // 2. Create or get the DM room
      const roomRes = await fetch(`/api/chat/rooms/dm?userId=${dbId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      if (!roomRes.ok) {
        const errText = await roomRes.text();
        throw new Error(errText || "Failed to open DM room");
      }
      const room = await roomRes.json();

      // 3. Watch the Stream channel and make it active
      const channel = client.channel(room.streamChannelType, room.streamChannelId);
      await channel.watch();
      setActiveChannel(channel);
      setTargetUsername("");
    } catch (err) {
      setDmError(err.message);
    } finally {
      setDmLoading(false);
    }
  };

  const Header = userRole === "client" ? Header_client : Header_partner;

  if (!dbId) return (
    <div style={styles.center}>
      Not logged in. Please <a href="/login" style={{ color: "#2563eb", marginLeft: 4 }}>log in</a> first.
    </div>
  );
  if (loading) return <div style={styles.center}>Connecting to chat...</div>;
  if (error) return (
    <div style={{ ...styles.center, flexDirection: "column", gap: 8 }}>
      <b style={{ color: "#ef4444" }}>Chat error</b>
      <pre style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", maxWidth: 600 }}>{error}</pre>
    </div>
  );
  if (!client) return null;

  const currentStreamUserId = client.userID;
  const filters = { type: "messaging", members: { $in: [currentStreamUserId] } };
  const sort    = { last_message_at: -1 };

  return (
    <div style={styles.page}>
      <Header />

      <Chat client={client} theme="str-chat__theme-light">
        <div style={styles.layout}>

          {/* ── Left sidebar ── */}
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.sidebarTitle}>Messages</span>
                {unreadCount > 0 && (
                  <span style={styles.unreadBadge}>{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </div>
              <span style={styles.userBadge}>{username}</span>
            </div>

            {/* New DM: search by username */}
            <div style={styles.newDm}>
              <input
                style={styles.dmInput}
                type="text"
                placeholder="Enter username to chat"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startDm()}
              />
              <button style={styles.dmButton} onClick={startDm} disabled={dmLoading}>
                {dmLoading ? "..." : "Start"}
              </button>
            </div>
            {dmError && <div style={styles.dmError}>{dmError}</div>}

            <ChannelList
              key={channelListKey}
              filters={filters}
              sort={sort}
              setActiveChannel={(ch) => {
                setActiveChannel(ch);
                setUnreadCount(0);
              }}
            />
          </div>

          {/* ── Main chat area ── */}
          <div style={styles.main}>
            {activeChannel ? (
              <Channel channel={activeChannel}>
                <Window>
                  <ChannelHeader />
                  <MessageList />
                  <MessageComposer />
                </Window>
                <Thread />
              </Channel>
            ) : (
              <div style={styles.empty}>
                Select a conversation or search for a username above to start a new one
              </div>
            )}
          </div>

        </div>
      </Chat>
    </div>
  );
}

const styles = {
  page:   { height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif" },
  layout: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: {
    width: "300px", borderRight: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column", background: "#fff",
  },
  sidebarHeader: {
    padding: "16px", borderBottom: "1px solid #e5e7eb",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  sidebarTitle: { fontWeight: 700, fontSize: "16px" },
  userBadge: {
    fontSize: "12px", color: "#6b7280", background: "#f3f4f6",
    padding: "2px 8px", borderRadius: "999px",
  },
  unreadBadge: {
    fontSize: "11px", color: "#fff", background: "#ef4444",
    padding: "1px 6px", borderRadius: "999px", fontWeight: 700,
  },
  newDm: {
    display: "flex", gap: "8px", padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  dmInput: {
    flex: 1, padding: "6px 10px", border: "1px solid #d1d5db",
    borderRadius: "6px", fontSize: "13px", outline: "none",
  },
  dmButton: {
    padding: "6px 12px", background: "#2563eb", color: "#fff",
    border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
  },
  dmError: { padding: "0 16px 8px", fontSize: "12px", color: "#ef4444" },
  main:   { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  empty: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    color: "#9ca3af", fontSize: "14px", textAlign: "center", padding: "32px",
  },
  center: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", fontSize: "16px", color: "#6b7280",
  },
};

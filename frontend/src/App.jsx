import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Bot,
  LogOut,
  Eye,
  EyeOff,
  Menu,
  Pencil,
  Search,
  RotateCcw,
  MessageSquare,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Settings,
  Trash2,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function createSessionId() {
  return `session-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}


const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";

  const value = String(timestamp).trim();

  // The backend stores created_at in UTC, but SQLite/SQLAlchemy may
  // serialize it without a timezone suffix. Treat such timestamps as UTC
  // before converting them to the user's local timezone.
  const normalizedTimestamp =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? value
      : `${value}Z`;

  const date = new Date(normalizedTimestamp);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("access_token"))
  );

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState(
    localStorage.getItem("mychatbot_show_message_actions") !== "false"
  );
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [renamedSessions, setRenamedSessions] = useState({});
  const [regenerating, setRegenerating] = useState(false);
  const [toast, setToast] = useState("");
  const messagesEndRef = useRef(null);

  const [username, setUsername] = useState(
    localStorage.getItem("chat_username") || "User"
  );

  const activeSession = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.session_id === activeSessionId
      ),
    [sessions, activeSessionId]
  );

  const displayedSessions = useMemo(() => sessions, [sessions]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    localStorage.setItem("mychatbot_show_message_actions", String(showMessageActions));
  }, [showMessageActions]);



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadSessions();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !sessionSearch.trim()) return;
    const timer = setTimeout(() => loadSessions(sessionSearch), 250);
    return () => clearTimeout(timer);
  }, [sessionSearch]);


  const handleAuthChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });

    setAuthError("");
    setAuthSuccess("");
  };


  const switchAuthMode = () => {
    setIsLogin(!isLogin);
    setShowPassword(false);
    setAuthError("");
    setAuthSuccess("");

    setForm({
      username: "",
      email: "",
      password: "",
    });
  };


  const loadSessions = async (search = "") => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      logout();
      return;
    }

    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const response = await fetch(
        `${API_URL}/chat/sessions${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load conversations."
        );
      }

      const data = await response.json();

      const loadedSessions = data.sessions || [];

      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        const firstSessionId =
          loadedSessions.find(
            (session) => session.session_id === activeSessionId
          )?.session_id || loadedSessions[0].session_id;

        await selectSession(firstSessionId);
      } else {
        createNewChat();
      }
    } catch (error) {
      setChatError(error.message);
    }
  };


  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");

    try {
      const endpoint = isLogin
        ? `${API_URL}/auth/login`
        : `${API_URL}/auth/register`;

      const body = isLogin
        ? {
            username: form.username,
            password: form.password,
          }
        : {
            username: form.username,
            email: form.email,
            password: form.password,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Something went wrong. Please try again."
        );
      }

      if (isLogin) {
        localStorage.setItem(
          "access_token",
          data.access_token
        );

        localStorage.setItem(
          "chat_username",
          form.username
        );

        setUsername(form.username);
        setIsAuthenticated(true);

        setForm({
          username: "",
          email: "",
          password: "",
        });
      } else {
        setAuthSuccess(
          "Account created successfully. You can now sign in."
        );

        setIsLogin(true);

        setForm({
          username: form.username,
          email: "",
          password: "",
        });
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setAuthError(
          "Unable to connect to the server. Make sure the backend is running."
        );
      } else {
        setAuthError(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };


  const createNewChat = () => {
    const newSessionId = createSessionId();

    setActiveSessionId(newSessionId);
    setMessages([]);
    setMessageInput("");
    setChatError("");
    setLastFailedMessage("");
    setMobileSidebar(false);
  };


  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    setChatError("");
    setMobileSidebar(false);

    const token = localStorage.getItem("access_token");

    if (!token) {
      logout();
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/chat/${sessionId}/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.status === 404) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load conversation."
        );
      }

      const data = await response.json();

      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          message: message.message,
          created_at: message.created_at,
          feedback: message.feedback || null,
        }))
      );
    } catch (error) {
      setChatError(error.message);
    }
  };


  const sendMessage = async (event, retryText = null) => {
    event?.preventDefault();

    const trimmedMessage = (retryText ?? messageInput).trim();

    if (
      !trimmedMessage ||
      chatLoading ||
      !activeSessionId
    ) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      logout();
      return;
    }

    const userMessage = {
      id: null,
      role: "user",
      message: trimmedMessage,
      created_at: new Date().toISOString(),
      feedback: null,
    };

    setMessages((current) => {
      if (retryText) {
        const lastFailedIndex =
          [...current]
            .map((message, index) => ({ message, index }))
            .reverse()
            .find(
              ({ message }) =>
                message.role === "user" &&
                message.message === trimmedMessage
            )?.index;

        if (lastFailedIndex !== undefined) {
          const withoutFailedMessage = [...current];
          withoutFailedMessage.splice(lastFailedIndex, 1);
          return [...withoutFailedMessage, userMessage];
        }
      }

      return [...current, userMessage];
    });

    setMessageInput("");
    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch(
        `${API_URL}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: activeSessionId,
            message: trimmedMessage,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to get a response."
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: data.message_id,
          role: "assistant",
          message: data.reply,
          created_at: data.created_at || new Date().toISOString(),
          feedback: null,
        },
      ]);

      setLastFailedMessage("");
      await loadSessions();
    } catch (error) {
      setLastFailedMessage(trimmedMessage);
      setChatError(
        error instanceof TypeError
          ? "Unable to connect to the server. Make sure the backend is running."
          : error.message
      );
    } finally {
      setChatLoading(false);
    }
  };


  const deleteSession = async (sessionId) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      logout();
      return;
    }

    const session = sessions.find(
      (item) => item.session_id === sessionId
    );

    const confirmed = window.confirm(
      `Delete "${session?.title || "this conversation"}"?\n\nThis will permanently delete the conversation and its messages.`
    );

    if (!confirmed) {
      return;
    }

    setChatError("");

    try {
      const response = await fetch(
        `${API_URL}/chat/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to delete conversation."
        );
      }

      const remainingSessions = sessions.filter(
        (item) => item.session_id !== sessionId
      );

      setSessions(remainingSessions);

      if (activeSessionId === sessionId) {
        if (remainingSessions.length > 0) {
          await selectSession(
            remainingSessions[0].session_id
          );
        } else {
          createNewChat();
        }
      }
    } catch (error) {
      setChatError(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("chat_username");

    setIsAuthenticated(false);
    setActiveSessionId(null);
    setMessages([]);
    setSessions([]);
    setUsername("User");
    setChatError("");
  };


  const showToast = (message) => setToast(message);

  const copyMessage = async (message, index) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessageIndex(index);
      showToast("Message copied");
      setTimeout(() => setCopiedMessageIndex(null), 1600);
    } catch {
      setChatError("Unable to copy the message. Please try again.");
    }
  };

  const setMessageFeedback = async (message, value) => {
    if (!message.id) return;
    const token = localStorage.getItem("access_token");
    if (!token) { logout(); return; }
    const nextValue = message.feedback === value ? null : value;
    try {
      const response = await fetch(`${API_URL}/chat/${activeSessionId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message_id: message.id, value: nextValue || "none" }),
      });
      if (!response.ok) throw new Error("Unable to save feedback.");
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: nextValue } : item));
      showToast(nextValue ? "Thanks for the feedback" : "Feedback removed");
    } catch (error) {
      setChatError(error.message);
    }
  };

  const renameSession = async (session) => {
    const currentTitle = session.title || "New conversation";
    const nextTitle = window.prompt("Conversation name", currentTitle);
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    const token = localStorage.getItem("access_token");
    if (!token) { logout(); return; }
    try {
      const response = await fetch(`${API_URL}/chat/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: trimmed.slice(0, 120) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to rename conversation.");
      setSessions((current) => current.map((item) => item.session_id === session.session_id ? { ...item, title: data.title } : item));
      showToast("Conversation renamed");
    } catch (error) {
      setChatError(error.message);
    }
  };

  const regenerateLastResponse = async () => {
    if (!activeSessionId || chatLoading || regenerating) return;
    const token = localStorage.getItem("access_token");
    if (!token) { logout(); return; }
    setRegenerating(true);
    setChatError("");
    try {
      const response = await fetch(`${API_URL}/chat/${activeSessionId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.status === 401) { logout(); return; }
      if (!response.ok) throw new Error(data.detail || "Unable to regenerate response.");
      setMessages((current) => {
        const updated = [...current];
        if (updated.at(-1)?.role === "assistant") updated.pop();
        return [...updated, { id: data.message_id, role: "assistant", message: data.reply, created_at: data.created_at, feedback: null }];
      });
      await loadSessions();
      showToast("Response regenerated");
    } catch (error) {
      setChatError(error instanceof TypeError ? "Unable to connect to the server. Make sure the backend is running." : error.message);
    } finally {
      setRegenerating(false);
    }
  };

  const clearCurrentConversation = async () => {
    if (!activeSessionId || messages.length === 0) return;
    if (!window.confirm("Clear all messages from this conversation?")) return;
    const token = localStorage.getItem("access_token");
    if (!token) { logout(); return; }
    try {
      const response = await fetch(`${API_URL}/chat/${activeSessionId}/messages`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to clear conversation.");
      setMessages([]);
      setSessions((current) => current.map((item) => item.session_id === activeSessionId ? { ...item, title: "New conversation" } : item));
      showToast("Conversation cleared");
    } catch (error) {
      setChatError(error.message);
    }
  };

  const formatMessage = (message) => {
    return message.split("\n").map((line, index) => (
      <span key={index}>
        {line}
        {index <
          message.split("\n").length - 1 && <br />}
      </span>
    ));
  };


  if (!isAuthenticated) {
    return (
      <AuthScreen
        isLogin={isLogin}
        setIsLogin={setIsLogin}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        form={form}
        handleChange={handleAuthChange}
        handleSubmit={handleAuthSubmit}
        switchMode={switchAuthMode}
        loading={authLoading}
        error={authError}
        success={authSuccess}
      />
    );
  }


  return (
    <div className="chat-app">
      {mobileSidebar && (
        <button
          className="sidebar-overlay"
          onClick={() =>
            setMobileSidebar(false)
          }
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`chat-sidebar ${
          mobileSidebar
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-mark small-mark">
              <MessageSquare size={18} />
            </div>

            <span>MyChatbot</span>

            <button
              className="mobile-close"
              onClick={() =>
                setMobileSidebar(false)
              }
            >
              <X size={19} />
            </button>
          </div>

          <button
            className="new-chat-button"
            onClick={createNewChat}
          >
            <Plus size={17} />
            <span>New conversation</span>
          </button>
        </div>


        <div className="history-section">
          <div className="sidebar-history-header">
            <div className="sidebar-label">Conversations</div>
            <span className="conversation-count">{sessions.length}</span>
          </div>

          <div className="conversation-search">
            <Search size={15} />
            <input
              value={sessionSearch}
              onChange={(event) => setSessionSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
            {sessionSearch && (
              <button type="button" onClick={() => setSessionSearch("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="empty-history">Your conversations will appear here.</div>
          ) : displayedSessions.length === 0 ? (
            <div className="empty-history">No conversations found.</div>
          ) : (
            <div className="conversation-list">
              {displayedSessions.map((session) => (
                <div
                  key={session.session_id}
                  className={`conversation-item-wrap ${session.session_id === activeSessionId ? "active" : ""}`}
                >
                  <button
                    className={`conversation-item ${session.session_id === activeSessionId ? "active" : ""}`}
                    onClick={() => selectSession(session.session_id)}
                  >
                    <MessageSquare size={16} />
                    <span>{session.title}</span>
                  </button>

                  <div className="conversation-actions">
                    <button
                      type="button"
                      className="conversation-rename"
                      onClick={(event) => { event.stopPropagation(); renameSession(session); }}
                      title="Rename conversation"
                      aria-label={`Rename ${session.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="conversation-delete"
                      onClick={(event) => { event.stopPropagation(); deleteSession(session.session_id); }}
                      title="Delete conversation"
                      aria-label={`Delete ${session.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-action" onClick={() => setShowSettings(true)}>
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <div className="sidebar-user">
            <div className="user-avatar">
              {username
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{username}</strong>
              <span>Personal account</span>
            </div>

            <button
              className="logout-button"
              onClick={logout}
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>


      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-left">
            <button
              className="mobile-menu"
              onClick={() =>
                setMobileSidebar(true)
              }
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1>
                {activeSession?.title || "New conversation"}
              </h1>

              <span className="connection-status">
                <span className="status-dot" />
                AI assistant online
              </span>
            </div>
          </div>

          <div className="header-actions">
            {messages.length > 0 && (
              <button type="button" className="header-action-button" onClick={clearCurrentConversation} title="Clear conversation">
                <Trash2 size={16} />
                <span>Clear</span>
              </button>
            )}
            <div className="header-badge">
              <ShieldCheck size={15} />
              Private
            </div>
          </div>
        </header>


        <section className="messages-area">
          {messages.length === 0 ? (
            <div className="welcome-state">
              <div className="welcome-icon">
                <Bot size={25} />
              </div>

              <span className="welcome-eyebrow">
                <Sparkles size={13} />
                PERSONAL AI ASSISTANT
              </span>

              <h2>
                What can I help you with?
              </h2>

              <p>
                Ask a question, explore an idea,
                or continue a conversation.
              </p>

              <div className="suggestion-row">
                <button
                  onClick={() =>
                    setMessageInput(
                      "Explain something interesting to me."
                    )
                  }
                >
                  Explain something
                </button>

                <button
                  onClick={() =>
                    setMessageInput(
                      "Help me plan my day."
                    )
                  }
                >
                  Help me plan
                </button>

                <button
                  onClick={() =>
                    setMessageInput(
                      "Help me understand a topic."
                    )
                  }
                >
                  Learn a topic
                </button>
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map(
                (message, index) => (
                  <div
                    className={`message-row ${
                      message.role === "user"
                        ? "user-row"
                        : "assistant-row"
                    }`}
                    key={`${message.role}-${index}`}
                  >
                    <div
                      className={`message-avatar ${
                        message.role ===
                        "user"
                          ? "user-message-avatar"
                          : "assistant-message-avatar"
                      }`}
                    >
                      {message.role ===
                      "user" ? (
                        <User size={16} />
                      ) : (
                        <Bot size={17} />
                      )}
                    </div>

                    <div className="message-content">
                      <div className="message-name">
                        {message.role ===
                        "user"
                          ? username
                          : "MyChatbot"}
                      </div>

                      <div className="message-text">
                        {formatMessage(
                          message.message
                        )}
                      </div>

                      <div className="message-meta-row">
                        {message.created_at && (
                          <div className="message-time">
                            {formatMessageTime(message.created_at)}
                          </div>
                        )}

                        {showMessageActions && message.role === "assistant" && (
                          <div className="message-actions" aria-label="Message actions">
                            <button type="button" onClick={() => copyMessage(message.message, index)} title={copiedMessageIndex === index ? "Copied" : "Copy message"}>
                              {copiedMessageIndex === index ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                            {index === messages.length - 1 && (
                              <button type="button" onClick={regenerateLastResponse} disabled={regenerating} title="Regenerate response">
                                <RotateCcw size={13} className={regenerating ? "spin-icon" : ""} />
                              </button>
                            )}
                            <button type="button" className={message.feedback === "up" ? "selected" : ""} onClick={() => setMessageFeedback(message, "up")} title="Helpful">
                              <ThumbsUp size={13} />
                            </button>
                            <button type="button" className={message.feedback === "down" ? "selected" : ""} onClick={() => setMessageFeedback(message, "down")} title="Not helpful">
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

              {chatLoading && (
                <div className="message-row assistant-row">
                  <div className="message-avatar assistant-message-avatar">
                    <Bot size={17} />
                  </div>

                  <div className="message-content">
                    <div className="message-name">
                      MyChatbot
                    </div>

                    <div className="typing-indicator" aria-label="AI is thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {chatError && (
            <div className="chat-error-card" role="alert">
              <div className="chat-error-icon">
                !
              </div>

              <div className="chat-error-content">
                <strong>Something went wrong</strong>
                <span>{chatError}</span>
              </div>

              <button
                type="button"
                className="chat-error-retry"
                onClick={() => {
                  if (!chatLoading && lastFailedMessage) {
                    setChatError("");
                    sendMessage(undefined, lastFailedMessage);
                  }
                }}
                disabled={chatLoading || !lastFailedMessage}
              >
                Try again
              </button>
            </div>
          )}
        </section>


        <div className="composer-area">
          <form
            className="composer"
            onSubmit={sendMessage}
          >
            <textarea
              value={messageInput}
              onChange={(event) =>
                setMessageInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message MyChatbot..."
              rows={1}
              disabled={chatLoading}
            />

            <button
              type="submit"
              className="send-button"
              disabled={
                !messageInput.trim() ||
                chatLoading
              }
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>

          <p className="composer-note">
            MyChatbot can make mistakes. Check
            important information.
          </p>
        </div>

        {toast && (
          <div className="app-toast" role="status">
            <Check size={15} />
            <span>{toast}</span>
          </div>
        )}

        {showSettings && (
          <div className="settings-backdrop" onMouseDown={() => setShowSettings(false)}>
            <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="settings-header">
                <div>
                  <strong>Settings</strong>
                  <span>Personalize your chat experience.</span>
                </div>
                <button type="button" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button>
              </div>

              <label className="settings-toggle-row">
                <div>
                  <strong>Message actions</strong>
                  <span>Show copy, regenerate and feedback controls below AI responses.</span>
                </div>
                <input
                  type="checkbox"
                  checked={showMessageActions}
                  onChange={(event) => setShowMessageActions(event.target.checked)}
                />
              </label>

              <div className="settings-info">
                <ShieldCheck size={16} />
                <span>Your account, conversations and authentication remain protected by the existing backend.</span>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}


function AuthScreen({
  isLogin,
  setIsLogin,
  showPassword,
  setShowPassword,
  form,
  handleChange,
  handleSubmit,
  switchMode,
  loading,
  error,
  success,
}) {
  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-brand-panel">
          <div className="brand">
            <div className="brand-mark">
              <MessageSquare size={21} />
            </div>

            <span>MyChatbot</span>
          </div>

          <div className="brand-content">
            <span className="eyebrow">
              <Sparkles size={14} />
              PERSONAL AI ASSISTANT
            </span>

            <h1>
              Conversations that
              <span> stay with you.</span>
            </h1>

            <p>
              A focused workspace for thoughtful
              conversations, persistent context,
              and useful answers.
            </p>
          </div>

          <div className="brand-footer">
            <ShieldCheck size={16} />

            <span>
              Your conversations stay connected
              to your account.
            </span>
          </div>
        </div>


        <div className="auth-form-panel">
          <div className="auth-form-wrap">
            <div className="mobile-brand">
              <div className="brand-mark">
                <MessageSquare size={20} />
              </div>

              <span>MyChatbot</span>
            </div>

            <div className="form-heading">
              <h2>
                {isLogin
                  ? "Welcome back"
                  : "Create your account"}
              </h2>

              <p>
                {isLogin
                  ? "Sign in to continue your conversations."
                  : "Create an account to keep your conversations in one place."}
              </p>
            </div>


            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="username">
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  required
                  minLength={3}
                />
              </div>


              {!isLogin && (
                <div className="field">
                  <label htmlFor="email">
                    Email address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              )}


              <div className="field">
                <label htmlFor="password">
                  Password
                </label>

                <div className="password-field">
                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    minLength={8}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>


              {isLogin && (
                <div className="form-options">
                  <label className="remember">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="text-button"
                  >
                    Forgot password?
                  </button>
                </div>
              )}


              {error && (
                <div className="form-message error-message">
                  {error}
                </div>
              )}


              {success && (
                <div className="form-message success-message">
                  {success}
                </div>
              )}


              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                <span>
                  {loading
                    ? isLogin
                      ? "Signing in..."
                      : "Creating account..."
                    : isLogin
                    ? "Sign in"
                    : "Create account"}
                </span>

                {!loading && (
                  <ArrowRight size={18} />
                )}
              </button>
            </form>


            <div className="auth-switch">
              <span>
                {isLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>

              <button
                type="button"
                onClick={switchMode}
              >
                {isLogin
                  ? "Create account"
                  : "Sign in"}
              </button>
            </div>


            <p className="legal">
              By continuing, you agree to our Terms
              of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}


const deleteButtonStyles = `
  .message-time {
    margin-top: 5px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1;
  }

  .user-row .message-time {
    text-align: right;
  }

  .chat-error-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(100%, 760px);
    margin: 0 auto 12px;
    padding: 10px 12px;
    border: 1px solid #fecaca;
    border-radius: 10px;
    background: #fff7f7;
    color: #7f1d1d;
  }

  .chat-error-icon {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #fee2e2;
    color: #dc2626;
    font-size: 13px;
    font-weight: 700;
  }

  .chat-error-content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chat-error-content strong {
    font-size: 13px;
  }

  .chat-error-content span {
    color: #991b1b;
    font-size: 12px;
    line-height: 1.4;
  }

  .chat-error-retry {
    flex: 0 0 auto;
    border: 1px solid #fecaca;
    border-radius: 7px;
    background: #ffffff;
    color: #b91c1c;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .chat-error-retry:hover:not(:disabled) {
    background: #fef2f2;
  }

  .chat-error-retry:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .conversation-item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    border-radius: 10px;
  }

  .conversation-item-wrap .conversation-item {
    flex: 1;
    min-width: 0;
  }

  .conversation-delete {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  }

  .conversation-item-wrap:hover .conversation-delete,
  .conversation-item-wrap.active .conversation-delete {
    opacity: 1;
  }

  .conversation-delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .conversation-item-wrap:hover .conversation-item span,
  .conversation-item-wrap.active .conversation-item span {
    padding-right: 72px;
  }

  .sidebar-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .conversation-count {
    min-width: 22px;
    padding: 2px 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
  }

  .conversation-search {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 9px;
    margin-bottom: 9px;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    background: #ffffff;
    color: #94a3b8;
  }

  .conversation-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: #334155;
    font-size: 12px;
  }

  .conversation-search button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
  }

  .conversation-actions {
    position: absolute;
    right: 7px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity .15s ease;
  }

  .conversation-item-wrap:hover .conversation-actions,
  .conversation-item-wrap.active .conversation-actions {
    opacity: 1;
  }

  .conversation-rename, .conversation-delete {
    position: static !important;
    transform: none !important;
    opacity: 1 !important;
    width: 28px !important;
    height: 28px !important;
  }

  .conversation-rename {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
  }

  .conversation-rename:hover {
    background: #eff6ff;
    color: #2563eb;
  }

  .message-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 18px;
  }

  .message-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity .15s ease;
  }

  .message-row:hover .message-actions,
  .message-actions:focus-within {
    opacity: 1;
  }

  .message-actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
  }

  .message-actions button:hover,
  .message-actions button.selected {
    background: #eff6ff;
    color: #2563eb;
  }

  .app-toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 13px;
    border: 1px solid #dbeafe;
    border-radius: 9px;
    background: #ffffff;
    color: #1e40af;
    box-shadow: 0 8px 30px rgba(15, 23, 42, .12);
    font-size: 12px;
    font-weight: 600;
  }

  .settings-backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, .32);
  }

  .settings-modal {
    width: min(100%, 460px);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 24px 70px rgba(15, 23, 42, .18);
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px;
    border-bottom: 1px solid #f1f5f9;
  }

  .settings-header > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-header strong {
    color: #0f172a;
    font-size: 16px;
  }

  .settings-header span {
    color: #64748b;
    font-size: 12px;
  }

  .settings-header button {
    display: flex;
    border: 0;
    background: transparent;
    color: #64748b;
    cursor: pointer;
  }

  .settings-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    cursor: pointer;
  }

  .settings-toggle-row div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-toggle-row strong {
    color: #334155;
    font-size: 13px;
  }

  .settings-toggle-row span {
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
  }

  .settings-toggle-row input {
    width: 38px;
    height: 20px;
    accent-color: #2563eb;
    cursor: pointer;
  }

  .settings-info {
    display: flex;
    gap: 9px;
    margin: 0 20px 20px;
    padding: 11px 12px;
    border-radius: 9px;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px;
    line-height: 1.45;
  }

  @media (max-width: 640px) {
    .message-actions { opacity: 1; }
    .app-toast { bottom: 76px; }
  }

  .header-actions { display:flex; align-items:center; gap:8px; }
  .header-action-button { display:inline-flex; align-items:center; gap:6px; border:1px solid #dbe3ef; background:#fff; color:#526071; border-radius:9px; padding:8px 10px; font-size:12px; font-weight:600; cursor:pointer; }
  .header-action-button:hover { background:#f7f9fc; color:#1f2937; }
  .spin-icon { animation: spin-icon 0.8s linear infinite; }
  @keyframes spin-icon { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @media (max-width: 700px) { .header-action-button span { display:none; } .header-action-button { padding:8px; } }
`;

if (typeof document !== "undefined") {
  const styleId = "mychatbot-delete-session-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = deleteButtonStyles;
    document.head.appendChild(style);
  }
}

export default App;

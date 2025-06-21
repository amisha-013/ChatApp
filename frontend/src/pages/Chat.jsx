import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import "./Chat.css";

const socket = io("http://localhost:5000");


function Chat({ token, username }) {
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState("general");
  const [privateReceiver, setPrivateReceiver] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [targetLang, setTargetLang] = useState("en");
  const [file, setFile] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    if (username) socket.emit("register_user", username);
  }, [username]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`/api/users?username=${username}`);
        const data = await res.json();
        const usernames = data.map(u => (typeof u === "string" ? u : u.username));
        setUsers(usernames.filter(u => u !== username));
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, [username]);

  useEffect(() => {
    if (room) {
      socket.emit("join_room", room);
    } else if (privateReceiver) {
      socket.emit("load_private_history", { sender: username, receiver: privateReceiver });
    } else {
      setMessages([]);
    }
  }, [room, privateReceiver, username]);

  const translateMessage = async (text, target) => {
    if (!text || !target) return text;
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target }),
      });
      const data = await res.json();
      return data.data?.translations?.[0]?.translatedText || text;
    } catch {
      return text;
    }
  };

  useEffect(() => {
    socket.on("receive_message", async (data) => {
      if (
        (data.room && data.room === room) ||
        (data.receiver &&
          ((data.sender === privateReceiver && data.receiver === username) ||
           (data.sender === username && data.receiver === privateReceiver)))
      ) {
        const translated = await translateMessage(data.message, targetLang);
        const translatedMsg = { ...data, translatedText: translated };
        setMessages(prev => [...prev, translatedMsg]);
      }
    });

    return () => socket.off("receive_message");
  }, [room, privateReceiver, targetLang, username]);

  useEffect(() => {
    socket.on("private_history", async (history) => {
      const translated = await Promise.all(
        history.map(async (msg) => ({
          ...msg,
          translatedText: await translateMessage(msg.message, targetLang),
        }))
      );
      setMessages(translated);
    });

    return () => socket.off("private_history");
  }, [targetLang]);

  useEffect(() => {
    socket.on("user_typing", (user) => {
      if (
        (room && user.room === room) ||
        (privateReceiver && (user.user === privateReceiver || user.user === username))
      ) {
        setTypingUser(user.user);
      }
    });
    socket.on("user_stop_typing", () => setTypingUser(null));
    return () => {
      socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, [room, privateReceiver, username]);

  const sendMessage = async () => {
    let fileUrl = null;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        fileUrl = data.url;
      } catch {
        return;
      } finally {
        setFile(null);
      }
    }

    if (!message.trim() && !fileUrl) return;

    const msgData = {
      sender: username,
      message: message.trim(),
      media: fileUrl,
      timestamp: new Date().toISOString(),
    };

    if (room) {
      msgData.room = room;
    } else if (privateReceiver) {
      msgData.receiver = privateReceiver;
    }

    socket.emit("send_message", msgData);
    setMessage("");
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      const target = room ? { room, user: username } : { to: privateReceiver, user: username };
      socket.emit("typing", target);
      setTimeout(() => {
        setIsTyping(false);
        const stopTarget = room ? { room, user: username } : { to: privateReceiver, user: username };
        socket.emit("stop_typing", stopTarget);
      }, 3000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
      const stopTarget = room ? { room, user: username } : { to: privateReceiver, user: username };
      socket.emit("stop_typing", stopTarget);
    }
  };

  function MessageItem({ msg }) {
    const media = msg.media?.toLowerCase();

    return (
      <div className={`message-item ${msg.sender === username ? "own" : ""}`}>
        <div className="message-sender">{msg.sender}</div>
        <div className="message-content">
          {msg.translatedText || msg.message || (media && "📎 Media attached")}
          {media?.endsWith(".mp4") && (
            <video src={msg.media} controls width="300" className="message-media" />
          )}
          {[".jpg", ".jpeg", ".png", ".gif", ".webp"].some((ext) =>
            media?.endsWith(ext)
          ) && (
            <img src={msg.media} alt="media" className="message-media" />
          )}
          {msg.translatedText && msg.translatedText !== msg.message && (
            <small className="original-text">({msg.message})</small>
          )}
        </div>
        <div className="message-time">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <aside className="sidebar">
        <h3>Rooms</h3>
        <select
          className="select"
          value={room || ""}
          onChange={(e) => {
            setRoom(e.target.value);
            setPrivateReceiver("");
          }}
        >
          <option value="general">General</option>
          <option value="random">Random</option>
          <option value="tech">Tech</option>
          <option value="">-- None --</option>
        </select>

        <h3>Private Chat</h3>
        <select
          className="select"
          value={privateReceiver}
          onChange={(e) => {
            setPrivateReceiver(e.target.value);
            setRoom("");
          }}
        >
          <option value="">-- Select user --</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <h3>Language</h3>
        <select
          className="select"
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="hi">Hindi</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <h2>
            {room
              ? `Room: ${room}`
              : privateReceiver
              ? `Private chat with ${privateReceiver}`
              : "Select a chat"}
          </h2>
          {typingUser && (
            <p className="typing-indicator">{typingUser} is typing...</p>
          )}
        </header>

        <section className="messages-container">
          {messages.length === 0 ? (
            <p className="no-messages">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => <MessageItem key={msg._id || msg.timestamp} msg={msg} />)
          )}
        </section>

        <footer className="chat-input-area">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="file-input"
          />

          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="message-input"
          />
          <button onClick={sendMessage} className="send-button">
            Send
          </button>
        </footer>
      </main>
    </div>
  );
}

export default Chat;

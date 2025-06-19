import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

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
        const usernames = data.map(u => (typeof u === 'string' ? u : u.username));
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
        history.map(async msg => ({
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
      <div style={{ marginBottom: "8px" }}>
        <b>{msg.sender}:</b>{" "}
        {msg.translatedText || msg.message || (media && "📎 Media attached")}
        <br />
        {media?.endsWith(".mp4") && (
          <video src={msg.media} controls width="300" style={{ marginTop: "5px" }} />
        )}
        {[".jpg", ".jpeg", ".png", ".gif", ".webp"].some((ext) =>
          media?.endsWith(ext)
        ) && (
          <img src={msg.media} alt="media" width="200" style={{ marginTop: "5px" }} />
        )}
        {msg.translatedText && msg.translatedText !== msg.message && (
          <small style={{ color: "gray" }}>({msg.message})</small>
        )}
        <br />
        <small style={{ color: "gray" }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </small>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "90vh" }}>
      {/* Sidebar */}
      <div style={{ width: "250px", padding: "10px", borderRight: "1px solid #ccc" }}>
        <h4>Room</h4>
        <select
          value={room || ""}
          onChange={(e) => {
            setRoom(e.target.value);
            setPrivateReceiver("");
          }}
          style={{ width: "100%", padding: "6px", marginBottom: "10px" }}
        >
          <option value="general">General</option>
          <option value="random">Random</option>
          <option value="tech">Tech</option>
          <option value="">-- None --</option>
        </select>

        <h4>Private Chat</h4>
        <select
          value={privateReceiver}
          onChange={(e) => {
            setPrivateReceiver(e.target.value);
            setRoom("");
          }}
          style={{ width: "100%", padding: "6px", marginBottom: "10px" }}
        >
          <option value="">-- Select user --</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <h4>Language</h4>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          style={{ width: "100%", padding: "6px" }}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="hi">Hindi</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, padding: "15px", display: "flex", flexDirection: "column" }}>
        <h2 style={{ marginBottom: "10px" }}>
          {room
            ? `Room: ${room}`
            : privateReceiver
            ? `Private chat with ${privateReceiver}`
            : "Select a chat"}
        </h2>

        {typingUser && (
          <p style={{ fontStyle: "italic", color: "gray" }}>{typingUser} is typing...</p>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: "#f9f9f9",
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: "gray" }}>No messages yet. Start the conversation!</p>
          )}
          {messages.map((msg) => (
            <MessageItem key={msg._id || msg.timestamp} msg={msg} />
          ))}
        </div>

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: "10px" }}
        />

        <div style={{ display: "flex" }}>
          <input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            style={{ flex: 1, padding: "10px" }}
          />
          <button
            onClick={sendMessage}
            style={{ padding: "10px 15px", marginLeft: "10px" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;

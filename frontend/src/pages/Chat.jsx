import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

const socket = io("http://localhost:5000");

function Chat({ token, username }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState("general");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [targetLang, setTargetLang] = useState("en");
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    if (room) socket.emit("join_room", room);

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat?room=${room}`);
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
      }
    };

    fetchMessages();
  }, [room]);

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
    } catch (err) {
      console.error("Translation error:", err);
      return text;
    }
  };

  useEffect(() => {
    socket.on("receive_message", async (data) => {
      const translated = await translateMessage(data.message, targetLang);
      const translatedMsg = { ...data, translatedText: translated };
      setMessages((prev) => [...prev, translatedMsg]);
      socket.emit("message_delivered", {
        messageId: data._id,
        username,
        room,
      });
    });

    return () => socket.off("receive_message");
  }, [targetLang]);

  useEffect(() => {
    socket.on("user_typing", (user) => setTypingUser(user));
    socket.on("user_stop_typing", () => setTypingUser(null));
    return () => {
      socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, []);

  useEffect(() => {
    socket.on("message_seen_update", ({ messageId, username: seenUser }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                seenBy: msg.seenBy?.includes(seenUser)
                  ? msg.seenBy
                  : [...(msg.seenBy || []), seenUser],
              }
            : msg
        )
      );
    });
    return () => socket.off("message_seen_update");
  }, []);

  useEffect(() => {
    socket.on("message_delivered_update", ({ messageId, username: deliveredUser }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                deliveredTo: msg.deliveredTo?.includes(deliveredUser)
                  ? msg.deliveredTo
                  : [...(msg.deliveredTo || []), deliveredUser],
              }
            : msg
        )
      );
    });
    return () => socket.off("message_delivered_update");
  }, []);

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

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Upload failed: ${res.status} – ${errText}`);
        }

        const data = await res.json();
        fileUrl = data.url;
      } catch (err) {
        console.error("Upload error:", err.message);
        return;
      } finally {
        setFile(null);
      }
    }

    if (!message.trim() && !fileUrl) return;

    const msgData = {
      sender: username,
      message: message.trim(),
      room,
      timestamp: new Date().toISOString(),
      media: fileUrl,
    };

    socket.emit("send_message", msgData);
    setMessage("");
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { room, user: username });
      setTimeout(() => {
        setIsTyping(false);
        socket.emit("stop_typing", { room, user: username });
      }, 3000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
      socket.emit("stop_typing", { room, user: username });
    }
  };

  function MessageItem({ msg }) {
    useEffect(() => {
      if (!msg.seenBy?.includes(username)) {
        socket.emit("message_seen", {
          messageId: msg._id,
          username,
          room,
        });
      }
    }, [msg]);

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
          {new Date(msg.timestamp).toLocaleTimeString()}{" "}
          {msg.deliveredTo?.includes(username) ? "• Delivered" : ""}{" "}
          {msg.seenBy?.includes(username) ? "• Seen" : ""}
        </small>
      </div>
    );
  }

  return (
    <div>
      <h2>Chat Room: {room}</h2>

      <select
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        style={{ marginBottom: "10px", padding: "6px" }}
      >
        <option value="general">General</option>
        <option value="random">Random</option>
        <option value="tech">Tech</option>
      </select>

      <select
        value={targetLang}
        onChange={(e) => setTargetLang(e.target.value)}
        style={{ marginLeft: "10px", padding: "6px" }}
      >
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="hi">Hindi</option>
        <option value="fr">French</option>
        <option value="de">German</option>
      </select>

      {typingUser && (
        <p style={{ fontStyle: "italic", color: "gray" }}>
          {typingUser} is typing...
        </p>
      )}

      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg) => (
          <MessageItem key={msg._id || msg.timestamp} msg={msg} />
        ))}
      </div>

      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        style={{ marginBottom: "10px" }}
      />
      <br />
      <input
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          handleTyping();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        style={{ width: "80%", padding: "8px" }}
      />
      <button
        onClick={sendMessage}
        style={{ padding: "8px 12px", marginLeft: "8px" }}
      >
        Send
      </button>
    </div>
  );
}

export default Chat;

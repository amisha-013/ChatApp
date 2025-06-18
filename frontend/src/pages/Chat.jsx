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

  // Redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // Join room & load chat history
  useEffect(() => {
    if (room) {
      socket.emit("join_room", room);
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/chat?room=${room}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    };

    fetchMessages();
  }, [room]);

  // Listen for new incoming messages
  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });
    return () => {
      socket.off("receive_message");
    };
  }, []);

  // Typing indicator listeners
  useEffect(() => {
    socket.on("user_typing", (user) => setTypingUser(user));
    socket.on("user_stop_typing", () => setTypingUser(null));

    return () => {
      socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, []);

  // Listen for message seen updates
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
    return () => {
      socket.off("message_seen_update");
    };
  }, []);

  // Send message
  const sendMessage = () => {
    if (message.trim() === "") return;

    const msgData = {
      sender: username,
      message,
      room,
      timestamp: new Date().toISOString(),
    };

    socket.emit("send_message", msgData);
    setMessage("");
  };

  // Typing events
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

  // Emit "message_seen" when rendering messages that user hasn't seen yet
  // Note: can't put useEffect inside map, so we'll use a helper component below

  // Helper component to emit seen event when a message appears
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

    return (
      <div key={msg._id} style={{ marginBottom: "8px" }}>
        <b>{msg.sender}:</b> {msg.message}
        <br />
        <small style={{ color: "gray" }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
          {msg.seenBy?.includes(username) ? " • Seen" : ""}
        </small>
      </div>
    );
  }

  return (
    <div>
      <h2>Chat Room: {room}</h2>

      {/* Room selector */}
      <select
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        style={{ marginBottom: "10px", padding: "6px" }}
      >
        <option value="general">General</option>
        <option value="random">Random</option>
        <option value="tech">Tech</option>
      </select>

      {/* Typing indicator */}
      {typingUser && (
        <p style={{ fontStyle: "italic", color: "gray" }}>
          {typingUser} is typing...
        </p>
      )}

      {/* Messages */}
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

      {/* Message input */}
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

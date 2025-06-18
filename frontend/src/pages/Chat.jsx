import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const socket = io("http://localhost:5000");

function Chat({ token, username }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState("general"); // ✅ Default room

  // 🔒 Redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // 📡 Join room & load chat history
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
          console.warn("Expected array but got:", data);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [room]);

  // 🔔 Listen for real-time messages
  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, []);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div>
      <h2>Chat Room: {room}</h2>

      {/* 🔀 Room Selector */}
      <select
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        style={{ marginBottom: "10px", padding: "6px" }}
      >
        <option value="general">General</option>
        <option value="random">Random</option>
        <option value="tech">Tech</option>
      </select>

      {/* 📨 Chat Messages */}
      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: "8px" }}>
            <b>{msg.sender || "Unknown"}:</b> {msg.message}
            <br />
            <small style={{ color: "gray" }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </small>
          </div>
        ))}
      </div>

      {/* 📝 Message Input */}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
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

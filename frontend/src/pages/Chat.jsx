import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const socket = io("http://localhost:5000");

function Chat({ token, username }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Redirect to login if token is missing
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // Fetch past messages on component mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/chat');
        const data = await res.json();

        // Ensure the fetched data is an array
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
  }, []);

  // Listen for real-time incoming messages
  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, []);

  const sendMessage = async () => {
    if (message.trim() === "") return;

    const msgData = {
      message,
      sender: username,
      timestamp: new Date().toISOString(),
    };

    // Emit real-time message
    socket.emit("send_message", msgData);

    // Save to backend
    try {
      await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sender: username, text: message }),
      });
    } catch (err) {
      console.error("Failed to save message", err);
    }

    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div>
      <h2>Chat Room</h2>
      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {Array.isArray(messages) &&
          messages.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: "8px" }}>
              <b>{msg.sender || "Unknown"}:</b> {msg.text || msg.message} <br />
              <small style={{ color: "gray" }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </small>
            </div>
          ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type here..."
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

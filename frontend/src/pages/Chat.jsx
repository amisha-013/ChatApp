import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io("http://localhost:5000");

function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const sendMessage = () => {
    socket.emit("send_message", { message });
    setMessage("");
  };

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data.message]);
    });
  }, []);

  return (
    <div>
      <h2>Chat Room</h2>
      {messages.map((msg, idx) => <div key={idx}>{msg}</div>)}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type here..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default Chat;

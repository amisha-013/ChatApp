import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Chat from './pages/Chat.jsx'; // ✅ You forgot this import

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login setToken={setToken} setUsername={setUsername} />} />
        <Route path="/chat" element={<Chat token={token} username={username} />} />
      </Routes>
    </Router>
  );
}

export default App;

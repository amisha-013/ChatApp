import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login({ setToken, setUsername }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value.trim() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Both email and password are required');
      return;
    }

    try {
      const response = await axios.post('/api/auth/login', form, {
        headers: { 'Content-Type': 'application/json' },
      });

      const { token, username } = response.data;
      setToken(token);
      setUsername(username);
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      navigate('/chat');
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.message ||
        (err.response?.status === 404
          ? 'Login route not found. Check your proxy setup.'
          : 'Login failed. Please try again.')
      );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
      />
      <button type="submit">Login</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}

export default Login;

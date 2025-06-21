import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login({ setToken, setUsername }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" noValidate>
        <h2 className="login-title">Welcome Back</h2>

        <div className="login-fields">
          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="login-input"
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="login-input"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <button type="submit" className="login-button">Sign In</button>

        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}

export default Login;

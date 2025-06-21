import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Register.css';

function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Validate email format using regex
  const validateEmail = (email) => {
    // Basic regex for checking "something@something"
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear error on typing
    setError('');
  };

  // Validate email on blur (when user leaves email input)
  const handleEmailBlur = () => {
    if (form.email && !validateEmail(form.email)) {
      setError('Please enter a valid email address');
    } else {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(form.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await axios.post('/api/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit} className="register-form" noValidate>
        <h2 className="register-title">Register</h2>

        <label htmlFor="username" className="register-label">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Enter your username"
          onChange={handleChange}
          className="register-input"
          required
          autoComplete="username"
        />

        <label htmlFor="email" className="register-label">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          onChange={handleChange}
          onBlur={handleEmailBlur}
          className="register-input"
          required
          autoComplete="email"
        />

        <label htmlFor="password" className="register-label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          onChange={handleChange}
          className="register-input"
          required
          autoComplete="new-password"
        />

        <label htmlFor="confirmPassword" className="register-label">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          onChange={handleChange}
          className="register-input"
          required
          autoComplete="new-password"
        />

        <button type="submit" className="register-button">Register</button>

        {error && <p className="register-error">{error}</p>}
      </form>
    </div>
  );
}

export default Register;

/**
 * Signup Page — Firebase Authentication
 *
 * Fully accessible registration form with:
 * - Properly associated labels (htmlFor/id)
 * - ARIA live region for async state announcements
 * - autoComplete attributes for password managers
 * - aria-required and aria-busy attributes
 * - h1 heading (correct page hierarchy)
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, User, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await signup(email, password, name);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      toast.success('Welcome!');
      navigate('/');
    } catch (err) {
      toast.error('Google sign-in failed');
    }
  };

  return (
    <div className="auth-page" role="main" aria-label="Sign up page">
      <div className="auth-card glass-card animate-fade-in-up">
        <div className="auth-card__header">
          <div className="auth-card__logo" aria-hidden="true">
            <Sparkles size={32} />
          </div>
          <h1 className="fw-bold" style={{ fontSize: '1.5rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Join SyncSphere today</p>
        </div>

        {/* ARIA live region for status announcements */}
        <div aria-live="polite" aria-atomic="true" className="visually-hidden">
          {loading && 'Creating your account, please wait...'}
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-card__form"
          aria-label="Create account form"
          noValidate
        >
          <div className="mb-3">
            <label htmlFor="signup-name" className="form-label small fw-semibold">
              Full Name
            </label>
            <div className="input-group">
              <span
                className="input-group-text"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                aria-hidden="true"
              >
                <User size={16} />
              </span>
              <input
                type="text"
                id="signup-name"
                name="name"
                className="form-control"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                aria-required="true"
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="signup-email" className="form-label small fw-semibold">
              Email address
            </label>
            <div className="input-group">
              <span
                className="input-group-text"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                aria-hidden="true"
              >
                <Mail size={16} />
              </span>
              <input
                type="email"
                id="signup-email"
                name="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-required="true"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="signup-password" className="form-label small fw-semibold">
              Password
            </label>
            <div className="input-group">
              <span
                className="input-group-text"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                aria-hidden="true"
              >
                <Lock size={16} />
              </span>
              <input
                type="password"
                id="signup-password"
                name="password"
                className="form-control"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby="signup-password-hint"
              />
            </div>
            <div id="signup-password-hint" className="form-text" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Password must be at least 6 characters
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 mb-3"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && (
              <Loader
                size={18}
                className="me-2"
                style={{ animation: 'spin 1s linear infinite' }}
                aria-hidden="true"
              />
            )}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <button
            type="button"
            className="btn btn-outline-primary w-100"
            onClick={handleGoogle}
            aria-label="Sign up with Google account"
          >
            Sign up with Google
          </button>
        </form>

        <div className="auth-card__footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="fw-semibold" style={{ color: 'var(--primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Login Page — Firebase Authentication
 *
 * Fully accessible login form with:
 * - Properly associated labels (htmlFor/id)
 * - ARIA live region for async state announcements
 * - keyboard-accessible Google sign-in
 * - autoComplete hints for password managers
 * - Firebase Auth + Google OAuth support
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
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
    <div className="auth-page" role="main" aria-label="Login page">
      <div className="auth-card glass-card animate-fade-in-up">
        <div className="auth-card__header">
          <div className="auth-card__logo" aria-hidden="true">
            <Sparkles size={32} />
          </div>
          {/* h1 for correct page heading hierarchy */}
          <h1 className="fw-bold" style={{ fontSize: '1.5rem' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to SyncSphere</p>
        </div>

        {/* ARIA live region: announces async status to screen readers */}
        <div aria-live="polite" aria-atomic="true" className="visually-hidden">
          {loading && 'Signing in, please wait...'}
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-card__form"
          aria-label="Sign in form"
          noValidate
        >
          <div className="mb-3">
            <label htmlFor="login-email" className="form-label small fw-semibold">
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
                id="login-email"
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
            <label htmlFor="login-password" className="form-label small fw-semibold">
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
                id="login-password"
                name="password"
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-required="true"
              />
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            className="btn btn-outline-primary w-100"
            onClick={handleGoogle}
            aria-label="Sign in with Google account"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              className="me-2"
              aria-hidden="true"
              focusable="false"
            >
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="auth-card__footer">
          <p>
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="fw-semibold" style={{ color: 'var(--primary)' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Google Services Badge */}
      <div
        className="auth-services animate-fade-in"
        style={{ animationDelay: '0.5s' }}
        aria-label="Powered by Google Cloud services"
      >
        <small style={{ color: 'var(--text-muted)' }}>
          Powered by Firebase Auth &bull; Vertex AI &bull; Cloud SQL &bull; BigQuery &bull; GCS &bull; Cloud Run
        </small>
      </div>
    </div>
  );
}

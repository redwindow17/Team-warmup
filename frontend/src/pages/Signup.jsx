/**
 * Signup Page
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
    <div className="auth-page">
      <div className="auth-card glass-card animate-fade-in-up">
        <div className="auth-card__header">
          <div className="auth-card__logo"><Sparkles size={32} /></div>
          <h2 className="fw-bold">Create Account</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Join SyncSphere today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="mb-3">
            <label className="form-label small fw-semibold">Full Name</label>
            <div className="input-group">
              <span className="input-group-text" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <User size={16} />
              </span>
              <input type="text" className="form-control" placeholder="John Doe"
                value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold">Email</label>
            <div className="input-group">
              <span className="input-group-text" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Mail size={16} />
              </span>
              <input type="email" className="form-control" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small fw-semibold">Password</label>
            <div className="input-group">
              <span className="input-group-text" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Lock size={16} />
              </span>
              <input type="password" className="form-control" placeholder="Min. 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 mb-3" disabled={loading}>
            {loading ? <Loader size={18} className="me-2" style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <button type="button" className="btn btn-outline-primary w-100" onClick={handleGoogle}>
            Sign up with Google
          </button>
        </form>

        <div className="auth-card__footer">
          <p>Already have an account? <Link to="/login" className="fw-semibold" style={{ color: 'var(--primary)' }}>Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}

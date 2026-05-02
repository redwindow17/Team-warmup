/**
 * Common Components — LoadingSpinner, Avatar, Toast, FileUpload
 */

import React from 'react';
import { getInitials } from '../../utils/formatters';
import { Upload, Loader } from 'lucide-react';

export function LoadingSpinner({ size = 40, text = 'Loading...' }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5">
      <div className="spinner-border text-primary" role="status" style={{ width: size, height: size }}>
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && <p className="mt-3" style={{ color: 'var(--text-secondary)' }}>{text}</p>}
    </div>
  );
}

export function Avatar({ name, url, size = 36 }) {
  const style = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    background: 'var(--gradient-primary)', color: 'white',
    overflow: 'hidden'
  };
  return (
    <div style={style}>
      {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : getInitials(name)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-5 animate-fade-in">
      {Icon && <Icon size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />}
      <h5 style={{ color: 'var(--text-primary)' }}>{title}</h5>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function FileUploadButton({ onUpload, loading }) {
  const handleChange = (e) => {
    if (e.target.files[0]) onUpload(e.target.files[0]);
  };
  return (
    <label className="btn btn-outline-primary btn-sm" style={{ cursor: 'pointer' }}>
      {loading ? <Loader size={16} className="me-1" style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} className="me-1" />}
      {loading ? 'Uploading...' : 'Attach File'}
      <input type="file" hidden onChange={handleChange} disabled={loading} />
    </label>
  );
}

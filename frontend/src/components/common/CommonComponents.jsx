/**
 * Common Components — LoadingSpinner, Avatar, EmptyState, FileUpload
 * 
 * Shared UI components with full accessibility support:
 * - ARIA live regions for loading states
 * - Proper alt text for images
 * - Keyboard-accessible file upload
 * - Semantic HTML with ARIA roles
 */

import React, { useRef } from 'react';
import { getInitials } from '../../utils/formatters';
import { Upload, Loader } from 'lucide-react';

/**
 * Loading spinner with accessible live region
 * @param {Object} props
 * @param {number} [props.size=40] - Spinner diameter in pixels
 * @param {string} [props.text='Loading...'] - Status text announced to screen readers
 */
export function LoadingSpinner({ size = 40, text = 'Loading...' }) {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="spinner-border text-primary"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && (
        <p className="mt-3" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * User avatar with initials fallback
 * @param {Object} props
 * @param {string} props.name - User display name
 * @param {string} [props.url] - Avatar image URL
 * @param {number} [props.size=36] - Avatar size in pixels
 */
export function Avatar({ name, url, size = 36 }) {
  const style = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    background: 'var(--gradient-primary)', color: 'white',
    overflow: 'hidden'
  };
  return (
    <div style={style} role="img" aria-label={`${name || 'User'}'s avatar`}>
      {url ? (
        <img
          src={url}
          alt={`${name || 'User'}'s profile picture`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </div>
  );
}

/**
 * Empty state placeholder with optional action
 * @param {Object} props
 * @param {React.ComponentType} [props.icon] - Icon component to display
 * @param {string} props.title - Empty state heading
 * @param {string} props.description - Descriptive text
 * @param {React.ReactNode} [props.action] - Action element (button, link)
 */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      className="text-center py-5 animate-fade-in"
      role="status"
      aria-label={title}
    >
      {Icon && <Icon size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} aria-hidden="true" />}
      <h5 style={{ color: 'var(--text-primary)' }}>{title}</h5>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Accessible file upload button with loading state
 * @param {Object} props
 * @param {Function} props.onUpload - Callback when file is selected
 * @param {boolean} [props.loading] - Whether upload is in progress
 */
export function FileUploadButton({ onUpload, loading }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    if (e.target.files[0]) onUpload(e.target.files[0]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <label
      className="btn btn-outline-primary btn-sm"
      style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-busy={loading}
      aria-label={loading ? 'File upload in progress' : 'Attach a file'}
    >
      {loading ? (
        <Loader size={16} className="me-1" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
      ) : (
        <Upload size={16} className="me-1" aria-hidden="true" />
      )}
      {loading ? 'Uploading...' : 'Attach File'}
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={handleChange}
        disabled={loading}
        aria-label="Choose file to upload"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      />
    </label>
  );
}


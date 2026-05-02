/**
 * Utility Formatters
 */

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatRelative(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function truncate(str, max = 50) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  high: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  medium: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  low: { label: 'Low', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
};

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  review: { label: 'Review', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  done: { label: 'Done', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
};

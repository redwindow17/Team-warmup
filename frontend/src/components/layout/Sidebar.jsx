/**
 * Sidebar Navigation
 * 
 * Primary navigation with ARIA landmark, keyboard accessibility,
 * and screen reader support for role-based user info.
 */

import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, MessageCircle, BarChart3, Workflow, Settings, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../utils/formatters';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/workflows', icon: Workflow, label: 'Workflows' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { userProfile, logout } = useAuth();
  const sidebarRef = useRef(null);

  // Close sidebar on Escape key (accessibility)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay — clickable and keyboard-dismissable */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon" aria-hidden="true">
            <Sparkles size={24} />
          </div>
          <span className="sidebar__logo-text">SyncSphere</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav" aria-label="Primary">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} role="list">
            {navItems.map(item => (
              <li key={item.path} role="listitem">
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                  onClick={onClose}
                  aria-current={({ isActive }) => isActive ? 'page' : undefined}
                >
                  <item.icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User section */}
        <div className="sidebar__user" role="region" aria-label="User profile">
          <div className="sidebar__user-avatar" role="img" aria-label={`${userProfile?.name || 'User'}'s avatar`}>
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt={`${userProfile.name}'s profile`} loading="lazy" />
            ) : (
              <span aria-hidden="true">{getInitials(userProfile?.name)}</span>
            )}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{userProfile?.name || 'User'}</div>
            <div className="sidebar__user-role" aria-label={`Role: ${userProfile?.role || 'member'}`}>
              {userProfile?.role || 'member'}
            </div>
          </div>
          <button
            className="sidebar__logout"
            onClick={logout}
            title="Logout"
            aria-label="Sign out of your account"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}


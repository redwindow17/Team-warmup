/**
 * Sidebar Navigation
 */

import React from 'react';
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

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">
            <Sparkles size={24} />
          </div>
          <span className="sidebar__logo-text">SyncSphere</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt={userProfile.name} />
            ) : (
              <span>{getInitials(userProfile?.name)}</span>
            )}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{userProfile?.name || 'User'}</div>
            <div className="sidebar__user-role">{userProfile?.role || 'member'}</div>
          </div>
          <button className="sidebar__logout" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}

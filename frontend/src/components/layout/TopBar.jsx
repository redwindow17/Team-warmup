/**
 * Top Bar — Search, Notifications, Theme Toggle
 * 
 * Header bar with accessible search, notification badge,
 * AI assistant toggle, and theme switcher.
 */

import React, { useState } from 'react';
import { Search, Bell, Sun, Moon, Menu, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function TopBar({ onMenuClick, onAiToggle }) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="topbar" role="banner" aria-label="Application header">
      <div className="topbar__left">
        <button
          className="topbar__menu-btn"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
          aria-expanded="false"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="topbar__search" role="search" aria-label="Search tasks and messages">
          <Search size={18} className="topbar__search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search tasks, messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="topbar__search-input"
            aria-label="Search tasks and messages"
            autoComplete="off"
            id="global-search"
          />
        </div>
      </div>

      <div className="topbar__right" role="toolbar" aria-label="Quick actions">
        <button
          className="topbar__icon-btn topbar__ai-btn animate-glow"
          onClick={onAiToggle}
          title="AI Assistant (Vertex AI)"
          aria-label="Open AI Assistant powered by Google Vertex AI"
        >
          <Sparkles size={20} aria-hidden="true" />
        </button>
        <button
          className="topbar__icon-btn"
          title="Notifications"
          aria-label="View notifications, 3 unread"
        >
          <Bell size={20} aria-hidden="true" />
          <span className="topbar__badge" aria-hidden="true">3</span>
        </button>
        <button
          className="topbar__icon-btn"
          onClick={toggleTheme}
          title="Toggle theme"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}


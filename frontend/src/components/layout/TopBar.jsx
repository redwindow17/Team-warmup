/**
 * Top Bar — Search, Notifications, Theme Toggle
 */

import React, { useState } from 'react';
import { Search, Bell, Sun, Moon, Menu, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function TopBar({ onMenuClick, onAiToggle }) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onMenuClick}>
          <Menu size={22} />
        </button>
        <div className="topbar__search">
          <Search size={18} className="topbar__search-icon" />
          <input
            type="text"
            placeholder="Search tasks, messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="topbar__search-input"
          />
        </div>
      </div>

      <div className="topbar__right">
        <button
          className="topbar__icon-btn topbar__ai-btn animate-glow"
          onClick={onAiToggle}
          title="AI Assistant (Vertex AI)"
        >
          <Sparkles size={20} />
        </button>
        <button className="topbar__icon-btn" title="Notifications">
          <Bell size={20} />
          <span className="topbar__badge">3</span>
        </button>
        <button className="topbar__icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}

/**
 * Main Layout — Sidebar + TopBar + Content Area
 * 
 * Provides the primary application shell with:
 * - Navigation sidebar with ARIA landmark
 * - Top bar with menu and AI assistant controls
 * - Main content area with skip-navigation target
 * - AI Assistant panel (complementary landmark)
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AiAssistant from '../ai/AiAssistant';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="app-layout" role="presentation">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-layout__main">
        <TopBar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onAiToggle={() => setAiOpen(!aiOpen)}
        />
        <main
          id="main-content"
          className="app-layout__content"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
      <AiAssistant
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
      />
    </div>
  );
}


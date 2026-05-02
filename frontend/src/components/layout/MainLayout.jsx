/**
 * Main Layout — Sidebar + TopBar + Content Area
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
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-layout__main">
        <TopBar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onAiToggle={() => setAiOpen(!aiOpen)}
        />
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
      <AiAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

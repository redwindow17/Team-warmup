/**
 * Dashboard Page — Stats, Charts, Activity Feed, AI Suggestions
 */

import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, AlertTriangle, TrendingUp, Sparkles, Activity } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend } from 'chart.js';
import { taskApi, aiApi } from '../services/taskApi';
import { LoadingSpinner } from '../components/common/CommonComponents';
import { formatRelative } from '../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => {
    if (teamId) loadStats();
    else setLoading(false);
  }, [teamId]);

  const loadStats = async () => {
    try {
      const res = await taskApi.getStats(teamId);
      setStats(res.data);
    } catch (err) {
      console.error('Stats load error:', err);
    }
    setLoading(false);
  };

  const loadAiSuggestions = async () => {
    if (!teamId) return;
    setAiLoading(true);
    try {
      const res = await aiApi.suggest(teamId);
      setAiSuggestion(res.data);
    } catch (err) {
      console.error('AI suggestion error:', err);
    }
    setAiLoading(false);
  };

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Tasks Completed',
      data: [3, 5, 4, 7, 6, 2, 4],
      fill: true,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointBorderWidth: 0,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a2e', borderColor: '#6366f1', borderWidth: 1 } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b' }, beginAtZero: true }
    }
  };

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  const statCards = [
    { icon: CheckSquare, label: 'Total Tasks', value: stats?.total || 0, color: '#6366f1' },
    { icon: TrendingUp, label: 'Completed', value: stats?.done_count || 0, color: '#10b981' },
    { icon: Clock, label: 'In Progress', value: stats?.in_progress_count || 0, color: '#3b82f6' },
    { icon: AlertTriangle, label: 'Overdue', value: stats?.overdue_count || 0, color: '#ef4444' },
  ];

  return (
    <div className="dashboard animate-fade-in">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back! Here's your team overview.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={loadAiSuggestions} disabled={aiLoading}>
          <Sparkles size={18} />
          {aiLoading ? 'Analyzing...' : 'AI Insights'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4 stagger-children">
        {statCards.map((card, i) => (
          <div key={i} className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="d-flex align-items-center gap-2 mb-2">
                <card.icon size={20} style={{ color: card.color }} />
                <span className="stat-label">{card.label}</span>
              </div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Productivity Chart */}
        <div className="col-lg-8">
          <div className="glass-card p-4" style={{ height: 350 }}>
            <h6 className="fw-bold mb-3">
              <TrendingUp size={18} className="me-2" style={{ color: 'var(--primary)' }} />
              Weekly Productivity
            </h6>
            <div style={{ height: 270 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="col-lg-4">
          <div className="glass-card p-4" style={{ height: 350, overflowY: 'auto' }}>
            <h6 className="fw-bold mb-3">
              <Sparkles size={18} className="me-2" style={{ color: 'var(--accent)' }} />
              AI Recommendations
            </h6>
            {aiSuggestion ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {aiSuggestion.suggestions}
              </div>
            ) : (
              <div className="text-center py-4">
                <Sparkles size={32} style={{ color: 'var(--text-muted)' }} />
                <p className="mt-2 small" style={{ color: 'var(--text-muted)' }}>
                  Click "AI Insights" to get smart recommendations powered by Vertex AI Gemini Pro
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass-card p-4 mt-3">
        <h6 className="fw-bold mb-3">
          <Activity size={18} className="me-2" style={{ color: 'var(--info)' }} />
          Recent Activity
        </h6>
        <div className="d-flex flex-column gap-2">
          {['Task "Design UI" completed', 'New task "API Integration" created', 'Team standup summary generated by AI'].map((item, i) => (
            <div key={i} className="d-flex align-items-center gap-3 p-2 rounded" style={{ background: 'var(--bg-hover)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
              <span className="small">{item}</span>
              <span className="ms-auto small" style={{ color: 'var(--text-muted)' }}>{formatRelative(new Date(Date.now() - i * 3600000))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

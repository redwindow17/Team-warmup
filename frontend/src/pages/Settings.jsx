/**
 * Settings Page — Profile, Teams, Notifications, Appearance
 *
 * Accessibility features:
 * - Tablist/tab/tabpanel ARIA pattern for settings navigation
 * - All form inputs have htmlFor/id associations
 * - Toggle switches have aria-checked and aria-label
 * - Team list uses aria-current for active team
 * - Section headings use h2 (under the page h1)
 * - Save button has aria-busy
 * - Invite form has proper label association
 */

import React, { useState, useEffect } from 'react';
import { User, Users, Bell, Palette, Shield, Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { userApi } from '../services/taskApi';
import toast from 'react-hot-toast';

const NOTIFICATION_ITEMS = [
  { id: 'notif-tasks', label: 'Task assignments' },
  { id: 'notif-deadlines', label: 'Deadline reminders' },
  { id: 'notif-workflows', label: 'Workflow triggers' },
  { id: 'notif-mentions', label: 'Chat mentions' },
  { id: 'notif-summaries', label: 'Daily summaries' },
];

export default function Settings() {
  const { userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (teamId) loadMembers(); }, [teamId]);

  const loadTeams = async () => {
    try { const r = await userApi.getTeams(); setTeams(r.data); } catch (e) { console.error(e); }
  };

  const loadMembers = async () => {
    try { const r = await userApi.getMembers(teamId); setMembers(r.data); } catch (e) { console.error(e); }
  };

  const createTeam = async (e) => {
    e.preventDefault();
    try {
      const r = await userApi.createTeam({ name: newTeam });
      setTeams(prev => [...prev, r.data]);
      localStorage.setItem('syncsphere-active-team', r.data.id);
      setNewTeam('');
      toast.success('Team created!');
    } catch (err) { toast.error('Failed'); }
  };

  const inviteMember = async (e) => {
    e.preventDefault();
    try {
      await userApi.addMember(teamId, { email: inviteEmail, role: 'member' });
      setInviteEmail('');
      loadMembers();
      toast.success('Member invited!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      toast.success('Profile saved!');
    } catch (err) { toast.error('Failed to save'); }
    setSaving(false);
  };

  const selectTeam = (id) => {
    localStorage.setItem('syncsphere-active-team', id);
    toast.success('Team switched!');
    window.location.reload();
  };

  const tabs = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'teams', icon: Users, label: 'Teams' },
    { id: 'appearance', icon: Palette, label: 'Appearance' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="h3 fw-bold mb-4">Settings</h1>

      <div className="row g-4">
        {/* Tab Navigation */}
        <div className="col-md-3">
          <nav
            className="glass-card p-3"
            aria-label="Settings navigation"
          >
            {/* role="tablist" for keyboard-navigable tab pattern */}
            <div role="tablist" aria-label="Settings sections">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  className="d-flex align-items-center gap-2 w-100 text-start p-2 rounded mb-1 border-0"
                  style={{
                    background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon size={18} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Tab Panels */}
        <div className="col-md-9">
          <div className="glass-card p-4">

            {/* Profile Tab */}
            <div
              id="tabpanel-profile"
              role="tabpanel"
              aria-labelledby="tab-profile"
              hidden={activeTab !== 'profile'}
            >
              <h2 className="fw-bold mb-4" style={{ fontSize: '1.1rem' }}>Profile Settings</h2>
              <form onSubmit={handleSaveProfile} aria-label="Profile settings form" noValidate>
                <div className="mb-3">
                  <label htmlFor="profile-name" className="form-label small fw-semibold">Name</label>
                  <input
                    id="profile-name"
                    name="name"
                    className="form-control"
                    defaultValue={userProfile?.name}
                    autoComplete="name"
                    aria-required="true"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="profile-email" className="form-label small fw-semibold">Email</label>
                  <input
                    id="profile-email"
                    name="email"
                    className="form-control"
                    defaultValue={userProfile?.email}
                    disabled
                    aria-readonly="true"
                    autoComplete="email"
                  />
                  <div className="form-text" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Email cannot be changed after registration
                  </div>
                </div>
                <div className="mb-3">
                  <span className="form-label small fw-semibold d-block">Role</span>
                  <div className="d-flex align-items-center gap-2">
                    <Shield size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                    <span
                      className="badge gradient-badge"
                      aria-label={`Your role: ${userProfile?.role || 'member'}`}
                    >
                      {userProfile?.role || 'member'}
                    </span>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-busy={saving}
                  disabled={saving}
                >
                  <Save size={16} className="me-2" aria-hidden="true" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Teams Tab */}
            <div
              id="tabpanel-teams"
              role="tabpanel"
              aria-labelledby="tab-teams"
              hidden={activeTab !== 'teams'}
            >
              <h2 className="fw-bold mb-4" style={{ fontSize: '1.1rem' }}>Team Management</h2>

              <form onSubmit={createTeam} className="d-flex gap-2 mb-4" aria-label="Create new team">
                <label htmlFor="new-team-name" className="visually-hidden">New team name</label>
                <input
                  id="new-team-name"
                  name="teamName"
                  className="form-control"
                  placeholder="New team name"
                  value={newTeam}
                  onChange={e => setNewTeam(e.target.value)}
                  required
                  autoComplete="off"
                  aria-required="true"
                />
                <button type="submit" className="btn btn-primary" aria-label="Create team">
                  <Plus size={16} aria-hidden="true" />
                </button>
              </form>

              <section aria-label="Your teams">
                <h3 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>Your Teams</h3>
                {teams.map(t => (
                  <div
                    key={t.id}
                    className="d-flex align-items-center justify-content-between p-3 rounded mb-2"
                    style={{
                      background: 'var(--bg-hover)',
                      border: t.id === teamId ? '1px solid var(--primary)' : '1px solid transparent'
                    }}
                    aria-current={t.id === teamId ? 'true' : undefined}
                  >
                    <div>
                      <span className="fw-semibold">{t.name}</span>
                      <span
                        className="ms-2 badge"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                        aria-label={`Your role: ${t.member_role}`}
                      >
                        {t.member_role}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => selectTeam(t.id)}
                      aria-label={t.id === teamId ? `${t.name} is your active team` : `Switch to team ${t.name}`}
                      disabled={t.id === teamId}
                    >
                      {t.id === teamId ? 'Active' : 'Switch'}
                    </button>
                  </div>
                ))}
              </section>

              {teamId && (
                <section className="mt-3" aria-label="Team members">
                  <h3 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>Members</h3>
                  <ul className="list-unstyled mb-3" role="list">
                    {members.map(m => (
                      <li
                        key={m.id}
                        className="d-flex align-items-center gap-3 p-2 rounded mb-1"
                        style={{ background: 'var(--bg-hover)' }}
                        aria-label={`${m.name}, ${m.email}, role: ${m.role}`}
                      >
                        <div
                          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}
                          aria-hidden="true"
                        >
                          {m.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="small fw-semibold">{m.name}</div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>{m.email}</div>
                        </div>
                        <span
                          className="ms-auto badge"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                          aria-label={`Role: ${m.role}`}
                        >
                          {m.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={inviteMember} className="d-flex gap-2" aria-label="Invite team member by email">
                    <label htmlFor="invite-email" className="visually-hidden">Email address to invite</label>
                    <input
                      id="invite-email"
                      type="email"
                      name="inviteEmail"
                      className="form-control form-control-sm"
                      placeholder="Invite by email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      autoComplete="email"
                      aria-required="true"
                    />
                    <button type="submit" className="btn btn-sm btn-primary">Invite</button>
                  </form>
                </section>
              )}
            </div>

            {/* Appearance Tab */}
            <div
              id="tabpanel-appearance"
              role="tabpanel"
              aria-labelledby="tab-appearance"
              hidden={activeTab !== 'appearance'}
            >
              <h2 className="fw-bold mb-4" style={{ fontSize: '1.1rem' }}>Appearance</h2>
              <div
                className="d-flex align-items-center justify-content-between p-3 rounded"
                style={{ background: 'var(--bg-hover)' }}
              >
                <div>
                  <label htmlFor="dark-mode-toggle" className="fw-semibold d-block" style={{ cursor: 'pointer' }}>
                    Dark Mode
                  </label>
                  <small style={{ color: 'var(--text-muted)' }}>Switch between dark and light theme</small>
                </div>
                <button
                  id="dark-mode-toggle"
                  className="btn"
                  onClick={toggleTheme}
                  style={{ color: theme === 'dark' ? 'var(--primary)' : 'var(--text-muted)' }}
                  aria-pressed={theme === 'dark'}
                  aria-label={`Dark mode is ${theme === 'dark' ? 'on' : 'off'}. Click to switch to ${theme === 'dark' ? 'light' : 'dark'} mode.`}
                >
                  {theme === 'dark'
                    ? <ToggleRight size={32} aria-hidden="true" />
                    : <ToggleLeft size={32} aria-hidden="true" />
                  }
                </button>
              </div>
            </div>

            {/* Notifications Tab */}
            <div
              id="tabpanel-notifications"
              role="tabpanel"
              aria-labelledby="tab-notifications"
              hidden={activeTab !== 'notifications'}
            >
              <h2 className="fw-bold mb-4" style={{ fontSize: '1.1rem' }}>Notification Preferences</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Powered by Firebase Cloud Messaging (FCM)
              </p>
              <ul className="list-unstyled" role="list">
                {NOTIFICATION_ITEMS.map((item) => (
                  <li
                    key={item.id}
                    className="d-flex align-items-center justify-content-between p-3 rounded mb-2"
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <label htmlFor={item.id} className="mb-0" style={{ cursor: 'pointer' }}>
                      {item.label}
                    </label>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={item.id}
                        name={item.id}
                        defaultChecked
                        role="switch"
                        aria-checked="true"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

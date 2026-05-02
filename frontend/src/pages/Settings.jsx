/**
 * Settings Page — Profile, Team, Notifications, Theme
 */
import React, { useState, useEffect } from 'react';
import { User, Users, Bell, Palette, Shield, Plus, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { userApi } from '../services/taskApi';
import toast from 'react-hot-toast';

export default function Settings() {
  const { userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');

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
        <div className="col-md-3">
          <div className="glass-card p-3">
            {tabs.map(tab => (
              <button key={tab.id}
                className={`d-flex align-items-center gap-2 w-100 text-start p-2 rounded mb-1 border-0`}
                style={{
                  background: activeTab === tab.id ? 'var(--bg-active)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer'
                }}
                onClick={() => setActiveTab(tab.id)}>
                <tab.icon size={18} /><span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-md-9">
          <div className="glass-card p-4">
            {activeTab === 'profile' && (
              <div>
                <h5 className="fw-bold mb-4">Profile Settings</h5>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Name</label>
                  <input className="form-control" defaultValue={userProfile?.name} />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Email</label>
                  <input className="form-control" defaultValue={userProfile?.email} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Role</label>
                  <div className="d-flex align-items-center gap-2">
                    <Shield size={16} style={{ color: 'var(--primary)' }} />
                    <span className="badge gradient-badge">{userProfile?.role || 'member'}</span>
                  </div>
                </div>
                <button className="btn btn-primary"><Save size={16} className="me-2" />Save Changes</button>
              </div>
            )}

            {activeTab === 'teams' && (
              <div>
                <h5 className="fw-bold mb-4">Team Management</h5>
                <form onSubmit={createTeam} className="d-flex gap-2 mb-4">
                  <input className="form-control" placeholder="New team name" value={newTeam} onChange={e => setNewTeam(e.target.value)} required />
                  <button className="btn btn-primary"><Plus size={16} /></button>
                </form>

                <div className="mb-4">
                  <h6 className="fw-semibold mb-2">Your Teams</h6>
                  {teams.map(t => (
                    <div key={t.id} className="d-flex align-items-center justify-content-between p-3 rounded mb-2" style={{ background: 'var(--bg-hover)', border: t.id === teamId ? '1px solid var(--primary)' : '1px solid transparent' }}>
                      <div>
                        <span className="fw-semibold">{t.name}</span>
                        <span className="ms-2 badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{t.member_role}</span>
                      </div>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => selectTeam(t.id)}>
                        {t.id === teamId ? 'Active' : 'Switch'}
                      </button>
                    </div>
                  ))}
                </div>

                {teamId && (
                  <>
                    <h6 className="fw-semibold mb-2">Members</h6>
                    {members.map(m => (
                      <div key={m.id} className="d-flex align-items-center gap-3 p-2 rounded mb-1" style={{ background: 'var(--bg-hover)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>
                          {m.name?.charAt(0)}
                        </div>
                        <div><div className="small fw-semibold">{m.name}</div><div className="small" style={{ color: 'var(--text-muted)' }}>{m.email}</div></div>
                        <span className="ms-auto badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{m.role}</span>
                      </div>
                    ))}
                    <form onSubmit={inviteMember} className="d-flex gap-2 mt-3">
                      <input className="form-control form-control-sm" placeholder="Invite by email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required type="email" />
                      <button className="btn btn-sm btn-primary">Invite</button>
                    </form>
                  </>
                )}
              </div>
            )}

            {activeTab === 'appearance' && (
              <div>
                <h5 className="fw-bold mb-4">Appearance</h5>
                <div className="d-flex align-items-center justify-content-between p-3 rounded" style={{ background: 'var(--bg-hover)' }}>
                  <div>
                    <div className="fw-semibold">Dark Mode</div>
                    <small style={{ color: 'var(--text-muted)' }}>Switch between dark and light theme</small>
                  </div>
                  <button className="btn" onClick={toggleTheme} style={{ color: theme === 'dark' ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {theme === 'dark' ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h5 className="fw-bold mb-4">Notification Preferences</h5>
                <p style={{ color: 'var(--text-secondary)' }}>Powered by Firebase Cloud Messaging (FCM)</p>
                {['Task assignments', 'Deadline reminders', 'Workflow triggers', 'Chat mentions', 'Daily summaries'].map((item, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between p-3 rounded mb-2" style={{ background: 'var(--bg-hover)' }}>
                    <span>{item}</span>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" defaultChecked />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

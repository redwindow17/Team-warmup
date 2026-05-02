/**
 * Tasks Page — Kanban Board
 */

import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, Clock, User, Tag, Loader } from 'lucide-react';
import { taskApi } from '../services/taskApi';
import { LoadingSpinner, Avatar } from '../components/common/CommonComponents';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium', deadline: '', status: 'todo' });
  const [saving, setSaving] = useState(false);

  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => { if (teamId) loadTasks(); else setLoading(false); }, [teamId]);

  const loadTasks = async () => {
    try {
      const res = await taskApi.getTasks(teamId, { limit: 100 });
      setTasks(res.data.tasks || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await taskApi.createTask({ ...formData, teamId });
      setTasks(prev => [...prev, res.data]);
      setShowForm(false);
      setFormData({ title: '', description: '', priority: 'medium', deadline: '', status: 'todo' });
      toast.success('Task created!');
    } catch (err) { toast.error('Failed to create task'); }
    setSaving(false);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success(`Moved to ${STATUS_CONFIG[newStatus].label}`);
    } catch (err) { toast.error('Failed to update'); }
  };

  if (loading) return <LoadingSpinner text="Loading tasks..." />;

  return (
    <div className="tasks-page animate-fade-in">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Tasks</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your team's work</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={18} /> New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const statusConf = STATUS_CONFIG[col.id];
          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column__header">
                <span className="badge" style={{ background: statusConf.bg, color: statusConf.color }}>
                  {col.label}
                </span>
                <span className="small fw-semibold" style={{ color: 'var(--text-muted)' }}>{colTasks.length}</span>
              </div>
              <div className="kanban-column__cards">
                {colTasks.map(task => {
                  const prioConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                  return (
                    <div key={task.id} className="kanban-card glass-card p-3 mb-2">
                      <div className="d-flex align-items-start justify-content-between mb-2">
                        <h6 className="mb-0 fw-semibold small">{task.title}</h6>
                        <span className="badge ms-2" style={{ background: prioConf.bg, color: prioConf.color, fontSize: '0.65rem' }}>
                          {prioConf.label}
                        </span>
                      </div>
                      {task.description && (
                        <p className="mb-2 small" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {task.description.substring(0, 80)}{task.description.length > 80 ? '...' : ''}
                        </p>
                      )}
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          {task.assignee_name && <Avatar name={task.assignee_name} url={task.assignee_avatar} size={24} />}
                          {task.deadline && (
                            <span className="small d-flex align-items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Clock size={12} /> {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>
                        <select className="form-select form-select-sm" value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          style={{ width: 'auto', fontSize: '0.7rem', padding: '2px 8px' }}>
                          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="text-center py-4 small" style={{ color: 'var(--text-muted)' }}>No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Create Task</h5>
                <button className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Title *</label>
                    <input type="text" className="form-control" value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <textarea className="form-control" rows={3} value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select className="form-select" value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Deadline</label>
                      <input type="date" className="form-control" value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-primary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

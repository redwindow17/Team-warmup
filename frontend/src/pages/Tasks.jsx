/**
 * Tasks Page — Kanban Board with Accessible Task Management
 *
 * Accessibility features:
 * - Kanban columns have ARIA region labels
 * - Task cards have descriptive aria-labels
 * - Status selects have aria-label for screen readers
 * - Create Task modal uses role="dialog" + aria-modal + aria-labelledby
 * - Form inputs have proper htmlFor/id associations
 * - ARIA live region announces task creation status
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Clock, Loader } from 'lucide-react';
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
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const modalTitleRef = useRef(null);

  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => { if (teamId) loadTasks(); else setLoading(false); }, [teamId]);

  // Focus modal title when modal opens for screen readers
  useEffect(() => {
    if (showForm && modalTitleRef.current) {
      modalTitleRef.current.focus();
    }
  }, [showForm]);

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
      setStatusAnnouncement(`Task "${res.data.title}" created successfully.`);
      toast.success('Task created!');
    } catch (err) { toast.error('Failed to create task'); }
    setSaving(false);
  };

  const handleStatusChange = async (taskId, taskTitle, newStatus) => {
    try {
      await taskApi.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setStatusAnnouncement(`Task "${taskTitle}" moved to ${STATUS_CONFIG[newStatus].label}.`);
      toast.success(`Moved to ${STATUS_CONFIG[newStatus].label}`);
    } catch (err) { toast.error('Failed to update'); }
  };

  // Close modal on Escape key
  const handleModalKeyDown = (e) => {
    if (e.key === 'Escape') setShowForm(false);
  };

  if (loading) return <LoadingSpinner text="Loading tasks..." />;

  return (
    <div className="tasks-page animate-fade-in">
      {/* ARIA live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">
        {statusAnnouncement}
      </div>

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Tasks</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your team&apos;s work</p>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => setShowForm(true)}
          aria-haspopup="dialog"
          aria-expanded={showForm}
        >
          <Plus size={18} aria-hidden="true" /> New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board" role="region" aria-label="Kanban task board">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const statusConf = STATUS_CONFIG[col.id];
          return (
            <div
              key={col.id}
              className="kanban-column"
              role="region"
              aria-label={`${col.label} column, ${colTasks.length} task${colTasks.length !== 1 ? 's' : ''}`}
            >
              <div className="kanban-column__header">
                <span className="badge" style={{ background: statusConf.bg, color: statusConf.color }}>
                  {col.label}
                </span>
                <span
                  className="small fw-semibold"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={`${colTasks.length} tasks`}
                >
                  {colTasks.length}
                </span>
              </div>
              <div className="kanban-column__cards">
                {colTasks.map(task => {
                  const prioConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                  return (
                    <article
                      key={task.id}
                      className="kanban-card glass-card p-3 mb-2"
                      aria-label={`Task: ${task.title}, priority ${prioConf.label}, status ${STATUS_CONFIG[task.status]?.label || task.status}`}
                    >
                      <div className="d-flex align-items-start justify-content-between mb-2">
                        <h2 className="mb-0 fw-semibold small" style={{ fontSize: '0.875rem' }}>{task.title}</h2>
                        <span
                          className="badge ms-2"
                          style={{ background: prioConf.bg, color: prioConf.color, fontSize: '0.65rem' }}
                          aria-label={`Priority: ${prioConf.label}`}
                        >
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
                          {task.assignee_name && (
                            <Avatar name={task.assignee_name} url={task.assignee_avatar} size={24} />
                          )}
                          {task.deadline && (
                            <span className="small d-flex align-items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Clock size={12} aria-hidden="true" />
                              <span>
                                <span className="visually-hidden">Deadline: </span>
                                {formatDate(task.deadline)}
                              </span>
                            </span>
                          )}
                        </div>
                        <label htmlFor={`status-${task.id}`} className="visually-hidden">
                          Change status for {task.title}
                        </label>
                        <select
                          id={`status-${task.id}`}
                          className="form-select form-select-sm"
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, task.title, e.target.value)}
                          style={{ width: 'auto', fontSize: '0.7rem', padding: '2px 8px' }}
                        >
                          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                    </article>
                  );
                })}
                {colTasks.length === 0 && (
                  <div
                    className="text-center py-4 small"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={`No tasks in ${col.label}`}
                  >
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal — role=dialog for screen readers */}
      {showForm && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          role="presentation"
          onClick={() => setShowForm(false)}
          onKeyDown={handleModalKeyDown}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h2
                  id="create-task-modal-title"
                  className="modal-title fw-bold"
                  ref={modalTitleRef}
                  tabIndex={-1}
                  style={{ fontSize: '1.1rem' }}
                >
                  Create Task
                </h2>
                <button
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                  aria-label="Close create task dialog"
                />
              </div>
              <form onSubmit={handleCreate} aria-label="Create task form" noValidate>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="task-title" className="form-label small fw-semibold">
                      Title <span aria-hidden="true">*</span>
                      <span className="visually-hidden">(required)</span>
                    </label>
                    <input
                      type="text"
                      id="task-title"
                      name="title"
                      className="form-control"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                      aria-required="true"
                      autoComplete="off"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="task-description" className="form-label small fw-semibold">
                      Description
                    </label>
                    <textarea
                      id="task-description"
                      name="description"
                      className="form-control"
                      rows={3}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-6">
                      <label htmlFor="task-priority" className="form-label small fw-semibold">
                        Priority
                      </label>
                      <select
                        id="task-priority"
                        name="priority"
                        className="form-select"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label htmlFor="task-deadline" className="form-label small fw-semibold">
                        Deadline
                      </label>
                      <input
                        type="date"
                        id="task-deadline"
                        name="deadline"
                        className="form-control"
                        value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    aria-busy={saving}
                  >
                    {saving ? (
                      <>
                        <Loader size={16} className="me-2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                        Creating...
                      </>
                    ) : 'Create Task'}
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

/**
 * Workflows Page — Rule-Based Automation
 *
 * Accessibility features:
 * - Workflow cards use article semantics with aria-label
 * - Toggle buttons use aria-pressed + aria-label
 * - Delete buttons have descriptive aria-label
 * - Create modal uses role=dialog + aria-modal + aria-labelledby
 * - Form inputs have proper htmlFor/id associations
 */
import React, { useState, useEffect } from 'react';
import { Workflow, Plus, Zap, Bell, ArrowRight, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { workflowApi } from '../services/taskApi';
import { EmptyState } from '../components/common/CommonComponents';
import toast from 'react-hot-toast';

const TRIGGERS = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_delayed', label: 'Task Delayed' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'deadline_approaching', label: 'Deadline Approaching' },
  { value: 'task_completed', label: 'Task Completed' },
];

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', triggerType: 'task_delayed', description: '' });
  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => { if (teamId) loadWorkflows(); }, [teamId]);

  const loadWorkflows = async () => {
    try {
      const res = await workflowApi.getWorkflows(teamId);
      setWorkflows(res.data);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await workflowApi.createWorkflow({
        ...form, teamId,
        conditions: [{ field: 'priority', operator: 'equals', value: 'high' }],
        actions: [{ type: 'send_notification', title: 'Alert', message: form.name }]
      });
      setWorkflows(prev => [res.data, ...prev]);
      setShowForm(false);
      toast.success('Workflow created!');
    } catch (err) { toast.error('Failed to create workflow'); }
  };

  const toggleWf = async (id, enabled) => {
    try {
      await workflowApi.updateWorkflow(id, { enabled: !enabled });
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, enabled: !enabled } : w));
    } catch (err) { toast.error('Toggle failed'); }
  };

  const deleteWf = async (id) => {
    try {
      await workflowApi.deleteWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      toast.success('Deleted');
    } catch (err) { toast.error('Delete failed'); }
  };

  return (
    <div className="animate-fade-in">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Workflows</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Automate your team processes</p>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => setShowForm(true)}
          aria-haspopup="dialog"
          aria-expanded={showForm}
        >
          <Plus size={18} aria-hidden="true" /> New Workflow
        </button>
      </div>

      {workflows.length === 0 && !showForm ? (
        <EmptyState icon={Workflow} title="No workflows yet" description="Create rules to automate tasks"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Create First</button>} />
      ) : (
        <div className="row g-3 stagger-children">
          {workflows.map(wf => (
            <div key={wf.id} className="col-md-6 col-lg-4">
              <article
                className="glass-card p-4"
                aria-label={`Workflow: ${wf.name}, ${wf.enabled ? 'enabled' : 'disabled'}`}
              >
                <div className="d-flex justify-content-between mb-3">
                  <h2 className="fw-bold mb-0" style={{ fontSize: '0.9rem' }}>{wf.name}</h2>
                  <button
                    onClick={() => toggleWf(wf.id, wf.enabled)}
                    className="btn btn-sm p-0"
                    style={{ color: wf.enabled ? 'var(--success)' : 'var(--text-muted)' }}
                    aria-pressed={wf.enabled}
                    aria-label={`${wf.enabled ? 'Disable' : 'Enable'} workflow: ${wf.name}`}
                  >
                    {wf.enabled ? <ToggleRight size={28} aria-hidden="true" /> : <ToggleLeft size={28} aria-hidden="true" />}
                  </button>
                </div>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                    <Zap size={12} className="me-1" aria-hidden="true" />
                    {TRIGGERS.find(t => t.value === wf.trigger_type)?.label}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Bell size={12} className="me-1" aria-hidden="true" />Notify
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <small style={{ color: 'var(--text-muted)' }} aria-label={`Runs: ${wf.run_count || 0}`}>
                    Runs: {wf.run_count || 0}
                  </small>
                  <button
                    onClick={() => deleteWf(wf.id)}
                    className="btn btn-sm"
                    style={{ color: 'var(--danger)' }}
                    aria-label={`Delete workflow: ${wf.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          role="presentation"
          onClick={() => setShowForm(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h2 id="workflow-modal-title" className="modal-title fw-bold" style={{ fontSize: '1.1rem' }}>New Workflow</h2>
                <button className="btn-close" onClick={() => setShowForm(false)} aria-label="Close new workflow dialog" />
              </div>
              <form onSubmit={handleCreate} aria-label="Create workflow form" noValidate>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="wf-name" className="form-label small fw-semibold">Name</label>
                    <input
                      id="wf-name"
                      name="name"
                      className="form-control"
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      required
                      aria-required="true"
                      autoComplete="off"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="wf-trigger" className="form-label small fw-semibold">Trigger</label>
                    <select
                      id="wf-trigger"
                      name="triggerType"
                      className="form-select"
                      value={form.triggerType}
                      onChange={e => setForm({...form, triggerType: e.target.value})}
                    >
                      {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-primary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Workflow</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

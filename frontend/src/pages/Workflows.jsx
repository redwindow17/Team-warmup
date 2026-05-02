/**
 * Workflows Page — Rule-Based Automation
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
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={18} /> New Workflow
        </button>
      </div>

      {workflows.length === 0 && !showForm ? (
        <EmptyState icon={Workflow} title="No workflows yet" description="Create rules to automate tasks"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Create First</button>} />
      ) : (
        <div className="row g-3 stagger-children">
          {workflows.map(wf => (
            <div key={wf.id} className="col-md-6 col-lg-4">
              <div className="glass-card p-4">
                <div className="d-flex justify-content-between mb-3">
                  <h6 className="fw-bold mb-0">{wf.name}</h6>
                  <button onClick={() => toggleWf(wf.id, wf.enabled)} className="btn btn-sm p-0"
                    style={{ color: wf.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                    {wf.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                    <Zap size={12} className="me-1" />{TRIGGERS.find(t => t.value === wf.trigger_type)?.label}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Bell size={12} className="me-1" />Notify
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <small style={{ color: 'var(--text-muted)' }}>Runs: {wf.run_count || 0}</small>
                  <button onClick={() => deleteWf(wf.id)} className="btn btn-sm" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title fw-bold">New Workflow</h5></div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Name</label>
                    <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Trigger</label>
                    <select className="form-select" value={form.triggerType} onChange={e => setForm({...form, triggerType: e.target.value})}>
                      {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-primary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

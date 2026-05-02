/**
 * AI Assistant Panel — Vertex AI Gemini Pro
 * Floating slide-out drawer with chat interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Lightbulb, Clock, ListTodo, Loader } from 'lucide-react';
import { aiApi } from '../../services/taskApi';

export default function AiAssistant({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm SyncSphere AI, powered by **Google Vertex AI Gemini Pro**. I can help you manage tasks, detect delays, summarize work, and more. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const teamId = localStorage.getItem('syncsphere-active-team');
      const res = await aiApi.chat(userMsg, teamId);
      setMessages(prev => [...prev, { role: 'ai', text: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { icon: Lightbulb, label: 'Suggest Next Actions', action: 'What should I work on next?' },
    { icon: Clock, label: 'Detect Delays', action: 'Are there any delayed tasks?' },
    { icon: ListTodo, label: 'Daily Summary', action: 'Summarize today\'s work' },
  ];

  return (
    <div className={`ai-panel ${isOpen ? 'ai-panel--open' : ''}`}>
      {/* Header */}
      <div className="ai-panel__header">
        <div className="d-flex align-items-center gap-2">
          <div className="ai-panel__icon animate-float">
            <Sparkles size={20} />
          </div>
          <div>
            <h6 className="mb-0 fw-bold">SyncSphere AI</h6>
            <small style={{ color: 'var(--text-muted)' }}>Powered by Vertex AI Gemini</small>
          </div>
        </div>
        <button className="btn btn-sm" onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="ai-panel__quick-actions">
        {quickActions.map((qa, i) => (
          <button key={i} className="ai-panel__quick-btn"
            onClick={() => { setInput(qa.action); }}>
            <qa.icon size={14} />
            <span>{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="ai-panel__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-panel__msg ai-panel__msg--${msg.role}`}>
            {msg.role === 'ai' && (
              <div className="ai-panel__msg-avatar">
                <Sparkles size={14} />
              </div>
            )}
            <div className="ai-panel__msg-text">
              {msg.text.split('\n').map((line, j) => (
                <React.Fragment key={j}>{line}<br /></React.Fragment>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-panel__msg ai-panel__msg--ai">
            <div className="ai-panel__msg-avatar"><Sparkles size={14} /></div>
            <div className="ai-panel__msg-text animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-panel__input">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask SyncSphere AI..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="ai-panel__send-btn">
          {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

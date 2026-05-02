/**
 * AI Assistant Panel — Vertex AI Gemini Pro
 *
 * Accessible floating slide-out drawer with:
 * - role="complementary" + aria-label for the panel landmark
 * - aria-live="polite" on messages for screen reader announcements
 * - aria-busy on the send button during AI generation
 * - Proper aria-label on all icon-only buttons
 * - Focus trap: input auto-focuses when panel opens
 * - Keyboard: Enter submits; Escape closes panel
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Lightbulb, Clock, ListTodo, Loader } from 'lucide-react';
import { aiApi } from '../../services/taskApi';

export default function AiAssistant({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "Hi! I'm SyncSphere AI, powered by **Google Vertex AI Gemini Pro**. I can help you manage tasks, detect delays, summarize work, and more. How can I help?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow CSS transition to complete
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
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
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' }
      ]);
    }
    setLoading(false);
    // Return focus to input after AI responds
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const quickActions = [
    { icon: Lightbulb, label: 'Suggest Next Actions', action: 'What should I work on next?' },
    { icon: Clock, label: 'Detect Delays', action: 'Are there any delayed tasks?' },
    { icon: ListTodo, label: 'Daily Summary', action: "Summarize today's work" },
  ];

  return (
    <aside
      ref={panelRef}
      className={`ai-panel ${isOpen ? 'ai-panel--open' : ''}`}
      role="complementary"
      aria-label="AI Assistant powered by Vertex AI"
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="ai-panel__header">
        <div className="d-flex align-items-center gap-2">
          <div className="ai-panel__icon animate-float" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="mb-0 fw-bold" style={{ fontSize: '1rem' }}>SyncSphere AI</h2>
            <small style={{ color: 'var(--text-muted)' }}>Powered by Vertex AI Gemini</small>
          </div>
        </div>
        <button
          className="btn btn-sm"
          onClick={onClose}
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Close AI Assistant panel"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Quick Actions */}
      <div
        className="ai-panel__quick-actions"
        role="group"
        aria-label="Quick action prompts"
      >
        {quickActions.map((qa, i) => (
          <button
            key={i}
            className="ai-panel__quick-btn"
            onClick={() => {
              setInput(qa.action);
              inputRef.current?.focus();
            }}
            aria-label={`Quick action: ${qa.label}`}
          >
            <qa.icon size={14} aria-hidden="true" />
            <span>{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Messages — aria-live announces new AI responses to screen readers */}
      <div
        className="ai-panel__messages"
        role="log"
        aria-label="Conversation with AI assistant"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-panel__msg ai-panel__msg--${msg.role}`}
            aria-label={`${msg.role === 'ai' ? 'AI assistant' : 'You'}: ${msg.text}`}
          >
            {msg.role === 'ai' && (
              <div className="ai-panel__msg-avatar" aria-hidden="true">
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
          <div
            className="ai-panel__msg ai-panel__msg--ai"
            aria-label="AI assistant is thinking..."
          >
            <div className="ai-panel__msg-avatar" aria-hidden="true">
              <Sparkles size={14} />
            </div>
            <div className="ai-panel__msg-text animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <div className="ai-panel__input" role="group" aria-label="Message input">
        <label htmlFor="ai-message-input" className="visually-hidden">
          Message to AI assistant
        </label>
        <input
          ref={inputRef}
          id="ai-message-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask SyncSphere AI..."
          disabled={loading}
          aria-describedby="ai-input-hint"
          autoComplete="off"
        />
        <span id="ai-input-hint" className="visually-hidden">
          Press Enter to send, Escape to close the panel
        </span>
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="ai-panel__send-btn"
          aria-label={loading ? 'AI is responding, please wait' : 'Send message to AI'}
          aria-busy={loading}
        >
          {loading
            ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
            : <Send size={18} aria-hidden="true" />
          }
        </button>
      </div>
    </aside>
  );
}

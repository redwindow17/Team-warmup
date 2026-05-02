/**
 * Chat Page — Real-Time Messaging via Cloud Firestore
 *
 * Accessibility features:
 * - Channel list uses role="listbox" with aria-selected states
 * - Message area uses role="log" + aria-live for real-time messages
 * - Message input has proper label association and aria-describedby
 * - Send button has descriptive aria-label
 * - Create channel form uses htmlFor/id and aria-label
 * - Messages use time element with dateTime attribute
 */

import React, { useState, useEffect, useRef } from 'react';
import { Hash, Plus, Send, MessageCircle } from 'lucide-react';
import { collection, query as fsQuery, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { chatApi } from '../services/taskApi';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, EmptyState } from '../components/common/CommonComponents';
import { formatTime } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function Chat() {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const { userProfile } = useAuth();
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const teamId = localStorage.getItem('syncsphere-active-team');

  useEffect(() => { if (teamId) loadChannels(); }, [teamId]);

  useEffect(() => {
    if (!activeChannel) return;
    // Real-time listener via Cloud Firestore
    const msgsRef = collection(firestore, 'channels', activeChannel.id, 'messages');
    const q = fsQuery(msgsRef, orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs.reverse());
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return unsub;
  }, [activeChannel]);

  const loadChannels = async () => {
    try {
      const res = await chatApi.getChannels(teamId);
      setChannels(res.data);
      if (res.data.length > 0) setActiveChannel(res.data[0]);
    } catch (err) { console.error(err); }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChannel) return;
    try {
      await chatApi.sendMessage({ text: newMessage, channelId: activeChannel.id });
      setNewMessage('');
    } catch (err) { toast.error('Failed to send message'); }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    try {
      const res = await chatApi.createChannel({ name: channelName, teamId, type: 'channel' });
      setChannels(prev => [res.data, ...prev]);
      setActiveChannel(res.data);
      setShowNewChannel(false);
      setChannelName('');
      toast.success('Channel created!');
    } catch (err) { toast.error('Failed to create channel'); }
  };

  const handleChannelKeyDown = (e, ch) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveChannel(ch);
    }
  };

  return (
    <div className="chat-page animate-fade-in">
      <div className="chat-layout">
        {/* Channel Sidebar */}
        <nav
          className="chat-sidebar"
          aria-label="Chat channels"
        >
          <div className="d-flex align-items-center justify-content-between p-3">
            <h1 className="fw-bold mb-0" style={{ fontSize: '1rem' }}>Channels</h1>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowNewChannel(!showNewChannel)}
              aria-label="Create new channel"
              aria-expanded={showNewChannel}
              aria-controls="new-channel-form"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Channel list — role="listbox" for single-select channel switching */}
          <div
            className="chat-sidebar__channels"
            role="listbox"
            aria-label="Available channels"
            aria-activedescendant={activeChannel ? `channel-${activeChannel.id}` : undefined}
          >
            {channels.map(ch => (
              <button
                key={ch.id}
                id={`channel-${ch.id}`}
                className={`chat-sidebar__channel ${activeChannel?.id === ch.id ? 'chat-sidebar__channel--active' : ''}`}
                onClick={() => setActiveChannel(ch)}
                onKeyDown={(e) => handleChannelKeyDown(e, ch)}
                role="option"
                aria-selected={activeChannel?.id === ch.id}
                aria-label={`Channel: ${ch.name}${activeChannel?.id === ch.id ? ' (active)' : ''}`}
              >
                <Hash size={16} aria-hidden="true" />
                <span>{ch.name}</span>
              </button>
            ))}
          </div>

          {/* Create Channel Form */}
          {showNewChannel && (
            <form
              id="new-channel-form"
              onSubmit={handleCreateChannel}
              className="p-3"
              aria-label="Create new channel form"
            >
              <label htmlFor="new-channel-name" className="visually-hidden">
                Channel name
              </label>
              <input
                type="text"
                id="new-channel-name"
                name="channelName"
                className="form-control form-control-sm mb-2"
                placeholder="Channel name"
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
                required
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-sm w-100">
                Create Channel
              </button>
            </form>
          )}
        </nav>

        {/* Messages Area */}
        <main className="chat-main" aria-label={activeChannel ? `#${activeChannel.name} channel messages` : 'Chat messages'}>
          {activeChannel ? (
            <>
              <div className="chat-main__header" role="heading" aria-level="2">
                <Hash size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span className="fw-bold">{activeChannel.name}</span>
              </div>

              {/* Message log — aria-live for real-time updates */}
              <div
                className="chat-main__messages"
                role="log"
                aria-label={`Messages in #${activeChannel.name}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.map(msg => (
                  <article
                    key={msg.id}
                    className={`chat-msg ${msg.senderId === userProfile?.id ? 'chat-msg--own' : ''}`}
                    aria-label={`${msg.senderName}: ${msg.text}`}
                  >
                    <Avatar name={msg.senderName} url={msg.senderAvatar} size={32} />
                    <div className="chat-msg__content">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="fw-semibold small">{msg.senderName}</span>
                        <time
                          className="small"
                          style={{ color: 'var(--text-muted)' }}
                          dateTime={msg.timestamp?.toDate?.()?.toISOString?.() || ''}
                        >
                          {formatTime(msg.timestamp)}
                        </time>
                      </div>
                      <p className="mb-0">{msg.text}</p>
                    </div>
                  </article>
                ))}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {/* Message Input */}
              <div className="chat-main__input" role="group" aria-label="Send message">
                <label htmlFor="chat-message-input" className="visually-hidden">
                  Message #{activeChannel.name}
                </label>
                <input
                  ref={messageInputRef}
                  id="chat-message-input"
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={`Message #${activeChannel.name}`}
                  aria-describedby="chat-input-hint"
                  autoComplete="off"
                />
                <span id="chat-input-hint" className="visually-hidden">
                  Press Enter to send your message
                </span>
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="chat-main__send-btn"
                  aria-label={`Send message to #${activeChannel.name}`}
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Select a channel"
              description="Choose a channel to start chatting with your team"
            />
          )}
        </main>
      </div>
    </div>
  );
}

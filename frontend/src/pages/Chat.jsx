/**
 * Chat Page — Real-Time Messaging via Firestore
 */

import React, { useState, useEffect, useRef } from 'react';
import { Hash, Plus, Send, Smile, Paperclip, MessageCircle } from 'lucide-react';
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

  return (
    <div className="chat-page animate-fade-in">
      <div className="chat-layout">
        {/* Channel Sidebar */}
        <div className="chat-sidebar">
          <div className="d-flex align-items-center justify-content-between p-3">
            <h6 className="fw-bold mb-0">Channels</h6>
            <button className="btn btn-sm btn-outline-primary" onClick={() => setShowNewChannel(true)}>
              <Plus size={16} />
            </button>
          </div>
          <div className="chat-sidebar__channels">
            {channels.map(ch => (
              <button key={ch.id}
                className={`chat-sidebar__channel ${activeChannel?.id === ch.id ? 'chat-sidebar__channel--active' : ''}`}
                onClick={() => setActiveChannel(ch)}>
                <Hash size={16} />
                <span>{ch.name}</span>
              </button>
            ))}
          </div>

          {showNewChannel && (
            <form onSubmit={handleCreateChannel} className="p-3">
              <input type="text" className="form-control form-control-sm mb-2" placeholder="Channel name"
                value={channelName} onChange={e => setChannelName(e.target.value)} required />
              <button type="submit" className="btn btn-primary btn-sm w-100">Create</button>
            </form>
          )}
        </div>

        {/* Messages Area */}
        <div className="chat-main">
          {activeChannel ? (
            <>
              <div className="chat-main__header">
                <Hash size={20} style={{ color: 'var(--primary)' }} />
                <h6 className="mb-0 fw-bold">{activeChannel.name}</h6>
              </div>

              <div className="chat-main__messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-msg ${msg.senderId === userProfile?.id ? 'chat-msg--own' : ''}`}>
                    <Avatar name={msg.senderName} url={msg.senderAvatar} size={32} />
                    <div className="chat-msg__content">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="fw-semibold small">{msg.senderName}</span>
                        <span className="small" style={{ color: 'var(--text-muted)' }}>{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="mb-0">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-main__input">
                <input type="text" value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={`Message #${activeChannel.name}`} />
                <button onClick={handleSend} disabled={!newMessage.trim()} className="chat-main__send-btn">
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon={MessageCircle} title="Select a channel" description="Choose a channel to start chatting with your team" />
          )}
        </div>
      </div>
    </div>
  );
}

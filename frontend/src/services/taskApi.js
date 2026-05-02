import api from './api';

export const taskApi = {
  getTasks: (teamId, params = {}) => api.get(`/api/tasks/team/${teamId}`, { params }),
  getTask: (id) => api.get(`/api/tasks/${id}`),
  createTask: (data) => api.post('/api/tasks', data),
  updateTask: (id, data) => api.put(`/api/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/api/tasks/${id}`),
  getStats: (teamId) => api.get(`/api/tasks/stats/${teamId}`)
};

export const chatApi = {
  getChannels: (teamId) => api.get(`/api/chat/channels/${teamId}`),
  createChannel: (data) => api.post('/api/chat/channels', data),
  getMessages: (channelId, params) => api.get(`/api/chat/messages/${channelId}`, { params }),
  sendMessage: (data) => api.post('/api/chat/messages', data)
};

export const aiApi = {
  suggest: (teamId) => api.post('/api/ai/suggest', { teamId }),
  detectDelays: (teamId) => api.post('/api/ai/detect-delays', { teamId }),
  summarize: (teamId, date) => api.post('/api/ai/summarize', { teamId, date }),
  chatToTasks: (messages) => api.post('/api/ai/chat-to-tasks', { messages }),
  chat: (message, teamId) => api.post('/api/ai/chat', { message, teamId })
};

export const analyticsApi = {
  productivity: (teamId, days) => api.get(`/api/analytics/productivity/${teamId}`, { params: { days } }),
  completion: (teamId, days) => api.get(`/api/analytics/completion/${teamId}`, { params: { days } }),
  bottlenecks: (teamId) => api.get(`/api/analytics/bottlenecks/${teamId}`)
};

export const userApi = {
  getMe: () => api.get('/api/users/me'),
  updateMe: (data) => api.put('/api/users/me', data),
  getTeams: () => api.get('/api/users/teams'),
  createTeam: (data) => api.post('/api/users/teams', data),
  getMembers: (teamId) => api.get(`/api/users/teams/${teamId}/members`),
  addMember: (teamId, data) => api.post(`/api/users/teams/${teamId}/members`, data)
};

export const fileApi = {
  upload: (formData) => api.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getDownloadUrl: (fileName) => api.get('/api/files/download', { params: { fileName } }),
  getTaskFiles: (teamId, taskId) => api.get(`/api/files/task/${teamId}/${taskId}`)
};

export const workflowApi = {
  getWorkflows: (teamId) => api.get(`/api/workflows/team/${teamId}`),
  createWorkflow: (data) => api.post('/api/workflows', data),
  updateWorkflow: (id, data) => api.put(`/api/workflows/${id}`, data),
  deleteWorkflow: (id) => api.delete(`/api/workflows/${id}`)
};

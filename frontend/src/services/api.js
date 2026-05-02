/**
 * API Service — Axios instance with auth headers
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — could trigger re-auth
      console.warn('Authentication expired');
    }
    return Promise.reject(error);
  }
);

export default api;

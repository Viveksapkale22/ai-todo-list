import store from './store.js';
import { showToast } from '../components/Toast.js';

const API_BASE = '/api';

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    store.set('loading', true);
    const response = await fetch(`${API_BASE}${url}`, config);
    
    if (response.status === 401) {
      // Token expired or invalid, log out the user
      localStorage.removeItem('token');
      store.reset();
      window.location.hash = '#/login';
      showToast('Session expired. Please log in again.', 'error');
      throw new Error('Unauthorized');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error on ${url}:`, error);
    if (error.message !== 'Unauthorized') {
      showToast(error.message || 'Connection failed', 'error');
    }
    throw error;
  } finally {
    store.set('loading', false);
  }
}

export const api = {
  get: (url) => request(url, { method: 'GET' }),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body = {}) => request(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => request(url, { method: 'DELETE' })
};

export default api;

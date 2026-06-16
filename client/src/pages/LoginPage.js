import api from '../utils/api.js';
import store from '../utils/store.js';
import { renderLogo } from '../components/Logo.js';
import { showToast } from '../components/Toast.js';
import { requestNotificationPermission, subscribeToPush } from '../utils/notifications.js';

export default class LoginPage {
  constructor() {
    this.isRegister = false;
  }

  async render() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="login-container">
        <div class="glass-card login-card animate-slide-up">
          <div class="login-logo">
            ${renderLogo()}
          </div>
          
          <h2 class="text-center" id="auth-title">Welcome Back</h2>
          <p class="text-center margin-bottom" id="auth-subtitle" style="font-size: 13px">Log in to manage your daily tasks with AI.</p>
          
          <form id="auth-form" class="animate-fade-in" style="animation-duration: 0.3s">
            <div class="form-group" id="name-group" style="display: none">
              <label for="reg-name">Name</label>
              <input type="text" id="reg-name" class="input-field" placeholder="John Doe">
            </div>

            <div class="form-group">
              <label for="auth-email">Email Address</label>
              <input type="email" id="auth-email" class="input-field" placeholder="you@example.com" required>
            </div>

            <div class="form-group margin-bottom">
              <label for="auth-password">Password</label>
              <input type="password" id="auth-password" class="input-field" placeholder="••••••••" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px" id="auth-submit-btn">
              Log In
            </button>
          </form>

          <div class="login-toggle">
            <span id="auth-toggle-text">Don't have an account?</span>
            <button class="login-toggle-btn" id="auth-toggle-btn">Sign Up</button>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  }

  setupListeners() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const nameGroup = document.getElementById('name-group');
    const submitBtn = document.getElementById('auth-submit-btn');

    toggleBtn.addEventListener('click', () => {
      this.isRegister = !this.isRegister;
      
      if (this.isRegister) {
        title.innerText = 'Create Account';
        subtitle.innerText = 'Start organizing your schedule with TaskAI.';
        nameGroup.style.display = 'flex';
        nameGroup.querySelector('input').setAttribute('required', 'true');
        submitBtn.innerText = 'Sign Up';
        toggleText.innerText = 'Already have an account?';
        toggleBtn.innerText = 'Log In';
      } else {
        title.innerText = 'Welcome Back';
        subtitle.innerText = 'Log in to manage your daily tasks with AI.';
        nameGroup.style.display = 'none';
        nameGroup.querySelector('input').removeAttribute('required');
        submitBtn.innerText = 'Log In';
        toggleText.innerText = "Don't have an account?";
        toggleBtn.innerText = 'Sign Up';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      
      try {
        let response;
        if (this.isRegister) {
          const name = document.getElementById('reg-name').value;
          response = await api.post('/auth/register', { name, email, password });
          showToast('Account created successfully!', 'success');
        } else {
          response = await api.post('/auth/login', { email, password });
          showToast(`Welcome back, ${response.user.name}!`, 'success');
        }

        // Save token to localStorage and write to IndexedDB for SW usage
        localStorage.setItem('token', response.token);
        await this.storeTokenInIndexedDB(response.token);
        
        store.set('user', response.user);
        store.set('settings', response.user.settings);

        // Request notification permission and subscribe to Web Push (non-blocking)
        try {
          const allowed = await requestNotificationPermission();
          if (allowed) {
            await subscribeToPush();
          }
        } catch (pushErr) {
          console.warn('Push registration failed silently:', pushErr);
        }

        // Redirect to task list
        window.location.hash = '#/tasks';
      } catch (err) {
        // Error is already shown as Toast in api.js
        console.error('Authentication form submit error:', err);
      }
    });
  }

  // Store token in IndexedDB so SW background process can fetch it for snooze/complete clicks
  storeTokenInIndexedDB(token) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('aitodo-db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        try {
          const transaction = db.transaction('keyval', 'readwrite');
          const objectStore = transaction.objectStore('keyval');
          const putRequest = objectStore.put(token, 'token');
          
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } catch (e) {
          reject(e);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

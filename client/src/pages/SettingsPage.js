import api from '../utils/api.js';
import store from '../utils/store.js';
import { showToast } from '../components/Toast.js';

export default class SettingsPage {
  constructor() {
    this.unsubscribe = null;
    this.unsubscribeUser = null;
  }

  async render() {
    const container = document.getElementById('view-container');
    const user = store.get('user');
    const settings = store.get('settings');

    container.innerHTML = `
      <div class="settings-page animate-fade-in">
        <h1 class="margin-bottom" style="font-size: 24px">Settings</h1>

        <div class="settings-list">
          
          <!-- User Profile Details Form -->
          <div class="settings-group">
            <div class="settings-group-title">User Profile</div>
            <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px">
              <form id="profile-form" style="display: flex; flex-direction: column; gap: 12px">
                <div class="form-group" style="margin-bottom: 0">
                  <label for="profile-name-input">Display Name</label>
                  <input type="text" id="profile-name-input" class="input-field" value="${user ? this.escapeHTML(user.name) : ''}" required style="padding: 10px 14px; font-size: 13px">
                </div>
                <div class="form-group" style="margin-bottom: 0">
                  <label for="profile-email-input">Email Address</label>
                  <input type="email" id="profile-email-input" class="input-field" value="${user ? this.escapeHTML(user.email) : ''}" required style="padding: 10px 14px; font-size: 13px">
                </div>
                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 13px; margin-top: 6px">
                  Save Profile Info
                </button>
              </form>
            </div>
          </div>

          <!-- OpenRouter API Setup -->
          <div class="settings-group">
            <div class="settings-group-title">AI Engine Settings</div>
            <div class="settings-item" style="flex-direction: column; align-items: flex-start; gap: 12px">
              <div class="settings-item-info">
                <span class="settings-item-title">OpenRouter API Key</span>
                <span class="settings-item-desc">API key to power TaskAI. The key is securely encrypted at rest.</span>
              </div>
              
              <form id="api-key-form" style="width: 100%; display: flex; gap: 8px">
                <input type="password" id="openrouter-api-key-input" class="input-field" placeholder="${user && user.hasApiKey ? '••••••••••••••••••••' : 'Enter OpenRouter API Key'}" style="padding: 10px 14px; font-size: 13px">
                <button type="submit" class="btn btn-primary" style="padding: 0 16px; font-size: 13px">Save</button>
              </form>
            </div>
          </div>

          <!-- Alarms and Alerts Controls -->
          <div class="settings-group">
            <div class="settings-group-title">Alarms & Alerts</div>
            
            <!-- Voice synthesis alarms toggle -->
            <div class="settings-item">
              <div class="settings-item-info" style="max-width: 75%">
                <span class="settings-item-title">Voice Readout Alarms</span>
                <span class="settings-item-desc">Speak task summary out loud when the alarm triggers.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="voice-alarm-toggle" ${settings && settings.voiceAlarm ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <!-- Standard push notifications toggle (LOCKED ALWAYS ON) -->
            <div class="settings-item">
              <div class="settings-item-info" style="max-width: 75%">
                <span class="settings-item-title">Push Notifications</span>
                <span class="settings-item-desc" style="color: var(--accent-cyan)">Always enabled to ensure you never miss scheduled tasks.</span>
              </div>
              <label class="switch">
                <input type="checkbox" checked disabled>
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- About information -->
          <div class="settings-group">
            <div class="settings-group-title">About App</div>
            <div class="settings-item">
              <div class="settings-item-info">
                <span class="settings-item-title">AITodo Smart Assistant</span>
                <span class="settings-item-desc">Futuristic AI Scheduling & Collaboration</span>
              </div>
              <span style="font-size: 12px; font-weight: 700; color: var(--accent-cyan)">v1.0.0</span>
            </div>
          </div>

          <!-- Action operations -->
          <button id="logout-btn" class="btn btn-secondary" style="width: 100%; padding: 14px; border-color: rgba(239, 68, 68, 0.2); color: var(--danger)">
            Log Out
          </button>

        </div>
      </div>
    `;

    this.unsubscribe = store.subscribe('settings', (newSettings) => {
      const toggle = document.getElementById('voice-alarm-toggle');
      if (toggle) toggle.checked = newSettings.voiceAlarm;
    });

    this.unsubscribeUser = store.subscribe('user', (newUser) => {
      if (!newUser) return;
      const nameInput = document.getElementById('profile-name-input');
      const emailInput = document.getElementById('profile-email-input');
      if (nameInput) nameInput.value = newUser.name;
      if (emailInput) emailInput.value = newUser.email;
    });

    this.setupListeners();
  }

  setupListeners() {
    const profileForm = document.getElementById('profile-form');
    const apiKeyForm = document.getElementById('api-key-form');
    const keyInput = document.getElementById('openrouter-api-key-input');
    const voiceToggle = document.getElementById('voice-alarm-toggle');
    const logoutBtn = document.getElementById('logout-btn');

    // Handle profile form saving
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name-input').value.trim();
      const email = document.getElementById('profile-email-input').value.trim();

      try {
        const result = await api.put('/auth/profile', { name, email });
        store.set('user', result.user);
        showToast('Profile updated successfully!', 'success');
      } catch (err) {
        console.error(err);
      }
    });

    // Handle saving API key
    apiKeyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const key = keyInput.value.trim();
      if (!key) {
        showToast('Please enter a valid API key', 'error');
        return;
      }

      try {
        await api.put('/auth/api-key', { apiKey: key });
        keyInput.value = '';
        keyInput.placeholder = '••••••••••••••••••••';
        
        const currentUser = store.get('user');
        store.set('user', { ...currentUser, hasApiKey: true });
        
        showToast('OpenRouter API Key saved successfully!', 'success');
      } catch (err) {
        console.error(err);
      }
    });

    // Handle voice alarm toggle
    voiceToggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      
      try {
        const result = await api.put('/auth/settings', { voiceAlarm: isChecked });
        store.set('settings', result.settings);
        showToast(isChecked ? 'Voice alarms enabled' : 'Voice alarms disabled', 'success');
      } catch (err) {
        e.target.checked = !isChecked;
        console.error(err);
      }
    });

    // Logout operation
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('token');
        this.clearTokenFromIndexedDB();
        store.reset();
        window.location.hash = '#/login';
        showToast('Logged out successfully', 'info');
      }
    });
  }

  clearTokenFromIndexedDB() {
    const request = indexedDB.open('aitodo-db', 1);
    request.onsuccess = (event) => {
      const db = event.target.result;
      try {
        const transaction = db.transaction('keyval', 'readwrite');
        const objectStore = transaction.objectStore('keyval');
        objectStore.delete('token');
      } catch (e) {
        console.error(e);
      }
    };
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.unsubscribeUser) {
      this.unsubscribeUser();
    }
  }
}

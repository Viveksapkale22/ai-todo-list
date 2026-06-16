import api from '../utils/api.js';
import store from '../utils/store.js';
import { showToast } from '../components/Toast.js';

export default class ChatPage {
  constructor() {
    this.unsubscribe = null;
    this.isAiTyping = false;
  }

  async render() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <div class="chat-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M12 2v9M8 5h8"></path>
            </svg>
          </div>
          <div class="chat-title-info">
            <h3 style="font-size: 15px">TaskAI assistant</h3>
            <span class="chat-status" id="ai-status-text">online</span>
          </div>
        </div>

        <!-- Conversation thread -->
        <div class="chat-messages" id="chat-messages-container"></div>

        <!-- Chat input bar -->
        <form class="chat-input-area" id="chat-input-form">
          <input type="text" id="chat-user-input" class="chat-input" placeholder="Type a task, e.g. Buy groceries tomorrow 10am" autocomplete="off" required>
          <button type="submit" class="chat-send-btn" id="chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg); margin-left: -2px; margin-top: -2px">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    `;

    // Subscribe to chat message changes
    this.unsubscribe = store.subscribe('chatMessages', (messages) => {
      this.renderMessages(messages);
    });

    this.renderMessages(store.get('chatMessages'));
    this.setupListeners();
    this.checkUserApiKey();
  }

  // Double check if user has key set. If not, remind them.
  checkUserApiKey() {
    const user = store.get('user');
    if (user && !user.hasApiKey) {
      showToast('OpenRouter API Key not set! Go to Settings to configure your key to use AI chat.', 'error');
    }
  }

  renderMessages(messages) {
    const thread = document.getElementById('chat-messages-container');
    if (!thread) return;

    thread.innerHTML = messages.map(msg => {
      const isUser = msg.role === 'user';
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      
      // Look for JSON block in AI message to render structured preview card
      let textContent = msg.content || '';
      let taskPreviewHtml = '';
      
      if (!isUser && textContent) {
        const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const taskObj = JSON.parse(jsonMatch[1]);
            // Remove the raw JSON block from the text content so it doesn't print raw text
            textContent = textContent.replace(/```json\n[\s\S]*?\n```/, '').trim();
            
            taskPreviewHtml = this.renderTaskPreviewCard(taskObj, msg.id);
          } catch (e) {
            console.error('Failed to parse task JSON from AI reply:', e);
          }
        }
      }

      return `
        <div class="message ${isUser ? 'user' : 'ai'}">
          <div class="message-bubble glass-panel">
            <div>${this.escapeHTML(textContent).replace(/\n/g, '<br>')}</div>
            ${taskPreviewHtml}
          </div>
          <span class="message-time">${time}</span>
        </div>
      `;
    }).join('');

    // Render typing indicator if AI is working
    if (this.isAiTyping) {
      thread.innerHTML += `
        <div class="message ai" id="ai-typing-message">
          <div class="message-bubble glass-panel" style="padding: 10px 14px">
            <div class="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>
      `;
    }

    // Scroll to bottom
    thread.scrollTop = thread.scrollHeight;
  }

  renderTaskPreviewCard(task, messageId) {
    let dateStr = '';
    if (task.scheduledAt) {
      try {
        const cleanDate = task.scheduledAt.replace(/Z|([+-]\d{2}:\d{2})$/gi, '');
        const dateObj = new Date(cleanDate);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toLocaleString([], {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
          });
        }
      } catch (e) {
        console.warn('Failed to format task preview date:', e);
      }
    }

    const priority = (task.priority || 'medium').toLowerCase();
    const priorityColor = {
      low: 'var(--success)',
      medium: 'var(--warning)',
      high: 'var(--danger)',
      urgent: 'var(--urgent)'
    }[priority] || 'var(--text-secondary)';

    const displayTitle = task.title || 'Untitled Task';

    return `
      <div class="ai-task-preview">
        <div class="ai-task-header">Task Preview</div>
        <div style="font-weight: 600; font-size: 14px">${this.escapeHTML(displayTitle)}</div>
        ${task.description ? `<div style="font-size: 11px; color: var(--text-secondary)">${this.escapeHTML(task.description)}</div>` : ''}
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
          <span class="meta-badge" style="border: 1px solid ${priorityColor}; color: ${priorityColor}">
            ${priority.toUpperCase()}
          </span>
          ${dateStr ? `<span class="meta-badge">⏰ ${dateStr}</span>` : ''}
          ${(task.tags || []).map(t => `<span class="meta-badge">#${this.escapeHTML(t)}</span>`).join('')}
        </div>
        <button class="ai-task-confirm-btn" data-action="confirm-task" data-msg-id="${messageId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Add Task
        </button>
      </div>
    `;
  }

  setupListeners() {
    const form = document.getElementById('chat-input-form');
    const input = document.getElementById('chat-user-input');
    const thread = document.getElementById('chat-messages-container');
    const statusText = document.getElementById('ai-status-text');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const query = input.value.trim();
      if (!query) return;

      input.value = '';

      // Append user message
      const history = store.get('chatMessages');
      const updatedHistory = [
        ...history,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: query,
          timestamp: new Date().toISOString()
        }
      ];
      store.set('chatMessages', updatedHistory);

      // Trigger AI typing
      this.isAiTyping = true;
      statusText.innerText = 'thinking...';
      statusText.style.color = 'var(--warning)';
      this.renderMessages(updatedHistory);

      try {
        // Capture local client time details
        const now = new Date();
        const clientTime = now.toLocaleString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
          hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false 
        });
        
        // Timezone offset in format +HH:MM or -HH:MM
        const offsetMinutes = -now.getTimezoneOffset();
        const offsetSign = offsetMinutes >= 0 ? '+' : '-';
        const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
        const offsetMins = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
        const timezoneOffset = `${offsetSign}${offsetHours}:${offsetMins}`;

        const chatPayload = updatedHistory.slice(-6).map(msg => ({
          role: msg.role === 'ai' ? 'assistant' : msg.role,
          content: msg.content
        }));

        const reply = await api.post('/ai/chat', { 
          messages: chatPayload,
          clientTime,
          timezoneOffset
        });

        if (!reply || !reply.choices || reply.choices.length === 0) {
          throw new Error('AI assistant returned an empty response. Please retry.');
        }

        const aiMessage = reply.choices[0].message;
        if (!aiMessage || !aiMessage.content) {
          throw new Error('AI assistant response content is empty.');
        }

        this.isAiTyping = false;
        statusText.innerText = 'online';
        statusText.style.color = 'var(--success)';

        const finalHistory = [
          ...store.get('chatMessages'),
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: aiMessage.content,
            timestamp: new Date().toISOString()
          }
        ];
        store.set('chatMessages', finalHistory);
      } catch (err) {
        console.error('Chat AI response error:', err);
        this.isAiTyping = false;
        statusText.innerText = 'online';
        statusText.style.color = 'var(--success)';
        this.renderMessages(store.get('chatMessages'));
        showToast(err.message || 'Failed to get AI response.', 'error');
      }
    });

    // Handle confirming tasks inside chat messages
    thread.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="confirm-task"]');
      if (!btn) return;

      const msgId = btn.getAttribute('data-msg-id');
      const messages = store.get('chatMessages');
      const msg = messages.find(m => m.id === msgId);
      if (!msg) return;

      const jsonMatch = msg.content.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) return;

      try {
        const taskObj = JSON.parse(jsonMatch[1]);
        
        // Map to DB Schema
        const taskPayload = {
          title: taskObj.title,
          description: taskObj.description || '',
          priority: taskObj.priority || 'medium',
          scheduledAt: taskObj.scheduledAt ? new Date(taskObj.scheduledAt.replace(/Z|([+-]\d{2}:\d{2})$/gi, '')).toISOString() : null,
          reminderAt: taskObj.scheduledAt ? new Date(taskObj.scheduledAt.replace(/Z|([+-]\d{2}:\d{2})$/gi, '')).toISOString() : null,
          tags: taskObj.tags || [],
          aiGenerated: true
        };

        const createdTask = await api.post('/tasks', taskPayload);
        
        // Add task to local store
        const tasks = [createdTask, ...store.get('tasks')];
        store.set('tasks', tasks);
        
        showToast(`Task "${createdTask.title}" added successfully!`, 'success');
        
        // Disable button in UI to prevent adding multiple times
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color: white">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Added ✓
        `;
        btn.disabled = true;
        btn.style.background = 'var(--glass-border)';
        btn.style.cursor = 'not-allowed';
      } catch (err) {
        console.error('Failed to confirm and create task:', err);
      }
    });
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
  }
}

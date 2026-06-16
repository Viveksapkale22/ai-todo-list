import api from '../utils/api.js';
import store from '../utils/store.js';
import { renderTaskCard } from '../components/TaskCard.js';
import { showAlarmOverlay } from '../components/AlarmOverlay.js';
import { showToast } from '../components/Toast.js';

export default class TasksPage {
  constructor() {
    this.activeFilter = 'all'; // 'all', 'pending', 'scheduled', 'completed'
    this.unsubscribe = null;
  }

  async render() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="tasks-page animate-fade-in">
        <div class="tasks-header">
          <div class="date-header">
            <span class="date-subtitle" id="current-day-label">Daily Panel</span>
            <h1 style="margin: 0; font-size: 24px">Personal Tasks</h1>
          </div>
          <button id="refresh-tasks-btn" class="btn btn-secondary" style="padding: 8px 12px; font-size: 13px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: block">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
          </button>
        </div>

        <!-- Filter tabs -->
        <div class="filter-tabs">
          <button class="filter-tab ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="filter-tab ${this.activeFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pending</button>
          <button class="filter-tab ${this.activeFilter === 'scheduled' ? 'active' : ''}" data-filter="scheduled">Alarmed</button>
          <button class="filter-tab ${this.activeFilter === 'completed' ? 'active' : ''}" data-filter="completed">Done</button>
        </div>

        <!-- Tasks list -->
        <div id="tasks-list-container" class="tasks-list">
          <div class="text-center" style="padding: 40px 0">Loading tasks...</div>
        </div>

        <!-- Floating action buttons -->
        <!-- Manual create button (Cyan) -->
        <button id="manual-create-btn" class="fab" title="Create manually" style="right: 84px; background: var(--accent-cyan); box-shadow: 0 6px 20px rgba(6, 182, 212, 0.35)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- Floating action button to AI Chat (Purple) -->
        <a href="#/chat" class="fab" title="Create with TaskAI">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </a>

        <!-- Manual Create / Edit Task Modal -->
        <div id="task-modal" class="alarm-overlay hidden">
          <div class="alarm-card glass-card animate-fade-in" style="width: 90%; max-width: 450px; text-align: left; padding: 24px; animation-duration: 0.3s">
            <h2 id="modal-task-title-header" style="margin-bottom: 16px; font-size: 20px">Create Task</h2>
            <form id="task-modal-form" style="display: flex; flex-direction: column; gap: 12px">
              <input type="hidden" id="modal-task-id">
              
              <div class="form-group" style="margin-bottom: 0">
                <label for="modal-title">Task Title</label>
                <input type="text" id="modal-title" class="input-field" placeholder="Task summary" required style="padding: 10px 14px; font-size: 13px">
              </div>

              <div class="form-group" style="margin-bottom: 0">
                <label for="modal-desc">Description (Body)</label>
                <textarea id="modal-desc" class="input-field" placeholder="Optional details..." style="padding: 10px 14px; font-size: 13px; height: 60px; resize: none"></textarea>
              </div>

              <div style="display: flex; gap: 8px">
                <div class="form-group" style="flex: 1; margin-bottom: 0">
                  <label for="modal-priority">Priority</label>
                  <select id="modal-priority" class="input-field" style="padding: 10px; font-size: 13px; background-color: var(--bg-secondary)">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div class="form-group" style="flex: 1.5; margin-bottom: 0">
                  <label for="modal-schedule">Due Time</label>
                  <input type="datetime-local" id="modal-schedule" class="input-field" style="padding: 8px; font-size: 13px">
                </div>
              </div>

              <div style="display: flex; gap: 8px">
                <div class="form-group" style="flex: 1.5; margin-bottom: 0">
                  <label for="modal-reminder">Alarm / Reminder Time</label>
                  <input type="datetime-local" id="modal-reminder" class="input-field" style="padding: 8px; font-size: 13px">
                </div>
                
                <div class="form-group" style="flex: 1; margin-bottom: 0">
                  <label for="modal-tags">Tags</label>
                  <input type="text" id="modal-tags" class="input-field" placeholder="home, work" style="padding: 10px 14px; font-size: 13px">
                </div>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 12px">
                <button type="button" id="modal-cancel-btn" class="btn btn-secondary" style="flex: 1; padding: 10px; font-size: 13px">Cancel</button>
                <button type="submit" class="btn btn-primary" style="flex: 1.5; padding: 10px; font-size: 13px">Save Task</button>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;

    // Subscribe to store updates to update UI automatically
    this.unsubscribe = store.subscribe('tasks', (tasks) => {
      this.renderTaskList(tasks);
    });

    this.setupListeners();
    await this.fetchTasks();
    this.checkUrlParams();
  }

  // Check query string parameters to trigger alarms or highlight a task
  checkUrlParams() {
    const hash = window.location.hash;
    if (hash.includes('?')) {
      const queryString = hash.split('?')[1];
      const params = new URLSearchParams(queryString);
      
      const alarmTaskId = params.get('alarm');
      if (alarmTaskId) {
        const tasks = store.get('tasks');
        const task = tasks.find(t => t._id === alarmTaskId);
        if (task) {
          showAlarmOverlay(task);
          // Clear query params to prevent repeating on reload
          window.location.hash = '#/tasks';
        }
      }
    }
  }

  async fetchTasks() {
    try {
      const tasks = await api.get('/tasks');
      store.set('tasks', tasks);
    } catch (err) {
      console.error('Failed to retrieve tasks:', err);
    }
  }

  renderTaskList(tasks) {
    const listContainer = document.getElementById('tasks-list-container');
    if (!listContainer) return;

    // Filter tasks based on selected tab
    const filteredTasks = tasks.filter(task => {
      if (this.activeFilter === 'pending') return task.status === 'pending';
      if (this.activeFilter === 'completed') return task.status === 'completed';
      if (this.activeFilter === 'scheduled') return task.status === 'pending' && task.reminderAt;
      return true; // 'all'
    });

    if (filteredTasks.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state animate-fade-in">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div class="empty-title">No tasks found</div>
          <div class="empty-desc">${this.getEmptyStateMessage()}</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filteredTasks.map(task => renderTaskCard(task)).join('');
  }

  getEmptyStateMessage() {
    if (this.activeFilter === 'pending') return 'Yay! You have no pending tasks to complete.';
    if (this.activeFilter === 'completed') return 'No completed tasks yet. Finish a task to see it here!';
    if (this.activeFilter === 'scheduled') return 'No tasks with scheduled alarms.';
    return 'Your personal task list is empty. Tap the check button to add a task manually!';
  }

  // Format helper: Convert ISO Date to Local DateTime-Local Input string (YYYY-MM-DDTHH:MM)
  formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  setupListeners() {
    const listContainer = document.getElementById('tasks-list-container');
    const refreshBtn = document.getElementById('refresh-tasks-btn');
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    // Modal buttons
    const manualCreateBtn = document.getElementById('manual-create-btn');
    const taskModal = document.getElementById('task-modal');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const taskModalForm = document.getElementById('task-modal-form');
    const modalTitleHeader = document.getElementById('modal-task-title-header');

    // Open Modal for Manual Task Creation
    manualCreateBtn.addEventListener('click', () => {
      taskModalForm.reset();
      document.getElementById('modal-task-id').value = '';
      modalTitleHeader.innerText = 'Create Task';
      taskModal.classList.remove('hidden');
    });

    // Close Modal
    modalCancelBtn.addEventListener('click', () => {
      taskModal.classList.add('hidden');
    });

    // Submit Modal Form (Create / Edit)
    taskModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const taskId = document.getElementById('modal-task-id').value;
      const title = document.getElementById('modal-title').value.trim();
      const description = document.getElementById('modal-desc').value.trim();
      const priority = document.getElementById('modal-priority').value;
      const scheduledAt = document.getElementById('modal-schedule').value;
      const reminderAt = document.getElementById('modal-reminder').value;
      const tagsText = document.getElementById('modal-tags').value.trim();

      const tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(Boolean) : [];

      const payload = {
        title,
        description,
        priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        tags
      };

      try {
        if (taskId) {
          // Edit task
          const updated = await api.put(`/tasks/${taskId}`, payload);
          const tasks = store.get('tasks').map(t => t._id === taskId ? updated : t);
          store.set('tasks', tasks);
          showToast('Task updated successfully!', 'success');
        } else {
          // Create task
          const created = await api.post('/tasks', payload);
          const tasks = [created, ...store.get('tasks')];
          store.set('tasks', tasks);
          showToast('Task created successfully!', 'success');
        }
        taskModal.classList.add('hidden');
      } catch (err) {
        console.error('Failed to save manual task:', err);
      }
    });

    // Tab filter clicks
    filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        filterTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = e.target.getAttribute('data-filter');
        this.renderTaskList(store.get('tasks'));
      });
    });

    // Refresh button click
    refreshBtn.addEventListener('click', async () => {
      showToast('Refreshing task list...', 'info');
      await this.fetchTasks();
    });

    // Task actions delegation
    listContainer.addEventListener('click', async (e) => {
      const target = e.target;
      const actionElement = target.closest('[data-action]');
      if (!actionElement) return;

      const card = target.closest('.task-card');
      const taskId = card.getAttribute('data-id');
      const action = actionElement.getAttribute('data-action');

      if (action === 'toggle-complete') {
        try {
          const updated = await api.patch(`/tasks/${taskId}/complete`);
          const tasks = store.get('tasks').map(t => t._id === taskId ? updated : t);
          store.set('tasks', tasks);
          showToast(updated.status === 'completed' ? 'Task completed!' : 'Task set to pending', 'success');
        } catch (err) {
          console.error(err);
        }
      } else if (action === 'delete-task') {
        if (confirm('Are you sure you want to delete this task?')) {
          try {
            await api.delete(`/tasks/${taskId}`);
            const tasks = store.get('tasks').filter(t => t._id !== taskId);
            store.set('tasks', tasks);
            showToast('Task deleted successfully', 'success');
          } catch (err) {
            console.error(err);
          }
        }
      } else if (action === 'edit-task') {
        // Find task details in store
        const tasks = store.get('tasks');
        const task = tasks.find(t => t._id === taskId);
        if (!task) return;

        // Populate form fields
        document.getElementById('modal-task-id').value = task._id;
        document.getElementById('modal-title').value = task.title;
        document.getElementById('modal-desc').value = task.description || '';
        document.getElementById('modal-priority').value = task.priority;
        document.getElementById('modal-schedule').value = this.formatDateForInput(task.scheduledAt);
        document.getElementById('modal-reminder').value = this.formatDateForInput(task.reminderAt);
        document.getElementById('modal-tags').value = (task.tags || []).join(', ');

        modalTitleHeader.innerText = 'Edit Task';
        taskModal.classList.remove('hidden');
      } else if (action === 'view-details') {
        // Expand/collapse card details in UI
        const desc = card.querySelector('.task-card-desc');
        if (desc) {
          desc.style.display = desc.style.display === 'block' ? '-webkit-box' : 'block';
        }
      }
    });
  }

  // Cleanup subscribers
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

import { playAlarmSound, stopAlarmSound, stopSpeech, speakTask, triggerVibration } from '../utils/notifications.js';
import api from '../utils/api.js';
import store from '../utils/store.js';

export function showAlarmOverlay(task) {
  const root = document.getElementById('alarm-overlay-root');
  if (!root) return;

  // Clear current alarm if any
  root.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'alarm-overlay';
  overlay.id = `alarm-overlay-${task._id}`;

  const priorityLabel = task.priority.toUpperCase();
  const descriptionHtml = task.description ? `<div class="alarm-desc">${escapeHTML(task.description)}</div>` : '';

  overlay.innerHTML = `
    <div class="alarm-card glass-card animate-fade-in" style="animation-duration: 0.5s">
      <div class="alarm-icon-pulse animate-shake">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </div>
      <div class="alarm-title">${escapeHTML(task.title)}</div>
      ${descriptionHtml}
      
      <div class="alarm-meta">
        <span class="meta-badge" style="background: rgba(244, 63, 94, 0.1); color: var(--urgent)">
          ${priorityLabel} PRIORITY
        </span>
      </div>

      <div class="alarm-actions">
        <button class="alarm-btn-dismiss" id="alarm-complete-btn" style="background: var(--success); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4)">
          Complete Task
        </button>
        <button class="alarm-btn-snooze" id="alarm-snooze-btn" style="margin-top: 6px">
          Snooze 5 Min
        </button>
        <button class="alarm-btn-snooze" id="alarm-dismiss-btn" style="background: transparent; border: none; font-size: 13px; color: var(--text-muted); margin-top: 6px">
          Close Alarm
        </button>
      </div>
    </div>
  `;

  root.appendChild(overlay);

  // Trigger sound, vibration, and voice
  triggerVibration();
  playAlarmSound();
  
  if (store.get('settings').voiceAlarm) {
    speakTask(task.title, task.description);
  }

  // Complete button
  overlay.querySelector('#alarm-complete-btn').addEventListener('click', async () => {
    stopAlarmSound();
    stopSpeech();
    overlay.remove();
    try {
      await api.patch(`/tasks/${task._id}/complete`);
      const updatedTasks = store.get('tasks').map(t => 
        t._id === task._id ? { ...t, status: 'completed' } : t
      );
      store.set('tasks', updatedTasks);
    } catch (e) {
      console.error('Failed to mark task completed:', e);
    }
  });

  // Snooze button
  overlay.querySelector('#alarm-snooze-btn').addEventListener('click', async () => {
    stopAlarmSound();
    stopSpeech();
    overlay.remove();
    try {
      await api.patch(`/tasks/${task._id}/snooze`, { minutes: 5 });
      // Update task in local store
      const updatedTasks = store.get('tasks').map(t => 
        t._id === task._id ? { ...t, reminderAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } : t
      );
      store.set('tasks', updatedTasks);
    } catch (e) {
      console.error('Failed to snooze task:', e);
    }
  });

  // Close alarm only button
  overlay.querySelector('#alarm-dismiss-btn').addEventListener('click', () => {
    stopAlarmSound();
    stopSpeech();
    overlay.remove();
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

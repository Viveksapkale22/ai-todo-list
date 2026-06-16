export function renderTaskCard(task) {
  const isCompleted = task.status === 'completed';
  const priorityClass = `priority-${task.priority}`;
  
  // Format scheduled time
  let timeStr = '';
  if (task.scheduledAt) {
    const date = new Date(task.scheduledAt);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    const timeFormatted = date.toLocaleTimeString([], timeOptions);

    if (date.toDateString() === today.toDateString()) {
      timeStr = `Today at ${timeFormatted}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      timeStr = `Tomorrow at ${timeFormatted}`;
    } else {
      const dateOptions = { month: 'short', day: 'numeric' };
      timeStr = `${date.toLocaleDateString([], dateOptions)} at ${timeFormatted}`;
    }
  }

  // Tags HTML
  const tagsHtml = (task.tags || []).map(tag => `
    <span class="meta-badge">#${tag}</span>
  `).join('');

  // Collaborative indicator
  const collabBadge = task.isCollaborative ? `
    <span class="meta-badge" style="background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan)">
      👥 Group
    </span>
  ` : '';

  // Alarm indicator
  const alarmBadge = task.reminderAt && !isCompleted ? `
    <span class="meta-badge meta-badge-alarm">
      ⏰ Alarm ${new Date(task.reminderAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  ` : '';

  return `
    <div class="glass-card task-card ${priorityClass} ${isCompleted ? 'completed' : ''}" data-id="${task._id}">
      <div class="task-card-checkbox" data-action="toggle-complete">
        <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      
      <div class="task-card-body" data-action="view-details">
        <div class="task-card-title">${escapeHTML(task.title)}</div>
        ${task.description ? `<div class="task-card-desc">${escapeHTML(task.description)}</div>` : ''}
        
        <div class="task-card-meta">
          ${timeStr ? `<span class="meta-badge">${timeStr}</span>` : ''}
          ${alarmBadge}
          ${collabBadge}
          ${tagsHtml}
        </div>
      </div>

      <div style="display: flex; gap: 6px; align-items: center">
        <div class="task-card-delete" data-action="edit-task" title="Edit Task" style="color: var(--text-muted); cursor: pointer; padding: 4px; transition: color var(--transition-fast)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </div>

        <div class="task-card-delete" data-action="delete-task" title="Delete Task">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </div>
      </div>
    </div>
  `;
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

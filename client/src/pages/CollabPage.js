import api from '../utils/api.js';
import store from '../utils/store.js';
import { showToast } from '../components/Toast.js';
import { renderTaskCard } from '../components/TaskCard.js';

export default class CollabPage {
  constructor() {
    this.unsubscribeCollab = null;
    this.unsubscribeInvites = null;
    this.selectedGroup = null; // Group object if viewing group detail panel
    this.groupTasks = [];
  }

  async render() {
    const container = document.getElementById('view-container');
    
    if (this.selectedGroup) {
      await this.renderGroupDetails(container);
    } else {
      this.renderGroupList(container);
    }
    
    this.setupListeners();
  }

  renderGroupList(container) {
    container.innerHTML = `
      <div class="collab-page animate-fade-in">
        <h1 class="margin-bottom" style="font-size: 24px">Collaboration Panel</h1>
        <p class="margin-bottom" style="font-size: 13px">Create groups to share tasks with colleagues and friends in real-time.</p>

        <!-- Invites Section -->
        <div id="invites-section" class="collab-section hidden">
          <h2>Pending Invitations</h2>
          <div id="invites-list-container" class="tasks-list"></div>
        </div>

        <!-- Create Group Card -->
        <div class="glass-card margin-bottom" style="padding: 20px">
          <h2>Create New Group</h2>
          <form id="create-group-form" style="display: flex; gap: 8px">
            <input type="text" id="new-group-name" class="input-field" placeholder="Group / Project Name" required style="padding: 10px 14px">
            <button type="submit" class="btn btn-primary" style="padding: 0 20px">Create</button>
          </form>
        </div>

        <!-- Groups List -->
        <div class="collab-section">
          <h2>Your Groups</h2>
          <div id="groups-list-container" class="tasks-list">
            <div class="text-center" style="padding: 40px 0">Loading groups...</div>
          </div>
        </div>
      </div>
    `;

    // Subscribe to store
    this.unsubscribeCollab = store.subscribe('collabGroups', (groups) => {
      this.renderGroups(groups);
    });

    this.unsubscribeInvites = store.subscribe('invites', (invites) => {
      this.renderInvites(invites);
    });

    // Populate data
    this.fetchData();
  }

  async fetchData() {
    try {
      const groups = await api.get('/collab');
      store.set('collabGroups', groups);
      
      const invites = await api.get('/collab/invites');
      store.set('invites', invites);
    } catch (e) {
      console.error('Failed to load collaboration data:', e);
    }
  }

  renderGroups(groups) {
    const list = document.getElementById('groups-list-container');
    if (!list) return;

    if (groups.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No groups yet</div>
          <div class="empty-desc">Create a group above and start inviting people!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = groups.map(g => {
      const isOwner = g.ownerId._id === store.get('user').id || g.ownerId === store.get('user').id;
      const ownerName = isOwner ? 'You' : (g.ownerId.name || g.ownerId.email);
      
      return `
        <div class="glass-card collab-group-card animate-fade-in" data-id="${g._id}">
          <div class="group-info">
            <div class="group-name">${this.escapeHTML(g.name)}</div>
            <div class="group-members-count">Owner: ${this.escapeHTML(ownerName)} • ${g.members.length} member(s)</div>
          </div>
          <button class="btn btn-secondary" data-action="open-group" style="padding: 8px 16px; font-size: 13px">Open</button>
        </div>
      `;
    }).join('');
  }

  renderInvites(invites) {
    const section = document.getElementById('invites-section');
    const list = document.getElementById('invites-list-container');
    if (!section || !list) return;

    if (invites.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = invites.map(inv => `
      <div class="glass-card invite-card animate-fade-in" data-id="${inv._id}">
        <div>
          <div style="font-weight: 600; font-size: 14px">Invitation to join: "${this.escapeHTML(inv.name)}"</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px">Invited by: ${this.escapeHTML(inv.ownerId.name)} (${this.escapeHTML(inv.ownerId.email)})</div>
        </div>
        <div class="invite-actions">
          <button class="invite-btn invite-btn-accept" data-action="accept-invite">Accept</button>
          <button class="invite-btn invite-btn-decline" data-action="decline-invite">Decline</button>
        </div>
      </div>
    `).join('');
  }

  async renderGroupDetails(container) {
    const g = this.selectedGroup;
    const isOwner = g.ownerId._id === store.get('user').id || g.ownerId === store.get('user').id;
    
    // Fetch group tasks
    try {
      this.groupTasks = await api.get(`/collab/${g._id}/tasks`);
    } catch (err) {
      console.error(err);
      this.groupTasks = [];
    }

    container.innerHTML = `
      <div class="collab-page animate-fade-in">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
          <button id="back-to-list-btn" class="btn btn-secondary" style="padding: 8px 12px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div>
            <span class="date-subtitle">Group Space</span>
            <h1 style="margin: 0; font-size: 22px">${this.escapeHTML(g.name)}</h1>
          </div>
        </div>

        <!-- Group Members -->
        <div class="glass-card margin-bottom" style="padding: 20px">
          <div class="flex-between margin-bottom">
            <h3>Members (${g.members.length})</h3>
            ${isOwner ? `<button id="show-invite-form-btn" class="inline-btn">+ Invite Member</button>` : ''}
          </div>
          
          <!-- Invite form (initially hidden) -->
          <form id="invite-member-form" class="hidden margin-bottom animate-fade-in" style="display: none; gap: 8px">
            <input type="email" id="invite-email" class="input-field" placeholder="colleague@example.com" required style="padding: 8px 12px; font-size: 13px">
            <select id="invite-role" class="input-field" style="width: 110px; padding: 8px; font-size: 13px">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" class="btn btn-primary" style="padding: 0 16px; font-size: 13px">Send</button>
          </form>

          <div style="display: flex; flex-direction: column; gap: 10px">
            ${g.members.map(m => `
              <div class="flex-between" style="font-size: 13px">
                <div>
                  <span style="font-weight: 500">${this.escapeHTML(m.email)}</span>
                  ${m.status === 'pending' ? `<span style="color: var(--warning); font-size: 10px; margin-left: 6px">(pending)</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px">
                  <span class="collab-badge">${m.role.toUpperCase()}</span>
                  ${isOwner && m.email !== store.get('user').email ? `
                    <button class="inline-btn" data-action="remove-member" data-email="${m.email}" style="color: var(--danger)">Remove</button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Add Shared Task Form -->
        <div class="glass-card margin-bottom" style="padding: 20px">
          <h3>Create Shared Task</h3>
          <form id="create-shared-task-form" style="margin-top: 12px; display: flex; flex-direction: column; gap: 10px">
            <input type="text" id="shared-task-title" class="input-field" placeholder="Task Title" required style="padding: 10px 14px">
            <textarea id="shared-task-desc" class="input-field" placeholder="Details/Description" style="padding: 10px 14px; height: 60px; resize: none"></textarea>
            <div style="display: flex; gap: 8px">
              <select id="shared-task-priority" class="input-field" style="flex: 1; padding: 10px">
                <option value="low">Low Priority</option>
                <option value="medium" selected>Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Priority</option>
              </select>
              <input type="datetime-local" id="shared-task-schedule" class="input-field" style="flex: 1.5; padding: 8px">
            </div>
            <button type="submit" class="btn btn-primary" style="padding: 12px">Create Task</button>
          </form>
        </div>

        <!-- Shared Tasks List -->
        <div>
          <h2>Shared Tasks</h2>
          <div id="shared-tasks-list-container" class="tasks-list" style="margin-top: 12px">
            ${this.renderSharedTasks()}
          </div>
        </div>
      </div>
    `;
  }

  renderSharedTasks() {
    if (this.groupTasks.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-title">No group tasks</div>
          <div class="empty-desc">Shared tasks for this collaboration will appear here.</div>
        </div>
      `;
    }
    return this.groupTasks.map(t => renderTaskCard(t)).join('');
  }

  setupListeners() {
    const container = document.getElementById('view-container');
    
    // Core event delegation
    container.addEventListener('click', async (e) => {
      const target = e.target;
      const actionBtn = target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.getAttribute('data-action');
      const card = target.closest('.glass-card');
      const entityId = card?.getAttribute('data-id');

      // 1. Accept Invitation
      if (action === 'accept-invite') {
        try {
          await api.post(`/collab/${entityId}/accept`);
          showToast('Invitation accepted!', 'success');
          this.fetchData();
        } catch (err) { console.error(err); }
      }
      
      // 2. Decline Invitation
      else if (action === 'decline-invite') {
        try {
          await api.post(`/collab/${entityId}/decline`);
          showToast('Invitation declined.', 'info');
          this.fetchData();
        } catch (err) { console.error(err); }
      }
      
      // 3. Open Group Detail Space
      else if (action === 'open-group') {
        const groups = store.get('collabGroups');
        const g = groups.find(x => x._id === entityId);
        if (g) {
          this.selectedGroup = g;
          // Unsubscribe group list updates
          this.cleanupSubscribers();
          this.render();
        }
      }
      
      // 4. Remove member
      else if (action === 'remove-member') {
        const email = actionBtn.getAttribute('data-email');
        if (confirm(`Are you sure you want to remove ${email}?`)) {
          try {
            const result = await api.delete(`/collab/${this.selectedGroup._id}/members/${email}`);
            this.selectedGroup.members = result.members;
            showToast('Member removed.', 'success');
            this.render();
          } catch (err) { console.error(err); }
        }
      }
    });

    // BACK Button in Group Details
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.selectedGroup = null;
        this.render();
      });
    }

    // SHOW Invite Form Button
    const showInviteBtn = document.getElementById('show-invite-form-btn');
    const inviteForm = document.getElementById('invite-member-form');
    if (showInviteBtn && inviteForm) {
      showInviteBtn.addEventListener('click', () => {
        const isHidden = inviteForm.classList.contains('hidden');
        if (isHidden) {
          inviteForm.classList.remove('hidden');
          inviteForm.style.display = 'flex';
          showInviteBtn.innerText = 'Cancel';
        } else {
          inviteForm.classList.add('hidden');
          inviteForm.style.display = 'none';
          showInviteBtn.innerText = '+ Invite Member';
        }
      });
    }

    // CREATE group form
    const createGroupForm = document.getElementById('create-group-form');
    if (createGroupForm) {
      createGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-group-name');
        try {
          const newGroup = await api.post('/collab', { name: nameInput.value });
          nameInput.value = '';
          showToast(`Group "${newGroup.name}" created successfully!`, 'success');
          
          const groups = [newGroup, ...store.get('collabGroups')];
          store.set('collabGroups', groups);
        } catch (err) { console.error(err); }
      });
    }

    // SEND invite form
    const inviteFormElement = document.getElementById('invite-member-form');
    if (inviteFormElement) {
      inviteFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('invite-email');
        const roleSelect = document.getElementById('invite-role');
        try {
          const result = await api.post(`/collab/${this.selectedGroup._id}/invite`, {
            email: emailInput.value,
            role: roleSelect.value
          });
          emailInput.value = '';
          showToast('Invitation sent successfully!', 'success');
          this.selectedGroup.members = result.members;
          this.render();
        } catch (err) { console.error(err); }
      });
    }

    // CREATE shared task form
    const sharedTaskForm = document.getElementById('create-shared-task-form');
    if (sharedTaskForm) {
      sharedTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('shared-task-title').value;
        const description = document.getElementById('shared-task-desc').value;
        const priority = document.getElementById('shared-task-priority').value;
        const scheduledAt = document.getElementById('shared-task-schedule').value;
        
        try {
          const payload = {
            title,
            description,
            priority,
            scheduledAt: scheduledAt || null,
            reminderAt: scheduledAt || null
          };
          
          const created = await api.post(`/collab/${this.selectedGroup._id}/tasks`, payload);
          showToast('Shared task created!', 'success');
          
          this.groupTasks = [created, ...this.groupTasks];
          this.render();
        } catch (err) { console.error(err); }
      });
    }

    // SHARED Task action clicks (Checkbox / Delete) delegation
    const sharedList = document.getElementById('shared-tasks-list-container');
    if (sharedList) {
      sharedList.addEventListener('click', async (e) => {
        const target = e.target;
        const actionElement = target.closest('[data-action]');
        if (!actionElement) return;

        const card = target.closest('.task-card');
        const taskId = card.getAttribute('data-id');
        const action = actionElement.getAttribute('data-action');

        if (action === 'toggle-complete') {
          try {
            const updated = await api.patch(`/collab/${this.selectedGroup._id}/tasks/${taskId}/complete`);
            this.groupTasks = this.groupTasks.map(t => t._id === taskId ? updated : t);
            this.render();
            showToast(updated.status === 'completed' ? 'Task completed!' : 'Task set to pending', 'success');
          } catch (err) { console.error(err); }
        } else if (action === 'delete-task') {
          if (confirm('Delete this shared task?')) {
            try {
              await api.delete(`/collab/${this.selectedGroup._id}/tasks/${taskId}`);
              this.groupTasks = this.groupTasks.filter(t => t._id !== taskId);
              this.render();
              showToast('Shared task deleted.', 'success');
            } catch (err) { console.error(err); }
          }
        }
      });
    }
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

  cleanupSubscribers() {
    if (this.unsubscribeCollab) this.unsubscribeCollab();
    if (this.unsubscribeInvites) this.unsubscribeInvites();
  }

  destroy() {
    this.cleanupSubscribers();
  }
}

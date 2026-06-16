import store from '../utils/store.js';

export function updateNavbar(activeRoute) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  if (activeRoute === 'login') {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');

  // Highlight active tab
  const items = nav.querySelectorAll('.nav-item');
  items.forEach(item => {
    const route = item.getAttribute('data-route');
    if (route === activeRoute) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update badges
  updateNavBadges();
}

export function updateNavBadges() {
  const taskBadge = document.getElementById('task-badge-count');
  const inviteBadge = document.getElementById('invite-badge-count');

  if (taskBadge) {
    const pendingCount = store.get('tasks').filter(t => t.status === 'pending').length;
    if (pendingCount > 0) {
      taskBadge.innerText = pendingCount;
      taskBadge.classList.remove('hidden');
    } else {
      taskBadge.classList.add('hidden');
    }
  }

  if (inviteBadge) {
    const inviteCount = store.get('invites').length;
    if (inviteCount > 0) {
      inviteBadge.innerText = inviteCount;
      inviteBadge.classList.remove('hidden');
    } else {
      inviteBadge.classList.add('hidden');
    }
  }
}

// Initial subscriber setup
store.subscribe('tasks', () => updateNavBadges());
store.subscribe('invites', () => updateNavBadges());

import api from './utils/api.js';
import store from './utils/store.js';
import LoginPage from './pages/LoginPage.js';
import TasksPage from './pages/TasksPage.js';
import ChatPage from './pages/ChatPage.js';
import CollabPage from './pages/CollabPage.js';
import SettingsPage from './pages/SettingsPage.js';
import { updateNavbar } from './components/Navbar.js';
import { showAlarmOverlay } from './components/AlarmOverlay.js';
import { playAlarmSound } from './utils/notifications.js';

// Route maps
const routes = {
  login: LoginPage,
  tasks: TasksPage,
  chat: ChatPage,
  collab: CollabPage,
  settings: SettingsPage
};

let currentPageInstance = null;
let foregroundAlarmInterval = null;

// Simple SPA Router
async function router() {
  const hash = window.location.hash || '#/tasks';
  const cleanHash = hash.split('?')[0]; // Strip query params for routing
  let route = cleanHash.replace('#/', '');

  // Default fallback route
  if (!routes[route]) {
    route = 'tasks';
    window.location.hash = '#/tasks';
    return;
  }

  const token = localStorage.getItem('token');

  // Route auth guard
  if (!token && route !== 'login') {
    window.location.hash = '#/login';
    return;
  }
  
  if (token && route === 'login') {
    window.location.hash = '#/tasks';
    return;
  }

  // Destroy previous page to clean up listeners and prevent leaks
  if (currentPageInstance && typeof currentPageInstance.destroy === 'function') {
    currentPageInstance.destroy();
  }

  // Render bottom nav bar highlight
  updateNavbar(route);

  // Initialize new page
  const PageClass = routes[route];
  currentPageInstance = new PageClass();
  
  try {
    await currentPageInstance.render();
  } catch (err) {
    console.error('Error rendering page:', err);
  }
}

// Check foreground task alarms
function startForegroundAlarmChecker() {
  if (foregroundAlarmInterval) clearInterval(foregroundAlarmInterval);
  
  foregroundAlarmInterval = setInterval(() => {
    const user = store.get('user');
    if (!user) return;

    const tasks = store.get('tasks') || [];
    const now = Date.now();
    
    // Look for pending tasks where reminder time has passed and has not been marked done
    const activeAlarmTask = tasks.find(task => {
      if (task.status === 'completed' || !task.reminderAt) return false;
      const reminderTime = new Date(task.reminderAt).getTime();
      // Trigger if reminder time has arrived (within a 2 minute window so old alarms don't spam)
      return reminderTime <= now && now - reminderTime < 120000;
    });

    if (activeAlarmTask) {
      // Show foreground overlay alarm and start playing sound loop
      showAlarmOverlay(activeAlarmTask);
      playAlarmSound();
      
      // Mark as completed locally or clear reminder to prevent repeating
      activeAlarmTask.reminderAt = null; 
      store.set('tasks', [...tasks]);
    }
  }, 10000); // Check every 10 seconds
}

// Fetch user session on app start
async function initSession() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const data = await api.get('/auth/me');
      store.set('user', data.user);
      store.set('settings', data.user.settings);
      
      // Also prefetch tasks
      const tasks = await api.get('/tasks');
      store.set('tasks', tasks);
      
      // Start foreground checker
      startForegroundAlarmChecker();
    } catch (e) {
      console.error('Failed to restore user session:', e);
      localStorage.removeItem('token');
    }
  }
}

// Register PWA Service Worker and handle notifications click redirects
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully!', reg);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    });

    // Listen for navigation messages from Service Worker (e.g. on push click)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    });
  }
}

// Initialize Application
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  await initSession();
  router();
});

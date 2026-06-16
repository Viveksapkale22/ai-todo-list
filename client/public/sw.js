const CACHE_NAME = 'aitodo-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/alarm.mp3'
];

// Install Event - cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - cache-first strategy for static resources, ignore API
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass cache for API calls
  if (requestUrl.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache new static assets on the fly
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, data } = payload;

    const options = {
      body: body || 'You have an upcoming task.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: data?.taskId || 'aitodo-alert',
      renotify: true,
      requireInteraction: true,
      data: data || {},
      actions: [
        {
          action: 'complete-action',
          title: '✓ Complete',
          icon: '/icons/icon-192.png'
        },
        {
          action: 'snooze-action',
          title: '⏰ Snooze 5m',
          icon: '/icons/icon-192.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title || 'Task Reminder', options)
    );
  } catch (error) {
    console.error('Error handling push event:', error);
  }
});

// Listen for notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const taskData = notification.data;

  notification.close();

  if (!taskData || !taskData.taskId) {
    event.waitUntil(openApp('/'));
    return;
  }

  const taskId = taskData.taskId;

  if (action === 'complete-action') {
    event.waitUntil(
      performBackgroundAction(`/api/tasks/${taskId}/complete`)
    );
  } else if (action === 'snooze-action') {
    event.waitUntil(
      performBackgroundAction(`/api/tasks/${taskId}/snooze`, { minutes: 5 })
    );
  } else {
    event.waitUntil(
      openApp(`/#/tasks?alarm=${taskId}`)
    );
  }
});

// Helper: Open or focus application window
async function openApp(url) {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  for (const client of clientList) {
    if (client.url.includes(self.location.origin)) {
      await client.focus();
      client.postMessage({ type: 'NAVIGATE', url });
      return;
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}

// Helper: Perform API action in the background (using token from IndexedDB)
async function performBackgroundAction(url, body = {}) {
  try {
    const token = await getStoredToken();
    if (!token) {
      console.warn('No token available for Service Worker background action.');
      return;
    }

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      console.error(`Background API call failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to perform background Service Worker action:', error);
  }
}

// Read token from IndexedDB
function getStoredToken() {
  return new Promise((resolve) => {
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
        const transaction = db.transaction('keyval', 'readonly');
        const store = transaction.objectStore('keyval');
        const getReq = store.get('token');
        
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };

    request.onerror = () => resolve(null);
  });
}

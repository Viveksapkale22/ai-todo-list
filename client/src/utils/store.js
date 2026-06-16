// Reactive Application State Store (Pub/Sub pattern)

class Store {
  constructor() {
    this.state = {
      user: null,
      tasks: [],
      collabGroups: [],
      invites: [],
      chatMessages: [
        {
          id: 'initial',
          role: 'assistant',
          content: 'Hello! I am TaskAI. Tell me about a task you need to complete, and I will help you refine and schedule it.',
          timestamp: new Date().toISOString()
        }
      ],
      settings: {
        voiceAlarm: false,
        notificationsEnabled: true
      },
      loading: false
    };
    
    this.listeners = new Map();
  }

  // Get current state value
  get(key) {
    return this.state[key];
  }

  // Update state and trigger listeners
  set(key, value) {
    this.state[key] = value;
    this.notify(key, value);
  }

  // Subscribe to changes for a specific state key
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  // Notify all subscribers of a key
  notify(key, value) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(value);
        } catch (err) {
          console.error(`Error in state listener for key "${key}":`, err);
        }
      });
    }
  }

  // Reset store (on logout)
  reset() {
    this.set('user', null);
    this.set('tasks', []);
    this.set('collabGroups', []);
    this.set('invites', []);
    this.set('chatMessages', [
      {
        id: 'initial',
        role: 'assistant',
        content: 'Hello! I am TaskAI. Tell me about a task you need to complete, and I will help you refine and schedule it.',
        timestamp: new Date().toISOString()
      }
    ]);
    this.set('settings', {
      voiceAlarm: false,
      notificationsEnabled: true
    });
  }
}

export const store = new Store();
export default store;

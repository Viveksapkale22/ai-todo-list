import api from './api.js';
import store from './store.js';


// Conversion function for base64 VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Ask the user for notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Register push subscription with the Service Worker and sync with server
 */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Get VAPID key from backend
      const { publicKey } = await api.get('/push/key');
      if (!publicKey) throw new Error('VAPID key not returned by server.');

      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // Send subscription object to backend
    await api.post('/push/subscribe', { subscription });
    console.log('Successfully registered Web Push on server.');
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe user to Web Push:', error);
    return null;
  }
}

let alarmAudio = null;

/**
 * Play downloaded alarm ringtone audio file
 */
export function playAlarmSound() {
  if (alarmAudio) return; // Already playing

  try {
    alarmAudio = new Audio('/alarm.mp3');
    alarmAudio.loop = true;
    alarmAudio.play().catch((err) => {
      console.warn('Playback blocked by browser auto-play policy, waiting for user interaction:', err);
      // Fallback: play on first click/keypress if blocked
      const resumeAudio = () => {
        if (alarmAudio) {
          alarmAudio.play().catch(e => console.error('Delayed play failed:', e));
        }
        window.removeEventListener('click', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
      };
      window.addEventListener('click', resumeAudio);
      window.addEventListener('keydown', resumeAudio);
    });
  } catch (error) {
    console.error('Failed to play alarm ringtone:', error);
  }
}

/**
 * Stop alarm sound
 */
export function stopAlarmSound() {
  if (alarmAudio) {
    try {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    } catch (e) {}
    alarmAudio = null;
  }
}

/**
 * Trigger speech synthesis reading the task details aloud
 * @param {string} title 
 * @param {string} description 
 */
export function speakTask(title, description = '') {
  if (!('speechSynthesis' in window)) return;
  
  try {
    window.speechSynthesis.cancel(); // Clear current speech
    
    const textToSpeak = `Task Alert: ${title}. ${description ? description : ''}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.85; // Slightly slower for better speech clarity
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech synthesis error:', error);
  }
}

/**
 * Stop speech synthesis
 */
export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Trigger device vibration (Android only)
 */
export function triggerVibration() {
  if ('vibrate' in navigator) {
    // Vibrate 200ms, pause 100ms, vibrate 200ms
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

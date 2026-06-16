import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const configureWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    console.warn('WARNING: VAPID keys or email are missing. Push notifications will not work.');
    return false;
  }

  try {
    webpush.setVapidDetails(email, publicKey, privateKey);
    return true;
  } catch (error) {
    console.error('Error configuring web-push:', error);
    return false;
  }
};

const isConfigured = configureWebPush();

/**
 * Send web push notification to a user subscription
 * @param {object} subscription 
 * @param {object} payload 
 */
export async function sendNotification(subscription, payload) {
  if (!isConfigured) {
    console.error('WebPush is not configured. Cannot send notification.');
    throw new Error('WebPush is not configured.');
  }

  try {
    const payloadString = JSON.stringify(payload);
    await webpush.sendNotification(subscription, payloadString);
    return true;
  } catch (error) {
    // 410 Gone or 404 Not Found indicates subscription expired or ceased
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('Push subscription expired or deleted. Status code:', error.statusCode);
      return { expired: true };
    }
    console.error('Failed to send push notification:', error);
    throw error;
  }
}

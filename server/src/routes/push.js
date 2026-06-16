import express from 'express';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get VAPID Public Key for client subscription setup
router.get('/key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID public key not configured on server.' });
  }
  res.json({ publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Valid subscription object is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if subscription already exists
    const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Subscribed to push notifications successfully.' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Subscription endpoint is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Filter out subscription with matching endpoint
    user.pushSubscriptions = user.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
    await user.save();

    res.status(200).json({ success: true, message: 'Unsubscribed from push notifications successfully.' });
  } catch (error) {
    console.error('Unsubscription error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});

export default router;

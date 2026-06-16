import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { encrypt } from '../utils/encryption.js';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      passwordHash
    });

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        settings: user.settings,
        hasApiKey: false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        settings: user.settings,
        hasApiKey: !!user.openRouterApiKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login.' });
  }
});

// Get user profile (Requires authentication)
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      settings: req.user.settings,
      hasApiKey: !!req.user.openRouterApiKey
    }
  });
});

// Save or update OpenRouter API Key (Requires authentication)
router.put('/api-key', authMiddleware, async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (apiKey === undefined) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const encryptedKey = apiKey ? encrypt(apiKey) : null;
    
    await User.findByIdAndUpdate(req.user._id, { openRouterApiKey: encryptedKey });
    
    res.json({ success: true, message: apiKey ? 'OpenRouter API Key saved successfully.' : 'OpenRouter API Key removed.' });
  } catch (error) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: 'Failed to update API key.' });
  }
});

// Update settings (Requires authentication)
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { voiceAlarm } = req.body;

    if (voiceAlarm === undefined) {
      return res.status(400).json({ error: 'voiceAlarm setting is required.' });
    }

    // Always keep notificationsEnabled to true as per user request
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $set: { 
          'settings.voiceAlarm': voiceAlarm,
          'settings.notificationsEnabled': true
        } 
      },
      { new: true }
    );

    res.json({
      success: true,
      settings: updatedUser.settings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Update user profile (Name and Email)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if another user already has this email
    const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({ error: 'Another user already has this email.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, email: normalizedEmail } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        settings: updatedUser.settings,
        hasApiKey: !!updatedUser.openRouterApiKey
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile details.' });
  }
});

export default router;

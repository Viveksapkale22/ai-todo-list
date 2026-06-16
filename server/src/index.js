import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import collabRoutes from './routes/collaboration.js';
import aiRoutes from './routes/ai.js';
import pushRoutes from './routes/push.js';
import { startScheduler } from './services/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Turn off for simpler client connection/dev
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: '*', // Allow all in dev/PWA
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate Limiting (to prevent brute forcing / spamming endpoints)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// Basic test route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date() 
  });
});

// Database state check middleware for all API routes (except health endpoint)
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: 'Database connection is temporarily offline. Retrying connection... Please try again in a few seconds.' 
    });
  }
  next();
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/push', pushRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Database Connection with Auto-Retry
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('CRITICAL: MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

let schedulerStarted = false;

const connectWithRetry = () => {
  console.log('[Database] Connecting to MongoDB...');
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('[Database] Successfully connected to MongoDB.');
      
      // Start the alarm cron job only once
      if (!schedulerStarted) {
        startScheduler();
        schedulerStarted = true;
      }
    })
    .catch(err => {
      console.error('[Database] MongoDB connection failed. Retrying in 5 seconds... Error:', err.message);
      setTimeout(connectWithRetry, 5000);
    });
};

// Start the connection loop
connectWithRetry();

// Start server immediately so it listens on port 5000 (prevents proxy ECONNREFUSED)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
  });
}

export default app;

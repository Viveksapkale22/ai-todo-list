import cron from 'node-cron';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { sendNotification } from './pushService.js';

let isRunning = false;

// Task scheduler runner
async function checkAndSendReminders() {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    
    // Find pending/in-progress tasks where reminder time has passed and has not been notified
    const pendingTasks = await Task.find({
      reminderAt: { $lte: now },
      notified: false,
      status: { $in: ['pending', 'in-progress'] }
    });

    if (pendingTasks.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[Scheduler] Found ${pendingTasks.length} tasks to notify.`);

    for (const task of pendingTasks) {
      const user = await User.findById(task.userId);
      if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
        // No user or no push subscriptions, just mark as notified to avoid infinite retries
        task.notified = true;
        await task.save();
        continue;
      }

      const payload = {
        title: `Task Reminder: ${task.title}`,
        body: task.description || 'You have a scheduled task starting now.',
        tag: task._id.toString(),
        data: {
          taskId: task._id.toString(),
          title: task.title,
          description: task.description,
          priority: task.priority,
          scheduledAt: task.scheduledAt
        }
      };

      const subscriptionsToRemove = [];

      // Send to all device subscriptions for this user
      for (const sub of user.pushSubscriptions) {
        try {
          const result = await sendNotification(sub, payload);
          if (result && result.expired) {
            subscriptionsToRemove.push(sub.endpoint);
          }
        } catch (error) {
          console.error(`Error sending notification to user ${user._id} endpoint ${sub.endpoint}:`, error);
        }
      }

      // Cleanup expired subscriptions
      if (subscriptionsToRemove.length > 0) {
        user.pushSubscriptions = user.pushSubscriptions.filter(
          sub => !subscriptionsToRemove.includes(sub.endpoint)
        );
        await user.save();
        console.log(`[Scheduler] Cleaned up ${subscriptionsToRemove.length} expired subscriptions for user ${user._id}`);
      }

      // Mark task as notified
      task.notified = true;
      
      // Handle recurrence if configured
      // If we have recurrence, we calculate next reminderAt, reset notified=false, and save
      // For simple cron, we just mark it notified.
      await task.save();
    }
  } catch (error) {
    console.error('[Scheduler] Error running reminder checks:', error);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  console.log('[Scheduler] Initializing cron job (every 30 seconds)...');
  // Runs every 30 seconds
  cron.schedule('*/30 * * * * *', () => {
    checkAndSendReminders();
  });
}

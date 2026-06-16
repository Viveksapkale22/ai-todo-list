import express from 'express';
import Task from '../models/Task.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get all personal tasks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, priority, scheduledDate } = req.query;
    const query = { userId: req.user._id, isCollaborative: false };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    if (scheduledDate) {
      const start = new Date(scheduledDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(scheduledDate);
      end.setHours(23, 59, 59, 999);
      query.scheduledAt = { $gte: start, $lte: end };
    }

    const tasks = await Task.find(query).sort({ scheduledAt: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// Get today's personal tasks
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const query = {
      userId: req.user._id,
      isCollaborative: false,
      $or: [
        { scheduledAt: { $gte: start, $lte: end } },
        { status: 'pending', scheduledAt: { $lt: start } } // Show overdue pending tasks as well
      ]
    };

    const tasks = await Task.find(query).sort({ priority: -1, scheduledAt: 1 });
    res.json(tasks);
  } catch (error) {
    console.error('Fetch today tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s tasks.' });
  }
});

// Create a task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, scheduledAt, reminderAt, recurrence, tags, aiGenerated } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const task = new Task({
      userId: req.user._id,
      createdBy: req.user._id,
      title,
      description,
      priority: priority || 'medium',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      recurrence: recurrence || null,
      tags: tags || [],
      aiGenerated: !!aiGenerated,
      notified: false
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// Update a task
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, status, scheduledAt, reminderAt, recurrence, tags } = req.body;
    
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (status) {
      task.status = status;
      if (status === 'completed') {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }
    }
    
    if (scheduledAt !== undefined) {
      task.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    }
    
    if (reminderAt !== undefined) {
      const newReminder = reminderAt ? new Date(reminderAt) : null;
      // If reminder date changed, reset notification status
      if (newReminder?.getTime() !== task.reminderAt?.getTime()) {
        task.reminderAt = newReminder;
        task.notified = false;
      }
    }

    if (recurrence !== undefined) task.recurrence = recurrence;
    if (tags) task.tags = tags;

    await task.save();
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// Toggle complete task
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    task.status = task.status === 'completed' ? 'pending' : 'completed';
    task.completedAt = task.status === 'completed' ? new Date() : null;

    await task.save();
    res.json(task);
  } catch (error) {
    console.error('Toggle complete task error:', error);
    res.status(500).json({ error: 'Failed to update task status.' });
  }
});

// Snooze task alarm
router.patch('/:id/snooze', authMiddleware, async (req, res) => {
  try {
    const { minutes } = req.body;
    const snoozeMinutes = parseInt(minutes) || 5;

    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const newReminder = new Date();
    newReminder.setMinutes(newReminder.getMinutes() + snoozeMinutes);

    task.reminderAt = newReminder;
    task.notified = false;

    await task.save();
    res.json({ success: true, reminderAt: newReminder, task });
  } catch (error) {
    console.error('Snooze task error:', error);
    res.status(500).json({ error: 'Failed to snooze task.' });
  }
});

// Delete a task
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Task.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

export default router;

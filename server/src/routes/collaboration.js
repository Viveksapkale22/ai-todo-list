import express from 'express';
import Collaboration from '../models/Collaboration.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Helper: Check if user is member of collaboration group
async function checkMembership(userId, userEmail, collabId) {
  const collab = await Collaboration.findById(collabId);
  if (!collab) return { error: 'Group not found', status: 404 };

  if (collab.ownerId.toString() === userId.toString()) {
    return { collab, role: 'admin', isOwner: true };
  }

  const member = collab.members.find(m => 
    (m.userId && m.userId.toString() === userId.toString()) || 
    m.email.toLowerCase() === userEmail.toLowerCase()
  );

  if (!member || member.status !== 'accepted') {
    return { error: 'Access denied. Not a member of this group.', status: 403 };
  }

  return { collab, role: member.role, isOwner: false };
}

// Create a collaboration group
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const collab = new Collaboration({
      name,
      ownerId: req.user._id,
      members: [{
        userId: req.user._id,
        email: req.user.email,
        role: 'admin',
        status: 'accepted',
        joinedAt: new Date()
      }]
    });

    await collab.save();
    res.status(201).json(collab);
  } catch (error) {
    console.error('Create collaboration error:', error);
    res.status(500).json({ error: 'Failed to create collaboration group.' });
  }
});

// Get all collaboration groups the user belongs to
router.get('/', authMiddleware, async (req, res) => {
  try {
    const collabs = await Collaboration.find({
      $or: [
        { ownerId: req.user._id },
        { 'members.userId': req.user._id, 'members.status': 'accepted' },
        { 'members.email': req.user.email, 'members.status': 'accepted' }
      ]
    }).populate('ownerId', 'name email');

    res.json(collabs);
  } catch (error) {
    console.error('Fetch collaborations error:', error);
    res.status(500).json({ error: 'Failed to fetch collaboration groups.' });
  }
});

// Get pending invitations for the current user
router.get('/invites', authMiddleware, async (req, res) => {
  try {
    const invites = await Collaboration.find({
      members: {
        $elemMatch: {
          email: req.user.email,
          status: 'pending'
        }
      }
    }).populate('ownerId', 'name email');

    res.json(invites);
  } catch (error) {
    console.error('Fetch invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invites.' });
  }
});

// Invite a member by email
router.post('/:id/invite', authMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const { collab, role: myRole } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (!collab) return res.status(403).json({ error: 'Access denied.' });
    if (myRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite members.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already in the members list
    const alreadyMember = collab.members.some(m => m.email.toLowerCase() === normalizedEmail);
    if (alreadyMember) {
      return res.status(400).json({ error: 'User is already a member or has a pending invite.' });
    }

    // Check if user exists in the app to link userId
    const invitedUser = await User.findOne({ email: normalizedEmail });

    collab.members.push({
      userId: invitedUser ? invitedUser._id : null,
      email: normalizedEmail,
      role: role || 'editor',
      status: 'pending'
    });

    await collab.save();
    res.json({ success: true, message: 'Invitation sent.', members: collab.members });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to send invite.' });
  }
});

// Accept invitation
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const collab = await Collaboration.findById(req.params.id);
    if (!collab) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const member = collab.members.find(m => m.email.toLowerCase() === req.user.email.toLowerCase());
    if (!member) {
      return res.status(404).json({ error: 'Invitation not found for this email.' });
    }

    member.status = 'accepted';
    member.userId = req.user._id;
    member.joinedAt = new Date();

    await collab.save();
    res.json({ success: true, message: 'Invitation accepted.', collab });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
});

// Decline/Cancel invitation or leave group
router.post('/:id/decline', authMiddleware, async (req, res) => {
  try {
    const collab = await Collaboration.findById(req.params.id);
    if (!collab) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    collab.members = collab.members.filter(m => m.email.toLowerCase() !== req.user.email.toLowerCase());
    await collab.save();

    res.json({ success: true, message: 'Invitation declined or left the group.' });
  } catch (error) {
    console.error('Decline invite error:', error);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// Remove a member (Admins only)
router.delete('/:id/members/:email', authMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    const { collab, role: myRole } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (!collab) return res.status(403).json({ error: 'Access denied.' });
    if (myRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members.' });
    }

    // Check if removing the owner
    const memberToRemove = collab.members.find(m => m.email.toLowerCase() === email.toLowerCase());
    if (!memberToRemove) {
      return res.status(404).json({ error: 'Member not found in this group.' });
    }

    if (memberToRemove.userId && memberToRemove.userId.toString() === collab.ownerId.toString()) {
      return res.status(400).json({ error: 'Cannot remove the owner of the group.' });
    }

    collab.members = collab.members.filter(m => m.email.toLowerCase() !== email.toLowerCase());
    await collab.save();

    // Also remove the task assignments if needed, or keep them.
    res.json({ success: true, message: 'Member removed.', members: collab.members });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// List tasks in a collaboration group
router.get('/:id/tasks', authMiddleware, async (req, res) => {
  try {
    const { collab, error, status } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (error) return res.status(status).json({ error });

    const tasks = await Task.find({ collaborativeGroupId: req.params.id, isCollaborative: true })
      .populate('createdBy', 'name email')
      .sort({ scheduledAt: 1, createdAt: -1 });
      
    res.json(tasks);
  } catch (error) {
    console.error('Fetch shared tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch shared tasks.' });
  }
});

// Create a task inside a collaboration group
router.post('/:id/tasks', authMiddleware, async (req, res) => {
  try {
    const { collab, role, error, status } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (error) return res.status(status).json({ error });

    if (role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create tasks.' });
    }

    const { title, description, priority, scheduledAt, reminderAt, recurrence, tags } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const task = new Task({
      userId: req.user._id, // Assign to creator initially
      createdBy: req.user._id,
      title,
      description,
      priority: priority || 'medium',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      recurrence: recurrence || null,
      tags: tags || [],
      isCollaborative: true,
      collaborativeGroupId: collab._id,
      notified: false
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error('Create shared task error:', error);
    res.status(500).json({ error: 'Failed to create shared task.' });
  }
});

// Update shared task
router.put('/:id/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { collab, role, error, status } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (error) return res.status(status).json({ error });

    if (role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit tasks.' });
    }

    const { title, description, priority, status: taskStatus, scheduledAt, reminderAt, recurrence, tags } = req.body;

    const task = await Task.findOne({ _id: req.params.taskId, collaborativeGroupId: collab._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found in this group.' });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    
    if (taskStatus) {
      task.status = taskStatus;
      if (taskStatus === 'completed') {
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
    console.error('Update shared task error:', error);
    res.status(500).json({ error: 'Failed to update shared task.' });
  }
});

// Toggle complete shared task
router.patch('/:id/tasks/:taskId/complete', authMiddleware, async (req, res) => {
  try {
    const { collab, role, error, status } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (error) return res.status(status).json({ error });

    if (role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot mark tasks complete.' });
    }

    const task = await Task.findOne({ _id: req.params.taskId, collaborativeGroupId: collab._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found in this group.' });
    }

    task.status = task.status === 'completed' ? 'pending' : 'completed';
    task.completedAt = task.status === 'completed' ? new Date() : null;

    await task.save();
    res.json(task);
  } catch (error) {
    console.error('Toggle complete shared task error:', error);
    res.status(500).json({ error: 'Failed to update shared task status.' });
  }
});

// Delete shared task
router.delete('/:id/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { collab, role, error, status } = await checkMembership(req.user._id, req.user.email, req.params.id);
    if (error) return res.status(status).json({ error });

    if (role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete tasks.' });
    }

    const task = await Task.findOne({ _id: req.params.taskId, collaborativeGroupId: collab._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found in this group.' });
    }

    // Only creator of task, admin of group or owner of group can delete task
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isAdmin = role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only task creator or group admins can delete this task.' });
    }

    await Task.deleteOne({ _id: req.params.taskId });
    res.json({ success: true, message: 'Shared task deleted successfully.' });
  } catch (error) {
    console.error('Delete shared task error:', error);
    res.status(500).json({ error: 'Failed to delete shared task.' });
  }
});

export default router;

import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  scheduledAt: {
    type: Date,
    default: null,
    index: true
  },
  reminderAt: {
    type: Date,
    default: null,
    index: true
  },
  recurrence: {
    type: String, // Cron expression for repeating tasks
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  isCollaborative: {
    type: Boolean,
    default: false,
    index: true
  },
  collaborativeGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaboration',
    default: null,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  notified: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for querying a user's daily tasks
taskSchema.index({ userId: 1, status: 1, scheduledAt: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;

import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  openRouterApiKey: {
    type: String,
    default: null
  },
  pushSubscriptions: [pushSubscriptionSchema],
  settings: {
    voiceAlarm: {
      type: Boolean,
      default: false
    },
    notificationsEnabled: {
      type: Boolean,
      default: true // Locked to true as per user request
    }
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

export default User;

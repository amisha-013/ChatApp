import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    trim: true,
    default: '', // now optional
  },
  room: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  seenBy: {
    type: [String],
    default: [],
  },
  media: {
    type: String,
    default: null,
  },
});

// ✅ Ensure either message or media is provided
messageSchema.pre('validate', function (next) {
  if (!this.message && !this.media) {
    this.invalidate('message', 'Either message text or media is required.');
  }
  next();
});

const Message = mongoose.model('Message', messageSchema, 'messages');

export default Message;

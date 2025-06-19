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
    default: '', // optional text
  },
  room: {
    type: String,
    trim: true,
    default: null, // ✅ now optional
  },
  receiver: {
    type: String,
    trim: true,
    default: null, // ✅ now optional
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  seenBy: {
    type: [String],
    default: [],
  },
  deliveredTo: {
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

  if (!this.room && !this.receiver) {
    this.invalidate('room', 'Message must have either a room or a receiver.');
  }

  next();
});

const Message = mongoose.model('Message', messageSchema, 'messages');
export default Message;

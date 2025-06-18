import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';

// ⛔ Fix for ES modules to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Connect to MongoDB
connectDB();

// ✅ Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Routes
app.use('/api/auth', authRoutes);

// ✅ Chat Mongoose Model
const chatSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
const Chat = mongoose.model('Chat', chatSchema);

// ✅ REST Endpoint to get all chat messages (optional)
app.get('/api/chat', async (req, res) => {
  try {
    const messages = await Chat.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ✅ REST Endpoint to post a message (optional)
app.post('/api/chat', async (req, res) => {
  try {
    const { sender, message } = req.body;
    const newMessage = new Chat({ sender, message });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// ✅ Root route
app.get('/', (req, res) => {
  res.send("API Running");
});

// ✅ Socket.io Events
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // 🔄 Send chat history to newly connected client
  try {
    const history = await Chat.find().sort({ timestamp: 1 });
    socket.emit('chat_history', history);
  } catch (error) {
    console.error('Error loading chat history:', error);
  }

  // 💬 Listen for and broadcast new messages
  socket.on('send_message', async (data) => {
    try {
      const { sender, message, timestamp } = data;
      const newMsg = new Chat({ sender, message, timestamp });
      await newMsg.save();
      io.emit('receive_message', newMsg);
    } catch (err) {
      console.error('Failed to save or emit message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

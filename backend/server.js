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
import Message from './models/Message.js'; // ✅ Updated model with `room` field

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

// Express setup
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

// Routes
app.use('/api/auth', authRoutes);

// REST Endpoint to get all messages (you can use a query param for room)
app.get('/api/chat', async (req, res) => {
  const room = req.query.room;
  try {
    const messages = room
      ? await Message.find({ room }).sort({ timestamp: 1 })
      : await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send("API Running");
});

// ✅ Socket.IO Room-based Chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async (room) => {
    socket.join(room);
    try {
      const history = await Message.find({ room }).sort({ timestamp: 1 });
      socket.emit('chat_history', history);
    } catch (error) {
      console.error('Error sending chat history:', error);
    }
  });

  socket.on('send_message', async (data) => {
    const { sender, message, room, timestamp } = data;
    try {
      const newMsg = new Message({ sender, message, room, timestamp });
      await newMsg.save();
      io.to(room).emit('receive_message', newMsg);
    } catch (err) {
      console.error('Failed to save or broadcast message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

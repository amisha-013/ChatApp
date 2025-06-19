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
import Message from './models/Message.js';
import mediaRoutes from './routes/media.js'; // must be a default export
import fetch from 'node-fetch'; // Google Translate API

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', mediaRoutes);

// Translation
app.post('/api/translate', async (req, res) => {
  const { q, target } = req.body;
  const apiKey = process.env.GOOGLE_API_KEY;

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, target, format: 'text' }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.error.message });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Fetch all messages
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

// Health check
app.get('/', (req, res) => {
  res.send('API Running');
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async (room) => {
    socket.join(room);
    try {
      const history = await Message.find({ room }).sort({ timestamp: 1 });
      socket.emit('chat_history', history);
    } catch (err) {
      console.error('Error sending chat history:', err);
    }
  });

  socket.on('send_message', async ({ sender, message, media, room, timestamp }) => {
    try {
      const newMsg = new Message({
        sender,
        message,
        media,
        room,
        timestamp,
        deliveredTo: [sender],
        seenBy: [],
      });

      await newMsg.save();
      io.to(room).emit('receive_message', newMsg);
    } catch (err) {
      console.error('Failed to save or broadcast message:', err);
    }
  });

  socket.on('message_seen', async ({ messageId, username, room }) => {
    try {
      const msg = await Message.findById(messageId);
      if (msg && !msg.seenBy.includes(username)) {
        msg.seenBy.push(username);
        await msg.save();
        io.to(room).emit('message_seen_update', { messageId, username });
      }
    } catch (err) {
      console.error('Error marking message as seen:', err);
    }
  });

  socket.on('message_delivered', async ({ messageId, username, room }) => {
    try {
      const msg = await Message.findById(messageId);
      if (msg && !msg.deliveredTo.includes(username)) {
        msg.deliveredTo.push(username);
        await msg.save();
        io.to(room).emit('message_delivered_update', { messageId, username });
      }
    } catch (err) {
      console.error('Error marking message as delivered:', err);
    }
  });

  socket.on('typing', ({ room, user }) => {
    socket.to(room).emit('user_typing', user);
  });

  socket.on('stop_typing', ({ room, user }) => {
    socket.to(room).emit('user_stop_typing', user);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

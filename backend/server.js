import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import mediaRoutes from './routes/media.js';
import Message from './models/Message.js';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const users = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api', mediaRoutes);

// Translation API proxy
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
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Get users except current
app.get('/api/users', async (req, res) => {
  try {
    const { username } = req.query;
    const filter = username ? { username: { $ne: username } } : {};
    const usersList = await User.find(filter).select('username');
    res.json(usersList.map(u => ({ username: u.username })));
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Fetch room or private messages
app.get('/api/chat', async (req, res) => {
  const { room, sender, receiver } = req.query;
  try {
    let messages = [];

    if (room) {
      messages = await Message.find({ room }).sort({ timestamp: 1 });
    } else if (sender && receiver) {
      messages = await Message.find({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
        ],
      }).sort({ timestamp: 1 });
    }

    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Health check
app.get('/', (req, res) => res.send('API Running'));

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register_user', (username) => {
    users.set(username, socket.id);
    socket.username = username;
    console.log(`${username} registered with socket ID: ${socket.id}`);
  });

  socket.on('join_room', async (room) => {
    if (!room) return;
    socket.join(room);
    try {
      const history = await Message.find({ room }).sort({ timestamp: 1 });
      socket.emit('chat_history', history);
    } catch (err) {
      console.error('Room history fetch error:', err);
    }
  });

  socket.on('load_private_history', async ({ sender, receiver }) => {
    try {
      const history = await Message.find({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender },
        ],
      }).sort({ timestamp: 1 });

      socket.emit('private_history', history);
    } catch (err) {
      console.error('Private history fetch error:', err);
    }
  });

  // 🔁 Message sending and scheduling logic
  socket.on('send_message', async ({ sender, receiver, room, message, media, timestamp, scheduledTime }) => {
    try {
      const msgData = {
        sender,
        receiver: receiver || null,
        room: room || null,
        message,
        media,
        timestamp: scheduledTime || timestamp,
        scheduledTime: scheduledTime || null,
      };

      const sendNow = !scheduledTime || new Date(scheduledTime) <= new Date();

      const deliverMessage = async () => {
        const newMsg = new Message(msgData);
        await newMsg.save();

        if (room) {
          io.to(room).emit('receive_message', newMsg);
        } else if (receiver) {
          const receiverSocket = users.get(receiver);
          const senderSocket = users.get(sender);
          if (receiverSocket) io.to(receiverSocket).emit('receive_message', newMsg);
          if (senderSocket && receiverSocket !== senderSocket) {
            io.to(senderSocket).emit('receive_message', newMsg);
          }
        }
      };

      if (sendNow) {
        await deliverMessage();
      } else {
        const delay = new Date(scheduledTime) - new Date();
        console.log(`⏰ Scheduling message from ${sender} to send in ${delay}ms`);
        setTimeout(deliverMessage, delay);
      }

    } catch (err) {
      console.error('Message send error:', err);
    }
  });

  socket.on('typing', ({ room, to, user }) => {
    if (room) {
      socket.to(room).emit('user_typing', { room, user });
    } else if (to) {
      const toSocket = users.get(to);
      if (toSocket) io.to(toSocket).emit('user_typing', { user });
    }
  });

  socket.on('stop_typing', ({ room, to, user }) => {
    if (room) {
      socket.to(room).emit('user_stop_typing');
    } else if (to) {
      const toSocket = users.get(to);
      if (toSocket) io.to(toSocket).emit('user_stop_typing');
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.username);
      console.log(`User ${socket.username} disconnected`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
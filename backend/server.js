import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';

connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 5000;

io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send("API Running");
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

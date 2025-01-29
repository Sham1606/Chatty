import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  io.emit("newMessage", {
    senderId: Message.senderId,
    recipientId: Message.recipientId,
    text: Message.text,
  });

  // Broadcast to all clients except sender
  socket.broadcast.emit("newMessage", Message);

      // Update the sender's view immediately
      socket.emit("messageSent", Message);

  io.emit("newMessage", Message);
  

  socket.on('profileUpdate', async ({ userId, profilePic }) => {
    // Broadcast to all connected clients except sender
    socket.broadcast.emit('profileUpdated', {
      userId,
      profilePic
    })
  }); 

  // Backend Socket Listener
  socket.on('messageSeen', async ({ messageId, receiverId }) => {
    const message = await Message.findById(messageId);
    if (message && !message.seen.includes(receiverId)) {
      message.seen.push(receiverId);
      await message.save();
      io.to(message.senderId.toString()).emit('messageStatus', { messageId, status: 'seen', userId: receiverId });
    }
  });

  socket.on('messageDelivered', async (messageId) => {
  const message = await Message.findById(messageId);
  if (message && !message.delivered) {
    message.delivered = true;
    await message.save();
    io.to(message.senderId.toString()).emit('messageDeliveryStatus', { messageId, status: 'delivered' });
  }
});

socket.on('messageRead', async (messageId) => {
  const message = await Message.findById(messageId);
  if (message) {
    message.read = true;
    await message.save();
    io.to(message.senderId.toString()).emit('messageDeliveryStatus', { messageId, status: 'read' });
  }
});

socket.on("messageDeleted", async ({ messageId, deleteFor }) => {
  // Broadcast message deletion to all clients
  io.emit("messageDeleted", { messageId, deleteFor });
});

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, app, server, userSocketMap };


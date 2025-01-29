import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage } from "../controllers/message.controller.js";
import Message from "../models/message.model.js";
import { io } from "../lib/socket.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);

// Edit message route
router.put('/:id', protectRoute, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { text } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });
    
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    const timeDifference = (new Date() - new Date(message.createdAt)) / (1000 * 60);
    if (timeDifference > 10) {
      return res.status(400).json({ error: "Can't edit messages older than 10 minutes" });
    }

    // Store the old text in edit history
    message.editHistory.push({
      text: message.text,
      editedAt: new Date()
    });
    
    message.text = text;
    message.isEdited = true;
    await message.save();

    // Don't emit socket event - edits will sync on refresh
    res.json(message);
  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete('/:id', protectRoute, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { deleteFor } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (deleteFor === 'everyone') {
      if (message.senderId.toString() !== userId.toString()) {
        return res.status(403).json({ error: "Can only delete your own messages for everyone" });
      }
      await Message.findByIdAndDelete(messageId);
      io.to(message.receiverId.toString()).emit('messageDeleted', {
        messageId,
        deleteFor: 'everyone'
      });
    } else if (deleteFor === 'me') {
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }
    }

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
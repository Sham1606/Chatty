import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });
    const filteredMessages = messages.filter(msg => !msg.deletedFor.includes(myId));

    res.status(200).json(filteredMessages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, media } = req.body; // Renamed image to media for generality
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text?.trim() && !media) {
      return res.status(400).json({ error: "Message must contain text or media" });
    }

    let mediaUrl = null;
    let mediaType = null;
    let folderName = '';
    let sizeLimit = 0; // Default size limit

    if (media) {
      try {
        // Validate media format
        const mediaTypeRegex = /data:(image|video|application\/zip|application\/pdf);base64,/;  // Supported formats: image, video, zip, pdf
        if (!media.startsWith('data:') || !mediaTypeRegex.test(media)) {
          return res.status(400).json({ error: "Invalid media format" });
        }

        // Extract media type (image, video, zip, pdf, etc.)
        const mediaTypeMatch = media.split(';')[0].split('/')[1];
        mediaType = mediaTypeMatch;

        // Determine folder name and size limit based on media type
        switch (mediaType) {
          case 'image':
            folderName = 'messages/images';
            sizeLimit = 10485760; // 10MB limit for images
            break;
          case 'video':
            folderName = 'messages/videos';
            sizeLimit = 52428800; // 50MB limit for videos
            break;
          case 'zip':
            folderName = 'messages/zips';
            sizeLimit = 20971520; // 20MB limit for zip files
            break;
          case 'pdf':
            folderName = 'messages/documents';
            sizeLimit = 5242880; // 5MB limit for documents (PDF, DOCX, etc.)
            break;
          default:
            return res.status(400).json({ error: "Unsupported media type" });
        }

        // Check if the media size exceeds the limit
        const mediaBuffer = Buffer.from(media.split(',')[1], 'base64');
        if (mediaBuffer.length > sizeLimit) {
          return res.status(400).json({ error: `File size exceeds ${sizeLimit / 1048576}MB limit` });
        }

        // Upload media to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(media, {
          folder: folderName,
          resource_type: "auto", // Automatically handle the resource type
          max_bytes: sizeLimit, // Size limit
          quality: "auto:best", // Maintain original quality
          fetch_format: "auto", // Automatically choose the best format
        });

        if (!uploadResponse || !uploadResponse.secure_url) {
          throw new Error("Failed to upload media");
        }

        mediaUrl = uploadResponse.secure_url;

      } catch (uploadError) {
        console.error("Error uploading media:", uploadError);
        return res.status(500).json({ error: "Media upload failed" });
      }
    }

    // Prepare the new message
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text?.trim() || "",
      image: mediaType === "image" ? mediaUrl : "",
      videoUrl: mediaType === "video" ? mediaUrl : "",
      documentUrl: (mediaType === "zip" || mediaType === "pdf") ? mediaUrl : "", // Add document type handling if needed
      deletedFor: [],
      editHistory: [],
      isEdited: false,
    });

    await newMessage.save();

    // Only emit to receiver
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessageAsSeen = async (messageId, userId) => {
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (!message.seen.includes(userId)) {
      message.seen.push(userId);
      await message.save();
    }

    return message;
  } catch (error) {
    console.error("Error marking message as seen:", error);
    throw error;
  }
};


export const deleteMessage = async (req, res) => {
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
            // If message has an image, delete from Cloudinary
      if (message.image) {
        try {
          const publicId = message.image.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`messages/${publicId}`);
        } catch (error) {
          console.error("Error deleting image from Cloudinary:", error);
          // Continue with message deletion even if image deletion fails
        }
      }

      await Message.findByIdAndDelete(messageId);
      
      // Notify other users about deletion
      io.to(message.receiverId.toString()).emit('messageDeleted', {
        messageId,
        deleteFor: 'everyone'
      });
    } else if (deleteFor === 'me') {
      // Just add user to deletedFor array instead of removing message
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
};

export const editMessage = async (req, res) => {
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

    // Emit socket event for real-time updates
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", {
        messageId: message._id,
        newText: text,
        isEdited: true
      });
    }

    res.json(message);
  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
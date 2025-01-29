import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { MessageSquare, Edit, Trash2 } from 'lucide-react';
import DeleteMessagePopup from "./DeleteMessagePopup";
import EditMessagePopup from "./EditMessagePopup";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";

const socket = io();

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage, 
    editMessage
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(null);
  // const [setMessages, setSetMessages] = useState(null);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser._id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    socket.on("messageDelivered", (messageId) => {
      updateMessageStatus(messageId, { delivered: true });
    });

    socket.on("messageSeen", (messageId) => {
      updateMessageStatus(messageId, { read: true });
    });

    return () => {
      socket.off("messageDelivered");
      socket.off("messageSeen");
    };
  }, []);


  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const message = entry.target;
          const messageId = message.dataset.messageId;
          if (messageId && message.dataset.senderId !== authUser._id) {
            socket.emit('messageSeen', { messageId, receiverId: authUser._id });
          }
        }
      });
    }, { threshold: 0.5 });

    const messageElements = document.querySelectorAll('.chat');
    messageElements.forEach(message => {
      observer.observe(message);
    });

    return () => {
      messageElements.forEach(message => {
        observer.unobserve(message);
      });
    };
  }, [messages, socket, authUser._id]);

  const updateMessageStatus = (messageId, statusUpdate) => {
    useChatStore.setState((state) => ({
      messages: state.messages.map((msg) =>
        msg._id === messageId ? { ...msg, ...statusUpdate } : msg
      ),
    }));
  };

  const handleSendMessage = async (text) => {
    const newMessage = await sendMessage(selectedUser._id, text);
    socket.emit("messageSent", {
      messageId: newMessage._id,
      receiverId: selectedUser._id,
    });
  };

  const handleMessageSeen = (message) => {
    console.log(message);  // Log the message to see its structure
    const seen = message.seen || [];
    if (!seen.includes(authUser._id)) {
      socket.emit('messageSeen', message._id); // Emit event to backend
    }
  };


  const handleDelete = (messageId) => {
    setDeletingMessage(messageId);
  };

  const confirmDelete = async (deleteFor) => {
    await deleteMessage(deletingMessage, deleteFor);
    setDeletingMessage(null);
  };

  const handleEdit = (message) => {
    const timeDifference = (new Date() - new Date(message.createdAt)) / (1000 * 60);
    if (timeDifference <= 10) {
      setEditingMessage(message);
    } else {
      toast.error("Cannot edit messages older than 10 minutes");
    }
  };

  const submitEdit = async (newText) => {
    await editMessage(editingMessage._id, newText);
    setEditingMessage(null);
  };


  const renderMessage = (message) => {
    const isOwnMessage = message.senderId === authUser._id;

    const renderTicks = () => {
      if (!isOwnMessage) return null;
      if (message.read) return <span className="text-blue-500">✓✓</span>;
      if (message.delivered) return <span>✓✓</span>;
      return <span>✓</span>;
    };

    return (
      <div
        key={message._id}
        className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}
        data-message-id={message._id}
      >
        <div className="chat-image avatar">
          <div className="size-10 rounded-full border">
            <img
              src={
                isOwnMessage
                  ? authUser.profilePic || "/avatar.png"
                  : selectedUser.profilePic || "/avatar.png"
              }
              alt="profile pic"
            />
          </div>
        </div>
        <div className="chat-header mb-1">
          {isOwnMessage ? "You" : selectedUser.fullName}
          <time className="text-xs opacity-50 ml-1">
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <div className="chat-bubble flex flex-col">
          {message.image && (
            <img
              src={message.image}
              alt="Attachment"
              className="sm:max-w-[200px] rounded-md mb-2"
            />
          )}
          <p>{message.text}</p>
        </div>
        <div className="chat-footer opacity-50 flex gap-2 mt-1">
          {renderTicks()}
          {isOwnMessage && (
            <button onClick={() => handleDelete(message._id)}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput onSend={handleSendMessage} />
      </div>
    );
  }
  
  return  (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages
          .filter((message) => !message.deletedFor?.includes(authUser._id))
          .map(renderMessage)}
        <div ref={messageEndRef} />
      </div>
      <MessageInput onSend={handleSendMessage} />
      {editingMessage && (
        <EditMessagePopup
          message={editingMessage}
          onConfirm={submitEdit}
          onCancel={() => setEditingMessage(null)}
        />
      )}
      {deletingMessage && (
        <DeleteMessagePopup
          onDelete={confirmDelete}
          onCancel={() => setDeletingMessage(null)}
        />
      )}
    </div>
  );
};
export default ChatContainer;


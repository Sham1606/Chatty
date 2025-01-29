  import { create } from "zustand";
  import toast from "react-hot-toast";
  import { axiosInstance } from "../lib/axios";
  import { useAuthStore } from "./useAuthStore";

  export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,

    getUsers: async () => {
      set({ isUsersLoading: true });
      try {
        const res = await axiosInstance.get("/messages/users");
        const usersWithLastMessage = await Promise.all(
          res.data.map(async (user) => {
            const messages = await axiosInstance.get(`/messages/${user._id}`);
            // Get the last message that wasn't deleted for the current user
            const lastMessage = messages.data
              .filter(msg => !msg.deletedFor.includes(useAuthStore.getState().authUser._id))
              .pop();
            return { 
              ...user,
              lastMessage,
              profilePic: user.profilePic
            };
          })
        );
        set({ users: usersWithLastMessage });
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load users");
      } finally {
        set({ isUsersLoading: false });
      }
    },    

    getMessages: async (userId) => {
      set({ isMessagesLoading: true });
      try {
        const res = await axiosInstance.get(`/messages/${userId}`);
        const filteredMessages = res.data.filter(msg => {
          const { authUser } = useAuthStore.getState();
          return !msg.deletedFor.includes(authUser._id);
        });
        set({ messages: filteredMessages });
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load messages");
      } finally {
        set({ isMessagesLoading: false });
      }
    },

    sendMessage: async (messageData) => {
      const { selectedUser, messages } = get();
      if (!selectedUser) return;

      try {
        const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
        const newMessage = res.data;

        set({ messages: [...messages, newMessage] });

        // Update the last message for the user in the sidebar immediately
      set(state => ({
        users: state.users.map(user => {
          if (user._id === selectedUser._id) {
            return {
              ...user,
              lastMessage: newMessage
            };
          }
          return user;
        })
      }));

      // Emit socket event for real-time update
      const socket = useAuthStore.getState().socket;
      if (socket) {
        socket.emit("newMessage", newMessage);
      }


        return newMessage;
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to send message");
        throw error;
      }
    },

    deleteMessage: async (messageId, deleteFor) => {
      try {
        await axiosInstance.delete(`/messages/${messageId}`, { data: { deleteFor } });
        const { messages } = get();
        if (deleteFor === 'everyone') {
          set({ messages: messages.filter(msg => msg._id !== messageId) });
        } else {
          const { authUser } = useAuthStore.getState();
          const updatedMessages = messages.filter(msg => msg._id !== messageId);
          set({ messages: updatedMessages });
        }
        return true;
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to delete message");
        return false;
      }
    },

    editMessage: async (messageId, newText) => {
      try {
        const res = await axiosInstance.put(`/messages/${messageId}`, { text: newText });
        const { messages } = get();
        const updatedMessages = messages.map((msg) =>
          msg._id === messageId ? res.data : msg
        );
        set({ messages: updatedMessages });
        return true;
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to edit message");
        return false;
      }
    },

    deleteMessageForMe : async (messageId) => {
      try {
        const { messages, authUser } = get();
        await axiosInstance.delete(`/messages/${messageId}`, { data: { deleteFor: 'me' } });
        const updatedMessages = messages.filter(msg => msg._id !== messageId);
        set({ messages: updatedMessages });
        return true;
      } catch (error) {
        toast.error("Failed to delete message");
        return false;
      }
    },

    setSelectedUser: (user) => set({ selectedUser: user }),

    updateUserProfilePic: (userId, profilePic) => {
      set((state) => ({
        users: state.users.map(user =>
          user._id === userId ? { ...user, profilePic } : user
        ),
        selectedUser: state.selectedUser?._id === userId
          ? { ...state.selectedUser, profilePic }
          : state.selectedUser
      }));
    },

    updateLastMessage: (senderId, receiverId, message) => {
      set((state) => ({
        users: state.users.map((user) => {
          if (user._id === senderId || user._id === receiverId) {
            return {
              ...user,
              lastMessage: message
            };
          }
          return user;
        })
      }));
    },

    subscribeToMessages: () => {
      const socket = useAuthStore.getState().socket;
      
      if (!socket) return;
  
      socket.on("newMessage", (newMessage) => {
        const { authUser } = useAuthStore.getState();
        const { users, selectedUser, messages } = get();
        
        // Update messages if in current chat
      if (selectedUser && (
        newMessage.senderId === selectedUser._id ||
        newMessage.receiverId === selectedUser._id
      )) {
        set({ messages: [...messages, newMessage] });
      }
      // Update users list for sidebar
      const updatedUsers = users.map(user => {
        if (user._id === newMessage.senderId || user._id === newMessage.receiverId) {
          return {
            ...user,
            lastMessage: newMessage
          };
        }
        return user;
      });

      // Sort users by latest message
      const sortedUsers = updatedUsers.sort((a, b) => {
        const timeA = new Date(a.lastMessage?.createdAt || 0);
        const timeB = new Date(b.lastMessage?.createdAt || 0);
        return timeB - timeA;
      });

      set({ users: sortedUsers });
  
        // Add notification if message is received and chat isn't selected
      if (newMessage.senderId !== authUser._id && 
        (!selectedUser || selectedUser._id !== newMessage.senderId)) {
      set(state => ({
        notifications: {
          ...state.notifications,
          [newMessage.senderId]: (state.notifications[newMessage.senderId] || 0) + 1
        }
      }));
    }
  });
  
      // Listen for message deletions
      socket.on("messageDeleted", ({ messageId, deleteFor }) => {
        const { messages, users, updateLastMessage } = get();
        
        // Remove the message if it was deleted
        if (deleteFor === 'everyone') {
          const updatedMessages = messages.filter(msg => msg._id !== messageId);
          set({ messages: updatedMessages });
          
          // Update last message if the deleted message was the last one
          users.forEach(user => {
            if (user.lastMessage?._id === messageId) {
              // Find the new last message for this user
              const newLastMessage = updatedMessages[updatedMessages.length - 1];
              updateLastMessage(user._id, newLastMessage?.receiverId, newLastMessage);
            }
          });
        }
      });
  
      get().subscribeToMessageStatus();
    },

    unsubscribeFromMessages: () => {
      const socket = useAuthStore.getState().socket;
      socket.off("newMessage");
      get().unsubscribeFromMessageStatus();
    },

    updateMessageStatus: (messageId, status, seenBy) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                [status]: true,
                delivered: status === "read" ? true : msg.delivered,
                seen: status === "read" ? [...(msg.seen || []), seenBy] : msg.seen,
              }
            : msg
        ),
      }));
    },

    subscribeToMessageStatus: () => {
      const socket = useAuthStore.getState().socket;
      socket.on("messageDeliveryStatus", ({ messageId, status, seenBy }) => {
        get().updateMessageStatus(messageId, status, seenBy);
      });
    },

    unsubscribeFromMessageStatus: () => {
      const socket = useAuthStore.getState().socket;
      socket.off("messageDeliveryStatus");
    },
  }));


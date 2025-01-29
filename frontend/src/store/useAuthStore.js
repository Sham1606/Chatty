import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useChatStore } from "./useChatStore.js";
import Message from "../../../backend/models/message.model.js";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

// const axiosInstance = axios.create({
//   baseURL: BASE_URL,
//   withCredentials: true
// });


export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data,) => {
    try {
      set({ isUpdatingProfile: true });
      
      // Keep the full path here since axios needs the complete endpoint
      const res = await axiosInstance.put("/auth/update-profile", data);
      
      if (res.data) {
        const updatedUser = res.data;
        set({ authUser: updatedUser });
        
        get().socket?.emit('profileUpdate', {
          userId: updatedUser._id,
          profilePic: updatedUser.profilePic
        });

        toast.success("Profile updated successfully");
        return updatedUser;
      }
    } catch (error) {
      toast.error("Failed to update profile");
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  // updateProfile: async (payload) => {
  //   try {
  //     const response = await axiosInstance.put("/auth/update-profile", payload);
  //     set({ authUser: response.data });
  //     return response.data;
  //   } catch (error) {
  //     console.error("Error updating profile:", error);
  //     throw error;
  //   }
  // },  

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Add listeners for message events
    socket.on('messageEdited', ({ messageId, newText }) => {
      const messages = useChatStore.getState().messages;
      const updatedMessages = messages.map(msg => 
        msg._id === messageId ? { ...msg, text: newText } : msg
      );
      useChatStore.setState({ messages: updatedMessages });
    });

    socket.on("messageSeen", async (messageId) => {
      // Assuming you are using a message model in your database
      const message = await Message.findById(messageId);
      if (message && !message.seen.includes(userId)) {
        message.seen.push(userId);  // Add the user's ID to the seen list
        await message.save();
      }
    });    

    socket.on('messageDeleted', ({ messageId, deleteFor }) => {
      const messages = useChatStore.getState().messages;
      if (deleteFor === 'everyone') {
        useChatStore.setState({ 
          messages: messages.filter(msg => msg._id !== messageId) 
        });
      }
    });

    // Enhanced profile update handler
    socket.on('profileUpdated', ({ userId, profilePic }) => {
      const { authUser } = get();
      
      // Update authUser if it's the current user
      if (userId === authUser?._id) {
        set({ authUser: { ...authUser, profilePic } });
      }
      
      // Update user in chat store
      const chatStore = useChatStore.getState();
      if (chatStore.users.length > 0) {
        // Update in users list
        const updatedUsers = chatStore.users.map(user => 
          user._id === userId ? { ...user, profilePic } : user
        );
        useChatStore.setState({ users: updatedUsers });

        // Update selected user if it's the same user
        if (chatStore.selectedUser?._id === userId) {
          useChatStore.setState({
            selectedUser: { ...chatStore.selectedUser, profilePic }
          });
        }
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) {
      socket.off('profileUpdated');
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('getOnlineUsers'); 
      socket.disconnect();
    }
  },
}));
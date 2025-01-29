import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, MessageSquare } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import { toast } from "react-hot-toast";
import { Socket } from "socket.io-client";
import { io } from "socket.io-client";


const socket = io();

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    messages,
    subscribeToMessages,
    unsubscribeFromMessages
  } = useChatStore();

  const { onlineUsers, authUser } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [notifications, setNotifications] = useState({});

  useEffect(() => {
    getUsers();
    subscribeToMessages(); // Subscribe to real-time updates

    // Listen for new message events
    socket.on("newMessage", (data) => {
      const { senderId } = data;
      setNotifications((prev) => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1,
      }));
    });

    return () => {
      socket.off("newMessage");
      unsubscribeFromMessages(); // Unsubscribe from real-time updates
    };
  }, [getUsers, subscribeToMessages, unsubscribeFromMessages]);

  // const handleUserClick = (user) => {
  //   setSelectedUser(user);
  //   // Clear notifications for the selected user
  //   setNotifications((prev) => {
  //     const updated = { ...prev };
  //     delete updated[user._id];
  //     return updated;
  //   });
  // };

  const formatMessagePreview = (message, user) => {
    if (!message) return "";
    
    const isFromUser = message.senderId === user._id;
    const senderName = isFromUser ? user.fullName.split(' ')[0] : 'You';
    const messageContent = message.image ? '🖼️ Image' : message.text;
    
    return `${senderName}: ${messageContent}`;
  };

  // Sort users by most recent message
  const sortedUsers = [...users].sort((a, b) => {
    const timeA = new Date(a.lastMessage?.createdAt || 0).getTime();
    const timeB = new Date(b.lastMessage?.createdAt || 0).getTime();
    return timeB - timeA;
  });

  
  const handleUserClick = (user) => {
    setSelectedUser(user);
    // Clear notifications for this user
    setNotifications(prev => {
      const updated = { ...prev };
      delete updated[user._id];
      return updated;
    });
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.senderId === authUser._id) {
      toast.success(`Message sent to ${selectedUser.fullName}`, {
        position: "top-right",
        duration: 3000,
      });
    }
  }, [messages, authUser._id, selectedUser]);

  // const filteredUsers = showOnlineOnly
  //   ? users.filter((user) => onlineUsers.includes(user._id))
  //   : users;

  // Filter out the current user and apply online filter if selected
  const filteredUsers = users
    .filter(user => user._id !== authUser._id) // Remove current user
    .filter(user => {
      if (showOnlineOnly) {
        return onlineUsers.includes(user._id);
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.lastMessage?.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessage?.createdAt || 0).getTime();
      return timeB - timeA;
    });

  if (isUsersLoading) return <SidebarSkeleton />;

   // Calculate number of online users excluding the current user
   const onlineUsersCount = onlineUsers.filter(id => id !== authUser._id).length;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
      {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => {
            if (!user) return null;

            const isOnline = onlineUsers.includes(user._id);
            const lastMessage = user.lastMessage;
            const isLastMessageFromUser = lastMessage?.senderId === user._id;

            return (
              <button
                key={user._id}
                onClick={() => handleUserClick(user)}
                className={`w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-12 object-cover rounded-full"
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 size-3 bg-green-500 
                      rounded-full ring-2 ring-zinc-900"
                    />
                  )}
                </div>

                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">
                    {user.fullName}
                    {notifications[user._id] && (
                      <span className="ml-2 text-xs text-red-500">
                        ({notifications[user._id]})
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400 flex items-center gap-1">
                    {isOnline ? "Online" : "Offline"}
                    {lastMessage && (
                      <>
                        <span className="text-xs">•</span>
                        <span className="truncate">
                          {isLastMessageFromUser ? user.fullName.split(' ')[0] : 'You'}: {' '}
                          {lastMessage.image ? '🖼️ Image' : lastMessage.text}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center text-zinc-500 py-4">
            {showOnlineOnly ? "No online users" : "No users found"}
          </div>
        )}
{/* 
  {filteredUsers.length === 0 && (
    <div className="text-center text-zinc-500 py-4">No online users</div>
  )} */}
</div>
    </aside>
  );
};

export default Sidebar;

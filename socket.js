const socketIo = (io) => {
  // Store connected users with their room information using socket.id as their key
  const connectedUsers = new Map();
  // Store admins for each group
  const groupAdmins = new Map();
  
  // Handle new socket connections
  io.on("connection", (socket) => {
    // Get user from authentication
    const user = socket.handshake.auth.user;
    console.log("User connected", user?.username);

    //!START: Join room Handler
    socket.on("join room", (groupId) => {
      // Add socket to the specified room
      socket.join(groupId);
      // Store user and room info in connectedUsers map
      connectedUsers.set(socket.id, { user, room: groupId });

      // Check if the user is the first to join the room (creator) and assign them as admin
      if (!groupAdmins.has(groupId)) {
        groupAdmins.set(groupId, socket.id); // Set the first user as the admin
        console.log(`${user?.username} is the admin of the group ${groupId}`);
      }

      // Get list of all users currently in the room
      const usersInRoom = Array.from(connectedUsers.values())
        .filter((u) => u.room === groupId)
        .map((u) => u.user);
      // Emit updated users list to all clients in the room
      io.in(groupId).emit("users in room", usersInRoom);
      // Broadcast join notification to all other users in the room
      socket.to(groupId).emit("notification", {
        type: "USER_JOINED",
        message: `${user?.username} has joined`,
        user: user,
      });
    });
    //!END: Join room Handler

    //!START: Leave room Handler
    // Triggered when user manually leaves a room
    socket.on("leave room", (groupId) => {
      console.log(`${user?.username} leaving room:`, groupId);
      // Remove socket from the room
      socket.leave(groupId);
      if (connectedUsers.has(socket.id)) {
        // Remove user from connected users and notify others
        connectedUsers.delete(socket.id);
        socket.to(groupId).emit("user left", user?._id);
      }
    });
    //!END: Leave room Handler

    //!START: New Message Handler
    // Triggered when user sends a new message
    socket.on("new message", (message) => {
      // Broadcast message to all other users in the room
      socket.to(message.groupId).emit("message received", message);
    });
    //!END: New Message Handler

    //!START: Disconnect Handler
    // Triggered when user closes the connection
    socket.on("disconnect", () => {
      console.log(`${user?.username} disconnected`);
      if (connectedUsers.has(socket.id)) {
        // Get user's room info before removing
        const userData = connectedUsers.get(socket.id);
        // Notify others in the room about user's departure
        socket.to(userData.room).emit("user left", user?._id);
        // Remove user from connected users
        connectedUsers.delete(socket.id);
      }
    });
    //!END: Disconnect Handler

    //!START: Typing Indicator
    // Triggered when user starts typing
    socket.on("typing", ({ groupId, username }) => {
      // Broadcast typing status to other users in the room
      socket.to(groupId).emit("user typing", { username });
    });

    socket.on("stop typing", ({ groupId }) => {
      // Broadcast stop typing status to other users in the room
      socket.to(groupId).emit("user stop typing", { username: user?.username });
    });
    //!END: Typing Indicator

    //!START: Admin Check (For example, if someone tries to add/remove users)
    socket.on("isAdmin", (groupId, callback) => {
      // Check if the user is the admin of the group
      if (groupAdmins.get(groupId) === socket.id) {
        callback(true); // User is admin
      } else {
        callback(false); // User is not admin
      }
    });
    //!END: Admin Check
  });
};

module.exports = socketIo;

const Group = require("./models/GroupModel");

const socketIo = (io) => {
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    const user = socket.handshake.auth.user;
    console.log("User connected", user?.username);

    //!START: Join room Handler
    socket.on("join room", (groupId) => {
      socket.join(groupId);
      connectedUsers.set(socket.id, { user, room: groupId });

      const usersInRoom = Array.from(connectedUsers.values())
        .filter((u) => u.room === groupId)
        .map((u) => u.user);
      io.in(groupId).emit("users in room", usersInRoom);
      socket.to(groupId).emit("notification", {
        type: "USER_JOINED",
        message: `${user?.username} has joined`,
        user: user,
      });
    });
    //!END: Join room Handler

    //!START: Leave room Handler
    socket.on("leave room", (groupId) => {
      console.log(`${user?.username} leaving room:`, groupId);
      socket.leave(groupId);
      if (connectedUsers.has(socket.id)) {
        connectedUsers.delete(socket.id);
        socket.to(groupId).emit("user left", user?._id);
      }
    });
    //!END: Leave room Handler

    //!START: New Message Handler
    socket.on("new message", (message) => {
      io.to(message.groupId).emit("message received", message);
    });
    //!END: New Message Handler

    //!START: Disconnect Handler
    socket.on("disconnect", () => {
      console.log(`${user?.username} disconnected`);
      if (connectedUsers.has(socket.id)) {
        const userData = connectedUsers.get(socket.id);
        socket.to(userData.room).emit("user left", user?._id);
        connectedUsers.delete(socket.id);
      }
    });
    //!END: Disconnect Handler

    //!START: Typing Indicator
    socket.on("typing", ({ groupId, username }) => {
      socket.to(groupId).emit("user typing", { username });
    });

    socket.on("stop typing", ({ groupId }) => {
      socket.to(groupId).emit("user stop typing", { username: user?.username });
    });
    //!END: Typing Indicator

    //!START: Admin Check — queries DB instead of unreliable in-memory map
    socket.on("isAdmin", async (groupId, callback) => {
      try {
        const group = await Group.findById(groupId).select("admin");
        callback(group?.admin?.toString() === user?._id?.toString());
      } catch (error) {
        callback(false);
      }
    });
    //!END: Admin Check
  });
};

module.exports = socketIo;

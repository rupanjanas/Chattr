const express = require("express");
const Message = require("../models/chatModel");
const { protect } = require("../middleware/authMiddleware");
const messageRouter = express.Router();

const createMessageRouter = (io) => {
  // Send a message
  messageRouter.post("/", protect, async (req, res) => {
    try {
      const { content, groupId } = req.body;
      const message = await Message.create({
        sender: req.user._id,
        content,
        group: groupId,
      });

      const populatedMessage = await Message.findById(message._id).populate(
        "sender",
        "username email"
      );

      if (io) {
        io.to(groupId).emit("message received", populatedMessage);
      }

      res.json(populatedMessage);
    } catch (error) 
      res.status(400).json({ message: error.message });
    }
  });

  messageRouter.get("/:groupId", protect, async (req, res) => {
    try {
      const messages = await Message.find({ group: req.params.groupId })
        .populate("sender", "username email")
        .sort({ createdAt: 1 });
      res.json(messages);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  return messageRouter;
};

module.exports = createMessageRouter;

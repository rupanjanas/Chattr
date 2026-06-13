const express = require("express");
const Group = require("../models/GroupModel");
const { protect } = require("../middleware/authMiddleware");
const groupRouter = express.Router();

// Create a new group
groupRouter.post("/", protect, async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.create({
      name,
      description,
      admin: req.user._id,
      members: [req.user._id],
    });
    const populatedGroup = await Group.findById(group._id)
      .populate("admin", "username email")
      .populate("members", "username email");
    res.status(201).json({ populatedGroup });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: error.message });
  }
});

// Get all groups
groupRouter.get("/", protect, async (req, res) => {
  try {
    const groups = await Group.find()
      .populate("admin", "username email")
      .populate("members", "username email");
    res.json(groups);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Join a group
groupRouter.post("/:groupId/join", protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ message: "Already a member of this group" });
    }
    group.members.push(req.user._id);
    await group.save();
    res.json({ message: "Successfully joined this group" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ✅ IMPROVEMENT: Transfer admin ownership before leaving
// Admin must call this route first, passing newAdminId in the body.
// Only after a successful transfer can the admin call the leave route.
groupRouter.post("/:groupId/transfer-admin", protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only the current admin can transfer ownership
    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the admin can transfer ownership" });
    }

    const { newAdminId } = req.body;
    if (!newAdminId) {
      return res.status(400).json({ message: "newAdminId is required" });
    }

    // New admin must already be a member of the group
    const isMember = group.members.some(
      (memberId) => memberId.toString() === newAdminId.toString()
    );
    if (!isMember) {
      return res.status(400).json({ message: "New admin must be an existing member of the group" });
    }

    // Cannot transfer to yourself
    if (newAdminId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You are already the admin" });
    }

    group.admin = newAdminId;
    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate("admin", "username email")
      .populate("members", "username email");

    res.json({ message: "Admin transferred successfully", group: updatedGroup });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Leave a group
// ✅ IMPROVEMENT: Admin can now leave AFTER transferring ownership via /transfer-admin
// If they haven't transferred yet, they still get a clear error message.
groupRouter.post("/:groupId/leave", protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.members.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: "Not a member of this group" });
    }

    // ✅ Block admin from leaving without transferring first
    if (group.admin.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message:
          "You are the admin. Please transfer ownership to another member using /transfer-admin before leaving.",
      });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== req.user._id.toString()
    );
    await group.save();
    res.json({ message: "Successfully left the group" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = groupRouter;

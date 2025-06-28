const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      default: "system-notification",
    },
    url: {
      type: String,
      default: "/",
    },
    type: {
      type: String,
      default: "system",
    },
    icon: {
      type: String,
      default: "/Logo_ACS.png",
    },
    badge: {
      type: String,
      default: "/Logo_ACS.png",
    },
    totalSent: {
      type: Number,
      default: 0,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
    totalErrors: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);

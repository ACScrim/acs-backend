// filepath: d:\Dev\ACS\acs-backend\src\models\User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: {
    type: String,
    enum: ["admin", "user", "superadmin"],
    default: "user",
  },
  discordId: { type: String },
  stats: {
    bestGame: { type: String },
    bestScore: { type: Number },
    pointsRatio: { type: Number },
  },
  accessToken: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  avatarUrl: {
    type: String,
  },
  profile: {
    twitchUsername: { type: String, default: null },
    twitchSubscriptionId: { type: String, default: null },
    gameRoles: [
      {
        gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game" },
        enabled: { type: Boolean, default: false },
      },
    ],
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;

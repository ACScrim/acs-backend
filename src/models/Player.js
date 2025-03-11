const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const playerSchema = new Schema({
  username: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  discordId: { type: String, default: null },
  gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
  tier: {
    type: Number,
    enum: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
    required: true,
  },
});

const Player = mongoose.model("Player", playerSchema);

module.exports = Player;

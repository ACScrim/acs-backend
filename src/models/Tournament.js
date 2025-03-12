const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, required: true },
  players: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
      username: { type: String, required: true },
    },
  ],
  teams: [
    {
      name: { type: String, required: true },
      players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      score: { type: Number, default: 0 },
    },
  ],
  winningTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

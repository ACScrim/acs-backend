const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  teams: [
    {
      name: { type: String, required: true },
      players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      score: { type: Number, default: 0 },
    },
  ],
  winningTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  finished: { type: Boolean, default: false },
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

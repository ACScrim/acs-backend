const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], // On garde les IDs
  score: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 },
});

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: "Player" }], // On garde les IDs
  teams: [teamSchema],
  winningTeam: { type: teamSchema },
  finished: { type: Boolean, default: false },
  description: { type: String },
  checkIns: {
    type: Map,
    of: Boolean, // Clé = ID du joueur, Valeur = true/false
    default: {},
  },
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

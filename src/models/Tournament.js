const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const playerSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  checkedIn: { type: Boolean, default: false },
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [playerSchema],
  score: { type: Number, default: 0 },
});

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, required: true },
  players: [playerSchema],
  teams: [teamSchema], // Utilisation du schéma de sous-document pour les équipes
  winningTeam: { type: teamSchema }, // Utilisation du schéma de sous-document pour l'équipe gagnante
  finished: { type: Boolean, default: false },
  description: { type: String },
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

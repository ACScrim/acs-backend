const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  score: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 },
});

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  waitlistPlayers: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  playerCap: { type: Number, default: 0 }, // Nombre maximum de joueurs (0 = illimité)
  teams: [teamSchema],
  teamsPublished: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  description: { type: String },
  checkIns: {
    type: Map,
    of: Boolean,
    default: {},
  },
  registrationDates: {
    type: Map,
    of: Date,
    default: {},
  },
  waitlistRegistrationDates: {
    // Dates d'inscription en liste d'attente
    type: Map,
    of: Date,
    default: {},
  },
  // Dates de rappel personnalisées
  discordReminderDate: {
    type: Date,
    default: null, // Sera calculée par défaut à partir de la date du tournoi
  },
  privateReminderDate: {
    type: Date,
    default: null, // Sera calculée par défaut à partir de la date du tournoi
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  reminderSentPlayers: {
    type: Boolean,
    default: false,
  },
  messageId: {
    type: String,
    default: null,
  },
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  score: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 },
});

const mvpSchema = new mongoose.Schema({
  player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
  votes: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  isMvp: { type: Boolean, default: false }
});

const clipSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: { type: String },
  addedBy: { type: Schema.Types.ObjectId, ref: "Player" },
  addedAt: { type: Date, default: Date.now }
})

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
  mvps: [mvpSchema],
  mvpVoteOpen: {
    type: Boolean,
    default: true,
  },
  casters: [{ type: Schema.Types.ObjectId, ref: "Player" }],
  clips: [clipSchema]
});

const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
module.exports = Tournament;

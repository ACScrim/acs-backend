const mongoose = require("mongoose");

const playerGameLevelSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    required: true,
  },
  level: {
    type: String,
    enum: ["débutant", "intermédiaire", "avancé", "expert"],
    required: true,
  },
  // Nouveau champ pour le pseudo dans le jeu
  gameUsername: {
    type: String,
    trim: true,
  },
  // Nouveau champ pour savoir si le joueur est classé
  isRanked: {
    type: Boolean,
    default: false,
  },
  // Nouveau champ pour le rang du joueur
  rank: {
    type: String,
    trim: true,
  },
  // Commentaire ou notes sur l'expérience
  comment: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index composé pour assurer l'unicité de la paire joueur-jeu
playerGameLevelSchema.index({ player: 1, game: 1 }, { unique: true });

const PlayerGameLevel = mongoose.model(
  "PlayerGameLevel",
  playerGameLevelSchema
);
module.exports = PlayerGameLevel;

// filepath: d:\Dev\ACS\acs-backend\src\models\GameProposal.js
const mongoose = require("mongoose");

const gameProposalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  rawgId: {
    type: Number,
    default: null,
  },
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  votes: [
    {
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      value: {
        type: Number,
        enum: [1, -1], // 1 pour upvote, -1 pour downvote
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalVotes: {
    type: Number,
    default: 0,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 jours par défaut
  },
});

// Calcul du total des votes
// OPTIMISER:
gameProposalSchema.methods.calculateVotes = function () {
  // Utiliser reduce au lieu d'une boucle forEach
  this.totalVotes = this.votes.reduce((total, vote) => total + vote.value, 0);
  return this.totalVotes;
};

// Index pour la recherche
gameProposalSchema.index({ name: "text", description: "text" });

const GameProposal = mongoose.model("GameProposal", gameProposalSchema);
module.exports = GameProposal;

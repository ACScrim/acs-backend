const express = require("express");
const {
  createProposal,
  getProposals,
  voteProposal,
  moderateProposal,
  searchGames,
  deleteProposal,
} = require("../controllers/gameProposalController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

// Routes publiques
router.get("/", protect, getProposals);

// Routes authentifiées
router.post("/", protect, createProposal);
router.post("/:proposalId/vote", protect, voteProposal);
router.delete("/:proposalId", protect, admin, deleteProposal);
// Routes admin
router.patch("/:proposalId/moderate", protect, admin, moderateProposal);

// Recherche de jeux
router.get("/search", protect, searchGames);

module.exports = router;

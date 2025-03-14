const express = require("express");
const {
  createTournament,
  updateTournament,
  deleteTournament,
  getTournaments,
  getTournamentById,
  getTournamentsByGame,
  finishTournament,
  generateTeams,
  updateTeamScore, // Importer la nouvelle méthode du contrôleur
} = require("../controllers/tournamentController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

router
  .route("/")
  .get(protect, getTournaments)
  .post(protect, admin, createTournament);

router
  .route("/:id")
  .get(protect, getTournamentById)
  .put(protect, admin, updateTournament)
  .delete(protect, admin, deleteTournament);

router.route("/game/:gameId").get(protect, getTournamentsByGame);
router.route("/:id/finish").put(protect, admin, finishTournament);

router.route("/:id/generate-teams").post(protect, admin, generateTeams);

// Nouvelle route pour mettre à jour le score d'une équipe
router.route("/:id/teams/:teamId/score").put(protect, admin, updateTeamScore);

module.exports = router;

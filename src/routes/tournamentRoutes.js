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
  updateTeamScore,
  registerPlayer,
  unregisterPlayer,
  checkInPlayer,
  updateTeamRanking,
  createDiscordChannels,
  updateTournamentTeams,
  markTournamentAsFinished,
  unmarkTournamentAsFinished,
  deleteAllTeams,
  toggleTeamsPublication,
  voteForMvp, // Ajouter l'import de la nouvelle fonction
} = require("../controllers/tournamentController");
const { protect, admin } = require("../middleware/authMiddleware");
const { create } = require("connect-mongo");
const router = express.Router();

router.route("/").get(getTournaments).post(protect, admin, createTournament);

router
  .route("/:id")
  .get(getTournamentById)
  .put(protect, admin, updateTournament)
  .delete(protect, admin, deleteTournament);
router.put("/:id/teams", admin, updateTournamentTeams);

// Nouvelle route pour la publication des équipes
router.put("/:id/publish-teams", protect, admin, toggleTeamsPublication);

router.route("/game/:gameId").get(protect, getTournamentsByGame);
router.route("/:id/finish").put(protect, admin, finishTournament);

router.route("/:id/generate-teams").post(protect, admin, generateTeams);

// Nouvelle route pour inscrire un joueur à un tournoi
router.route("/:id/register").post(protect, registerPlayer);
router.route("/:id/unregister").post(protect, unregisterPlayer); // Ajout de la route unregister
router.put("/:id/unmark-finished", unmarkTournamentAsFinished);
// Nouvelle route pour mettre à jour le score d'une équipe
router.route("/:id/teams/:teamId/score").put(protect, admin, updateTeamScore);

router
  .route("/:id/mark-finished")
  .put(protect, admin, markTournamentAsFinished);

// Nouvelle route pour le check-in d'un joueur
router.route("/:id/check-in").post(protect, checkInPlayer);

router.put("/:id/teams/:teamId/ranking", updateTeamRanking);

router.post("/create-discord-channels", createDiscordChannels);
router.route("/:id/delete-teams").delete(protect, admin, deleteAllTeams);

router.route("/:id/vote-mvp").post(protect, voteForMvp);
module.exports = router;

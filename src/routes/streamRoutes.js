const express = require("express");
const router = express.Router();
const streamController = require("../controllers/streamController");
const { protect } = require("../middleware/authMiddleware");

// ========================================
// ROUTES PUBLIQUES (avec authentification)
// ========================================

/**
 * GET /api/streams/tournament/:tournamentId
 * Récupère les streams en live pour un tournoi spécifique
 */
router.get(
  "/tournament/:tournamentId",
  protect,
  streamController.getTournamentStreams
);

/**
 * GET /api/streams/all
 * Récupère tous les streams en live des utilisateurs ACS
 */
router.get("/all", protect, streamController.getAllLiveStreams);

/**
 * GET /api/streams/streamer/:twitchUsername
 * Récupère les infos d'un streamer spécifique
 */
router.get(
  "/streamer/:twitchUsername",
  protect,
  streamController.getStreamerInfo
);

// ========================================
// ROUTES D'ADMINISTRATION
// ========================================

/**
 * GET /api/streams/test-connection
 * Teste la connexion avec l'API Twitch
 */
router.get("/test-connection", protect, streamController.testTwitchConnection);

/**
 * GET /api/streams/tournament/:tournamentId/debug
 * Récupère les participants d'un tournoi spécifique (mode debug)
 */
router.get(
  "/tournament/:tournamentId/debug",
  protect,
  streamController.getTournamentParticipantsDebug
);

module.exports = router;

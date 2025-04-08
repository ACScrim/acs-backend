const express = require("express");
const router = express.Router();
const seasonController = require("../controllers/seasonController");
const { protect, admin } = require("../middleware/authMiddleware");

// Routes publiques
router.get("/", seasonController.getAllSeasons);
router.get("/current", seasonController.getCurrentSeason);
router.get("/:id", seasonController.getSeasonById);
router.get("/:id/ranking", seasonController.getSeasonRanking);
router.get(
  "/:id/available-tournaments",
  seasonController.getAvailableTournaments
);

// Routes protégées (admin seulement)
router.post("/", protect, admin, seasonController.createSeason);
router.put("/:id", protect, admin, seasonController.updateSeason);
router.delete("/:id", protect, admin, seasonController.deleteSeason);
router.post(
  "/:id/tournaments",
  protect,
  admin,
  seasonController.addTournamentToSeason
);
router.delete(
  "/:id/tournaments/:tournamentId",
  protect,
  admin,
  seasonController.removeTournamentFromSeason
);

module.exports = router;

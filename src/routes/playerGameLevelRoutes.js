const express = require("express");
const router = express.Router();
const playerGameLevelController = require("../controllers/playerGameLevelController");
const { protect } = require("../middleware/authMiddleware");

// Routes publiques - accessible à tous
router.get("/player/:playerId", playerGameLevelController.getPlayerLevels);
router.get(
  "/player/:playerId/game/:gameId",
  playerGameLevelController.getPlayerLevelForGame
);
router.get("/game/:gameId", playerGameLevelController.getPlayerLevelsByGame);

// Routes protégées - nécessitent une authentification
router.post(
  "/player/:playerId/game/:gameId",
  protect,
  playerGameLevelController.setPlayerLevel
);
router.delete(
  "/player/:playerId/game/:gameId",
  protect,
  playerGameLevelController.deletePlayerLevel
);

module.exports = router;

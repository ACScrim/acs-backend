const express = require("express");
const {
  getGames,
  addGame,
  updateGame,
  deleteGame,
} = require("../controllers/gameController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

router.route("/").get(protect, getGames).post(protect, admin, addGame);

router
  .route("/:id")
  .put(protect, admin, updateGame)
  .delete(protect, admin, deleteGame);

module.exports = router;

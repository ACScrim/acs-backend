const express = require("express");
const {
  getPlayers,
  addPlayer,
  updatePlayer,
  deletePlayer,
} = require("../controllers/playerController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

router.route("/").get(protect, getPlayers).post(protect, admin, addPlayer);

router
  .route("/:id")
  .put(protect, admin, updatePlayer)
  .delete(protect, admin, deletePlayer);

module.exports = router;

const express = require("express");
const {
  getPlayers,
  addPlayer,
  deletePlayer,
} = require("../controllers/playerController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

router.route("/").get(protect, getPlayers).post(protect, admin, addPlayer);

router.route("/:id").delete(protect, admin, deletePlayer);

module.exports = router;

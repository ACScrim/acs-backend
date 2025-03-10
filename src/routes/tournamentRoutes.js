// filepath: d:\Dev\ACS\acs-backend\src\routes\tournamentRoutes.js
const express = require("express");
const {
  getTournaments,
  addTournament,
  getTournament,
  updateTournament,
  deleteTournament,
} = require("../controllers/tournamentController");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

router
  .route("/")
  .get(protect, getTournaments)
  .post(protect, admin, addTournament);

router
  .route("/:id")
  .get(protect, getTournament)
  .put(protect, admin, updateTournament)
  .delete(protect, admin, deleteTournament);

module.exports = router;

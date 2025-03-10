// filepath: d:\Dev\ACS\acs-backend\src\controllers\tournamentController.js
const Tournament = require("../models/Tournament");

exports.getTournaments = async (req, res) => {
  const tournaments = await Tournament.find()
    .populate("players")
    .populate("teams.players")
    .populate("game");
  res.json(tournaments);
};

exports.addTournament = async (req, res) => {
  const { name, game, date, players, teams } = req.body;
  const tournament = new Tournament({ name, game, date, players, teams });
  await tournament.save();
  res.status(201).json(tournament);
};

exports.getTournament = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("players")
    .populate("teams.players")
    .populate("game");
  if (tournament) {
    res.json(tournament);
  } else {
    res.status(404).json({ message: "Tournament not found" });
  }
};

exports.updateTournament = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);

  if (tournament) {
    tournament.name = req.body.name || tournament.name;
    tournament.game = req.body.game || tournament.game;
    tournament.date = req.body.date || tournament.date;
    tournament.players = req.body.players || tournament.players;
    tournament.teams = req.body.teams || tournament.teams;
    const updatedTournament = await tournament.save();
    res.json(updatedTournament);
  } else {
    res.status(404).json({ message: "Tournament not found" });
  }
};

exports.deleteTournament = async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);

  if (tournament) {
    await tournament.remove();
    res.json({ message: "Tournament removed" });
  } else {
    res.status(404).json({ message: "Tournament not found" });
  }
};

const Tournament = require("../models/Tournament");
const Player = require("../models/Player");
const Game = require("../models/Game");

exports.createTournament = async (req, res) => {
  try {
    const { name, game, date, discordChannelName, players } = req.body;

    // Récupérer les informations des joueurs à partir de leurs IDs
    const playerDetails = await Player.find({ _id: { $in: players } });

    const newTournament = new Tournament({
      name,
      game,
      date,
      discordChannelName,
      players: playerDetails.map((player) => ({
        _id: player._id,
        username: player.username,
      })), // Utiliser les objets complets des joueurs
    });

    await newTournament.save();
    res.status(201).json(newTournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la création du tournoi", error });
  }
};

exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, discordChannelName, players, teams, winningTeam } =
      req.body;

    const updatedTournament = await Tournament.findByIdAndUpdate(
      id,
      { name, date, discordChannelName, players, teams, winningTeam },
      { new: true }
    );

    res.status(200).json(updatedTournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du tournoi", error });
  }
};

exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    await Tournament.findByIdAndDelete(id);
    res.status(200).json({ message: "Tournoi supprimé avec succès" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du tournoi", error });
  }
};

exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find().populate(
      "game players teams.players winningTeam"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id).populate(
      "game players teams.players winningTeam"
    );
    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du tournoi", error });
  }
};

exports.getTournamentsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const tournaments = await Tournament.find({ game: gameId }).populate(
      "game players teams.players winningTeam"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

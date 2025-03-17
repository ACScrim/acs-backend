const Tournament = require("../models/Tournament");
const Player = require("../models/Player");
const Game = require("../models/Game");
const User = require("../models/User");

// Créer un tournoi
exports.createTournament = async (req, res) => {
  try {
    const { name, game, date, discordChannelName, players, description } =
      req.body;

    const newTournament = new Tournament({
      name,
      game,
      date,
      discordChannelName,
      players,
      description,
    });

    await newTournament.save();
    res.status(201).json(newTournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la création du tournoi", error });
  }
};

// Mettre à jour un tournoi
exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      date,
      discordChannelName,
      players,
      teams,
      winningTeam,
      description,
    } = req.body;

    const updatedTournament = await Tournament.findByIdAndUpdate(
      id,
      {
        name,
        date,
        discordChannelName,
        players,
        teams,
        winningTeam,
        description,
      },
      { new: true }
    );

    res.status(200).json(updatedTournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du tournoi", error });
  }
};

// Supprimer un tournoi par son identifiant
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

// Récupérer tous les tournois
exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find().populate(
      "game players teams.players winningTeam description"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    console.error("Erreur lors de la récupération des tournois:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

// Récupérer un tournoi par son identifiant
exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id).populate(
      "game players teams.players winningTeam description"
    );
    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du tournoi", error });
  }
};

// Récupérer les tournois par jeu
exports.getTournamentsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const tournaments = await Tournament.find({ game: gameId }).populate(
      "game players teams.players"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

// Terminer un tournoi et déclarer une équipe gagnante
exports.finishTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { winningTeamId } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const winningTeam = tournament.teams.id(winningTeamId);
    if (!winningTeam) {
      return res.status(404).json({ message: "Équipe gagnante non trouvée" });
    }

    tournament.finished = true;
    tournament.winningTeam = winningTeam;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la finalisation du tournoi", error });
  }
};

// Générer des équipes aléatoire en fonction d'un nombre d'équipes donné
exports.generateTeams = async (req, res) => {
  try {
    const { id } = req.params;
    const { numTeams } = req.body;
    const tournament = await Tournament.findById(id).populate("players");

    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const players = [...tournament.players];
    const teams = [];

    for (let i = 0; i < numTeams; i++) {
      teams.push({ name: `Équipe ${i + 1}`, players: [] });
    }

    while (players.length > 0) {
      for (let i = 0; i < teams.length && players.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * players.length);
        teams[i].players.push(players.splice(randomIndex, 1)[0]);
      }
    }

    tournament.teams = teams;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la génération des équipes", error });
  }
};

// Mettre à jour le score d'une équipe
exports.updateTeamScore = async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { score } = req.body;

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const team = tournament.teams.id(teamId);

    if (!team) {
      return res.status(404).json({ message: "Équipe non trouvée" });
    }

    team.score = score;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du score de l'équipe",
      error,
    });
  }
};

// Inscrire un joueur à un tournoi
exports.registerPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Chercher l'utilisateur correspondant à l'ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Chercher le joueur correspondant à l'ID de l'utilisateur
    const player = await Player.findOne({ userId: userId });
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    // Chercher le tournoi correspondant à l'ID
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Ajouter le joueur au tournoi s'il n'est pas déjà inscrit
    if (!tournament.players.includes(player._id)) {
      tournament.players.push(player._id);
      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    console.error("Erreur lors de l'inscription au tournoi:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'inscription au tournoi", error });
  }
};

// Désinscrire un joueur d'un tournoi
exports.unregisterPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Chercher l'utilisateur correspondant à l'ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Chercher le joueur correspondant à l'ID de l'utilisateur
    const player = await Player.findOne({ userId: userId });
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    // Chercher le tournoi correspondant à l'ID
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Retirer le joueur du tournoi s'il est inscrit
    const playerIndex = tournament.players.indexOf(player._id);
    if (playerIndex !== -1) {
      tournament.players.splice(playerIndex, 1);
      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    console.error("Erreur lors de la désinscription du tournoi:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la désinscription du tournoi", error });
  }
};

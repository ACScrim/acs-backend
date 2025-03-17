const Tournament = require("../models/Tournament");
const Player = require("../models/Player");
const User = require("../models/User");

// Créer un tournoi
exports.createTournament = async (req, res) => {
  try {
    const { name, game, date, discordChannelName, players, description } =
      req.body;

    // Extraire uniquement les IDs des joueurs
    const playerIds = players.map((player) => player._id);

    // Initialiser la propriété checkIns avec les IDs des joueurs et la valeur false par défaut
    const checkIns = {};
    playerIds.forEach((id) => {
      checkIns[id] = false;
    });

    const newTournament = new Tournament({
      name,
      game,
      date,
      discordChannelName,
      players: playerIds,
      checkIns,
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

    // Extraire uniquement les IDs des joueurs
    const playerIds = players.map((player) => player._id);

    // Initialiser la propriété checkIns avec les IDs des joueurs et la valeur false par défaut
    const checkIns = {};
    playerIds.forEach((id) => {
      checkIns[id] = false;
    });

    const updatedTournament = await Tournament.findByIdAndUpdate(
      id,
      {
        name,
        date,
        discordChannelName,
        players: playerIds,
        teams,
        winningTeam,
        checkIns,
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

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const player = await Player.findOne({ userId: userId });
    if (!player) return res.status(404).json({ message: "Joueur non trouvé" });

    const tournament = await Tournament.findById(id);
    if (!tournament)
      return res.status(404).json({ message: "Tournoi non trouvé" });

    if (!tournament.players.includes(player._id)) {
      tournament.players.push(player._id);
      tournament.checkIns.set(player._id, false); // Ajout dans checkIns avec "false"
      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de l'inscription au tournoi", error });
  }
};

// Désinscrire un joueur d'un tournoi
// Désinscrire un joueur d'un tournoi
exports.unregisterPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const player = await Player.findOne({ userId: userId });
    if (!player) return res.status(404).json({ message: "Joueur non trouvé" });

    const tournament = await Tournament.findById(id);
    if (!tournament)
      return res.status(404).json({ message: "Tournoi non trouvé" });

    const playerIndex = tournament.players.indexOf(player._id);
    if (playerIndex !== -1) {
      tournament.players.splice(playerIndex, 1);
      tournament.checkIns.delete(player._id); // Supprime le check-in
      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la désinscription du tournoi", error });
  }
};

// Check-in ou uncheck-in un joueur à un tournoi
exports.checkInPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, checkedIn } = req.body;

    // Récupérer le playerId à partir du userId
    const player = await Player.findOne({ userId: userId });
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    const playerId = player._id;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    if (!tournament.players.includes(playerId)) {
      return res.status(404).json({ message: "Joueur non inscrit au tournoi" });
    }

    tournament.checkIns.set(playerId, checkedIn);
    await tournament.save();

    res.status(200).json({ message: "Check-in mis à jour", tournament });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors du check-in", error });
  }
};

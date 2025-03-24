const Player = require("../models/Player");
const User = require("../models/User");
const Tournament = require("../models/Tournament");
// Récupérer la liste des joueurs
exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des joueurs" });
  }
};

// Récupérer un joueur par son ID
exports.getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate("badges");

    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    res.json(player);
  } catch (error) {
    console.error("Erreur lors de la récupération du joueur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du joueur" });
  }
};

// Ajouter un joueur
exports.addPlayer = async (req, res) => {
  const { username } = req.body;

  try {
    // Vérifier si un joueur avec le même username existe déjà (insensible à la casse)
    const existingPlayer = await Player.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    });
    if (existingPlayer) {
      return res.status(400).json({ message: "Le joueur existe déjà" });
    }

    const player = new Player({ username });
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la création du joueur" });
  }
};

// Supprimer un joueur
exports.deletePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    await Player.deleteOne({ _id: req.params.id });
    res.json({ message: "Joueur supprimé" });
  } catch (error) {
    console.error("Erreur lors de la suppression du joueur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du joueur" });
  }
};

exports.searchPlayers = async (req, res) => {
  try {
    const { search } = req.query;

    const players = await Player.find({
      username: { $regex: search, $options: "i" },
    });

    res.status(200).json(players);
  } catch (error) {
    console.error("Erreur lors de la recherche des joueurs:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la recherche des joueurs", error });
  }
};

// Endpoint pour synchroniser les joueurs avec les utilisateurs
exports.synchronizePlayers = async (req, res) => {
  try {
    const users = await User.find();
    const players = await Player.find();

    for (const player of players) {
      const normalizedUsername = player.username.toLowerCase();
      const user = users.find(
        (user) => user.username.toLowerCase() === normalizedUsername
      );

      if (user) {
        player.discordId = user.discordId;
        player.userId = user._id;
        await player.save();
      }
    }

    res.status(200).json({ message: "Synchronisation réussie" });
  } catch (error) {
    console.error("Erreur lors de la synchronisation:", error);
    res.status(500).json({ message: "Erreur lors de la synchronisation" });
  }
};

// Endpoint pour mettre à jour le nom d'utilisateur d'un joueur
exports.updatePlayerUsername = async (req, res) => {
  const { playerId, username } = req.body;

  try {
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    player.username = username;
    await player.save();

    res.status(200).json(player);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du nom d'utilisateur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du nom d'utilisateur" });
  }
};

// Endpoint pour récupérer le classement des joueurs
exports.getPlayerRankings = async (req, res) => {
  try {
    const players = await Player.find();
    const tournaments = await Tournament.find({ finished: true }).populate(
      "teams.players"
    );

    const playerRankings = players.map((player) => {
      // Filtrer les tournois auxquels le joueur a participé
      const playerTournaments = tournaments.filter((tournament) =>
        tournament.teams.some((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        )
      );
      // Calculer le total des points
      const totalPoints = playerTournaments.reduce((sum, tournament) => {
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );
        const points = playerTeam ? playerTeam.score || 0 : 0;
        return sum + points;
      }, 0);

      // Vérifier explicitement les victoires basées sur le ranking
      const victoriesWithDetails = playerTournaments.filter((tournament) => {
        // Trouver l'équipe du joueur dans ce tournoi
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );

        // Vérifier si cette équipe a un ranking de 1
        const isWinner = playerTeam && playerTeam.ranking === 1;

        return isWinner;
      });

      // Compter le nombre de victoires
      const totalVictories = victoriesWithDetails.length;

      // Détails des tournois auxquels le joueur a participé
      const tournamentsParticipated = playerTournaments.map((tournament) => {
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );

        const rank = playerTeam ? playerTeam.ranking || null : null;
        const numberOfTeams = tournament.teams ? tournament.teams.length : 0;

        return {
          _id: tournament._id,
          name: tournament.name,
          date: tournament.date,
          game: tournament.game,
          rank: rank,
          teamName: playerTeam ? playerTeam.name : "Équipe inconnue",
          numberOfTeams: numberOfTeams,
          // L'équipe gagnante est désormais déterminée par le ranking=1
          isWinner: playerTeam && playerTeam.ranking === 1,
        };
      });

      return {
        playerId: player._id,
        username: player.username,
        totalPoints,
        totalTournaments: playerTournaments.length,
        totalVictories,
        tournamentsParticipated,
      };
    });

    // Filtrer les joueurs qui ont participé à au moins un tournoi
    const activePlayerRankings = playerRankings.filter(
      (p) => p.totalTournaments > 0
    );

    // Trier les joueurs par victoires, puis points
    activePlayerRankings.sort((a, b) => {
      if (b.totalVictories !== a.totalVictories) {
        return b.totalVictories - a.totalVictories;
      }
      return b.totalPoints - a.totalPoints;
    });

    res.status(200).json(activePlayerRankings);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du classement des joueurs:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération du classement des joueurs",
      error,
    });
  }
};
// Endpoint pour récupérer le classement des joueurs par jeu
// Endpoint pour récupérer le classement des joueurs par jeu
exports.getPlayerRankingsByGame = async (req, res) => {
  const { gameId } = req.params;
  try {
    const players = await Player.find();
    const tournaments = await Tournament.find({
      game: gameId,
      finished: true, // Uniquement les tournois terminés
    }).populate("teams.players");

    const playerRankings = players.map((player) => {
      // Filtrer les tournois auxquels le joueur a participé
      const playerTournaments = tournaments.filter((tournament) =>
        tournament.teams.some((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        )
      );

      // Calculer le total des points
      const totalPoints = playerTournaments.reduce((sum, tournament) => {
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );
        const points = playerTeam ? playerTeam.score || 0 : 0;
        return sum + points;
      }, 0);

      // Calculer les victoires en utilisant le ranking des équipes
      const totalVictories = playerTournaments.filter((tournament) => {
        // Trouver l'équipe du joueur dans ce tournoi
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );

        // Vérifier si cette équipe a un ranking de 1 (gagnante)
        return playerTeam && playerTeam.ranking === 1;
      }).length;

      // Détails des tournois auxquels le joueur a participé
      const tournamentsParticipated = playerTournaments.map((tournament) => {
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) =>
              p._id && player._id && p._id.toString() === player._id.toString()
          )
        );

        const rank = playerTeam ? playerTeam.ranking || null : null;
        const numberOfTeams = tournament.teams ? tournament.teams.length : 0;

        return {
          _id: tournament._id,
          name: tournament.name,
          date: tournament.date,
          rank: rank,
          teamName: playerTeam ? playerTeam.name : "Équipe inconnue",
          numberOfTeams: numberOfTeams,
          isWinner: playerTeam && playerTeam.ranking === 1,
        };
      });

      return {
        playerId: player._id,
        username: player.username,
        totalPoints,
        totalTournaments: playerTournaments.length,
        totalVictories,
        tournamentsParticipated,
      };
    });

    // Filtrer les joueurs qui ont participé à au moins un tournoi
    const activePlayerRankings = playerRankings.filter(
      (p) => p.totalTournaments > 0
    );

    // Trier d'abord par victoires, puis par points
    activePlayerRankings.sort((a, b) => {
      if (b.totalVictories !== a.totalVictories) {
        return b.totalVictories - a.totalVictories;
      }
      return b.totalPoints - a.totalPoints;
    });

    res.status(200).json(activePlayerRankings);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du classement par jeu:",
      error
    );
    res.status(500).json({
      message:
        "Erreur lors de la récupération du classement des joueurs par jeu",
      error: error.message,
    });
  }
};

// Récupérer un joueur par userId
exports.getPlayerByIdUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    res.status(200).json(player);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du joueur", error });
  }
};

exports.getPlayerProfile = async (req, res) => {
  try {
    const playerId = req.params.id;
    const player = await Player.findById(playerId).populate("badges");
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    res.status(200).json(player);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération du profil du joueur",
      error,
    });
  }
};

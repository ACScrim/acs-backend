const Player = require("../models/Player");
const User = require("../models/User");
const Tournament = require("../models/Tournament");
const Season = require("../models/Season");
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
    const tournaments = await Tournament.find({ finished: true })
      .populate("teams.players")
      .populate("game");

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

        const isMvp = tournament.mvps.find(
          (mvp) => mvp.player.toString() === player._id.toString()
        )?.isMvp || false;

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
          isMvp,
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

// Récupérer les statistiques étendues d'un joueur
exports.getExtendedStats = async (req, res) => {
  try {
    const playerId = req.params.id;

    // Récupérer le joueur
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    // Récupérer tous les tournois où le joueur a participé
    const tournaments = await Tournament.find({
      $or: [{ players: playerId }, { "teams.players": playerId }],
    })
      .populate("game", "name imageUrl")
      .populate("teams.players", "username")
      .sort({ date: 1 }); // Trier par date croissante

    // Calculer memberSince (date du premier tournoi)
    const memberSince =
      tournaments.length > 0
        ? tournaments[0].date
        : player.createdAt || new Date();

    // Calculer lastSeen (date du dernier tournoi participé)
    const lastSeen =
      tournaments.length > 0
        ? tournaments[tournaments.length - 1].date
        : player.updatedAt || new Date();

    // Calculer participationStreak (nombre de tournois consécutifs récents)
    const participationStreak = calculateParticipationStreak(tournaments);

    // Statistiques par jeu
    const gameStats = calculateGameStats(tournaments, playerId);

    // Statistiques sociales
    const socialStats = calculateSocialStats(tournaments, playerId);

    // Records personnels
    const records = calculatePersonalRecords(tournaments, playerId);

    const extendedStats = {
      memberSince,
      lastSeen,
      participationStreak,
      gameStats,
      socialStats,
      records,
    };

    res.status(200).json(extendedStats);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des statistiques étendues:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des statistiques étendues",
      error: error.message,
    });
  }
};

// Récupérer les championnats de saisons d'un joueur
exports.getPlayerSeasonChampionships = async (req, res) => {
  try {
    const playerId = req.params.id;

    // Récupérer toutes les saisons sauf la plus récente (numéro le plus élevé) et exclure la saison 0
    const allSeasons = await Season.find({ numero: { $ne: 0 } }).sort({
      numero: -1,
    });

    if (allSeasons.length <= 1) {
      // Si il n'y a qu'une seule saison ou aucune, pas de saisons passées
      return res.status(200).json([]);
    }

    // Exclure la saison actuelle (la première dans le tri décroissant)
    const pastSeasons = allSeasons.slice(1);

    const championships = [];

    for (const season of pastSeasons) {
      // Ignorer la saison 0 (saison spéciale)
      if (season.numero === 0) continue;

      // Récupérer le classement de cette saison
      const seasonWithTournaments = await Season.findById(season._id).populate({
        path: "tournois",
        populate: {
          path: "teams",
          populate: {
            path: "players",
          },
        },
      });

      if (!seasonWithTournaments || !seasonWithTournaments.tournois) continue;

      // Calculer les statistiques du joueur pour cette saison
      const playerStats = {
        totalVictories: 0,
        totalTournaments: 0,
      };

      for (const tournament of seasonWithTournaments.tournois) {
        if (!tournament.finished || !tournament.teams) continue;

        // Vérifier si le joueur a participé à ce tournoi
        const playerTeam = tournament.teams.find((team) =>
          team.players.some(
            (p) => p._id && p._id.toString() === playerId.toString()
          )
        );

        if (playerTeam) {
          playerStats.totalTournaments++;
          if (playerTeam.ranking === 1) {
            playerStats.totalVictories++;
          }
        }
      }

      // Calculer le classement pour cette saison
      const allPlayerStats = {};

      for (const tournament of seasonWithTournaments.tournois) {
        if (!tournament.finished || !tournament.teams) continue;

        for (const team of tournament.teams) {
          for (const player of team.players) {
            const pId = player._id.toString();

            if (!allPlayerStats[pId]) {
              allPlayerStats[pId] = {
                playerId: pId,
                username: player.username,
                totalVictories: 0,
                totalTournaments: 0,
              };
            }

            allPlayerStats[pId].totalTournaments++;
            if (team.ranking === 1) {
              allPlayerStats[pId].totalVictories++;
            }
          }
        }
      }

      // Trier les joueurs par victoires décroissantes
      const seasonRankings = Object.values(allPlayerStats)
        .filter((p) => p.totalTournaments > 0)
        .sort((a, b) => {
          if (b.totalVictories !== a.totalVictories) {
            return b.totalVictories - a.totalVictories;
          }
          return b.totalTournaments - a.totalTournaments;
        });

      // Vérifier si le joueur est champion de cette saison (1ère place)
      if (
        seasonRankings.length > 0 &&
        seasonRankings[0].playerId === playerId.toString()
      ) {
        championships.push({
          seasonNumber: season.numero,
          seasonId: season._id,
          totalVictories: playerStats.totalVictories,
          totalTournaments: playerStats.totalTournaments,
          isChampion: true,
        });
      }
    }

    res.status(200).json(championships);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des championnats de saisons:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des championnats de saisons",
      error: error.message,
    });
  }
};

// Fonctions helper pour calculer les statistiques
function calculateParticipationStreak(tournaments) {
  if (tournaments.length === 0) return 0;

  // Trier les tournois par date (plus récent en premier)
  const sortedTournaments = [...tournaments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Compter la série de participation en partant du plus récent
  let streak = 0;
  const now = new Date();

  for (const tournament of sortedTournaments) {
    const tournamentDate = new Date(tournament.date);

    // Si le tournoi est dans le futur, l'ignorer
    if (tournamentDate > now) continue;

    // Compter le tournoi dans la série
    streak++;
  }

  return streak;
}

function calculateGameStats(tournaments, playerId) {
  const gameStatsMap = new Map();

  tournaments.forEach((tournament) => {
    if (!tournament.finished) {
      return; // Passer au tournoi suivant
    }

    if (!tournament.teams || !tournament.game) return;

    const gameId = tournament.game._id.toString();
    const gameName = tournament.game.name;
    const gameImage = tournament.game.imageUrl;

    if (!gameStatsMap.has(gameId)) {
      gameStatsMap.set(gameId, {
        gameId,
        gameName,
        gameImage,
        wins: 0,
        losses: 0,
        totalPlayed: 0,
      });
    }

    const stats = gameStatsMap.get(gameId);
    stats.totalPlayed++;

    // Trouver l'équipe du joueur et son classement
    const playerTeam = tournament.teams?.find((team) =>
      team.players.some((p) => p._id?.toString() === playerId.toString())
    );

    if (playerTeam) {
      if (playerTeam.ranking === 1) {
        stats.wins++;
      } else if (playerTeam.ranking > 1) {
        stats.losses++;
      }
    }
  });

  // Convertir en tableau et calculer le taux de victoire
  const gameStatsArray = Array.from(gameStatsMap.values()).map((stats) => ({
    ...stats,
    winRate:
      stats.totalPlayed > 0
        ? Math.round((stats.wins / stats.totalPlayed) * 100)
        : 0,
  }));

  // Trier par nombre de victoires décroissant
  return gameStatsArray.sort((a, b) => b.wins - a.wins);
}

// Dans calculateSocialStats, vous pouvez simplifier :
function calculateSocialStats(tournaments, playerId) {
  const teammateStats = new Map();
  let teamsFormed = 0;

  tournaments.forEach((tournament) => {
    if (!tournament.teams) return;

    const playerTeam = tournament.teams.find((team) =>
      team.players.some((p) => p._id?.toString() === playerId.toString())
    );

    if (playerTeam) {
      teamsFormed++;
      const isWinningTeam = playerTeam.ranking === 1;

      playerTeam.players.forEach((teammate) => {
        if (teammate._id?.toString() !== playerId.toString()) {
          const teammateId = teammate._id?.toString();
          const username = teammate.username || "Joueur inconnu";

          if (!teammateStats.has(teammateId)) {
            teammateStats.set(teammateId, {
              playerId: teammateId,
              username: username,
              count: 0,
              wins: 0,
            });
          }

          const stats = teammateStats.get(teammateId);
          stats.count++;
          if (isWinningTeam) {
            stats.wins++;
          }
        }
      });
    }
  });

  const teammateArray = Array.from(teammateStats.values());

  // Coéquipiers fréquents - on peut supprimer le champ wins si pas utilisé
  const frequentTeammates = teammateArray
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(({ playerId, username, count }) => ({ playerId, username, count })); // ✅ Supprimer wins

  // Partenaires de victoire
  const winningPartners = teammateArray
    .filter((t) => t.wins >= 1)
    .sort((a, b) => b.wins - a.wins)
    .map(({ playerId, username, wins }) => ({ playerId, username, wins })); // ✅ Garder seulement wins

  return {
    teamsFormed,
    uniqueTeammates: teammateStats.size,
    frequentTeammates,
    winningPartners,
  };
}

function calculatePersonalRecords(tournaments, playerId) {
  let longestWinStreak = 0;
  let currentWinStreak = 0;

  tournaments.forEach((tournament) => {
    if (!tournament.teams) return;

    const playerTeam = tournament.teams.find((team) =>
      team.players.some((p) => p._id?.toString() === playerId.toString())
    );

    if (playerTeam) {
      // Calculer la série de victoires
      if (playerTeam.ranking === 1) {
        currentWinStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else {
        currentWinStreak = 0;
      }
    }
  });

  return {
    longestWinStreak,
  };
}

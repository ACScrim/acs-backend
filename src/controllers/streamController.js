const twitchStreamService = require("../services/twitchStreamService");
const Tournament = require("../models/Tournament");
const Player = require("../models/Player");
const User = require("../models/User");

/**
 * Récupère les streams en live pour un tournoi spécifique
 * ✅ MODIFIÉ : Inclut aussi les participants offline avec Twitch
 */
exports.getTournamentStreams = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId).populate(
      "players"
    );

    if (!tournament) {
      return res.status(404).json({
        message: "Tournoi non trouvé",
      });
    }

    // Vérifier que le tournoi est en cours
    const now = new Date();
    const tournamentDate = new Date(tournament.date);
    const isToday = tournamentDate.toDateString() === now.toDateString();

    if (!isToday) {
      return res.status(200).json({
        message: "Le tournoi ne se déroule pas aujourd'hui",
        liveStreams: [],
        allUsersWithTwitch: [], // ✅ CHANGÉ : tous les users, pas participants
        tournamentDate: tournament.date,
        isToday: false,
        participantsCount: tournament.players.length,
      });
    }

    // ✅ NOUVEAU : Récupérer TOUS les utilisateurs avec profil Twitch (pas seulement participants)
    const allUsersWithTwitch = await User.find({
      "profile.twitchUsername": { $exists: true, $ne: null },
    }).select("_id username profile.twitchUsername");

    if (allUsersWithTwitch.length === 0) {
      return res.status(200).json({
        message: "Aucun utilisateur n'a configuré son profil Twitch",
        liveStreams: [],
        allUsersWithTwitch: [], // ✅ NOUVEAU
        isToday: true,
        participantsCount: tournament.players.length,
      });
    }

    // Récupérer les streams en live pour tous les users avec Twitch
    const twitchUsernames = allUsersWithTwitch.map(
      (user) => user.profile.twitchUsername
    );
    const liveStreams = await twitchStreamService.getLiveStreams(
      twitchUsernames
    );

    // ✅ NOUVEAU : Créer la liste complète de tous les users avec Twitch
    const allUsersWithTwitchData = allUsersWithTwitch.map((user) => {
      // Vérifier s'il est en live
      const liveStream = liveStreams.find(
        (stream) =>
          stream.userName.toLowerCase() ===
          user.profile.twitchUsername.toLowerCase()
      );

      // ✅ BONUS : Vérifier s'il participe au tournoi
      const isParticipant = tournament.players.some(
        (player) =>
          player.userId && player.userId.toString() === user._id.toString()
      );

      return {
        userId: user._id,
        username: user.username,
        twitchUsername: user.profile.twitchUsername,
        isLive: !!liveStream,
        isParticipant, // ✅ BONUS : info si c'est un participant
        stream: liveStream || null,
      };
    });

    // Enrichir seulement les streams en live pour la compatibilité
    const enrichedStreams = liveStreams.map((stream) => {
      const user = allUsersWithTwitch.find(
        (u) =>
          u.profile.twitchUsername.toLowerCase() ===
          stream.userName.toLowerCase()
      );

      // Vérifier si c'est un participant du tournoi
      const isParticipant = tournament.players.some(
        (player) =>
          player.userId && player.userId.toString() === user._id.toString()
      );

      return {
        ...stream,
        userId: user._id,
        username: user.username,
        isParticipant, // ✅ BONUS
      };
    });

    res.status(200).json({
      tournamentId: tournament._id,
      tournamentName: tournament.name,
      liveStreams: enrichedStreams,
      allUsersWithTwitch: allUsersWithTwitchData, // ✅ NOUVEAU : Tous les users avec Twitch
      totalStreams: enrichedStreams.length,
      totalUsersWithTwitch: allUsersWithTwitchData.length, // ✅ NOUVEAU
      isToday: true,
      participantsCount: tournament.players.length,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des streams du tournoi:",
      error
    );
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des streams",
      error: error.message,
    });
  }
};

/**
 * Récupère tous les streams en live des utilisateurs avec profil Twitch
 */
exports.getAllLiveStreams = async (req, res) => {
  try {
    // Récupérer tous les utilisateurs avec un nom Twitch
    const usersWithTwitch = await User.find({
      "profile.twitchUsername": { $exists: true, $ne: null },
    }).select("_id username profile.twitchUsername");

    if (usersWithTwitch.length === 0) {
      return res.status(200).json({
        liveStreams: [],
        message: "Aucun utilisateur n'a configuré son profil Twitch",
      });
    }

    // Récupérer les streams en live
    const twitchUsernames = usersWithTwitch.map(
      (user) => user.profile.twitchUsername
    );
    const liveStreams = await twitchStreamService.getLiveStreams(
      twitchUsernames
    );

    // Enrichir avec les infos utilisateur
    const enrichedStreams = liveStreams.map((stream) => {
      const user = usersWithTwitch.find(
        (u) =>
          u.profile.twitchUsername.toLowerCase() ===
          stream.userName.toLowerCase()
      );

      return {
        ...stream,
        participantId: user._id,
        participantUsername: user.username,
      };
    });

    res.status(200).json({
      liveStreams: enrichedStreams,
      totalStreams: enrichedStreams.length,
      totalUsersWithTwitch: usersWithTwitch.length,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de tous les streams:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des streams",
      error: error.message,
    });
  }
};

// ✅ NOUVEAU : Fonction helper pour debug
exports.getTournamentParticipantsDebug = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId).populate(
      "players"
    );

    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Analyser la structure des données
    const playerUserIds = tournament.players
      .map((player) => player.userId)
      .filter((userId) => userId !== null);

    const usersWithTwitch = await User.find({
      _id: { $in: playerUserIds },
      "profile.twitchUsername": { $exists: true, $ne: null },
    }).select("_id username profile.twitchUsername");

    const allUsers = await User.find({
      _id: { $in: playerUserIds },
    }).select("_id username profile.twitchUsername");

    res.status(200).json({
      tournamentName: tournament.name,
      totalPlayers: tournament.players.length,
      playersWithUserAccounts: playerUserIds.length,
      usersWithTwitch: usersWithTwitch.length,

      // Détails pour debug
      players: tournament.players.map((p) => ({
        playerId: p._id,
        playerName: p.username,
        hasUserId: !!p.userId,
        userId: p.userId,
      })),

      usersWithTwitchDetails: usersWithTwitch.map((u) => ({
        userId: u._id,
        username: u.username,
        twitchUsername: u.profile.twitchUsername,
      })),

      usersWithoutTwitch: allUsers
        .filter((u) => !u.profile?.twitchUsername)
        .map((u) => ({
          userId: u._id,
          username: u.username,
        })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors du debug",
      error: error.message,
    });
  }
};

/**
 * Teste la connexion avec l'API Twitch
 */
exports.testTwitchConnection = async (req, res) => {
  try {
    const token = await twitchStreamService.getTwitchAccessToken();

    res.status(200).json({
      message: "Connexion Twitch réussie",
      hasToken: !!token,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Erreur de connexion Twitch:", error);
    res.status(500).json({
      message: "Erreur de connexion à l'API Twitch",
      error: error.message,
    });
  }
};

/**
 * Récupère les informations d'un streamer spécifique
 */
exports.getStreamerInfo = async (req, res) => {
  try {
    const { twitchUsername } = req.params;

    if (!twitchUsername) {
      return res.status(400).json({
        message: "Nom d'utilisateur Twitch requis",
      });
    }

    const streams = await twitchStreamService.getLiveStreams([twitchUsername]);
    const streamerInfo = streams.length > 0 ? streams[0] : null;

    if (!streamerInfo) {
      return res.status(200).json({
        message: `${twitchUsername} n'est pas en live actuellement`,
        isLive: false,
        twitchUsername,
      });
    }

    res.status(200).json({
      ...streamerInfo,
      isLive: true,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des infos du streamer:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des informations du streamer",
      error: error.message,
    });
  }
};

const Player = require("../models/Player");
const PlayerGameLevel = require("../models/PlayerGameLevel");

// Récupérer tous les niveaux d'un joueur
exports.getPlayerLevels = async (req, res) => {
  try {
    const { playerId } = req.params;

    const levels = await PlayerGameLevel.find({ player: playerId })
      .populate("game", "name imageUrl")
      .sort({ updatedAt: -1 });

    res.status(200).json(levels);
  } catch (error) {
    console.error("Erreur lors de la récupération des niveaux:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des niveaux du joueur",
      error: error.message,
    });
  }
};

// Récupérer le niveau d'un joueur pour un jeu spécifique
exports.getPlayerLevelForGame = async (req, res) => {
  try {
    const { playerId, gameId } = req.params;

    const level = await PlayerGameLevel.findOne({
      player: playerId,
      game: gameId,
    });

    if (!level) {
      return res.status(404).json({ message: "Niveau non trouvé pour ce jeu" });
    }

    res.status(200).json(level);
  } catch (error) {
    console.error("Erreur lors de la récupération du niveau:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération du niveau",
      error: error.message,
    });
  }
};

// Définir ou mettre à jour le niveau d'un joueur pour un jeu
exports.setPlayerLevel = async (req, res) => {
  try {
    const { playerId, gameId } = req.params;
    const { level, gameUsername, isRanked, rank, comment } = req.body;

    // Validation du niveau
    const validLevels = ["débutant", "intermédiaire", "avancé", "expert"];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        message:
          "Niveau invalide. Les valeurs acceptées sont: débutant, intermédiaire, avancé, expert",
      });
    }

    // Vérifier que le joueur existe
    const playerExists = await Player.exists({ _id: playerId });
    if (!playerExists) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    // Rechercher si une entrée existe déjà
    let playerLevel = await PlayerGameLevel.findOne({
      player: playerId,
      game: gameId,
    });

    if (playerLevel) {
      // Mise à jour
      playerLevel.level = level;
      playerLevel.gameUsername = gameUsername || playerLevel.gameUsername;
      playerLevel.isRanked =
        isRanked !== undefined ? isRanked : playerLevel.isRanked;
      playerLevel.rank = rank || playerLevel.rank;
      playerLevel.comment =
        comment !== undefined ? comment : playerLevel.comment;
      playerLevel.updatedAt = Date.now();
      await playerLevel.save();
    } else {
      // Création
      playerLevel = new PlayerGameLevel({
        player: playerId,
        game: gameId,
        level,
        gameUsername,
        isRanked: isRanked || false,
        rank,
        comment,
      });
      await playerLevel.save();
    }

    res.status(200).json(playerLevel);
  } catch (error) {
    console.error("Erreur lors de la définition du niveau:", error);
    res.status(500).json({
      message: "Erreur lors de la définition du niveau du joueur",
      error: error.message,
    });
  }
};

// Supprimer un niveau de joueur
exports.deletePlayerLevel = async (req, res) => {
  try {
    const { playerId, gameId } = req.params;

    const deletedLevel = await PlayerGameLevel.findOneAndDelete({
      player: playerId,
      game: gameId,
    });

    if (!deletedLevel) {
      return res.status(404).json({ message: "Niveau de jeu non trouvé" });
    }

    res.status(200).json({ message: "Niveau de jeu supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression du niveau:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression du niveau de jeu",
      error: error.message,
    });
  }
};

// Récupérer tous les niveaux pour un jeu spécifique
exports.getPlayerLevelsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const User = require("../models/User"); // Ajout de l'import du modèle User

    // Récupérer tous les niveaux pour ce jeu
    let levels = await PlayerGameLevel.find({ game: gameId })
      .populate("player")
      .populate("game")
      .sort({ updatedAt: -1 });

    // Transformer les niveaux pour inclure les informations utilisateur
    const levelsWithUserInfo = await Promise.all(
      levels.map(async (level) => {
        const levelObject = level.toObject();

        // Si le joueur existe et a un userId, récupérer les infos de l'utilisateur
        if (levelObject.player && levelObject.player.userId) {
          try {
            const user = await User.findById(levelObject.player.userId).select(
              "username avatarUrl"
            );

            if (user) {
              // Ajouter les informations utilisateur directement dans l'objet player
              levelObject.player.userInfo = {
                username: user.username,
                avatarUrl: user.avatarUrl,
              };
            }
          } catch (userError) {
            console.error(
              "Erreur lors de la récupération de l'utilisateur:",
              userError
            );
          }
        }

        return levelObject;
      })
    );

    res.status(200).json(levelsWithUserInfo);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des niveaux pour ce jeu:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des niveaux pour ce jeu",
      error: error.message,
    });
  }
};

// Récupérer tous les niveaux de tous les joueurs pour tous les jeux
exports.getAllPlayerLevels = async (req, res) => {
  try {
    const User = require("../models/User");

    // Récupérer tous les niveaux
    let levels = await PlayerGameLevel.find({})
      .populate("player")
      .populate("game")
      .sort({ updatedAt: -1 });

    // Transformer les niveaux pour inclure les informations utilisateur
    const levelsWithUserInfo = await Promise.all(
      levels.map(async (level) => {
        const levelObject = level.toObject();

        // Si le joueur existe et a un userId, récupérer les infos de l'utilisateur
        if (levelObject.player && levelObject.player.userId) {
          try {
            const user = await User.findById(levelObject.player.userId).select(
              "username avatarUrl"
            );

            if (user) {
              // Ajouter les informations utilisateur directement dans l'objet player
              levelObject.player.userInfo = {
                username: user.username,
                avatarUrl: user.avatarUrl,
              };
            }
          } catch (userError) {
            console.error(
              "Erreur lors de la récupération de l'utilisateur:",
              userError
            );
          }
        }

        return levelObject;
      })
    );

    res.status(200).json(levelsWithUserInfo);
  } catch (error) {
    console.error("Erreur lors de la récupération de tous les niveaux:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération de tous les niveaux",
      error: error.message,
    });
  }
};

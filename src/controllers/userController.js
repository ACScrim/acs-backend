const User = require("../models/User");
const Player = require("../models/Player");
const Game = require("../models/Game");
const discordBot = require("../discord-bot/index");

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("username email role discordId avatarUrl profile")
      .populate("profile.gameRoles.gameId", "name imageUrl");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération de l'utilisateur",
      error,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("username email role discordId avatarUrl profile")
      .populate("profile.gameRoles.gameId", "name imageUrl");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération des utilisateurs",
      error,
    });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!["admin", "user", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true })
      .select("username email role discordId avatarUrl profile")
      .populate("profile.gameRoles.gameId", "name imageUrl");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du rôle de l'utilisateur",
      error,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier que l'utilisateur n'est pas un superadmin
    if (user.role === "superadmin") {
      return res.status(403).json({
        message: "Impossible de supprimer un superadmin",
      });
    }

    // Supprimer le joueur associé si existant
    await Player.findOneAndDelete({ userId: userId });

    // Supprimer l'utilisateur
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: "Utilisateur et données associées supprimés avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression de l'utilisateur",
      error: error.message,
    });
  }
};

// Mettre à jour le profil utilisateur
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId, twitchUsername, gameRoles } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Sauvegarder les anciens rôles pour comparaison
    const oldGameRoles = user.profile?.gameRoles || [];

    // Initialiser le profil s'il n'existe pas
    if (!user.profile) {
      user.profile = {
        twitchUsername: null,
        gameRoles: [],
      };
    }

    // Validation du nom Twitch (optionnel)
    if (twitchUsername && twitchUsername.trim()) {
      const cleanTwitchUsername = twitchUsername.trim().toLowerCase();

      // Vérifier si le nom Twitch n'est pas déjà utilisé
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        "profile.twitchUsername": cleanTwitchUsername,
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Ce nom Twitch est déjà utilisé par un autre utilisateur",
        });
      }

      user.profile.twitchUsername = cleanTwitchUsername;
    } else {
      user.profile.twitchUsername = null;
    }

    // Mettre à jour les rôles de jeu
    if (gameRoles && Array.isArray(gameRoles)) {
      user.profile.gameRoles = gameRoles.map((role) => ({
        gameId: role.gameId,
        enabled: Boolean(role.enabled),
      }));
    }

    await user.save();

    // ✅ NOUVEAU : Synchronisation Discord automatique
    try {
      // Récupérer l'utilisateur avec les rôles peuplés pour Discord
      const userForDiscord = await User.findById(userId).populate(
        "profile.gameRoles.gameId",
        "name imageUrl"
      );

      // Récupérer tous les jeux pour la synchronisation
      const allGames = await Game.find({}).select("name");

      // Synchroniser les rôles Discord si l'utilisateur a un Discord ID
      if (userForDiscord.discordId) {
        console.log(
          `🎮 Synchronisation Discord pour ${userForDiscord.username}...`
        );

        const syncResult = await discordBot.syncUserGameRoles(
          userForDiscord,
          allGames
        );

        console.log(
          `✅ Discord sync terminée: ${syncResult.added} ajoutés, ${syncResult.removed} retirés, ${syncResult.failed} échecs`
        );

        // Optionnel : nettoyer les rôles inutilisés (à faire occasionnellement)
        if (syncResult.removed > 0) {
          setTimeout(() => {
            discordBot
              .cleanupUnusedGameRoles(allGames)
              .then((cleaned) => {
                if (cleaned > 0) {
                  console.log(
                    `🧹 ${cleaned} rôles Discord inutilisés nettoyés`
                  );
                }
              })
              .catch((err) => console.error("Erreur nettoyage Discord:", err));
          }, 5000); // Attendre 5 secondes avant le nettoyage
        }
      } else {
        console.log(
          `ℹ️ ${userForDiscord.username} n'a pas de Discord ID, pas de sync Discord`
        );
      }
    } catch (discordError) {
      // Ne pas faire échouer la requête si Discord échoue
      console.error("Erreur lors de la synchronisation Discord:", discordError);
      // On continue, l'important est que la base de données soit mise à jour
    }

    // Retourner l'utilisateur complet avec profil peuplé
    const userResponse = await User.findById(userId)
      .select("-password -accessToken -refreshToken")
      .populate("profile.gameRoles.gameId", "name imageUrl");

    res.status(200).json(userResponse);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du profil:", error);
    res.status(500).json({
      message: "Erreur lors de la mise à jour du profil",
      error: error.message,
    });
  }
};

// Récupérer les utilisateurs avec un rôle de jeu spécifique
exports.getUsersWithGameRole = async (req, res) => {
  try {
    const { gameId } = req.params;

    const users = await User.find({
      "profile.gameRoles": {
        $elemMatch: {
          gameId: gameId,
          enabled: true,
        },
      },
    }).select("username discordId profile.twitchUsername");

    res.status(200).json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des utilisateurs avec rôles",
      error: error.message,
    });
  }
};

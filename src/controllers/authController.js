const Player = require("../models/Player");
const passport = require("passport");

const DISCORD_INVITE_LINK =
  process.env.DISCORD_INVITE_LINK || "https://discord.gg/ksCGJztmBd";
/**
 * Gère le callback d'authentification Discord avec gestion personnalisée des erreurs
 */
exports.discordCallback = (req, res, next) => {
  passport.authenticate("discord", (err, user, info) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // En cas d'erreur interne
    if (err) {
      console.error("Erreur d'authentification Discord:", err);
      return res.redirect(
        `${frontendUrl}/auth-error?error=internal&message=${encodeURIComponent(
          err.message || "Une erreur est survenue"
        )}`
      );
    }

    // Si l'utilisateur n'est pas authentifié (pas membre du serveur Discord ou autre raison)
    if (!user) {
      console.log("Authentification échouée:", info);

      // Cas spécifique: l'utilisateur n'est pas membre du serveur Discord requis
      if (info && info.errorType === "guild_membership_required") {
        return res.redirect(
          `${frontendUrl}/auth-error?type=guild_required&inviteLink=${encodeURIComponent(
            DISCORD_INVITE_LINK
          )}&message=${encodeURIComponent(info.message)}`
        );
      }

      // Cas spécifique: API Discord non accessible
      if (info && info.errorType === "discord_api_error") {
        return res.redirect(
          `${frontendUrl}/auth-error?type=api_error&message=${encodeURIComponent(
            info.message
          )}`
        );
      }

      // Erreur générique d'authentification
      return res.redirect(
        `${frontendUrl}/auth-error?message=${encodeURIComponent(
          "Échec de l'authentification"
        )}`
      );
    }

    // Si l'authentification est réussie, connecter l'utilisateur
    req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error("Erreur lors du login de l'utilisateur:", loginErr);
        return res.redirect(
          `${frontendUrl}/auth-error?message=${encodeURIComponent(
            "Erreur lors de la connexion"
          )}`
        );
      }

      try {
        // Vérification des champs requis
        if (!user.username || !user.discordId || !user.id) {
          return res.redirect(
            `${frontendUrl}/auth-error?message=${encodeURIComponent(
              "Données utilisateur invalides"
            )}`
          );
        }

        // D'abord, rechercher par discordId (identité précise)
        let playerByDiscordId = await Player.findOne({
          discordId: user.discordId,
        });

        // Si un joueur avec cet ID Discord existe déjà
        if (playerByDiscordId) {
          // Vérifier si le nom d'utilisateur a changé
          if (playerByDiscordId.username !== user.username) {
            console.log(
              `Le nom d'utilisateur a changé: ${playerByDiscordId.username} -> ${user.username}`
            );

            // Mettre à jour le nom d'utilisateur
            playerByDiscordId.username = user.username;

            // Mettre à jour d'autres champs si nécessaire
            playerByDiscordId.userId = user.id; // Assurez-vous que l'userId est à jour aussi

            await playerByDiscordId.save();
            console.log(
              `Nom d'utilisateur mis à jour pour ${user.username} (ID Discord: ${user.discordId})`
            );
          } else {
            // Même nom, juste mettre à jour l'userId si nécessaire
            if (playerByDiscordId.userId !== user.id) {
              playerByDiscordId.userId = user.id;
              await playerByDiscordId.save();
            }
          }
        } else {
          // Ajouter ou mettre à jour le joueur dans la base Player
          const normalizedUsername = user.username.toLowerCase();
          // Recherche d'un joueur existant avec le même nom d'utilisateur
          const existingPlayer = await Player.findOne({
            username: { $regex: new RegExp(`^${normalizedUsername}$`, "i") },
          });

          // Si un joueur existe déjà, met à jour les champs discordId et userId
          if (existingPlayer) {
            existingPlayer.discordId = user.discordId;
            existingPlayer.userId = user.id;
            await existingPlayer.save();
          } else {
            const player = new Player({
              username: user.username,
              userId: user.id,
              discordId: user.discordId,
            });
            await player.save();
          }
        }

        // Redirige vers le frontend après une connexion réussie
        return res.redirect(frontendUrl);
      } catch (error) {
        console.error(
          "Erreur lors de la création ou mise à jour du joueur:",
          error
        );
        return res.redirect(
          `${frontendUrl}/auth-error?message=${encodeURIComponent(
            "Erreur lors de l'enregistrement du joueur"
          )}`
        );
      }
    });
  })(req, res, next);
};

// Conservez les autres fonctions existantes...
exports.getMe = (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
};

exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Erreur lors de la déconnexion:", err);
      return res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Erreur lors de la destruction de la session:", err);
        return res
          .status(500)
          .json({ message: "Erreur lors de la destruction de la session" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Déconnexion réussie" });
    });
  });
};

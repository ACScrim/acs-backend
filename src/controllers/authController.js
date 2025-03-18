const Player = require("../models/Player");

exports.discordCallback = async (req, res) => {
  req.logIn(req.user, async (err) => {
    if (err) {
      console.error("Erreur lors du login de l'utilisateur:", err);
      return res.status(500).json({ message: "Erreur d'authentification" });
    }

    // Vérification des champs requis
    if (
      !req.user ||
      !req.user.username ||
      !req.user.discordId ||
      !req.user.id
    ) {
      return res.status(400).json({ message: "Données utilisateur invalides" });
    }

    // Ajouter ou mettre à jour le joueur dans la base Player
    try {
      const normalizedUsername = req.user.username.toLowerCase();
      // Recherche d'un joueur existant avec le même nom d'utilisateur
      const existingPlayer = await Player.findOne({
        username: { $regex: new RegExp(`^${normalizedUsername}$`, "i") },
      });

      // Si un joueur existe déjà, met à jour les champs discordId et userId
      if (existingPlayer) {
        existingPlayer.discordId = req.user.discordId;
        existingPlayer.userId = req.user.id;
        await existingPlayer.save();
      } else {
        const player = new Player({
          username: req.user.username,
          userId: req.user.id,
          discordId: req.user.discordId,
        });
        await player.save();
      }
    } catch (error) {
      console.error(
        "Erreur lors de la création ou mise à jour du joueur:",
        error
      );
    }

    // Redirige vers le frontend après une connexion réussie
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(frontendUrl);
  });
};

exports.getMe = (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
};

// Fonction de déconnexion
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

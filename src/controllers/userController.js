const User = require("../models/User");
const Player = require("../models/Player");

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(
      req.params.id,
      "username email role discordId avatarUrl"
    );
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
    const users = await User.find(
      {},
      "username email role discordId avatarUrl"
    );
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

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du rôle de l'utilisateur",
      error,
    });
  }
};

/**
 * Supprime un utilisateur et le joueur associé
 */
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

const User = require("../models/User");

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

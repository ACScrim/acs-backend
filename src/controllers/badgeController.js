const Badge = require("../models/Badge");
const Player = require("../models/Player");
const mongoose = require("mongoose");

exports.createBadge = async (req, res) => {
  try {
    const { title, imageUrl, description, categoryType, categoryId } = req.body;
    const badge = new Badge({
      title,
      imageUrl,
      description,
      categoryType,
      categoryId: categoryType === "game" ? categoryId : undefined,
    });
    await badge.save();
    res.status(201).json(badge);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la création du badge", error });
  }
};

exports.getBadges = async (req, res) => {
  try {
    const badges = await Badge.find();
    res.status(200).json(badges);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des badges", error });
  }
};

exports.getBadgeById = async (req, res) => {
  try {
    const badgeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(badgeId)) {
      return res.status(400).json({ message: "ID de badge invalide" });
    }
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ message: "Badge non trouvé" });
    }
    res.status(200).json(badge);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du badge", error });
  }
};

exports.assignBadgeToPlayer = async (req, res) => {
  try {
    const { playerId, badgeId } = req.body;

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ message: "Badge non trouvé" });
    }

    player.badges.push(badgeId);
    await player.save();
    res.status(200).json({ message: "Badge associé au joueur avec succès" });
  } catch (error) {
    console.error("Erreur lors de l'association du badge:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'association du badge", error });
  }
};

exports.removeBadgeFromPlayer = async (req, res) => {
  try {
    const { playerId, badgeId } = req.body;

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ message: "Badge non trouvé" });
    }

    player.badges.pull(badgeId);
    await player.save();
    res.status(200).json({ message: "Badge supprimé du joueur avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression du badge:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du badge", error });
  }
};

exports.updateBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, imageUrl, description, categoryType, categoryId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de badge invalide" });
    }

    const badge = await Badge.findById(id);
    if (!badge) {
      return res.status(404).json({ message: "Badge non trouvé" });
    }

    badge.title = title;
    badge.imageUrl = imageUrl;
    badge.description = description;
    badge.categoryType = categoryType;
    badge.categoryId = categoryType === "game" ? categoryId : undefined;

    await badge.save();

    res.status(200).json(badge);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du badge:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du badge", error });
  }
};

exports.deleteBadge = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de badge invalide" });
    }

    // Supprimer le badge
    const deletedBadge = await Badge.findByIdAndDelete(id);
    if (!deletedBadge) {
      return res.status(404).json({ message: "Badge non trouvé" });
    }

    // Supprimer les références à ce badge dans tous les joueurs qui le possèdent
    await Player.updateMany({ badges: id }, { $pull: { badges: id } });

    res.status(200).json({ message: "Badge supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression du badge:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du badge", error });
  }
};

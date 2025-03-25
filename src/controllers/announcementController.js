const Announcement = require("../models/Announcement");

// Récupérer toutes les annonces (publiques)
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ published: true })
      .sort({ createdAt: -1 })
      .populate("createdBy", "username avatarUrl");

    res.status(200).json(announcements);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la récupération des annonces",
        error: error.message,
      });
  }
};

// Récupérer une annonce spécifique
exports.getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate(
      "createdBy",
      "username avatarUrl"
    );

    if (!announcement) {
      return res.status(404).json({ message: "Annonce non trouvée" });
    }

    res.status(200).json(announcement);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la récupération de l'annonce",
        error: error.message,
      });
  }
};

// Créer une nouvelle annonce (admin seulement)
exports.createAnnouncement = async (req, res) => {
  try {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "superadmin")
    ) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const { title, content, youtubeUrl, published, featured } = req.body;

    const announcement = new Announcement({
      title,
      content,
      youtubeUrl,
      published,
      featured,
      createdBy: req.user._id,
    });

    await announcement.save();
    res.status(201).json(announcement);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la création de l'annonce",
        error: error.message,
      });
  }
};

// Mettre à jour une annonce (admin seulement)
exports.updateAnnouncement = async (req, res) => {
  try {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "superadmin")
    ) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const { title, content, youtubeUrl, published, featured } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: "Annonce non trouvée" });
    }

    announcement.title = title;
    announcement.content = content;
    announcement.youtubeUrl = youtubeUrl;
    announcement.published = published;
    announcement.featured = featured;
    announcement.updatedAt = Date.now();

    await announcement.save();
    res.status(200).json(announcement);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la mise à jour de l'annonce",
        error: error.message,
      });
  }
};

// Supprimer une annonce (admin seulement)
exports.deleteAnnouncement = async (req, res) => {
  try {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "superadmin")
    ) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: "Annonce non trouvée" });
    }

    res.status(200).json({ message: "Annonce supprimée avec succès" });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erreur lors de la suppression de l'annonce",
        error: error.message,
      });
  }
};

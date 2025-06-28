const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const NotificationSubscription = require("../models/NotificationSubscription");

/**
 * @route GET /api/notifications-subscriptions
  * @desc Récupérer les abonnements de notification pour l'utilisateur
  * @access Private
  * @param {Object} req - La requête HTTP
  * @param {Object} res - La réponse HTTP
  */
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const subscription = await NotificationSubscription.findOne({
      userId,
      isActive: true,
    });
    if (!subscription) {
      return res.status(404).json({
        message: "Aucun abonnement trouvé",
      });
    }
    res.json(subscription);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'abonnement:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération de l'abonnement",
    });
  }
});

router.put("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { isActive, preferences } = req.body;

    let subscription = await NotificationSubscription.findOne({
      userId,
    });

    if (!subscription) {
      subscription = new NotificationSubscription({
        userId,
        isActive,
        preferences,
      });
    } else {
      subscription.isActive = isActive;
      subscription.preferences = {
        ...subscription.preferences,
        ...preferences,
      };
    }

    await subscription.save();
    res.json(subscription);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'abonnement:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de l'abonnement",
    });
  }
})

module.exports = router;
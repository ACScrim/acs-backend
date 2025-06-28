const express = require("express");
const router = express.Router();
const NotificationSubscription = require("../models/NotificationSubscription");
const notificationService = require("../services/notificationService");
const { protect, admin } = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");

router.get('/', [protect, admin], async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("Erreur lors de la récupération des notifications:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des notifications",
    });
  }
});

/**
 * @route POST /api/notifications/subscribe
 * @desc S'abonner aux notifications push
 * @access Private
 */
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user._id;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        message: "Données d'abonnement invalides",
      });
    }

    // Vérifier si l'utilisateur a déjà un abonnement
    let existingSubscription = await NotificationSubscription.findOne({
      userId,
    });

    if (existingSubscription) {
      // Mettre à jour l'abonnement existant
      existingSubscription.subscription = subscription;
      existingSubscription.isActive = true;
      await existingSubscription.save();
    } else {
      // Créer un nouvel abonnement
      existingSubscription = new NotificationSubscription({
        userId,
        subscription,
        isActive: true,
      });
      await existingSubscription.save();
    }

    console.log(`✅ Abonnement créé/mis à jour pour l'utilisateur ${userId}`);

    res.status(200).json({
      message: "Abonnement enregistré avec succès",
      subscriptionId: existingSubscription._id,
    });
  } catch (error) {
    console.error("Erreur lors de l'abonnement aux notifications:", error);
    res.status(500).json({
      message: "Erreur serveur lors de l'abonnement",
    });
  }
});

/**
 * @route POST /api/notifications/unsubscribe
 * @desc Se désabonner des notifications push
 * @access Private
 */
router.post("/unsubscribe", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await NotificationSubscription.findOne({ userId });

    if (subscription) {
      subscription.isActive = false;
      await subscription.save();

      console.log(`🔕 Désabonnement effectué pour l'utilisateur ${userId}`);
    }

    res.status(200).json({
      message: "Désabonnement effectué avec succès",
    });
  } catch (error) {
    console.error("Erreur lors du désabonnement:", error);
    res.status(500).json({
      message: "Erreur serveur lors du désabonnement",
    });
  }
});

/**
 * @route GET /api/notifications/status
 * @desc Obtenir le statut d'abonnement de l'utilisateur
 * @access Private
 */
router.get("/status", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await NotificationSubscription.findOne({
      userId,
      isActive: true,
    });

    res.json({
      isSubscribed: !!subscription,
      preferences: subscription?.preferences || {
        tournaments: true,
        badges: true,
        reminders: true,
        system: true,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du statut:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération du statut",
    });
  }
});

/**
 * @route PUT /api/notifications/preferences
 * @desc Mettre à jour les préférences de notification
 * @access Private
 */
router.put("/preferences", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { preferences } = req.body;

    const subscription = await NotificationSubscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        message: "Aucun abonnement trouvé",
      });
    }

    subscription.preferences = {
      ...subscription.preferences,
      ...preferences,
    };

    await subscription.save();

    res.json({
      message: "Préférences mises à jour",
      preferences: subscription.preferences,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des préférences:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour",
    });
  }
});

/**
 * @route POST /api/notifications/test
 * @desc Envoyer une notification de test
 * @access Private
 */
router.post("/test", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const payload = {
      title: "🧪 Notification de test",
      body: "Vos notifications fonctionnent parfaitement !",
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: "test",
      data: {
        type: "test",
        url: "/",
      },
    };

    await notificationService.sendToUser(userId, payload);

    res.json({
      message: "Notification de test envoyée",
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de la notification de test:", error);
    res.status(500).json({
      message: "Erreur lors de l'envoi de la notification de test",
    });
  }
});

/**
 * @route GET /api/notifications/vapid-key
 * @desc Obtenir la clé publique VAPID
 * @access Public
 */
router.get("/vapid-key", (req, res) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return res.status(500).json({
      message: "Clé VAPID non configurée",
    });
  }

  res.json({
    vapidPublicKey,
  });
});

// Routes admin (optionnelles)
/**
 * @route GET /api/notifications/admin/stats
 * @desc Statistiques d'abonnements (admin seulement)
 * @access Private (Admin)
 */

/**
  total: 156,
  totalThisWeek: 23,
  subscribedUsers: 89,
  newSubscribersThisWeek: 7,
  deliveryRate: 94,
  topType: 'Tournois',
  topTypeCount: 45,
  byType: {
    tournaments: 45,
    badges: 32,
    reminders: 28,
    system: 51,
  },
 */
router.get("/admin/stats", admin, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const subscriptionStats = await NotificationSubscription.aggregate([
      {
        $group: {
          _id: null,
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          newActiveSubscriptionsThisWeek: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isActive", true] },
                    { $gte: ["$createdAt", new Date(new Date().setDate(new Date().getDate() - 7))] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const notificationStats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          totalSent: { $sum: "$totalSent" },
          totalThisWeek: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", new Date(new Date().setDate(new Date().getDate() - 7))] },
                "$totalSent",
                0,
              ],
            },
          },
          totalNotifications: { $sum: 1 },
        },
      }
    ]);

    const notificationsByType = await Notification.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalSent: { $sum: "$totalSent" }
        }
      }
    ]);

    const byType = {};
    notificationsByType.forEach(item => {
      if (item._id) {
        byType[item._id] = item.count;
      }
    });

    // Trouver le type le plus populaire
    let topType = 'system';
    let topTypeCount = 0;
    
    Object.entries(byType).forEach(([type, count]) => {
      if (count > topTypeCount) {
        topTypeCount = count;
        topType = type;
      }
    });

    const totalSent = notificationStats[0]?.totalSent || 0;
    const totalNotifications = notificationStats[0]?.totalNotifications || 0;
    const deliveryRate = totalNotifications > 0 ? Math.round((totalSent / totalNotifications) * 100) : 0;

    res.json({
      total: totalSent, // Nombre de notifications envoyées
      totalThisWeek: notificationStats[0]?.totalThisWeek || 0, // Nombre de notifications envoyées cette semaine
      subscribedUsers: subscriptionStats[0]?.activeSubscriptions || 0, // Nombre d'utilisateurs abonnés
      newSubscribersThisWeek: subscriptionStats[0]?.newActiveSubscriptionsThisWeek || 0, // Nombre de nouveaux abonnés cette semaine
      deliveryRate: deliveryRate || 0, // Taux de livraison des notifications (en pourcentage)
      topType, // Type de notification le plus fréquent
      topTypeCount, // Nombre de notifications du type le plus fréquent
      byType: { // Statistiques par type de notification
        tournaments: byType.tournaments || 0,
        badges: byType.badges || 0,
        reminders: byType.reminders || 0,
        system: byType.system || 0,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

/**
 * @route POST /api/notifications/admin/broadcast
 * @desc Envoyer une notification à tous les utilisateurs (admin seulement)
 * @access Private (Admin)
 */
router.post("/admin/broadcast", admin, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { title, body, tag } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        message: "Titre et message requis",
      });
    }

    const payload = {
      title,
      body,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag,
      data: {
        type: "system",
        url: "/",
      },
    };

    const result = await notificationService.sendToAllSubscribers(payload, {
      type: "system",
    });

    res.json({
      message: "Notification diffusée",
      result,
    });
  } catch (error) {
    console.error("Erreur lors de la diffusion:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la diffusion",
    });
  }
});

module.exports = router;

const mongoose = require("mongoose");

const notificationSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Un utilisateur = un abonnement
    },
    subscription: {
      endpoint: {
        type: String,
        required: true,
      },
      keys: {
        p256dh: {
          type: String,
          required: true,
        },
        auth: {
          type: String,
          required: true,
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    preferences: {
      tournaments: {
        type: Boolean,
        default: true,
      },
      badges: {
        type: Boolean,
        default: true,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
      system: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index pour les performances
notificationSubscriptionSchema.index({ userId: 1 });
notificationSubscriptionSchema.index({ "subscription.endpoint": 1 });

// Méthode statique pour nettoyer les abonnements expirés
notificationSubscriptionSchema.statics.cleanExpiredSubscriptions =
  async function () {
    // Supprimer les abonnements inactifs depuis plus de 30 jours
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.deleteMany({
      isActive: false,
      updatedAt: { $lt: thirtyDaysAgo },
    });
  };

module.exports = mongoose.model(
  "NotificationSubscription",
  notificationSubscriptionSchema
);

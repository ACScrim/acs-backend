const webpush = require("web-push");
const NotificationSubscription = require("../models/NotificationSubscription");

class NotificationService {
  constructor() {
    // Configuration des clés VAPID
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        "mailto:" + (process.env.VAPID_EMAIL || "admin@acsgaming.com"),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      console.warn(
        "⚠️  Clés VAPID non configurées. Les notifications push ne fonctionneront pas."
      );
    }
  }

  /**
   * Envoie une notification push à un utilisateur spécifique
   */
  async sendToUser(userId, payload) {
    try {
      const subscription = await NotificationSubscription.findOne({
        userId,
        isActive: true,
      });

      if (!subscription) {
        console.log(
          `Aucun abonnement actif trouvé pour l'utilisateur ${userId}`
        );
        return null;
      }

      return await this.sendNotification(subscription.subscription, payload);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification à l'utilisateur:",
        error
      );
      throw error;
    }
  }

  /**
   * Envoie une notification push à plusieurs utilisateurs
   */
  async sendToUsers(userIds, payload) {
    try {
      const subscriptions = await NotificationSubscription.find({
        userId: { $in: userIds },
        isActive: true,
      });

      const promises = subscriptions.map((sub) =>
        this.sendNotification(sub.subscription, payload).catch((err) => {
          console.error(`Erreur envoi notification à ${sub.userId}:`, err);
          return { error: err, userId: sub.userId };
        })
      );

      return await Promise.allSettled(promises);
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de notifications multiples:",
        error
      );
      throw error;
    }
  }

  /**
   * Envoie une notification à tous les utilisateurs abonnés
   */
  async sendToAllSubscribers(payload, preferences = {}) {
    try {
      const query = { isActive: true };

      // Filtrer par préférences si spécifié
      if (preferences.type) {
        query[`preferences.${preferences.type}`] = true;
      }

      const subscriptions = await NotificationSubscription.find(query);

      console.log(`📢 Envoi de notification à ${subscriptions.length} abonnés`);

      const promises = subscriptions.map((sub) =>
        this.sendNotification(sub.subscription, payload).catch((err) => {
          console.error(`Erreur envoi notification à ${sub.userId}:`, err);
          return { error: err, userId: sub.userId };
        })
      );

      const results = await Promise.allSettled(promises);

      // Compter les succès et échecs
      const successful = results.filter(
        (r) => r.status === "fulfilled" && !r.value?.error
      ).length;
      const failed = results.length - successful;

      console.log(
        `✅ ${successful} notifications envoyées avec succès, ${failed} échecs`
      );

      return { successful, failed, total: results.length };
    } catch (error) {
      console.error("Erreur lors de l'envoi de notifications globales:", error);
      throw error;
    }
  }

  /**
   * Envoie une notification push individuelle
   */
  async sendNotification(subscription, payload) {
    try {
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
      return result;
    } catch (error) {
      // Gérer les abonnements expirés
      if (error.statusCode === 410) {
        console.log("Abonnement expiré détecté, suppression...");
        await this.removeExpiredSubscription(subscription.endpoint);
      }
      throw error;
    }
  }

  /**
   * Supprime un abonnement expiré
   */
  async removeExpiredSubscription(endpoint) {
    try {
      await NotificationSubscription.findOneAndUpdate(
        { "subscription.endpoint": endpoint },
        { isActive: false }
      );
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de l'abonnement expiré:",
        error
      );
    }
  }

  /**
   * Méthodes spécifiques pour différents types de notifications
   */

  /**
   * Notification de nouveau tournoi
   */
  async notifyNewTournament(tournament) {
    const payload = {
      title: "🏆 Nouveau tournoi disponible !",
      body: `${tournament.name} - Les inscriptions sont ouvertes`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `tournament-${tournament._id}`,
      data: {
        type: "tournament",
        tournamentId: tournament._id,
        url: "/tournois-a-venir",
      },
      actions: [
        {
          action: "view",
          title: "Voir le tournoi",
          icon: "/Logo_ACS.png",
        },
        {
          action: "dismiss",
          title: "Fermer",
        },
      ],
    };

    return await this.sendToAllSubscribers(payload, { type: "tournaments" });
  }

  /**
   * Notification de rappel de tournoi
   */
  async notifyTournamentReminder(tournament, participants) {
    const payload = {
      title: "⏰ Rappel de tournoi",
      body: `${tournament.name} commence dans 1 heure !`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `reminder-${tournament._id}`,
      data: {
        type: "reminder",
        tournamentId: tournament._id,
        url: `/tournois/${tournament._id}`,
      },
      actions: [
        {
          action: "join",
          title: "Rejoindre",
          icon: "/Logo_ACS.png",
        },
      ],
    };

    // Envoyer uniquement aux participants
    const participantIds = participants.map((p) => p.playerId);
    return await this.sendToUsers(participantIds, payload);
  }

  /**
   * Notification de nouveau badge
   */
  async notifyNewBadge(userId, badge) {
    const payload = {
      title: "🏅 Nouveau badge obtenu !",
      body: `Félicitations ! Vous avez obtenu : ${badge.title}`,
      icon: badge.imageUrl || "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `badge-${badge._id}`,
      data: {
        type: "badge",
        badgeId: badge._id,
        url: "/badges",
      },
    };

    return await this.sendToUser(userId, payload);
  }

  /**
   * Notification système
   */
  async notifySystem(message, data = {}) {
    const payload = {
      title: "🔔 Notification système",
      body: message,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: "system",
      data: {
        type: "system",
        ...data,
      },
    };

    return await this.sendToAllSubscribers(payload, { type: "system" });
  }
}

module.exports = new NotificationService();

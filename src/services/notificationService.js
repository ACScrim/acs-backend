const webpush = require("web-push");
const NotificationSubscription = require("../models/NotificationSubscription");
const Notification = require("../models/Notification");

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

    // Lier les méthodes pour éviter les problèmes de contexte
    this.notifyTournamentReminder = this.notifyTournamentReminder.bind(this);
    this.sendToUsers = this.sendToUsers.bind(this);
    this.sendToUser = this.sendToUser.bind(this);
    this.sendNotification = this.sendNotification.bind(this);
    this.notifyNewBadge = this.notifyNewBadge.bind(this);
    this.notifyNewTournament = this.notifyNewTournament.bind(this);
    this.notifySystem = this.notifySystem.bind(this);
    this.removeExpiredSubscription = this.removeExpiredSubscription.bind(this);
    this.sendToAllSubscribers = this.sendToAllSubscribers.bind(this);
    this.notifyWinningTeam = this.notifyWinningTeam.bind(this);
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

      const notification = new Notification({
        users: [userId],
        title: payload.title,
        body: payload.body,
        tag: payload.tag || "system-notification",
        url: payload.data.url || "/",
        type: payload.data.type || "system",
        icon: "/Logo_ACS.png",
        badge: "/Logo_ACS.png",
        totalSent: 0,
        totalClicks: 0, // Initialisé à 0, peut être mis à jour plus tard
        totalErrors: 0,
      });
      notification.save();

      const notificationResponse = await this.sendNotification(subscription.subscription, {...payload, data: { ...payload.data, notificationId: notification.id }});

      notification.totalSent = notificationResponse.statusCode === 201 ? 1 : 0;
      notification.totalErrors = notificationResponse.statusCode !== 201 ? 1 : 0;
      notification.save();

      return notificationResponse;
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

      const notification = new Notification({
        users: subscriptions.map(sub => sub.userId),
        title: payload.title,
        body: payload.body,
        tag: payload.tag || "system-notification",
        url: payload.data.url || "/",
        type: payload.data.type || "system",
        icon: "/Logo_ACS.png",
        badge: "/Logo_ACS.png",
        totalSent: 0,
        totalClicks: 0, // Initialisé à 0, peut être mis à jour plus tard
        totalErrors: 0
      });
      notification.save();


      const promises = subscriptions.map((sub) =>
        this.sendNotification(sub.subscription, {...payload, data: { ...payload.data, notificationId: notification.id }}).catch((err) => {
          console.error(`Erreur envoi notification à ${sub.userId}:`, err);
          return { error: err, userId: sub.userId };
        })
      );

      const results = await Promise.allSettled(promises);

      notification.totalSent = results.filter(r => r.status === "fulfilled").length
      notification.totalErrors = results.filter(r => r.status === "rejected").length
      notification.save();
      

      return results;
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

      const notification = new Notification({
        users: subscriptions.map(sub => sub.userId),
        title: payload.title,
        body: payload.body,
        tag: payload.tag || "system-notification",
        url: payload.data.url || "/",
        type: payload.data.type || "system",
        icon: "/Logo_ACS.png",
        badge: "/Logo_ACS.png",
        totalSent: 0,
        totalClicks: 0,
        totalErrors: 0
      });
      notification.save();

      const promises = subscriptions.map((sub) =>
        this.sendNotification(sub.subscription, {...payload, data: { ...payload.data, notificationId: notification.id }}).catch((err) => {
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

      notification.totalSent = successful;
      notification.totalErrors = failed;
      notification.save();

      console.log(
        `✅ ${successful} notifications envoyées avec succès, ${failed} échecs`
      );

      return { successful, failed, total: results.length, subscriptions };
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
        type: "tournaments",
        tournamentId: tournament._id,
        url: "/tournois-a-venir"
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
  async notifyTournamentReminder(tournament, users) {
    const payload = {
      title: `⏰ Rappel de check-in pour ${tournament.name}`,
      body: `${tournament.name} commence dans 24 heures !`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `reminder-${tournament._id}`,
      data: {
        type: "reminders",
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

    const participantIds = users.map((u) => u.toString());

    if (participantIds.length === 0) {
      console.warn("⚠️ Aucun participant trouvé !");
      return [];
    }

    try {
      const result = await this.sendToUsers(participantIds, payload);
      return result;
    } catch (error) {
      console.error("❌ ERREUR dans notifyTournamentReminder:", error);
      throw error;
    }
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
  async notifySystem(title, message, data = {}) {
    const payload = {
      title: title || "🔔 Notification système",
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

  async notifyWinningTeam(tournament, team) {
    const payload = {
      title: `🏆 Victoire pour ${team.name} !`,
      body: `${team.name} a remporté le tournoi ${tournament.name}`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `tournament-${tournament._id}-winner`,
      data: {
        type: "tournaments",
        tournamentId: tournament._id,
        teamId: team._id,
        url: `/tournois/${tournament._id}`,
      },
    };

    // Envoi de la notification à tous les abonnés
    return await this.sendToAllSubscribers(payload, { type: "tournaments" });
  }

  async notifyMvpVoteOpen(tournament) {
    const payload = {
      title: `🏆 Vote pour le MVP du tournoi ${tournament.name} !`,
      body: `Le vote pour le MVP du tournoi ${tournament.name} est maintenant ouvert !`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `mvp-vote-${tournament._id}`,
      data: {
        type: "tournaments",
        tournamentId: tournament._id,
        url: `/tournois/${tournament._id}`,
      },
    };

    // Envoi de la notification à tous les abonnés
    return await this.sendToAllSubscribers(payload, { type: "tournaments" });
  }

  async notifyMvpWinner(tournament) {
    const mvps = tournament.mvps.filter(mvp => mvp.isMvp);

    const payload = {
      title: `🏆 MVP du tournoi ${tournament.name} !`,
      body: mvps.length > 1 ? `Félicitations à ${mvps.map(mvp => mvp.player.username).join(", ")} qui sont les MVPs de cette soirée !` : `Félicitations à ${mvps[0].player.username} qui est le MVP de cette soirée !`,
      icon: "/Logo_ACS.png",
      badge: "/Logo_ACS.png",
      tag: `mvp-${tournament._id}`,
      data: {
        type: "tournaments",
        tournamentId: tournament._id,
        url: `/tournois/${tournament._id}`,
      },
    };

    // Envoi de la notification à tous les abonnés
    return await this.sendToAllSubscribers(payload, { type: "tournaments" });
  }
}

module.exports = new NotificationService();

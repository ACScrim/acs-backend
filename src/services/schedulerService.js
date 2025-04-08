const Tournament = require("../models/Tournament");
const {
  sendTournamentReminder,
  updateTournamentSignupMessage,
  sendCheckInReminders,
} = require("../discord-bot/index");
const winston = require("winston");

// Utiliser le logger Winston déjà configuré dans l'application
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

// Vérifier les tournois à venir et envoyer des notifications sur le canal Discord
const checkUpcomingTournaments = async () => {
  try {
    const now = new Date();
    logger.info(`[Canal Discord] Heure actuelle: ${now.toISOString()}`);

    // Fenêtre de temps pour les notifications Discord (20 minutes avant/après l'heure prévue)
    const startWindow = new Date(now.getTime() - 20 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 20 * 60 * 1000);

    // Trouver les tournois dont la date de rappel Discord tombe dans cette fenêtre
    // OU dont la date est passée mais qui n'ont pas encore reçu de notification
    const upcomingTournaments = await Tournament.find({
      $or: [
        // Cas 1: Date de rappel personnalisée dans la fenêtre actuelle
        {
          discordReminderDate: {
            $gt: startWindow,
            $lt: endWindow,
          },
          reminderSent: { $ne: true },
          finished: { $ne: true },
          date: { $gt: now }, // Ajouter cette condition pour vérifier que la date du tournoi est dans le futur
        },
        // Cas 2: Date de rappel personnalisée passée mais rappel non envoyé
        {
          discordReminderDate: { $lt: now },
          reminderSent: { $ne: true },
          finished: { $ne: true },
          date: { $gt: now }, // Ajouter cette condition pour vérifier que la date du tournoi est dans le futur
        },
        // Cas 3 (legacy): Pas de date personnalisée, mais démarre dans les prochaines 24h
        {
          discordReminderDate: null,
          date: {
            $gt: now,
            $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
          reminderSent: { $ne: true },
          finished: { $ne: true },
        },
      ],
    }).populate("game");

    logger.info(
      `[Canal Discord] Tournois à notifier: ${upcomingTournaments.length} tournoi(s) trouvé(s)`
    );

    if (upcomingTournaments.length === 0) {
      return;
    }

    for (const tournament of upcomingTournaments) {
      // Ajouter un log pour identifier si c'est un rappel en retard
      const isLateReminder =
        tournament.discordReminderDate &&
        tournament.discordReminderDate < startWindow;

      logger.info(
        `[Canal Discord] Envoi de notification pour le tournoi: ${
          tournament.name
        } ${
          tournament.discordReminderDate
            ? `(date personnalisée${isLateReminder ? ", RETARD" : ""})`
            : "(règle par défaut)"
        }`
      );

      const success = await sendTournamentReminder(tournament);

      if (success) {
        // Marquer le rappel comme envoyé pour ne pas l'envoyer à nouveau
        tournament.reminderSent = true;
        await tournament.save();

        logger.info(
          `[Canal Discord] Notification envoyée pour le tournoi ${tournament.name} (ID: ${tournament._id})`
        );
      } else {
        logger.error(
          `[Canal Discord] Échec de l'envoi de la notification pour le tournoi ${tournament.name}`
        );
      }
    }
  } catch (error) {
    logger.error(
      "[Canal Discord] Erreur lors de la vérification des tournois à venir:",
      error
    );
  }
};

// Messages privés aux joueurs sans check-in
const checkPlayerReminders = async () => {
  try {
    const now = new Date();
    logger.info(`[Rappels MP] Heure actuelle: ${now.toISOString()}`);

    // Fenêtre de temps pour les notifications privées (20 minutes avant/après l'heure prévue)
    const startWindow = new Date(now.getTime() - 20 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 20 * 60 * 1000);

    // Trouver les tournois dont la date de rappel privé tombe dans cette fenêtre
    // OU dont la date est passée mais qui n'ont pas encore reçu de notification
    const upcomingTournaments = await Tournament.find({
      $or: [
        // Cas 1: Date de rappel personnalisée dans la fenêtre actuelle
        {
          privateReminderDate: {
            $gt: startWindow,
            $lt: endWindow,
          },
          reminderSentPlayers: { $ne: true },
          finished: { $ne: true },
          date: { $gt: now }, // Ajouter cette condition pour vérifier que la date du tournoi est dans le futur
        },
        // Cas 2: Date de rappel personnalisée passée mais rappel non envoyé
        {
          privateReminderDate: { $lt: now },
          reminderSentPlayers: { $ne: true },
          finished: { $ne: true },
          date: { $gt: now }, // Ajouter cette condition pour vérifier que la date du tournoi est dans le futur
        },
        // Cas 3 (legacy): Pas de date personnalisée, mais démarre dans les prochaines 6h
        {
          privateReminderDate: null,
          date: {
            $gt: now,
            $lt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
          },
          reminderSentPlayers: { $ne: true },
          finished: { $ne: true },
        },
      ],
    }).populate(["game", "players"]);

    logger.info(
      `[Rappels MP] Tournois à notifier: ${upcomingTournaments.length} tournoi(s) trouvé(s)`
    );

    if (upcomingTournaments.length === 0) {
      return;
    }

    for (const tournament of upcomingTournaments) {
      // Ajouter un log pour identifier si c'est un rappel en retard
      const isLateReminder =
        tournament.privateReminderDate &&
        tournament.privateReminderDate < startWindow;

      logger.info(
        `[Rappels MP] Envoi de rappels MP pour les joueurs du tournoi: ${
          tournament.name
        } ${
          tournament.privateReminderDate
            ? `(date personnalisée${isLateReminder ? ", RETARD" : ""})`
            : "(règle par défaut)"
        }`
      );

      // Seuls les joueurs n'ayant pas fait leur check-in recevront des MPs
      const { success, failed } = await sendCheckInReminders(tournament);

      if (success > 0 || failed === 0) {
        // Marquer que les rappels MP ont été envoyés
        tournament.reminderSentPlayers = true;
        await tournament.save();

        logger.info(
          `[Rappels MP] ${success} messages envoyés avec succès (${failed} échoués) pour le tournoi ${tournament.name}`
        );
      } else {
        logger.error(
          `[Rappels MP] Échec de l'envoi des rappels MP pour le tournoi ${tournament.name} (${failed} échoués)`
        );
      }
    }
  } catch (error) {
    logger.error(
      "[Rappels MP] Erreur lors de l'envoi des rappels aux joueurs:",
      error
    );
  }
};

// Fonction pour mettre à jour les messages d'inscription de tous les tournois à venir
const updateSignupMessages = async () => {
  try {
    const now = new Date();
    logger.info(
      `[Inscription] Mise à jour des messages d'inscription: ${now.toISOString()}`
    );

    // Trouver TOUS les tournois à venir qui ne sont pas terminés
    const upcomingTournaments = await Tournament.find({
      date: { $gt: now }, // Commence dans le futur
      finished: { $ne: true }, // Pas encore terminé
    })
      .sort({ date: 1 }) // Tri par date ascendante (plus proche au plus lointain)
      .populate("game");

    if (!upcomingTournaments || upcomingTournaments.length === 0) {
      logger.info("[Inscription] Aucun tournoi à venir n'a été trouvé");
      return;
    }

    logger.info(
      `[Inscription] ${upcomingTournaments.length} tournois à venir trouvés`
    );

    // Traiter chaque tournoi individuellement
    for (const tournament of upcomingTournaments) {
      // Mise à jour du message d'inscription pour ce tournoi
      const success = await updateTournamentSignupMessage(tournament);

      if (success) {
        logger.info(
          `[Inscription] Message d'inscription mis à jour pour ${tournament.name}`
        );
      } else {
        logger.error(
          `[Inscription] Échec de la mise à jour du message pour ${tournament.name}`
        );
      }
    }
  } catch (error) {
    logger.error(
      "[Inscription] Erreur lors de la mise à jour des messages d'inscription:",
      error
    );
  }
};

// Démarrer la planification
const startScheduler = () => {
  logger.info("Démarrage du planificateur de tournois");

  // Exécuter immédiatement au démarrage
  checkUpcomingTournaments();
  checkPlayerReminders(); // Vérifier les rappels MP aux joueurs
  updateSignupMessages();

  const checkInterval = 20 * 60 * 1000; // 20 minutes en millisecondes
  setInterval(checkUpcomingTournaments, checkInterval);
  setInterval(checkPlayerReminders, checkInterval);

  // Mettre à jour les messages d'inscription toutes les heures
  setInterval(updateSignupMessages, 60 * 60 * 1000);

  logger.info("Planificateur de tournois démarré avec intervalle d'une heure");
};

module.exports = { startScheduler, updateSignupMessages, checkPlayerReminders };

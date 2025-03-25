const Tournament = require("../models/Tournament");
const {
  sendTournamentReminder,
  updateTournamentSignupMessage,
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

// Vérifier les tournois à venir et envoyer des notifications
// Vérifier les tournois à venir et envoyer des notifications
const checkUpcomingTournaments = async () => {
  try {
    const now = new Date();
    logger.info(`Heure actuelle: ${now.toISOString()}`);

    // Modifications: fenêtre temporelle de recherche pour les tournois qui commencent dans 24h ou moins
    const endWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h à partir de maintenant

    logger.info(
      `Fenêtre de recherche modifiée: tournois commençant entre maintenant et ${endWindow.toISOString()}`
    );

    // Récupérer TOUS les tournois pour vérification
    const allTournaments = await Tournament.find({}).populate("game");
    logger.info(
      `Total des tournois dans la base de données: ${allTournaments.length}`
    );

    // Requête modifiée: trouver tous les tournois qui commencent dans les prochaines 24h
    const upcomingTournaments = await Tournament.find({
      date: {
        $gt: now, // Commence après maintenant
        $lt: endWindow, // Mais dans moins de 24h
      },
      reminderSent: { $ne: true }, // Pas encore notifié
      finished: { $ne: true }, // Pas encore terminé
    }).populate("game");

    logger.info(
      `Tournois à venir dans les prochaines 24h: ${upcomingTournaments.length} tournoi(s) trouvé(s)`
    );

    if (upcomingTournaments.length === 0) {
      logger.info("Aucun tournoi imminent n'a été trouvé.");
      return;
    }

    for (const tournament of upcomingTournaments) {
      logger.info(`Envoi de notification pour le tournoi: ${tournament.name}`);
      const success = await sendTournamentReminder(tournament);

      if (success) {
        // Marquer le rappel comme envoyé pour ne pas l'envoyer à nouveau
        tournament.reminderSent = true;
        await tournament.save();

        logger.info(
          `Notification envoyée pour le tournoi ${tournament.name} (ID: ${tournament._id})`
        );
      } else {
        logger.error(
          `Échec de l'envoi de la notification pour le tournoi ${tournament.name}`
        );
      }
    }

    // Reste de votre code pour envoyer des notifications...
  } catch (error) {
    logger.error("Erreur lors de la vérification des tournois à venir:", error);
  }
};

// Fonction modifiée pour mettre à jour les messages d'inscription de tous les tournois à venir
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
  updateSignupMessages();

  // Puis vérifier toutes les heures
  setInterval(checkUpcomingTournaments, 60 * 60 * 1000);

  // Mettre à jour les messages d'inscription toutes les heures
  setInterval(updateSignupMessages, 60 * 60 * 1000);

  logger.info("Planificateur de tournois démarré avec intervalle d'une heure");
};

module.exports = { startScheduler, updateSignupMessages };

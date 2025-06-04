/**
 * ⚠️ FICHIER TEMPORAIRE - À SUPPRIMER APRÈS 48H ⚠️
 *
 * Ce fichier contient la logique pour envoyer et mettre à jour
 * le classement des propositions de jeux dans le canal d'annonces.
 *
 * À supprimer après le 6 juin 2025
 *
 * Fonctionnalités:
 * - Envoi initial du classement
 * - Mise à jour automatique après chaque vote
 * - Message avec seuil de suppression à 9 votes
 */

const { EmbedBuilder } = require("discord.js");
const GameProposal = require("../models/GameProposal");
const winston = require("winston");

// ⚠️ CONFIGURATION TEMPORAIRE - À SUPPRIMER
const ANNOUNCEMENT_CHANNEL_ID = "1346232193453920256";

// ✅ AJOUT: Variable pour l'intervalle de mise à jour
let countdownInterval = null;

// ✅ NOUVEAU: Planning de suppression progressive
const SUPPRESSION_SCHEDULE = [
  { date: new Date("2025-06-05T20:00:00+02:00"), maxGames: 10 }, // Jeudi 20h : 10 jeux max
  { date: new Date("2025-06-06T20:00:00+02:00"), maxGames: 8 }, // Vendredi 20h : 8 jeux max
  { date: new Date("2025-06-07T20:00:00+02:00"), maxGames: 6 }, // Samedi 20h : 6 jeux max
  { date: new Date("2025-06-08T20:00:00+02:00"), maxGames: 4 }, // Dimanche 20h : 4 jeux max
  { date: new Date("2025-06-09T20:00:00+02:00"), maxGames: 2 }, // Lundi 20h : 2 jeux finaux
];

// Logger temporaire
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `[TEMP-VOTE-RANKING] ${timestamp} [${level}]: ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

/**
 * ⚠️ FONCTION TEMPORAIRE - Récupère le client Discord depuis le fichier principal
 */
function getDiscordClient() {
  try {
    // Récupérer le client depuis le module principal
    const mainBot = require("./index");
    return mainBot.client || require("./index").client;
  } catch (error) {
    logger.error("Impossible de récupérer le client Discord:", error);
    return null;
  }
}
/**
 * ⚠️ FONCTION TEMPORAIRE - Calcule combien de jeux doivent rester selon la date
 */
function calculateMaxGamesForDate(currentDate = new Date()) {
  // Trouver la prochaine étape de suppression
  const nextSuppression = SUPPRESSION_SCHEDULE.find(
    (step) => currentDate < step.date
  );

  if (!nextSuppression) {
    // Après le lundi 20h, seuls 2 jeux restent
    return { maxGames: 2, nextDate: null, isFinished: true };
  }

  return {
    maxGames: nextSuppression.maxGames,
    nextDate: nextSuppression.date,
    isFinished: false,
  };
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Calcule la prochaine suppression
 */
function getNextSuppressionInfo(currentDate = new Date()) {
  const currentSuppression = SUPPRESSION_SCHEDULE.find(
    (step) => currentDate < step.date
  );

  if (!currentSuppression) {
    return { message: "Sélection finale terminée !", timeLeft: 0 };
  }

  const timeLeft = currentSuppression.date.getTime() - currentDate.getTime();
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  let timeText = "";
  if (days > 0) {
    timeText = `${days} jour${days > 1 ? "s" : ""} et ${hours}h`;
  } else if (hours > 0) {
    timeText = `${hours}h ${minutes}min`;
  } else {
    timeText = `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  const dateStr = currentSuppression.date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    message: `Prochaine suppression ${dateStr} (${currentSuppression.maxGames} jeux max)`,
    timeLeft: timeText,
    maxGames: currentSuppression.maxGames,
    nextDate: currentSuppression.date,
  };
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Formate le classement des propositions
 */
async function formatVoteRanking() {
  try {
    // Récupérer toutes les propositions approuvées avec leurs votes
    const proposals = await GameProposal.find({ status: "approved" })
      .populate("proposedBy", "username")
      .populate("votes.player", "username");

    if (!proposals || proposals.length === 0) {
      return "Aucune proposition de jeu trouvée.";
    }

    const now = new Date();

    // ✅ NOUVEAU: Calculer les infos de suppression progressive
    const suppressionInfo = getNextSuppressionInfo(now);
    const maxGamesInfo = calculateMaxGamesForDate(now);

    // Trier les propositions par votes positifs
    const proposalsWithVotes = proposals
      .map((proposal) => ({
        name: proposal.name,
        positiveVotes: proposal.votes.filter((vote) => vote.value === 1).length,
      }))
      .sort((a, b) => b.positiveVotes - a.positiveVotes);

    // ✅ NOUVEAU: Compte à rebours adaptatif
    let content = "";
    if (!maxGamesInfo.isFinished) {
      //content += `⏰ **${suppressionInfo.message}**\n`;
      content += `⏳ **Temps restant : ${suppressionInfo.timeLeft}**\n\n`;
    } else {
      content += `🏁 **Sélection terminée ! Les 2 jeux finaux sont choisis.**\n\n`;
    }

    // content += "🎮 **Classement des propositions de jeux**\n";
    // content += "➡️ Votez sur le site : https://acscrim.fr/propositions-jeux\n";
    // content +=
    //   "ou dans le channel <#1374371008353407037> pour sauver vos favoris !\n\n";

    // // ✅ NOUVEAU: Planning de suppression
    // content += "📅 **Planning des suppressions :**\n";
    // SUPPRESSION_SCHEDULE.forEach((step, index) => {
    //   const isPassed = now >= step.date;
    //   const isCurrent =
    //     !isPassed &&
    //     (!SUPPRESSION_SCHEDULE[index - 1] ||
    //       now >= SUPPRESSION_SCHEDULE[index - 1].date);

    //   const dateStr = step.date.toLocaleDateString("fr-FR", {
    //     weekday: "short",
    //     day: "numeric",
    //     month: "short",
    //     hour: "2-digit",
    //     minute: "2-digit",
    //   });

    //   let lineText = `${dateStr} : ${step.maxGames} jeux max`;
    //   let status = "";

    //   if (isPassed) {
    //     // Barrer la ligne et ajouter un indicateur de fin
    //     lineText = `~~${lineText}~~ **TERMINÉ**`;
    //     status = "✅ ";
    //   } else if (isCurrent) {
    //     // Mettre en évidence l'étape en cours
    //     lineText = `**${lineText}** 🔥 **EN COURS ** Temps restant : ${suppressionInfo.timeLeft}`;
    //     status = "";
    //   } else {
    //     // Étapes futures
    //     status = "⏳ ";
    //   }

    //   content += `${status}${lineText}\n`;
    // });
    content += "\n";

    // ✅ NOUVEAU: Affichage avec statut de risque adaptatif
    proposalsWithVotes.forEach((proposal, index) => {
      const votes = proposal.positiveVotes;
      const position = index + 1;
      const isAtRisk = position > maxGamesInfo.maxGames;

      let statusIcon = "";
      if (!maxGamesInfo.isFinished) {
        if (!isAtRisk) {
          statusIcon = "✅"; // Sûr pour l'instant
        } else {
          statusIcon = "⚠️"; // À risque
        }
      } else {
        // Sélection terminée
        if (position <= 2) {
          statusIcon = position === 1 ? "🏆" : "🎖️"; // Les 2 gagnants
        } else {
          statusIcon = "❌"; // Éliminés
        }
      }

      let riskText = "";
      if (!maxGamesInfo.isFinished && isAtRisk) {
        riskText = ` • **Risque d'être supprimé ${
          suppressionInfo.nextDate
            ? "le " +
              suppressionInfo.nextDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "bientôt"
        }**`;
      } else if (maxGamesInfo.isFinished && position > 2) {
        riskText = " • **Éliminé**";
      } else if (!isAtRisk) {
        riskText = " • **Qualifié pour l'étape suivante**";
      }

      content += `${statusIcon} **${position}.** **${
        proposal.name
      }** — ${votes} vote${votes > 1 ? "s" : ""}${riskText}\n`;
    });

    return content;
  } catch (error) {
    logger.error("Erreur lors du formatage du classement:", error);
    return "Erreur lors de la récupération du classement.";
  }
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Envoie ou met à jour le message de classement
 */
async function updateVoteRankingMessage() {
  try {
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
      logger.warn("Client Discord non disponible");
      return false;
    }

    // Récupérer le canal d'annonces
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      logger.error(`Canal d'annonces ${ANNOUNCEMENT_CHANNEL_ID} introuvable`);
      return false;
    }

    // Formater le contenu
    const content = await formatVoteRanking();

    // ✅ CORRECTION: Rechercher un message existant de classement
    let existingMessage = null;
    let messageId = global.tempVoteRankingMessageId;

    // 1. D'abord essayer avec l'ID stocké
    if (messageId) {
      try {
        existingMessage = await channel.messages.fetch(messageId);
        logger.info(`Message existant trouvé avec l'ID stocké: ${messageId}`);
      } catch (fetchError) {
        logger.warn(
          `Message avec ID ${messageId} introuvable:`,
          fetchError.message
        );
        // Réinitialiser l'ID si le message n'existe plus
        global.tempVoteRankingMessageId = null;
      }
    }

    // 2. Si pas trouvé, chercher dans les messages récents du canal
    if (!existingMessage) {
      try {
        const messages = await channel.messages.fetch({ limit: 50 });

        // ✅ CORRECTION: Utiliser la nouvelle signature de recherche
        existingMessage = messages.find(
          (msg) =>
            msg.author.id === client.user.id && // Message du bot
            (msg.content.includes(
              "🎮 **Classement des propositions de jeux**"
            ) || // Nouvelle signature
              msg.content.includes(
                "🎮 **Voici tous les jeux les plus votés !**"
              )) // Ancienne signature (au cas où)
        );

        if (existingMessage) {
          logger.info(
            `Message existant trouvé par recherche: ${existingMessage.id}`
          );
          // Sauvegarder l'ID pour les prochaines fois
          global.tempVoteRankingMessageId = existingMessage.id;
        }
      } catch (searchError) {
        logger.warn(
          "Erreur lors de la recherche de message existant:",
          searchError.message
        );
      }
    }

    // 3. Mettre à jour le message existant ou en créer un nouveau
    if (existingMessage) {
      try {
        await existingMessage.edit({ content });
        logger.info("Message de classement mis à jour");
        return true;
      } catch (editError) {
        logger.error(
          "Erreur lors de la modification du message:",
          editError.message
        );
        // Si l'édition échoue, on va créer un nouveau message
      }
    }

    // 4. Créer un nouveau message seulement si nécessaire
    logger.info("Création d'un nouveau message de classement");
    const newMessage = await channel.send({ content });
    global.tempVoteRankingMessageId = newMessage.id;

    logger.info(`Nouveau message de classement créé: ${newMessage.id}`);
    return true;
  } catch (error) {
    logger.error(
      "Erreur lors de la mise à jour du message de classement:",
      error
    );
    return false;
  }
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Envoie le classement initial
 */
async function sendInitialVoteRanking() {
  logger.info("Envoi du classement initial des votes");
  return await updateVoteRankingMessage();
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Met à jour le classement après un vote
 */
async function onVoteUpdate() {
  logger.info("Mise à jour du classement suite à un vote");
  return await updateVoteRankingMessage();
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Démarre la mise à jour automatique adaptative
 */
function startCountdownUpdates() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function scheduleNextUpdate() {
    const now = new Date();
    const suppressionInfo = getNextSuppressionInfo(now);

    if (suppressionInfo.timeLeft === 0) {
      logger.info("⏰ Toutes les suppressions sont terminées");
      return;
    }

    // Calculer l'intervalle selon la proximité de la prochaine suppression
    const nextSuppression = SUPPRESSION_SCHEDULE.find(
      (step) => now < step.date
    );
    if (!nextSuppression) return;

    const timeToNext = nextSuppression.date.getTime() - now.getTime();
    let updateInterval;

    if (timeToNext <= 60 * 60 * 1000) {
      // Moins d'1 heure
      updateInterval = 5 * 60 * 1000; // Toutes les 5 minutes
    } else if (timeToNext <= 4 * 60 * 60 * 1000) {
      // Moins de 4h
      updateInterval = 15 * 60 * 1000; // Toutes les 15 minutes
    } else {
      updateInterval = 60 * 60 * 1000; // Toutes les heures
    }

    countdownInterval = setTimeout(async () => {
      logger.info("⏰ Mise à jour automatique du classement progressif");
      await updateVoteRankingMessage();
      scheduleNextUpdate();
    }, updateInterval);

    const nextUpdateIn = Math.round(updateInterval / (60 * 1000));
    logger.info(`⏰ Prochaine mise à jour dans ${nextUpdateIn} minutes`);
  }

  scheduleNextUpdate();
  logger.info("⏰ Mises à jour automatiques adaptatives démarrées");
}
/**
 * ⚠️ FONCTION TEMPORAIRE - Arrête la mise à jour automatique
 */
function stopCountdownUpdates() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
    logger.info("⏰ Mises à jour automatiques du compte à rebours arrêtées");
  }
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Envoie le classement initial avec compte à rebours
 */
async function sendInitialVoteRanking() {
  logger.info("Envoi du classement initial des votes avec compte à rebours");

  const result = await updateVoteRankingMessage();

  // ✅ AJOUT: Démarrer les mises à jour automatiques du compte à rebours
  if (result) {
    startCountdownUpdates();
  }

  return result;
}

/**
 * ⚠️ FONCTION TEMPORAIRE - Nettoie les ressources temporaires
 */
function cleanup() {
  logger.info("Nettoyage des ressources temporaires du classement des votes");
  global.tempVoteRankingMessageId = null;

  // ✅ AJOUT: Arrêter les mises à jour automatiques
  stopCountdownUpdates();
}

// ⚠️ EXPORTS TEMPORAIRES - À SUPPRIMER
module.exports = {
  sendInitialVoteRanking,
  updateVoteRankingMessage,
  onVoteUpdate,
  cleanup,
  // Fonction utilitaire pour les tests
  // ✅ AJOUT: Nouvelles fonctions pour le compte à rebours
  startCountdownUpdates,
  stopCountdownUpdates,
  formatVoteRanking,
};

/**
 * ⚠️ INSTRUCTIONS DE SUPPRESSION ⚠️
 *
 * Ce fichier doit être supprimé après le 6 juin 2025.
 *
 * Étapes de nettoyage:
 * 1. Supprimer ce fichier: temp-vote-ranking.js
 * 2. Retirer les imports de ce module dans:
 *    - gameProposalController.js
 *    - index.js (bot principal)
 * 3. Supprimer les appels à onVoteUpdate() dans le contrôleur
 * 4. Supprimer l'appel à sendInitialVoteRanking() au démarrage
 *
 * Rechercher et supprimer toutes les références à:
 * - temp-vote-ranking
 * - onVoteUpdate
 * - sendInitialVoteRanking
 */

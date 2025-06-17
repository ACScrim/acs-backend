const express = require("express");
const router = express.Router();
const { verifyTwitchSignature, sendDiscordNotification, getStreamInfoByUserId } = require('../discord-bot/twitch'); // Ajustez le chemin si nécessaire
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "twitch-bot" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} [${level}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta) : ""
            }`
        )
      ),
    }),
    new winston.transports.File({
      filename: "logs/twitch-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/twitch.log" }),
  ],
});

router.post('/twitch-webhook', async (req, res) => {
  // 1. Vérification de la signature
  // req.rawBody doit être disponible ici (configuré dans server.js)
  if (!req.rawBody) {
    logger.error("rawBody non disponible dans la requête pour la vérification de la signature Twitch.");
    return res.status(400).send('Bad Request: Missing raw body');
  }
  if (!verifyTwitchSignature(req)) {
    logger.warn('Tentative de webhook avec signature invalide rejetée.');
    return res.status(403).send('Forbidden: Invalid signature');
  }

  const messageType = req.header('Twitch-Eventsub-Message-Type');
  const messageId = req.header('Twitch-Eventsub-Message-Id'); // Pour le logging

  logger.info(`Webhook Twitch reçu - Type: ${messageType}, ID: ${messageId}`);

  switch (messageType) {
    case 'webhook_callback_verification':
      const challengeBody = req.body; // req.body est déjà parsé en JSON par express.json()
      logger.info(`Challenge reçu pour EventSub ID: ${challengeBody.subscription.id}. Challenge: ${challengeBody.challenge}`);
      // Renvoyer le 'challenge' tel quel, avec Content-Type text/plain
      return res.status(200).type('text/plain').send(challengeBody.challenge);

    case 'notification':
      const notificationBody = req.body;
      logger.info(`Notification reçue: Subscription Type: ${notificationBody.subscription.type}, Streamer ID: ${notificationBody.event?.broadcaster_user_id}`);

      if (notificationBody.subscription.type === 'stream.online') {
        const eventData = notificationBody.event;
        const streamerUsername = eventData.broadcaster_user_name;
        const streamerId = eventData.broadcaster_user_id;

        logger.info(`Streamer ${streamerUsername} (ID: ${streamerId}) est en ligne ! Event data:`, eventData);

        // Récupérer les détails du stream (titre, jeu)
        const streamDetails = await getStreamInfoByUserId(streamerId);

        if (streamDetails) {
          logger.info(`Détails du stream pour ${streamerUsername}: Titre: ${streamDetails.title}, Jeu: ${streamDetails.game_name}`);
        } else {
          logger.warn(`Impossible de récupérer les détails du stream pour ${streamerUsername}. Notification envoyée sans ces détails.`);
        }
        
        const message = `🔔 ${streamerUsername} est en live !`;
        // streamDetails peut être null, sendDiscordNotification doit pouvoir le gérer
        await sendDiscordNotification(message, streamDetails, streamerUsername);
      }
      // Vous pouvez ajouter d'autres types de notification ici (ex: 'stream.offline')

      return res.status(200).send('Notification received');

    case 'revocation':
      logger.warn('Abonnement EventSub révoqué:', req.body);
      // Vous pourriez vouloir recréer l'abonnement ici ou notifier un admin
      return res.status(200).send('Subscription revoked');

    default:
      logger.info(`Type de message EventSub inconnu: ${messageType}`);
      return res.status(200).send('Unknown message type');
  }
});

module.exports = router;
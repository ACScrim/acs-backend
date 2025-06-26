// const axios = require('axios');
// const crypto = require('crypto');
// // Assuming your User model is here, adjust path as necessary
// const User = require('../models/User'); // You need to create/import your User model
// const winston = require("winston");

// // ===========================================
// // SECTION: CONFIGURATION DU LOGGER
// // ===========================================
// const logger = winston.createLogger({
//   level: process.env.LOG_LEVEL || "info",
//   format: winston.format.combine(
//     winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//     winston.format.errors({ stack: true }),
//     winston.format.splat(),
//     winston.format.json()
//   ),
//   defaultMeta: { service: "twitch-bot" },
//   transports: [
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.printf(
//           ({ timestamp, level, message, ...meta }) =>
//             `${timestamp} [${level}]: ${message} ${
//               Object.keys(meta).length ? JSON.stringify(meta) : ""
//             }`
//         )
//       ),
//     }),
//     new winston.transports.File({
//       filename: "logs/twitch-error.log",
//       level: "error",
//     }),
//     new winston.transports.File({ filename: "logs/twitch.log" }),
//   ],
// });

// const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
// const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
// const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
// const EVENTSUB_SECRET = process.env.EVENTSUB_SECRET || '';
// const BASE_URL = process.env.BASE_URL || ''; // e.g., https://yourdomain.com
// const TWITCH_CALLBACK_PATH = '/api/twitch/twitch-webhook'; // Path where twitch routes are mounted + /twitch-webhook

// // Vérifications initiales
// if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !DISCORD_WEBHOOK_URL || !EVENTSUB_SECRET || !BASE_URL) {
//   logger.error("Erreur: Toutes les variables d'environnement Twitch/Discord ne sont pas configurées.");
//   // process.exit(1); // Consider if you want to exit or just log an error
// }
// if (EVENTSUB_SECRET.length < 10) {
//   logger.error("EVENTSUB_SECRET doit avoir au moins 10 caractères pour des raisons de sécurité.");
//   // process.exit(1);
// }

// // --- 2. Variables d'état ---
// let twitchAccessToken = null;

// // --- 3. Fonctions d'API Twitch ---

// async function getTwitchAccessToken() {
//   const url = "https://id.twitch.tv/oauth2/token";
//   const params = new URLSearchParams();
//   params.append("client_id", TWITCH_CLIENT_ID);
//   params.append("client_secret", TWITCH_CLIENT_SECRET);
//   params.append("grant_type", "client_credentials");
//   try {
//     const response = await axios.post(url, params.toString(), {
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//     });
//     twitchAccessToken = response.data.access_token;
//     logger.info("Nouveau token Twitch obtenu.");
//     return true;
//   } catch (error) {
//     logger.error(`Erreur lors de la récupération du token Twitch: ${error.message}`);
//     twitchAccessToken = null;
//     return false;
//   }
// }

// async function getStreamerId(username) {
//   if (!twitchAccessToken) {
//     logger.info("Pas de token d'accès Twitch. Tentative de récupération...");
//     if (!(await getTwitchAccessToken())) {
//       return null;
//     }
//   }
//   const url = `https://api.twitch.tv/helix/users?login=${username}`;
//   const headers = { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` };
//   try {
//     const response = await axios.get(url, { headers });
//     if (response.data.data && response.data.data.length > 0) {
//       return response.data.data[0].id;
//     } else {
//       logger.warn(`Aucun utilisateur Twitch trouvé pour le nom: ${username}`);
//       return null;
//     }
//   } catch (error) {
//     logger.error(`Erreur lors de la récupération de l'ID du streamer ${username}: ${error.message}`);
//     if (axios.isAxiosError(error) && error.response?.status === 401) {
//       logger.warn("Token Twitch invalide ou expiré. Tentative de rafraîchissement.");
//       if (await getTwitchAccessToken()) {
//         // Retry once after refreshing token
//         try {
//           const retryResponse = await axios.get(url, { headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` } });
//           if (retryResponse.data.data && retryResponse.data.data.length > 0) {
//             return retryResponse.data.data[0].id;
//           }
//         } catch (retryError) {
//           logger.error(`Erreur lors de la nouvelle tentative de récupération de l'ID du streamer ${username}: ${retryError.message}`);
//         }
//       }
//     }
//     return null;
//   }
// }

// async function getStreamInfoByUserId(broadcasterUserId) {
//   if (!twitchAccessToken) {
//     logger.info("Pas de token d'accès Twitch pour getStreamInfoByUserId. Tentative de récupération...");
//     if (!(await getTwitchAccessToken())) {
//       logger.error("Impossible de récupérer les détails du stream: token Twitch manquant.");
//       return null;
//     }
//   }
//   const url = `https://api.twitch.tv/helix/streams?user_id=${broadcasterUserId}`;
//   const headers = { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` };
//   try {
//     const response = await axios.get(url, { headers });
//     if (response.data.data && response.data.data.length > 0) {
//       const streamData = response.data.data[0];
//       return {
//         title: streamData.title,
//         game_name: streamData.game_name,
//         thumbnail_url: streamData.thumbnail_url, // This will have {width}x{height} placeholders
//         // Add any other details you might need
//       };
//     } else {
//       logger.warn(`Aucun stream actif trouvé pour l'utilisateur ID: ${broadcasterUserId}`);
//       return null;
//     }
//   } catch (error) {
//     logger.error(`Erreur lors de la récupération des détails du stream pour l'ID ${broadcasterUserId}: ${error.message}`);
//     if (axios.isAxiosError(error) && error.response?.status === 401) {
//       logger.warn("Token Twitch invalide ou expiré lors de getStreamInfoByUserId. Tentative de rafraîchissement.");
//       if (await getTwitchAccessToken()) {
//         // Retry once after refreshing token
//         try {
//           const retryResponse = await axios.get(url, { headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` } });
//           if (retryResponse.data.data && retryResponse.data.data.length > 0) {
//             const streamData = retryResponse.data.data[0];
//             return {
//               title: streamData.title,
//               game_name: streamData.game_name,
//               thumbnail_url: streamData.thumbnail_url,
//             };
//           }
//         } catch (retryError) {
//           logger.error(`Erreur lors de la nouvelle tentative de récupération des détails du stream pour l'ID ${broadcasterUserId}: ${retryError.message}`);
//         }
//       }
//     }
//     return null;
//   }
// }

// async function sendDiscordNotification(message, streamInfo, streamerUsername) {
//   logger.info("Stream info for Discord notification:", streamInfo);
//   if (!DISCORD_WEBHOOK_URL) {
//     logger.error("URL du webhook Discord non configurée.");
//     return;
//   }
//   const embed = {
//     title: "🔴 EN LIVE !",
//     description: `${streamerUsername} est en direct sur Twitch !`,
//     color: 0x9146FF,
//     url: `https://www.twitch.tv/${streamerUsername}`,
//     footer: { text: "Notifications Twitch" },
//     timestamp: new Date().toISOString()
//   };
//   if (streamInfo) {
//     embed.fields = [
//       { name: "Titre du live", value: streamInfo.title || "N/A", inline: false },
//       { name: "Jeu", value: streamInfo.game_name || "N/A", inline: false }
//     ];
//     if (streamInfo.thumbnail_url) {
//       const thumbnailUrl = streamInfo.thumbnail_url.replace("{width}", "1280").replace("{height}", "720");
//       embed.image = { url: thumbnailUrl };
//     }
//   }
//   const payload = { content: message, embeds: [embed] };
//   try {
//     await axios.post(DISCORD_WEBHOOK_URL, payload, { headers: { 'Content-Type': 'application/json' } });
//     logger.info(`Notification Discord envoyée pour ${streamerUsername}.`);
//   } catch (error) {
//     logger.error(`Erreur lors de l'envoi de la notification Discord pour ${streamerUsername}: ${error.message}`);
//   }
// }

// // --- 4. Fonctions EventSub ---

// function verifyTwitchSignature(req) {
//   const messageId = req.header('Twitch-Eventsub-Message-Id');
//   const timestamp = req.header('Twitch-Eventsub-Message-Timestamp');
//   const signature = req.header('Twitch-Eventsub-Message-Signature');
//   const body = req.rawBody; // Corps brut stocké par le middleware (doit être une chaîne)

//   if (!messageId || !timestamp || !signature || !body) {
//     logger.error("Missing Twitch signature headers or rawBody.");
//     return false;
//   }

//   const hmacMessage = messageId + timestamp + body;
//   const hmac = crypto.createHmac('sha256', EVENTSUB_SECRET)
//     .update(hmacMessage)
//     .digest('hex');
//   const expectedSignature = `sha256=${hmac}`;

//   try {
//     // crypto.timingSafeEqual requires buffers of the same length
//     const sigBuffer = Buffer.from(signature);
//     const expectedSigBuffer = Buffer.from(expectedSignature);
//     if (sigBuffer.length !== expectedSigBuffer.length) {
//       logger.warn("Invalid Twitch signature received (length mismatch).");
//       return false;
//     }
//     const isValid = crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
//     if (!isValid) {
//       logger.warn("Invalid Twitch signature received.");
//     }
//     return isValid;
//   } catch (e) {
//     logger.error("Error during timingSafeEqual:", e);
//     return false;
//   }
// }

// async function createEventSubSubscription(streamerIdToSubscribe, streamerUsername, userId) {
//   if (!twitchAccessToken || !streamerIdToSubscribe) {
//     logger.error("Impossible de créer l'abonnement EventSub: token ou ID streamer manquant.", { hasToken: !!twitchAccessToken, streamerIdToSubscribe });
//     return false;
//   }

//   const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
//   const headers = {
//     "Client-ID": TWITCH_CLIENT_ID,
//     "Authorization": `Bearer ${twitchAccessToken}`,
//     "Content-Type": "application/json"
//   };

//   const callbackUrl = `${BASE_URL}${TWITCH_CALLBACK_PATH}`;
//   logger.info(`Utilisation du callback URL pour EventSub: ${callbackUrl}`);

//   const data = {
//     type: "stream.online",
//     version: "1",
//     condition: {
//       broadcaster_user_id: streamerIdToSubscribe
//     },
//     transport: {
//       method: "webhook",
//       callback: callbackUrl,
//       secret: EVENTSUB_SECRET
//     }
//   };

//   try {
//     const response = await axios.post(url, data, { headers });
//     logger.info(`Abonnement EventSub créé/vérifié pour streamer ID ${streamerIdToSubscribe}:`, { status: response.status, subscriptionId: response.data?.data[0]?.id });
//     // Mettre à jour l'utilisateur avec le nouvel ID d'abonnement
//     const user = await User.findById(userId);
//     if (user) {
//       user.profile.twitchSubscriptionId = response.data?.data[0]?.id || null;
//       await user.save(); // Correction: 'return await user.save()' était ici, déplacé pour retourner true/false
//       return true;
//     } else {
//       logger.error(`Utilisateur non trouvé avec l'ID: ${userId} lors de la mise à jour de twitchSubscriptionId.`);
//       return false;
//     }
//   } catch (error) {
//     logger.error(`Erreur lors de la création/vérification de l'abonnement EventSub pour streamer ID ${streamerIdToSubscribe}: ${error.message}`);
//     if (axios.isAxiosError(error) && error.response?.data) {
//       logger.error("Détails de l'erreur EventSub:", error.response.data);
//     }
//     return false;
//   }
// }

// async function deleteAllEventSubSubscriptions() {
//   if (!twitchAccessToken) {
//     logger.info("Pas de token d'accès Twitch. Tentative de récupération...");
//     if (!(await getTwitchAccessToken())) {
//       logger.error("Impossible de supprimer les abonnements: token Twitch manquant.");
//       return;
//     }
//   }
//   logger.info("Récupération de tous les abonnements EventSub...");
//   try {
//     const response = await axios.get("https://api.twitch.tv/helix/eventsub/subscriptions", {
//       headers: {
//         "Client-ID": TWITCH_CLIENT_ID,
//         "Authorization": `Bearer ${twitchAccessToken}`
//       }
//     });
//     const subscriptions = response.data.data;
//     if (subscriptions && subscriptions.length > 0) {
//       logger.info(`Trouvé ${subscriptions.length} abonnements à supprimer.`);
//       for (const sub of subscriptions) {
//         try {
//           await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
//             headers: {
//               "Client-ID": TWITCH_CLIENT_ID,
//               "Authorization": `Bearer ${twitchAccessToken}`
//             }
//           });
//           logger.info(`Abonnement ${sub.id} (type: ${sub.type}, status: ${sub.status}) supprimé.`);
//         } catch (deleteError) {
//           logger.error(`Erreur lors de la suppression de l'abonnement ${sub.id}: ${deleteError.message}`);
//         }
//       }
//     } else {
//       logger.info("Aucun abonnement EventSub actif trouvé à supprimer.");
//     }
//   } catch (error) {
//     logger.error(`Erreur lors de la récupération des abonnements EventSub: ${error.message}`);
//   }
// }

// async function deleteOneEventSubSubscription(subscriptionId) {
//   if (!twitchAccessToken) { // Ajout d'une vérification et tentative de récupération du token
//     logger.info("Pas de token d'accès Twitch pour deleteOneEventSubSubscription. Tentative de récupération...");
//     if (!(await getTwitchAccessToken())) {
//       logger.error("Impossible de supprimer l'abonnement EventSub: token Twitch manquant.");
//       return false;
//     }
//   }
//   if (!subscriptionId) { // Vérification de subscriptionId après la tentative de token
//     logger.error("Impossible de supprimer l'abonnement EventSub: ID d'abonnement manquant.");
//     return false;
//   }

//   try {
//     await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
//       headers: {
//         "Client-ID": TWITCH_CLIENT_ID,
//         "Authorization": `Bearer ${twitchAccessToken}`
//       }
//     });
//     logger.info(`Abonnement EventSub ${subscriptionId} supprimé avec succès.`);
//     return true;
//   } catch (error) {
//     logger.error(`Erreur lors de la suppression de l'abonnement EventSub ${subscriptionId}: ${error.message}`);
//     if (axios.isAxiosError(error) && error.response?.status === 404) {
//         logger.warn(`Abonnement EventSub ${subscriptionId} non trouvé lors de la tentative de suppression (404). Il a peut-être déjà été supprimé.`);
//         return true; // Considérer comme un succès si non trouvé
//     }
//     return false;
//   }
// }

// async function initializeTwitchEventSubscriptions() {
//   logger.info("Initialisation des abonnements Twitch EventSub...");
//   if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !EVENTSUB_SECRET || !BASE_URL) {
//     logger.warn("Variables d'environnement Twitch manquantes. Initialisation annulée.");
//     return;
//   }

//   if (!await getTwitchAccessToken()) {
//     logger.error("Impossible d'initialiser les abonnements EventSub: échec de l'obtention du token Twitch.");
//     return;
//   }

//   // Optionnel: Supprimer tous les anciens abonnements au démarrage pour éviter les doublons ou les callbacks morts
//   // Attention: à utiliser avec prudence, surtout en production.
//   await deleteAllEventSubSubscriptions();

//   const usersWithTwitch = await User.find({ 'profile.twitchUsername': { $exists: true, $ne: null, $ne: "" } }).select('profile.twitchUsername _id').lean();

//   if (!usersWithTwitch || usersWithTwitch.length === 0) {
//     logger.info("Aucun utilisateur avec un nom d'utilisateur Twitch configuré trouvé.");
//     return;
//   }

//   logger.info(`Trouvé ${usersWithTwitch.length} utilisateurs avec des noms Twitch. Tentative de création d'abonnements...`);

//   for (const user of usersWithTwitch) {
//     if (user.profile && user.profile.twitchUsername) {
//       logger.info(`Traitement de l'utilisateur ID ${user._id} avec Twitch: ${user.profile.twitchUsername}`);
//       const streamerId = await getStreamerId(user.profile.twitchUsername);
//       if (streamerId) {
//         await createEventSubSubscription(streamerId, user.profile.twitchUsername, user._id);
//       } else {
//         logger.warn(`Impossible d'obtenir l'ID Twitch pour ${user.profile.twitchUsername} (Utilisateur ID: ${user._id}). Abonnement ignoré.`);
//       }
//     } else {
//       logger.warn(`Utilisateur ID ${user._id} n'a pas de profile.twitchUsername défini.`);
//     }
//   }
//   logger.info("Initialisation des abonnements Twitch EventSub terminée.");
// }

// async function addOneTwitchEventSubscription(streamerUsername, userId, oldSubscriptionId = null) {
//   if (!streamerUsername || typeof streamerUsername !== 'string' || streamerUsername.trim() === '') {
//     logger.error("Nom d'utilisateur Twitch invalide pour l'abonnement.", { userId });
//     return false;
//   }

//   if (!await getTwitchAccessToken()) { // S'assurer que le token est disponible
//     logger.error("Impossible d'ajouter l'abonnement EventSub: échec de l'obtention du token Twitch.", { userId, streamerUsername });
//     return false;
//   }

//   if (oldSubscriptionId && typeof oldSubscriptionId === 'string' && oldSubscriptionId.trim() !== '') {
//     logger.info(`Tentative de suppression de l'ancien abonnement ID: ${oldSubscriptionId} pour l'utilisateur ID: ${userId}`);
//     await deleteOneEventSubSubscription(oldSubscriptionId);
//   }

//   const streamerId = await getStreamerId(streamerUsername);
//   if (!streamerId) {
//     logger.error(`Impossible d'obtenir l'ID Twitch pour ${streamerUsername}. Abonnement non créé.`, { userId });
//     return false;
//   }

//   logger.info(`Création d'un nouvel abonnement pour ${streamerUsername} (ID: ${streamerId}), utilisateur ID: ${userId}`);
//   return await createEventSubSubscription(streamerId, streamerUsername, userId);
// }

// module.exports = {
//   verifyTwitchSignature,
//   sendDiscordNotification,
//   initializeTwitchEventSubscriptions,
//   getStreamInfoByUserId,
//   addOneTwitchEventSubscription,
//   deleteOneEventSubSubscription // Exposer deleteOneEventSubSubscription
//   // getTwitchAccessToken,
//   // createEventSubSubscription,
//   // getStreamerId
// };

const axios = require('axios');
const crypto = require('crypto');
// Assuming your User model is here, adjust path as necessary
const User = require('../models/User'); // You need to create/import your User model

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const EVENTSUB_SECRET = process.env.EVENTSUB_SECRET || '';
const BASE_URL = process.env.BASE_URL || ''; // e.g., https://yourdomain.com
const TWITCH_CALLBACK_PATH = '/api/twitch/twitch-webhook'; // Path where twitch routes are mounted + /twitch-webhook

// Vérifications initiales
if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !DISCORD_WEBHOOK_URL || !EVENTSUB_SECRET || !BASE_URL) {
  console.error("Erreur: Toutes les variables d'environnement Twitch/Discord ne sont pas configurées.");
  // process.exit(1); // Consider if you want to exit or just log an error
}
if (EVENTSUB_SECRET.length < 10) {
  console.error("EVENTSUB_SECRET doit avoir au moins 10 caractères pour des raisons de sécurité.");
  // process.exit(1);
}

// --- 2. Variables d'état ---
let twitchAccessToken = null;

// --- 3. Fonctions d'API Twitch ---

async function getTwitchAccessToken() {
  const url = "https://id.twitch.tv/oauth2/token";
  const params = new URLSearchParams();
  params.append("client_id", TWITCH_CLIENT_ID);
  params.append("client_secret", TWITCH_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");
  try {
    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    twitchAccessToken = response.data.access_token;
    console.log("Nouveau token Twitch obtenu.");
    return true;
  } catch (error) {
    console.error(`Erreur lors de la récupération du token Twitch: ${error.message}`);
    twitchAccessToken = null;
    return false;
  }
}

async function getStreamerId(username) {
  if (!twitchAccessToken) {
    console.log("Pas de token d'accès Twitch. Tentative de récupération...");
    if (!(await getTwitchAccessToken())) {
      return null;
    }
  }
  const url = `https://api.twitch.tv/helix/users?login=${username}`;
  const headers = { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` };
  try {
    const response = await axios.get(url, { headers });
    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0].id;
    } else {
      console.warn(`Aucun utilisateur Twitch trouvé pour le nom: ${username}`);
      return null;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'ID du streamer ${username}: ${error.message}`);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.warn("Token Twitch invalide ou expiré. Tentative de rafraîchissement.");
      if (await getTwitchAccessToken()) {
        // Retry once after refreshing token
        try {
          const retryResponse = await axios.get(url, { headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` } });
          if (retryResponse.data.data && retryResponse.data.data.length > 0) {
            return retryResponse.data.data[0].id;
          }
        } catch (retryError) {
          console.error(`Erreur lors de la nouvelle tentative de récupération de l'ID du streamer ${username}: ${retryError.message}`);
        }
      }
    }
    return null;
  }
}

async function getStreamInfoByUserId(broadcasterUserId) {
  if (!twitchAccessToken) {
    console.log("Pas de token d'accès Twitch pour getStreamInfoByUserId. Tentative de récupération...");
    if (!(await getTwitchAccessToken())) {
      console.error("Impossible de récupérer les détails du stream: token Twitch manquant.");
      return null;
    }
  }
  const url = `https://api.twitch.tv/helix/streams?user_id=${broadcasterUserId}`;
  const headers = { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` };
  try {
    const response = await axios.get(url, { headers });
    if (response.data.data && response.data.data.length > 0) {
      const streamData = response.data.data[0];
      return {
        title: streamData.title,
        game_name: streamData.game_name,
        thumbnail_url: streamData.thumbnail_url, // This will have {width}x{height} placeholders
        // Add any other details you might need
      };
    } else {
      console.warn(`Aucun stream actif trouvé pour l'utilisateur ID: ${broadcasterUserId}`);
      return null;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails du stream pour l'ID ${broadcasterUserId}: ${error.message}`);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.warn("Token Twitch invalide ou expiré lors de getStreamInfoByUserId. Tentative de rafraîchissement.");
      if (await getTwitchAccessToken()) {
        // Retry once after refreshing token
        try {
          const retryResponse = await axios.get(url, { headers: { "Client-ID": TWITCH_CLIENT_ID, "Authorization": `Bearer ${twitchAccessToken}` } });
          if (retryResponse.data.data && retryResponse.data.data.length > 0) {
            const streamData = retryResponse.data.data[0];
            return {
              title: streamData.title,
              game_name: streamData.game_name,
              thumbnail_url: streamData.thumbnail_url,
            };
          }
        } catch (retryError) {
          console.error(`Erreur lors de la nouvelle tentative de récupération des détails du stream pour l'ID ${broadcasterUserId}: ${retryError.message}`);
        }
      }
    }
    return null;
  }
}

async function sendDiscordNotification(message, streamInfo, streamerUsername) {
  console.log(streamInfo)
  if (!DISCORD_WEBHOOK_URL) {
    console.error("URL du webhook Discord non configurée.");
    return;
  }
  const embed = {
    title: "🔴 EN LIVE !",
    description: `${streamerUsername} est en direct sur Twitch !`,
    color: 0x9146FF,
    url: `https://www.twitch.tv/${streamerUsername}`,
    footer: { text: "Notifications Twitch" },
    timestamp: new Date().toISOString()
  };
  if (streamInfo) {
    embed.fields = [
      { name: "Titre du live", value: streamInfo.title || "N/A", inline: false },
      { name: "Jeu", value: streamInfo.game_name || "N/A", inline: false }
    ];
    if (streamInfo.thumbnail_url) {
      const thumbnailUrl = streamInfo.thumbnail_url.replace("{width}", "1280").replace("{height}", "720");
      embed.image = { url: thumbnailUrl };
    }
  }
  const payload = { content: message, embeds: [embed] };
  try {
    await axios.post(DISCORD_WEBHOOK_URL, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log(`Notification Discord envoyée pour ${streamerUsername}.`);
  } catch (error) {
    console.error(`Erreur lors de l'envoi de la notification Discord pour ${streamerUsername}: ${error.message}`);
  }
}

// --- 4. Fonctions EventSub ---

function verifyTwitchSignature(req) {
  const messageId = req.header('Twitch-Eventsub-Message-Id');
  const timestamp = req.header('Twitch-Eventsub-Message-Timestamp');
  const signature = req.header('Twitch-Eventsub-Message-Signature');
  const body = req.rawBody; // Corps brut stocké par le middleware (doit être une chaîne)

  if (!messageId || !timestamp || !signature || !body) {
    console.error("Missing Twitch signature headers or rawBody.");
    return false;
  }

  const hmacMessage = messageId + timestamp + body;
  const hmac = crypto.createHmac('sha256', EVENTSUB_SECRET)
    .update(hmacMessage)
    .digest('hex');
  const expectedSignature = `sha256=${hmac}`;

  try {
    // crypto.timingSafeEqual requires buffers of the same length
    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedSigBuffer.length) {
      console.warn("Invalid Twitch signature received (length mismatch).");
      return false;
    }
    const isValid = crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
    if (!isValid) {
      console.warn("Invalid Twitch signature received.");
    }
    return isValid;
  } catch (e) {
    console.error("Error during timingSafeEqual:", e);
    return false;
  }
}

async function createEventSubSubscription(streamerIdToSubscribe, streamerUsername) {
  if (!twitchAccessToken || !streamerIdToSubscribe) {
    console.error("Impossible de créer l'abonnement EventSub: token ou ID streamer manquant.", { hasToken: !!twitchAccessToken, streamerIdToSubscribe });
    return false;
  }

  const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
  const headers = {
    "Client-ID": TWITCH_CLIENT_ID,
    "Authorization": `Bearer ${twitchAccessToken}`,
    "Content-Type": "application/json"
  };

  const callbackUrl = `${BASE_URL}${TWITCH_CALLBACK_PATH}`;
  console.log(`Utilisation du callback URL pour EventSub: ${callbackUrl}`);

  const data = {
    type: "stream.online",
    version: "1",
    condition: {
      broadcaster_user_id: streamerIdToSubscribe
    },
    transport: {
      method: "webhook",
      callback: callbackUrl,
      secret: EVENTSUB_SECRET
    }
  };

  try {
    const response = await axios.post(url, data, { headers });
    console.log(`Abonnement EventSub créé/vérifié pour streamer ID ${streamerIdToSubscribe}:`, response.status, response.data?.data[0]?.id);
    // Mettre à jour l'utilisateur avec le nouvel ID d'abonnement
    const user = await User.findOneAndUpdate(
      { 'profile.twitchUsername': streamerUsername },
      { 'profile.twitchSubscriptionId': response.data.data[0].id },
      { new: true }
    ).lean();
    return true;
  } catch (error) {
    console.error(`Erreur lors de la création/vérification de l'abonnement EventSub pour streamer ID ${streamerIdToSubscribe}: ${error.message}`);
    if (axios.isAxiosError(error) && error.response?.data) {
      console.error("Détails de l'erreur EventSub:", error.response.data);
    }
    return false;
  }
}

async function deleteAllEventSubSubscriptions() {
  if (!twitchAccessToken) {
    console.log("Pas de token d'accès Twitch. Tentative de récupération...");
    if (!(await getTwitchAccessToken())) {
      console.error("Impossible de supprimer les abonnements: token Twitch manquant.");
      return;
    }
  }
  console.log("Récupération de tous les abonnements EventSub...");
  try {
    const response = await axios.get("https://api.twitch.tv/helix/eventsub/subscriptions", {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${twitchAccessToken}`
      }
    });
    const subscriptions = response.data.data;
    if (subscriptions && subscriptions.length > 0) {
      console.log(`Trouvé ${subscriptions.length} abonnements à supprimer.`);
      for (const sub of subscriptions) {
        try {
          await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
            headers: {
              "Client-ID": TWITCH_CLIENT_ID,
              "Authorization": `Bearer ${twitchAccessToken}`
            }
          });
          console.log(`Abonnement ${sub.id} (type: ${sub.type}, status: ${sub.status}) supprimé.`);
        } catch (deleteError) {
          console.error(`Erreur lors de la suppression de l'abonnement ${sub.id}: ${deleteError.message}`);
        }
      }
    } else {
      console.log("Aucun abonnement EventSub actif trouvé à supprimer.");
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des abonnements EventSub: ${error.message}`);
  }
}

async function deleteOneEventSubSubscription(subscriptionId) {
  if (!twitchAccessToken || !subscriptionId) {
    console.error("Impossible de supprimer l'abonnement EventSub: token ou ID d'abonnement manquant.");
    return false;
  }

  try {
    const response = await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${twitchAccessToken}`
      }
    });
    console.log(`Abonnement EventSub ${subscriptionId} supprimé avec succès.`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la suppression de l'abonnement EventSub ${subscriptionId}: ${error.message}`);
    return false;
  }
}

async function initializeTwitchEventSubscriptions() {
  console.log("Initialisation des abonnements Twitch EventSub...");
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !EVENTSUB_SECRET || !BASE_URL) {
    console.warn("Variables d'environnement Twitch manquantes. Initialisation annulée.");
    return;
  }

  if (!await getTwitchAccessToken()) {
    console.error("Impossible d'initialiser les abonnements EventSub: échec de l'obtention du token Twitch.");
    return;
  }

  // Optionnel: Supprimer tous les anciens abonnements au démarrage pour éviter les doublons ou les callbacks morts
  // Attention: à utiliser avec prudence, surtout en production.
  await deleteAllEventSubSubscriptions();

  const usersWithTwitch = await User.find({ 'profile.twitchUsername': { $exists: true, $ne: null } }).select('profile.twitchUsername').lean();

  if (!usersWithTwitch || usersWithTwitch.length === 0) {
    console.log("Aucun utilisateur avec un nom d'utilisateur Twitch configuré trouvé.");
    return;
  }

  console.log(`Trouvé ${usersWithTwitch.length} utilisateurs avec des noms Twitch. Tentative de création d'abonnements...`);

  for (const user of usersWithTwitch) {
    if (user.profile.twitchUsername) {
      console.log(`Traitement de l'utilisateur avec Twitch: ${user.profile.twitchUsername}`);
      const streamerId = await getStreamerId(user.profile.twitchUsername);
      if (streamerId) {
        await createEventSubSubscription(streamerId, user.profile.twitchUsername);
      } else {
        console.warn(`Impossible d'obtenir l'ID Twitch pour ${user.profile.twitchUsername}. Abonnement ignoré.`);
      }
    }
  }
  console.log("Initialisation des abonnements Twitch EventSub terminée.");
}

async function addOneTwitchEventSubscription(streamerUsername) {
  if (!streamerUsername || typeof streamerUsername !== 'string' || streamerUsername.trim() === '') {
    console.error("Nom d'utilisateur Twitch invalide pour l'abonnement.");
    return false;
  }

  const existingUser = await User.findOne({ 'profile.twitchUsername': streamerUsername }).lean();
  if (!existingUser) {
    console.error(`Aucun utilisateur trouvé avec le nom d'utilisateur Twitch: ${streamerUsername}`);
    return false;
  }

  await deleteOneEventSubSubscription(existingUser.profile.twitchSubscriptionId);

  const streamerId = await getStreamerId(streamerUsername);
  if (!streamerId) {
    console.error(`Impossible d'obtenir l'ID Twitch pour ${streamerUsername}. Abonnement non créé.`);
    return false;
  }

  return await createEventSubSubscription(streamerId, streamerUsername);
}

module.exports = {
  verifyTwitchSignature,
  sendDiscordNotification,
  initializeTwitchEventSubscriptions,
  getStreamInfoByUserId,
  addOneTwitchEventSubscription
  // Exposez d'autres fonctions si nécessaire, par exemple pour des commandes manuelles
  // getTwitchAccessToken,
  // createEventSubSubscription,
  // getStreamerId
};
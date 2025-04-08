const {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const winston = require("winston");
const Player = require("../models/Player");

// Configuration initiale et variables d'environnement
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID || "1330973733929615420";
const parentChannelId =
  process.env.DISCORD_PARENT_CHANNEL_ID || "1330973733929615424";
const channelsToKeep = ["1351248026491949157", "1330973733929615426"];

// ===========================================
// SECTION: CONFIGURATION DU LOGGER
// ===========================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "discord-bot" },
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
      filename: "logs/discord-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/discord.log" }),
  ],
});

// ===========================================
// SECTION: CONFIGURATION DU CLIENT DISCORD
// ===========================================
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// ===========================================
// SECTION: FONCTIONS UTILITAIRES
// ===========================================

/**
 * Récupère le serveur Discord configuré
 * @returns {Promise<Guild|null>} L'objet guild Discord ou null en cas d'erreur
 */
const fetchGuild = async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    logger.debug(`Serveur Discord récupéré: ${guild.name}`);
    return guild;
  } catch (error) {
    logger.error(
      `Erreur lors de la récupération du serveur Discord (ID: ${guildId}):`,
      error
    );
    return null;
  }
};

/**
 * Formate une date en heure française (UTC+1 ou UTC+2 selon DST)
 * @param {Date} date - La date à formater
 * @returns {string} La date formatée en heure française
 */
function formatDateToFrenchTimezone(date) {
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  };
  return date.toLocaleString("fr-FR", options);
}

/**
 * Trouve un canal dans la liste des canaux selon différents critères
 * @param {Collection} channels - Collection de canaux Discord
 * @param {string} targetChannelName - Nom du canal à rechercher
 * @param {number} channelType - Type de canal à rechercher (texte, vocal, etc.)
 * @param {Array} fallbackNames - Noms alternatifs à rechercher si le canal principal n'est pas trouvé
 * @returns {Channel|null} Le canal trouvé ou null
 */
function findChannel(
  channels,
  targetChannelName,
  channelType = ChannelType.GuildText,
  fallbackNames = []
) {
  // Recherche par nom spécifié
  if (targetChannelName) {
    const channel = channels.find(
      (c) =>
        c.name.toLowerCase() === targetChannelName.toLowerCase() &&
        c.type === channelType
    );
    if (channel) return channel;
  }

  // Recherche par noms alternatifs
  for (const name of fallbackNames) {
    const channel = channels.find(
      (c) => c.name.toLowerCase().includes(name) && c.type === channelType
    );
    if (channel) return channel;
  }

  return null;
}

/**
 * Crée un embed Discord pour les messages communs
 * @param {Object} options - Options de configuration de l'embed
 * @returns {EmbedBuilder} L'embed Discord configuré
 */
function createEmbed({
  title,
  description,
  color = "#ec4899",
  fields = [],
  footerText = "ACS",
  timestamp = true,
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);

  // Ajouter les champs s'ils existent
  if (fields && fields.length > 0) {
    embed.addFields(...fields);
  }

  // Ajouter un pied de page s'il existe
  if (footerText) {
    embed.setFooter({ text: footerText });
  }

  // Ajouter un timestamp si demandé
  if (timestamp) {
    embed.setTimestamp();
  }

  return embed;
}

// ===========================================
// SECTION: GESTION DES CANAUX VOCAUX
// ===========================================

/**
 * Supprime tous les canaux vocaux sauf ceux dans la liste des canaux à conserver
 */
const deleteChannel = async () => {
  try {
    const guild = await fetchGuild();
    if (!guild) return;

    const channels = await guild.channels.fetch();
    logger.info(
      `Suppression des salons vocaux: ${channels.size} canaux trouvés`
    );

    let deletedCount = 0;
    let skipCount = 0;

    for (const [id, channel] of channels) {
      if (
        channel.type === ChannelType.GuildVoice &&
        !channelsToKeep.includes(channel.id)
      ) {
        try {
          await channel.delete();
          logger.info(`Salon vocal "${channel.name}" supprimé`);
          deletedCount++;
        } catch (err) {
          logger.error(
            `Erreur lors de la suppression du salon vocal "${channel.name}":`,
            err
          );
        }
      } else if (channel.type === ChannelType.GuildVoice) {
        logger.debug(
          `Salon vocal "${channel.name}" conservé (dans la liste des exceptions)`
        );
        skipCount++;
      }
    }

    logger.info(
      `Suppression terminée: ${deletedCount} supprimés, ${skipCount} conservés`
    );
  } catch (error) {
    logger.error("Erreur lors de la suppression des salons vocaux:", error);
  }
};

/**
 * Crée un nouveau canal vocal avec le nom spécifié
 * @param {string} nomTeam - Nom de l'équipe/du canal à créer
 */
const createChannel = async (nomTeam) => {
  try {
    const guild = await fetchGuild();
    if (!guild) return;

    const channel = await guild.channels.create({
      type: ChannelType.GuildVoice,
      name: nomTeam,
      parent: parentChannelId,
    });

    logger.info(
      `Salon vocal "${channel.name}" créé avec succès (ID: ${channel.id})`
    );
    return channel;
  } catch (error) {
    logger.error(
      `Erreur lors de la création du salon vocal "${nomTeam}":`,
      error
    );
    return null;
  }
};

/**
 * Supprime les canaux existants et crée de nouveaux canaux pour chaque équipe
 * @param {string[]} nomsTeam - Liste des noms d'équipes pour lesquels créer des canaux
 */
const deleteAndCreateChannels = async (nomsTeam) => {
  try {
    logger.info(
      `Début du processus de recréation des salons vocaux pour ${nomsTeam.length} équipes`
    );

    // D'abord, supprimer les canaux existants
    await deleteChannel();

    // Ensuite, créer de nouveaux canaux pour chaque équipe
    const creationPromises = nomsTeam.map((nomTeam) => createChannel(nomTeam));

    // Attendre que toutes les créations soient terminées
    await Promise.all(creationPromises);

    logger.info(
      "Processus de recréation des salons vocaux terminé avec succès"
    );
  } catch (error) {
    logger.error(
      "Erreur globale lors du processus de recréation des salons vocaux:",
      error
    );
  }
};

// ===========================================
// SECTION: NOTIFICATIONS JOUEURS
// ===========================================

/**
 * Envoie un message privé à un joueur Discord
 * @param {Object} player - Le joueur à notifier
 * @param {EmbedBuilder} embed - L'embed à envoyer
 * @param {string} messageContent - Le contenu textuel du message
 * @returns {Promise<boolean>} Succès ou échec de l'envoi
 */
async function sendDirectMessage(player, embed, messageContent) {
  if (!player || !player.discordId) {
    logger.warn(`Pas de Discord ID pour le joueur ${player?._id || "inconnu"}`);
    return false;
  }

  try {
    const guild = await fetchGuild();
    if (!guild) return false;

    const member = await guild.members.fetch(player.discordId);
    if (!member) {
      logger.warn(`Membre Discord non trouvé pour l'ID: ${player.discordId}`);
      return false;
    }

    await member.send({ content: messageContent, embeds: [embed] });
    logger.debug(
      `✅ Message envoyé à ${player.username} (Discord ID: ${player.discordId})`
    );
    return true;
  } catch (error) {
    logger.error(
      `Erreur lors de l'envoi d'un message à ${
        player?.username || "joueur inconnu"
      }:`,
      error
    );
    return false;
  }
}

/**
 * Notifie un joueur qu'il a été promu de la liste d'attente
 * @param {Object} player - Le joueur promu
 * @param {Object} tournament - Le tournoi concerné
 * @returns {Promise<boolean>} Succès ou échec de l'envoi
 */
const notifyPlayerPromoted = async (player, tournament) => {
  try {
    const embed = createEmbed({
      title: `✅ Vous êtes inscrit à ${tournament.name}!`,
      description:
        "Bonne nouvelle! Vous avez été déplacé de la liste d'attente à la liste des participants du tournoi.",
      color: "#10B981", // Vert émeraude
      fields: [
        {
          name: "Date du tournoi",
          value: formatDateToFrenchTimezone(new Date(tournament.date)),
          inline: true,
        },
      ],
    });

    const messageContent = `**Promotion au tournoi ${tournament.name}**\nVous avez été inscrit au tournoi suite à une place libérée ou une augmentation du nombre de places.`;

    return await sendDirectMessage(player, embed, messageContent);
  } catch (error) {
    logger.error(`Erreur globale lors de la notification au joueur:`, error);
    return false;
  }
};

/**
 * Envoie un MP à tous les joueurs inscrits à un tournoi pour leur rappeler le check-in
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<{success: number, failed: number}>} Nombre de messages envoyés avec succès et échoués
 */
const sendCheckInReminders = async (tournament) => {
  if (!tournament || !tournament.players || tournament.players.length === 0) {
    logger.warn("Pas de joueurs à notifier pour ce tournoi");
    return { success: 0, failed: 0 };
  }

  logger.info(
    `Envoi de rappels de check-in à ${tournament.players.length} joueurs pour le tournoi "${tournament.name}"`
  );

  // Récupérer le serveur Discord
  const guild = await fetchGuild();
  if (!guild) {
    logger.error("Impossible de récupérer le serveur Discord");
    return { success: 0, failed: tournament.players.length };
  }

  let success = 0;
  let failed = 0;

  // Récupérer les documents Player pour tous les joueurs
  const players = await Promise.all(
    tournament.players.map((playerId) => Player.findById(playerId))
  );

  // Créer un embed pour le message privé
  const embed = createEmbed({
    title: `🎮 Hey! ${tournament.name} arrive bientôt!`,
    description:
      "Salut! On voulait te rappeler que tu n'as pas encore fait ton check-in pour le tournoi. Sans ça, tu ne pourras pas participer... et ce serait vraiment dommage de rater ça!",
    color: "#ec4899", // Rose cyberpunk
    fields: [
      {
        name: "🕹️ Jeu",
        value: tournament.game?.name || "Non spécifié",
        inline: true,
      },
      {
        name: "📅 Date",
        value: formatDateToFrenchTimezone(new Date(tournament.date)),
        inline: true,
      },
      {
        name: "⚡ Action à faire",
        value: `Clique sur [ce lien](https://acscrim.fr/tournois/${tournament._id}) pour confirmer ta présence en quelques secondes.`,
      },
    ],
    footerText: "À très vite sur le tournoi! L'équipe ACS",
  });

  // Envoyer un MP à chaque joueur
  for (const player of players) {
    if (!player || !player.discordId) {
      logger.debug(
        `Pas de Discord ID pour le joueur ${player?._id || "inconnu"}`
      );
      failed++;
      continue;
    }

    try {
      // Vérifier si le joueur a déjà fait son check-in
      const hasCheckedIn =
        tournament.checkIns &&
        tournament.checkIns.get(player._id.toString()) === true;

      // Ne pas envoyer de rappel aux joueurs qui ont déjà fait leur check-in
      if (hasCheckedIn) {
        logger.debug(
          `Le joueur ${player.username} a déjà fait son check-in, pas de rappel envoyé`
        );
        success++; // On compte comme un succès car pas besoin d'envoyer
        continue;
      }

      const messageContent = `**Salut ${player.username}! 👋 N'oublie pas de faire ton check-in pour ${tournament.name}**`;
      const sent = await sendDirectMessage(player, embed, messageContent);

      if (sent) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error(
        `Erreur lors de l'envoi du rappel à ${
          player?.username || player?._id || "joueur inconnu"
        }:`,
        error
      );
      failed++;
    }
  }

  logger.info(
    `Envoi des rappels de check-in terminé: ${success} réussis, ${failed} échoués`
  );
  return { success, failed };
};

/**
 * Envoie une notification pour un tournoi imminent
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de l'envoi
 */
const sendTournamentReminder = async (tournament) => {
  try {
    const guild = await fetchGuild();
    if (!guild) {
      logger.error("Impossible de récupérer le serveur Discord");
      return false;
    }

    // Récupérer tous les canaux du serveur
    const channels = await guild.channels.fetch();
    logger.debug(`${channels.size} canaux récupérés sur le serveur`);

    // Rechercher le canal approprié
    const defaultChannelNames = [
      "annonces",
      "notifications",
      "général",
      "general",
    ];
    const targetChannel = findChannel(
      channels,
      tournament.discordChannelName,
      ChannelType.GuildText,
      defaultChannelNames
    );

    if (!targetChannel) {
      logger.error("Aucun canal de texte trouvé sur le serveur");
      return false;
    }

    logger.info(
      `Canal sélectionné pour l'envoi: ${targetChannel.name} (${targetChannel.id})`
    );

    // Créer un embed pour le message de rappel
    const embed = createEmbed({
      title: `⚠️ RAPPEL: ${tournament.name} commence bientôt!`,
      description: "**Il ne reste que 24h pour faire votre check-in!**",
      color: "#ec4899",
      fields: [
        {
          name: "Jeu",
          value: tournament.game?.name || "Non spécifié",
          inline: true,
        },
        {
          name: "Date du tournoi",
          value: formatDateToFrenchTimezone(new Date(tournament.date)),
          inline: true,
        },
        {
          name: "Joueurs inscrits",
          value: `${tournament.players?.length || 0} joueurs`,
          inline: true,
        },
      ],
      footerText: "Pour faire votre check-in, connectez-vous sur acscrim.fr",
    });

    // Envoyer le message dans le canal
    try {
      await targetChannel.send({
        content: `@everyone **${tournament.name}** commence bientôt ! N'oubliez pas de faire votre check-in pour ce tournoi !\nRendez-vous sur [acscrim.fr](https://acscrim.fr/tournois/${tournament._id})`,
        embeds: [embed],
      });

      logger.info(
        `✅ Notification envoyée avec succès pour le tournoi "${tournament.name}" dans #${targetChannel.name}`
      );

      return true;
    } catch (sendError) {
      logger.error(
        `Erreur lors de l'envoi du message dans le canal ${targetChannel.name}:`,
        sendError
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Erreur globale lors de l'envoi de la notification pour ${tournament.name}:`,
      error
    );
    return false;
  }
};

// ===========================================
// SECTION: GESTION DES MESSAGES D'INSCRIPTION
// ===========================================

/**
 * Récupère et trie les noms des joueurs par date d'inscription
 * @param {Array} playerIds - IDs des joueurs
 * @param {Object} tournament - Document du tournoi contenant les dates d'inscription
 * @returns {Promise<Array>} - Tableau de noms de joueurs triés par ancienneté d'inscription
 */
async function getPlayerNames(playerIds, tournament) {
  if (!playerIds.length) return [];

  try {
    // Récupération des données des joueurs
    const players = await Promise.all(
      playerIds.map((id) => Player.findById(id))
    );
    const validPlayers = players.filter((player) => player?.username);

    // Créer un tableau d'objets avec les noms et les dates d'inscription
    const playersWithDates = validPlayers.map((player) => {
      const playerId = player._id.toString();
      // Récupérer la date d'inscription depuis le tournoi
      const registrationDate = tournament.registrationDates?.get(playerId)
        ? new Date(tournament.registrationDates.get(playerId))
        : new Date(); // Date par défaut si manquante

      return {
        username: player.username,
        registrationDate: registrationDate,
      };
    });

    // Trier les joueurs par date d'inscription (de la plus ancienne à la plus récente)
    playersWithDates.sort((a, b) => a.registrationDate - b.registrationDate);

    // Retourner uniquement les noms d'utilisateurs, maintenant triés
    return playersWithDates.map((player) => player.username);
  } catch (error) {
    logger.error("Erreur récupération utilisateurs:", error);
    return [`${playerIds.length} joueurs inscrits (IDs uniquement)`];
  }
}

/**
 * Met à jour le message d'inscription pour un tournoi
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de l'opération
 */
const updateTournamentSignupMessage = async (tournament) => {
  try {
    const guild = await fetchGuild();
    if (!guild) {
      logger.error("Impossible de récupérer le serveur Discord");
      return false;
    }

    // Récupération et sélection du canal cible
    const channels = await guild.channels.fetch();
    const defaultChannelNames = [
      "annonces",
      "notifications",
      "général",
      "general",
    ];
    const targetChannel = findChannel(
      channels,
      tournament.discordChannelName,
      ChannelType.GuildText,
      defaultChannelNames
    );

    if (!targetChannel) {
      logger.error("Aucun canal texte trouvé");
      return false;
    }

    // Récupération des noms des joueurs
    const playerNames = await getPlayerNames(
      tournament.players || [],
      tournament
    );

    // Rechercher un message existant pour ce tournoi
    const messages = await targetChannel.messages.fetch({ limit: 100 });
    const existingMessage = messages.find(
      (msg) => msg.embeds?.[0]?.title === `📝 Inscriptions: ${tournament.name}`
    );

    // Créer l'embed pour les inscriptions
    const embed = createEmbed({
      title: `📝 Inscriptions: ${tournament.name}`,
      description:
        `Le tournoi aura lieu le **${formatDateToFrenchTimezone(
          new Date(tournament.date)
        )}**\n\n` +
        `Pour vous inscrire ou vous désinscrire, rendez-vous sur [acscrim.fr](https://acscrim.fr/tournois/${tournament._id})\n`,
      color: "#0099ff",
      fields: [
        {
          name: "Jeu",
          value: tournament.game?.name || "Non spécifié",
          inline: true,
        },
        {
          name: `Participants (${playerNames.length})`,
          value:
            playerNames.length > 0
              ? playerNames.join(", ")
              : "Aucun participant",
        },
      ],
    });

    // Mettre à jour le message existant ou en créer un nouveau
    if (existingMessage) {
      try {
        await existingMessage.edit({
          content: `**${
            tournament.name
          }** - Liste des inscriptions mise à jour <t:${Math.floor(
            Date.now() / 1000
          )}:R>`,
          embeds: [embed],
        });
        logger.info(`Message existant mis à jour pour ${tournament.name}`);
        return true;
      } catch (editError) {
        logger.error(`Échec de la modification du message:`, editError);
      }
    }

    // Créer un nouveau message si échec de la modification ou message inexistant
    await targetChannel.send({
      content: `📣 **INSCRIPTIONS OUVERTES: ${tournament.name}**`,
      embeds: [embed],
    });

    logger.info(`Nouveau message créé pour ${tournament.name}`);
    return true;
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du message:`, error);
    return false;
  }
};

// Connexion au bot Discord
client
  .login(token)
  .then(() => logger.info("Connexion au bot Discord réussie"))
  .catch((error) =>
    logger.error("Échec de la connexion au bot Discord:", error)
  );

// Exporter les fonctions
module.exports = {
  deleteAndCreateChannels,
  sendTournamentReminder,
  updateTournamentSignupMessage,
  notifyPlayerPromoted,
  sendCheckInReminders,
};

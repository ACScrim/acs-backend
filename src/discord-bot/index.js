const {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Channel,
} = require("discord.js");
const winston = require("winston");
const Player = require("../models/Player");
const GameProposal = require("../models/GameProposal");
const User = require("../models/User");
const { notifyTournamentReminder } = require("../services/notificationService");

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
            `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""
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
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

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
 * Trouve un canal Discord spécifique sans utiliser de fallbacks
 * @param {Collection} channels - Collection de canaux Discord
 * @param {string} targetChannelName - Nom du canal à rechercher
 * @param {number} channelType - Type de canal à rechercher (texte, vocal, etc.)
 * @returns {Channel|null} Le canal trouvé ou null
 */
function findChannel(
  channels,
  targetChannelName,
  channelType = ChannelType.GuildText
) {
  // Vérifier si le nom du canal est défini
  if (!targetChannelName) {
    logger.error("Nom du canal non spécifié");
    return null;
  }

  // Rechercher uniquement le canal spécifié, sans alternatives
  const channel = channels.find(
    (c) =>
      c.name.toLowerCase() === targetChannelName.toLowerCase() &&
      c.type === channelType
  );

  if (channel) {
    logger.debug(`Canal trouvé: ${channel.name} (${channel.id})`);
    return channel;
  }

  logger.error(`Canal "${targetChannelName}" non trouvé`);
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
  imageUrl = null,
  url = null,
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
    if (typeof timestamp === "boolean") {
      embed.setTimestamp();
    }
    // Si un timestamp spécifique est fourni, l'utiliser
    else if (timestamp instanceof Date) {
      embed.setTimestamp(timestamp);
    }
  }

  // Ajouter une image si spécifiée
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  // Ajouter un lien si spécifié
  if (url) {
    embed.setURL(url);
  }

  return embed;
}

/**
 * Wrapper pour les fonctions qui envoient des messages dans les canaux
 * @param {Channel} channel - Canal Discord
 * @param {Object} messageOptions - Options du message
 * @param {string} logMessage - Message de log
 * @returns {Promise<Message|boolean>} Message envoyé ou boolean en mode dev
 */
async function sendChannelMessageIfNotDev(channel, messageOptions, logMessage) {
  if (process.env.ENV === "dev") {
    logger.info(`[DEV MODE] ${logMessage}`, {
      channel: channel?.name,
      content: messageOptions?.content?.substring(0, 100) + "...",
      embedTitle: messageOptions?.embeds?.[0]?.data?.title
    });
    return true;
  }
  
  return await channel.send(messageOptions);
}

/**
 * Wrapper pour les messages privés
 * @param {GuildMember} member - Membre Discord
 * @param {Object} messageOptions - Options du message
 * @param {string} logMessage - Message de log
 * @returns {Promise<Message|boolean>} Message envoyé ou boolean en mode dev
 */
async function sendDirectMessageIfNotDev(member, messageOptions, logMessage) {
  console.log(process.env.ENV)
  if (process.env.ENV === "dev") {
    logger.info(`[DEV MODE] ${logMessage}`, {
      user: member?.user?.username,
      content: messageOptions?.content?.substring(0, 100) + "...",
      embedTitle: messageOptions?.embeds?.[0]?.data?.title
    });
    return true;
  }
  
  return await member.send(messageOptions);
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

    // Utiliser le wrapper au lieu d'envoyer directement
    const sent = await sendDirectMessageIfNotDev(
      member,
      { content: messageContent, embeds: [embed] },
      `Message privé à ${player.username}: ${messageContent.substring(0, 50)}...`
    );

    if (sent) {
      logger.debug(
        `✅ Message envoyé à ${player.username} (Discord ID: ${player.discordId})`
      );
      return true;
    }
    return false;
  } catch (error) {
    logger.error(
      `Erreur lors de l'envoi d'un message à ${player?.username || "joueur inconnu"}:`,
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
      "Salut! On voulait te rappeler que tu n'as pas encore fait ton check-in pour le tournoi. Sans ça, tu ne pourras pas participer... et ce serait vraiment dommage de rater ça! Tu as jusque demain 12h pour check-in.",
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
        `Erreur lors de l'envoi du rappel à ${player?.username || player?._id || "joueur inconnu"
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

    // Rechercher le canal spécifié sans alternatives
    const targetChannel = findChannel(
      channels,
      tournament.discordChannelName,
      ChannelType.GuildText
    );

    if (!targetChannel) {
      logger.error("Aucun canal de texte trouvé sur le serveur");
      return false;
    }

    logger.info(
      `Canal sélectionné pour l'envoi: ${targetChannel.name} (${targetChannel.id})`
    );

    // Récupérer le rôle spécifique au tournoi
    await guild.roles.fetch(null, { force: true });
    const roleName = formatRoleName(tournament.game);
    const role = guild.roles.cache.find((r) => r.name === roleName);

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

    // Message de mention - utiliser le rôle spécifique si disponible, sinon @here
    const mentionText = role
      ? `<@&${role.id}> **${tournament.name}** commence bientôt !`
      : `@here **${tournament.name}** commence bientôt !`;

    // Envoyer le message dans le canal
    try {
      const sent = await sendChannelMessageIfNotDev(
        targetChannel,
        {
          content: `${mentionText} N'oubliez pas de faire votre check-in pour ce tournoi !\nRendez-vous sur [acscrim.fr](https://acscrim.fr/tournois/${tournament._id})`,
          embeds: [embed],
        },
        `Rappel de tournoi: ${tournament.name} dans #${targetChannel.name}`
      );

      if (sent) {
        const tournamentWithPlayers = await tournament.populate('players');

        await notifyTournamentReminder(
          tournament,
          tournamentWithPlayers.players.map((p) => p.userId)
        );

        logger.info(
          `✅ Notification envoyée avec succès pour le tournoi "${tournament.name}" dans #${targetChannel.name}`
        );

        return true;
      }
      return false;
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

    const targetChannel = findChannel(
      channels,
      tournament.discordChannelName,
      ChannelType.GuildText
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

    // Rechercher un message existant pour ce tournoi de manière plus flexible
    const messages = await targetChannel.messages.fetch({ limit: 100 });

    // Log pour déboguer
    logger.debug(`[Inscription] Recherche de message pour ${tournament.name}.`);

    // Recherche plus tolérante : on cherche le nom du tournoi dans le contenu ou les embeds
    let existingMessage = tournament.messageId
      ? messages.get(tournament.messageId)
      : null;

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
        logger.info(
          `[Inscription] Message existant trouvé pour ${tournament.name}, ID: ${existingMessage.id}`
        );

        // En mode dev, on simule la modification
        if (process.env.ENV === "dev") {
          logger.info(`[DEV MODE] Simulation de modification du message d'inscription pour ${tournament.name}`);
          return true;
        }

        await existingMessage.edit({
          content: `**${tournament.name}** - Liste des inscriptions mise à jour <t:${Math.floor(Date.now() / 1000)}:R>`,
          embeds: [embed],
        });
        
        logger.info(`[Inscription] Message existant mis à jour pour ${tournament.name}`);
        return true;
      } catch (editError) {
        logger.error(`[Inscription] Échec de la modification du message:`, editError);
      }
    } else {
      logger.info(`[Inscription] Aucun message existant trouvé pour ${tournament.name}, création d'un nouveau`);
    }

    // Créer un nouveau message si échec de la modification ou message inexistant
    const newMessage = await sendChannelMessageIfNotDev(
      targetChannel,
      {
        content: `📣 **INSCRIPTIONS OUVERTES: ${tournament.name}**`,
        embeds: [embed],
      },
      `Nouveau message d'inscription pour ${tournament.name}`
    );

    if (newMessage && newMessage !== true) {
      // Enregistrer l'ID du message uniquement si c'est un vrai message (pas en mode dev)
      tournament.messageId = newMessage.id;
      await tournament.save();
    }

    logger.info(`[Inscription] Nouveau message créé pour ${tournament.name}`);
    return true;
  } catch (error) {
    logger.error(`[Inscription] Erreur lors de la mise à jour du message:`, error);
    return false;
  }
};

// ===========================================
// SECTION: GESTION DES RÔLES
// ===========================================

/**
 * Format le nom d'un rôle pour un tournoi en fonction du jeu
 * @param {Object} game - L'objet jeu du tournoi
 * @returns {string} Le nom formaté du rôle
 */
function formatRoleName(game) {
  if (!game || !game.name) return null;
  return `Tournoi-${game.name.replace(/\s+/g, "-")}`;
}

/**
 * Récupère ou crée un rôle pour un tournoi
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<Role|null>} Le rôle récupéré ou créé, ou null en cas d'erreur
 */
async function getOrCreateTournamentRole(tournament) {
  try {
    if (!tournament.game || !tournament.game.name) {
      logger.warn(`Pas de jeu défini pour le tournoi ${tournament._id}`);
      return null;
    }

    const guild = await fetchGuild();
    if (!guild) return null;

    // Forcer le rafraîchissement du cache des rôles
    await guild.roles.fetch(null, { force: true });

    const roleName = formatRoleName(tournament.game);

    // Chercher si le rôle existe déjà
    let role = guild.roles.cache.find((r) => r.name === roleName);

    // Créer le rôle s'il n'existe pas
    if (!role) {
      // Générer une couleur basée sur le nom du jeu (simple et déterministe)
      const hashCode = Array.from(tournament.game.name).reduce(
        (acc, char) => acc + char.charCodeAt(0),
        0
      );

      // Utiliser ce hash pour créer une couleur hex
      const color = `#${((hashCode * 123456) % 0xffffff)
        .toString(16)
        .padStart(6, "0")}`;
      logger.info(
        `Création du rôle "${roleName}" pour le tournoi avec couleur ${color}`
      );
      role = await guild.roles.create({
        name: roleName,
        color: color,
        hoist: true,
        reason: `Rôle pour le tournoi ${tournament.name}`,
      });

      // Petit délai pour être sûr que le rôle est bien créé
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Rafraîchir à nouveau le cache pour être sûr d'avoir le rôle
      await guild.roles.fetch(null, { force: true });
      role = guild.roles.cache.find((r) => r.name === roleName);
    }

    return role;
  } catch (error) {
    logger.error(`Erreur lors de la création/récupération du rôle:`, error);
    return null;
  }
}

/**
 * Ajoute le rôle de tournoi à un joueur
 * @param {Object} player - Le joueur auquel ajouter le rôle
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de l'opération
 */
async function addTournamentRole(player, tournament) {
  try {
    if (!player || !player.discordId) {
      logger.warn(
        `Pas de Discord ID pour le joueur ${player?._id || "inconnu"}`
      );
      return false;
    }

    const guild = await fetchGuild();
    if (!guild) return false;

    // Forcer la récupération à jour du rôle
    await guild.roles.fetch();

    const role = await getOrCreateTournamentRole(tournament);
    if (!role) return false;

    // Récupérer le membre Discord avec une requête fraîche
    try {
      const member = await guild.members.fetch({
        user: player.discordId,
        force: true,
      });
      if (!member) {
        logger.warn(`Membre Discord non trouvé pour l'ID: ${player.discordId}`);
        return false;
      }

      // Forcer la récupération des rôles du membre
      await member.fetch(true);

      // Ajouter le rôle s'il ne l'a pas déjà
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        logger.debug(`Rôle ${role.name} ajouté à ${player.username}`);
      } else {
        logger.debug(`${player.username} a déjà le rôle ${role.name}`);
      }

      return true;
    } catch (memberError) {
      logger.error(
        `Erreur lors de la récupération du membre Discord ${player.discordId}:`,
        memberError
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Erreur lors de l'ajout du rôle au joueur ${player?.username || "inconnu"
      }:`,
      error
    );
    return false;
  }
}

/**
 * Retire le rôle de tournoi à un joueur
 * @param {Object} player - Le joueur auquel retirer le rôle
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de l'opération
 */
async function removeTournamentRole(player, tournament) {
  try {
    if (!player || !player.discordId) {
      logger.warn(
        `Pas de Discord ID pour le joueur ${player?._id || "inconnu"}`
      );
      return false;
    }

    const guild = await fetchGuild();
    if (!guild) return false;

    // Forcer la récupération à jour des rôles
    await guild.roles.fetch();

    const roleName = formatRoleName(tournament.game);
    const role = guild.roles.cache.find((r) => r.name === roleName);

    if (!role) {
      return false;
    }

    try {
      // Récupérer le membre avec ses données à jour
      const member = await guild.members.fetch({
        user: player.discordId,
        force: true,
      });
      if (!member) {
        logger.warn(`Membre Discord non trouvé pour l'ID: ${player.discordId}`);
        return false;
      }

      // Forcer la récupération des rôles du membre
      await member.fetch(true);

      // Retirer le rôle s'il l'a
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        logger.debug(`Rôle ${role.name} retiré à ${player.username}`);
      } else {
        logger.debug(
          `${player.username} n'a pas le rôle ${role.name} à retirer`
        );
      }

      return true;
    } catch (memberError) {
      logger.error(
        `Erreur lors de la récupération du membre Discord ${player.discordId}:`,
        memberError
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Erreur lors du retrait du rôle au joueur ${player?.username || "inconnu"
      }:`,
      error
    );
    return false;
  }
}

/**
 * Vérifie et met à jour les rôles pour tous les joueurs d'un tournoi
 * @param {Object} tournament - L'objet tournoi populé avec les joueurs
 * @param {Array} removedPlayers - Liste des joueurs retirés qui doivent perdre leur rôle (optionnel)
 * @returns {Promise<{success: number, failed: number, removed: number, skipped: number}>} Statistiques de l'opération
 */
async function syncTournamentRoles(tournament, removedPlayers = []) {
  let success = 0;
  let failed = 0;
  let removed = 0;
  let skipped = 0;

  // S'il n'y a pas de joueurs et pas de joueurs retirés, rien à faire
  if (!tournament?.players?.length && !removedPlayers.length) {
    logger.debug(
      `Pas de joueurs à synchroniser pour le tournoi ${tournament?._id}`
    );
    return { success, failed, removed, skipped };
  }

  logger.info(`Synchronisation des rôles pour le tournoi "${tournament.name}"`);

  const guild = await fetchGuild();
  if (!guild)
    return {
      success: 0,
      failed: 0,
      removed: 0,
      skipped: tournament.players?.length || 0,
    };

  // Forcer la récupération des rôles
  await guild.roles.fetch(null, { force: true });

  const role = await getOrCreateTournamentRole(tournament);
  if (!role) {
    logger.error(
      `Impossible de récupérer ou créer le rôle pour le tournoi ${tournament.name}`
    );
    return {
      success: 0,
      failed: 0,
      removed: 0,
      skipped: tournament.players?.length || 0,
    };
  }

  // 1. Ajouter le rôle aux joueurs actuels
  if (tournament.players && tournament.players.length > 0) {
    logger.info(
      `Vérification des rôles pour ${tournament.players.length} joueurs actifs`
    );

    // Récupérer les membres du serveur qui ont déjà ce rôle
    const membersWithRole = role.members;

    for (const playerId of tournament.players) {
      try {
        const player = await Player.findById(playerId);
        if (!player || !player.discordId) {
          failed++;
          continue;
        }

        // Vérifier si ce membre a déjà le rôle
        const hasRole = membersWithRole.some(
          (member) => member.id === player.discordId
        );

        if (hasRole) {
          // Le joueur a déjà le rôle, on le saute
          skipped++;
          logger.debug(
            `${player.username} a déjà le rôle ${role.name}, ignoré`
          );
          continue;
        }

        // Le joueur n'a pas le rôle, on l'ajoute
        const result = await addTournamentRole(player, tournament);
        result ? success++ : failed++;
      } catch (error) {
        logger.error(
          `Erreur lors de la synchronisation du rôle pour le joueur ${playerId}:`,
          error
        );
        failed++;
      }
    }
  }

  // 2. Retirer le rôle aux joueurs supprimés
  if (removedPlayers && removedPlayers.length > 0) {
    logger.info(`Retrait du rôle à ${removedPlayers.length} joueurs supprimés`);
    for (const player of removedPlayers) {
      try {
        if (!player || !player.discordId) continue;

        const result = await removeTournamentRole(player, tournament);
        if (result) {
          removed++;
          logger.debug(
            `Rôle retiré au joueur ${player.username} (supprimé du tournoi)`
          );
        }
      } catch (error) {
        logger.error(
          `Erreur lors du retrait du rôle au joueur supprimé ${player._id}:`,
          error
        );
      }
    }
  }

  logger.info(
    `Synchronisation des rôles terminée: ${success} ajoutés, ${removed} retirés, ${failed} échoués, ${skipped} ignorés (déjà corrects)`
  );
  return { success, failed, removed, skipped };
}

/**
 * Supprime le rôle d'un tournoi
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de la suppression
 */
async function deleteTournamentRole(tournament) {
  try {
    if (!tournament.game || !tournament.game.name) {
      logger.warn(`Pas de jeu défini pour le tournoi ${tournament._id}`);
      return false;
    }

    const guild = await fetchGuild();
    if (!guild) return false;

    const roleName = formatRoleName(tournament.game);
    const role = guild.roles.cache.find((r) => r.name === roleName);

    if (!role) {
      logger.warn(
        `Rôle ${roleName} non trouvé lors de la tentative de suppression`
      );
      return true; // On considère que c'est un succès si le rôle n'existe pas
    }

    await role.delete(`Tournoi ${tournament.name} terminé`);
    logger.info(
      `Rôle ${roleName} supprimé suite à la fin du tournoi ${tournament.name}`
    );
    return true;
  } catch (error) {
    logger.error(
      `Erreur lors de la suppression du rôle pour le tournoi ${tournament.name}:`,
      error
    );
    return false;
  }
}

// ===========================================
// SECTION: GESTION DES RÔLES DE JEU UTILISATEUR
// ===========================================

/**
 * Format le nom d'un rôle pour un jeu utilisateur
 * @param {Object} game - L'objet jeu
 * @returns {string} Le nom formaté du rôle
 */
function formatGameRoleName(game) {
  if (!game || !game.name) return null;
  // Format: nom du jeu en minuscules avec tirets au lieu d'espaces
  return game.name.replace(/\s+/g, "-").toLowerCase();
}

/**
 * Récupère ou crée un rôle pour un jeu spécifique
 * @param {Object} game - L'objet jeu
 * @returns {Promise<Role|null>} Le rôle récupéré ou créé, ou null en cas d'erreur
 */
async function getOrCreateGameRole(game) {
  try {
    if (!game || !game.name) {
      logger.warn(`Jeu invalide fourni pour la création de rôle`);
      return null;
    }

    const guild = await fetchGuild();
    if (!guild) return null;

    // Forcer le rafraîchissement du cache des rôles
    await guild.roles.fetch(null, { force: true });

    const roleName = formatGameRoleName(game);

    // Chercher si le rôle existe déjà
    let role = guild.roles.cache.find((r) => r.name === roleName);

    // Créer le rôle s'il n'existe pas
    if (!role) {
      logger.info(`Création du rôle de jeu "${roleName}"`);

      // Générer une couleur basée sur le nom du jeu
      const hashCode = Array.from(game.name).reduce(
        (acc, char) => acc + char.charCodeAt(0),
        0
      );

      // Utiliser le hash pour créer une couleur hex cohérente
      const color = `#${((hashCode * 654321) % 0xffffff)
        .toString(16)
        .padStart(6, "0")}`;

      role = await guild.roles.create({
        name: roleName,
        color: color,
        hoist: true,
        mentionable: true, // Permettre les mentions
        reason: `Rôle automatique pour le jeu ${game.name}`,
      });

      logger.info(`✅ Rôle "${roleName}" créé avec succès (couleur: ${color})`);

      // Petit délai pour s'assurer que le rôle est bien créé
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Rafraîchir le cache pour être sûr d'avoir le rôle
      await guild.roles.fetch(null, { force: true });
      role = guild.roles.cache.find((r) => r.name === roleName);
    } else {
      logger.debug(`Rôle "${roleName}" existe déjà`);
    }

    return role;
  } catch (error) {
    logger.error(
      `Erreur lors de la création/récupération du rôle pour ${game?.name}:`,
      error
    );
    return null;
  }
}

/**
 * Ajoute un rôle de jeu à un utilisateur
 * @param {Object} user - L'utilisateur Discord (avec discordId)
 * @param {Object} game - L'objet jeu
 * @returns {Promise<boolean>} Succès ou échec de l'opération
 */
async function addGameRoleToUser(user, game) {
  try {
    if (!user || !user.discordId) {
      logger.warn(
        `Pas de Discord ID pour l'utilisateur ${user?._id || "inconnu"}`
      );
      return false;
    }

    const guild = await fetchGuild();
    if (!guild) return false;

    const role = await getOrCreateGameRole(game);
    if (!role) {
      logger.error(`Impossible de créer/récupérer le rôle pour ${game?.name}`);
      return false;
    }

    try {
      // Récupérer le membre Discord
      const member = await guild.members.fetch({
        user: user.discordId,
        force: true,
      });

      if (!member) {
        logger.warn(`Membre Discord non trouvé pour l'ID: ${user.discordId}`);
        return false;
      }

      // Forcer la récupération des rôles du membre
      await member.fetch(true);

      // Ajouter le rôle s'il ne l'a pas déjà
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(
          role,
          `Rôle de jeu ajouté via les paramètres utilisateur`
        );
        logger.info(
          `✅ Rôle "${role.name}" ajouté à ${user.username} (${game.name})`
        );
      } else {
        logger.debug(`${user.username} a déjà le rôle "${role.name}"`);
      }

      return true;
    } catch (memberError) {
      logger.error(
        `Erreur lors de la récupération du membre Discord ${user.discordId}:`,
        memberError
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Erreur lors de l'ajout du rôle de jeu à ${user?.username || "inconnu"}:`,
      error
    );
    return false;
  }
}

/**
 * Retire un rôle de jeu à un utilisateur
 * @param {Object} user - L'utilisateur Discord (avec discordId)
 * @param {Object} game - L'objet jeu
 * @returns {Promise<boolean>} Succès ou échec de l'opération
 */
async function removeGameRoleFromUser(user, game) {
  try {
    if (!user || !user.discordId) {
      logger.warn(
        `Pas de Discord ID pour l'utilisateur ${user?._id || "inconnu"}`
      );
      return false;
    }

    const guild = await fetchGuild();
    if (!guild) return false;

    // Forcer la récupération des rôles
    await guild.roles.fetch(null, { force: true });

    const roleName = formatGameRoleName(game);
    const role = guild.roles.cache.find((r) => r.name === roleName);

    if (!role) {
      return false; // Pas d'erreur si le rôle n'existe pas
    }

    try {
      // Récupérer le membre Discord
      const member = await guild.members.fetch({
        user: user.discordId,
        force: true,
      });

      if (!member) {
        logger.warn(`Membre Discord non trouvé pour l'ID: ${user.discordId}`);
        return false;
      }

      // Forcer la récupération des rôles du membre
      await member.fetch(true);

      // Retirer le rôle s'il l'a
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(
          role,
          `Rôle de jeu retiré via les paramètres utilisateur`
        );
        logger.info(
          `❌ Rôle "${role.name}" retiré à ${user.username} (${game.name})`
        );
      } else {
        logger.debug(
          `${user.username} n'a pas le rôle "${role.name}" à retirer`
        );
      }

      return true;
    } catch (memberError) {
      logger.error(
        `Erreur lors de la récupération du membre Discord ${user.discordId}:`,
        memberError
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Erreur lors du retrait du rôle de jeu à ${user?.username || "inconnu"}:`,
      error
    );
    return false;
  }
}

/**
 * Synchronise tous les rôles de jeu d'un utilisateur selon ses préférences
 * @param {Object} user - L'utilisateur avec son profil peuplé
 * @param {Array} allGames - Liste de tous les jeux disponibles
 * @returns {Promise<{added: number, removed: number, failed: number}>} Statistiques de l'opération
 */
async function syncUserGameRoles(user, allGames) {
  let added = 0;
  let removed = 0;
  let failed = 0;

  try {
    if (!user || !user.discordId) {
      logger.warn(`Utilisateur invalide pour la synchronisation des rôles`);
      return { added: 0, removed: 0, failed: 1 };
    }

    if (!user.profile || !user.profile.gameRoles) {
      logger.debug(`Aucun profil de jeu défini pour ${user.username}`);
      return { added: 0, removed: 0, failed: 0 };
    }

    logger.info(`🔄 Synchronisation des rôles de jeu pour ${user.username}`);

    const guild = await fetchGuild();
    if (!guild) {
      return { added: 0, removed: 0, failed: 1 };
    }

    // Récupérer le membre Discord
    let member;
    try {
      member = await guild.members.fetch({
        user: user.discordId,
        force: true,
      });

      if (!member) {
        logger.warn(
          `Membre Discord non trouvé pour ${user.username} (${user.discordId})`
        );
        return { added: 0, removed: 0, failed: 1 };
      }
    } catch (memberError) {
      logger.error(
        `Erreur lors de la récupération du membre Discord:`,
        memberError
      );
      return { added: 0, removed: 0, failed: 1 };
    }

    // Créer un map des préférences de jeu de l'utilisateur
    const userGamePreferences = new Map();
    for (const gameRole of user.profile.gameRoles) {
      if (gameRole.gameId && gameRole.gameId._id) {
        userGamePreferences.set(
          gameRole.gameId._id.toString(),
          gameRole.enabled
        );
      }
    }

    // Parcourir tous les jeux disponibles
    for (const game of allGames) {
      const gameId = game._id.toString();
      const userWantsRole = userGamePreferences.get(gameId) === true;

      if (userWantsRole) {
        // L'utilisateur veut ce rôle
        const success = await addGameRoleToUser(user, game);
        success ? added++ : failed++;
      } else {
        // L'utilisateur ne veut pas ce rôle (ou n'a pas d'opinion)
        const success = await removeGameRoleFromUser(user, game);
        if (success) {
          // On ne compte comme "removed" que si le rôle existait vraiment
          const role = guild.roles.cache.find(
            (r) => r.name === formatGameRoleName(game)
          );
          if (role && member.roles.cache.has(role.id)) {
            removed++;
          }
        }
      }
    }

    logger.info(
      `✅ Synchronisation terminée pour ${user.username}: ${added} ajoutés, ${removed} retirés, ${failed} échecs`
    );

    return { added, removed, failed };
  } catch (error) {
    logger.error(
      `Erreur globale lors de la synchronisation des rôles pour ${user?.username}:`,
      error
    );
    return { added, removed, failed: failed + 1 };
  }
}

/**
 * Nettoie les rôles de jeu inutilisés (sans membres)
 * @param {Array} allGames - Liste de tous les jeux pour éviter de supprimer les bons rôles
 * @returns {Promise<number>} Nombre de rôles supprimés
 */
async function cleanupUnusedGameRoles(allGames) {
  try {
    const guild = await fetchGuild();
    if (!guild) return 0;

    await guild.roles.fetch(null, { force: true });

    let deletedCount = 0;
    const gameRoleNames = allGames
      .map((game) => formatGameRoleName(game))
      .filter(Boolean);

    for (const [roleId, role] of guild.roles.cache) {
      // Vérifier si c'est un rôle de jeu (pas de rôle système/admin)
      if (gameRoleNames.includes(role.name) && role.members.size === 0) {
        try {
          await role.delete(`Nettoyage automatique: rôle de jeu sans membres`);
          logger.info(`🗑️ Rôle inutilisé "${role.name}" supprimé`);
          deletedCount++;
        } catch (deleteError) {
          logger.error(
            `Erreur lors de la suppression du rôle ${role.name}:`,
            deleteError
          );
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        `🧹 Nettoyage terminé: ${deletedCount} rôles de jeu inutilisés supprimés`
      );
    }

    return deletedCount;
  } catch (error) {
    logger.error(`Erreur lors du nettoyage des rôles inutilisés:`, error);
    return 0;
  }
}

// ===========================================
// SECTION: EMBEDS PROPOSITION
// ===========================================

function buildProposalEmbed(proposal) {
  // const yesVote = proposal.votes.some(
  //   (vote) => vote.player._id.toString() === connectedUserId && vote.value === 1
  // );
  const yesButton = new ButtonBuilder()
    .setCustomId("oui")
    .setLabel("OUI")
    .setStyle(ButtonStyle.Success);
  // .setDisabled(yesVote);

  // const noVote = proposal.votes.some(
  //   (vote) =>
  //     vote.player._id.toString() === connectedUserId && vote.value === -1
  // );
  const noButton = new ButtonBuilder()
    .setCustomId("non")
    .setLabel("NON")
    .setStyle(ButtonStyle.Danger);
  // .setDisabled(noVote);

  const row = new ActionRowBuilder().addComponents(yesButton, noButton);

  // Créer l'embed
  const embed = createEmbed({
    title: proposal.name,
    description: proposal.description.slice(0, 100) + "...",
    imageUrl: proposal.imageUrl,
    url: `https://acscrim.fr/propositions-jeux/${proposal._id.toString()}`,
    color: "#ec4899", // Rose cyberpunk
    fields: [
      {
        name: "Votes OUI",
        value: proposal.votes
          .filter((vote) => vote.value === 1)
          .length.toString(),
        inline: true,
      },
      {
        name: "Votes NON",
        value: proposal.votes
          .filter((vote) => vote.value === -1)
          .length.toString(),
        inline: true,
      },
    ],
    footerText: `Proposé par ${proposal.proposedBy.username}`,
    timestamp: new Date(proposal.createdAt),
  });
  return { embed, row };
}

const CHANNEL_NAME = "propositions-de-jeux";
async function sendPropositionEmbed() {
  try {
    const guild = await fetchGuild();
    if (!guild) return;

    // Récupérer le canal de proposition
    const channel = findChannel(
      guild.channels.cache,
      CHANNEL_NAME,
      ChannelType.GuildText
    );

    if (!channel) {
      logger.error("Canal de propositions introuvable");
      return;
    }

    let lastBotMessage;
    do {
      lastBotMessage = await channel.messages.fetch({
        limit: 1,
      });
      if (lastBotMessage.size > 0) {
        if (!lastBotMessage.first().author.bot) {
          await lastBotMessage.first().delete();
        }
      }
    } while (lastBotMessage.size > 0 && !lastBotMessage.first().author.bot);

    let proposals = await GameProposal.find({
      status: "approved",
      createdAt: {
        $gt: new Date(
          lastBotMessage.first()
            ? lastBotMessage.first().embeds[0].timestamp
            : null
        ),
      },
    })
      .populate("proposedBy", "username")
      .populate("votes.player", "username")
      .sort({ createdAt: 1 });

    if (proposals.length === 0) {
      logger.info("Aucune nouvelle proposition de jeu trouvée");
      return;
    }

    for (const proposal of proposals) {
      const { embed, row } = buildProposalEmbed(proposal);
      
      await sendChannelMessageIfNotDev(
        channel,
        {
          embeds: [embed],
          components: [row],
          withResponse: true,
        },
        `Proposition de jeu: ${proposal.name}`
      );
    }
  } catch (error) {
    logger.error("Erreur lors de l'envoi de l'embed de proposition:", error);
  }
}

async function deleteEmbedProposal(proposal) {
  try {
    const guild = await fetchGuild();
    if (!guild) return;

    // Récupérer le canal de proposition
    const channel = findChannel(
      guild.channels.cache,
      CHANNEL_NAME,
      ChannelType.GuildText
    );

    if (!channel) {
      logger.error("Canal de propositions introuvable");
      return;
    }

    // Récupérer le message contenant l'embed
    const messages = await channel.messages.fetch({ limit: 100 });
    const message = messages.find(
      (msg) =>
        msg.embeds[0].url ===
        `https://acscrim.fr/propositions-jeux/${proposal._id.toString()}`
    );

    if (message) {
      await message.delete();
      logger.info(`Embed de proposition supprimé pour ${proposal.name}`);
    } else {
      logger.warn(`Aucun message trouvé pour la proposition ${proposal.name}`);
    }
  } catch (error) {
    logger.error(
      "Erreur lors de la suppression de l'embed de proposition:",
      error
    );
  }
}

// Make a interaction collector to handle the button clicks
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const proposalId = interaction.message.embeds[0].url.split("/").pop();

  const proposal = await GameProposal.findOne({
    status: "approved",
    _id: proposalId,
  })
    .populate("proposedBy", "username")
    .populate("votes.player", "username");
  if (!proposal) {
    await interaction.reply({
      content: "Aucune proposition trouvée.",
      ephemeral: true,
    });
    return;
  }
  const player = await User.findOne({
    discordId: interaction.user.id,
  }).populate("discordId", "username");
  if (!player) {
    await interaction.reply({
      content: "Vous devez être connecté pour voter.",
      ephemeral: true,
    });
    return;
  }
  const voteValue = interaction.customId === "oui" ? 1 : -1;
  const existingVote = proposal.votes.find(
    (vote) => vote.player._id.toString() === player._id.toString()
  );
  if (existingVote) {
    // Si le vote existe déjà, on le met à jour
    existingVote.value = voteValue;
  } else {
    // Sinon, on l'ajoute
    proposal.votes.push({ player: player._id, value: voteValue });
  }
  proposal.totalVotes = proposal.calculateVotes();
  await proposal.save();
  const { embed, row } = buildProposalEmbed(proposal);
  await interaction.update({
    components: [row],
    embeds: [embed],
  });
  logger.info(
    `Vote '${interaction.customId}' enregistré pour la proposition ${proposal.name} par ${player.username}`
  );
});

const updateProposalEmbed = async (proposal) => {
  const { embed, row } = buildProposalEmbed(proposal);
  try {
    const guild = await fetchGuild();
    if (!guild) return;

    // Récupérer le canal de proposition
    const channel = findChannel(
      guild.channels.cache,
      CHANNEL_NAME,
      ChannelType.GuildText
    );

    if (!channel) {
      logger.error("Canal de propositions introuvable");
      return;
    }

    // Récupérer le message contenant l'embed
    const messages = await channel.messages.fetch({ limit: 100 });
    const message = messages.find(
      (msg) =>
        msg.embeds[0].url ===
        `https://acscrim.fr/propositions-jeux/${proposal._id.toString()}`
    );

    if (message) {
      await message.edit({
        embeds: [embed],
        components: [row],
      });
      logger.info(`Embed de proposition mis à jour pour ${proposal.name}`);
    } else {
      logger.warn(`Aucun message trouvé pour la proposition ${proposal.name}`);
    }
  } catch (error) {
    logger.error(
      "Erreur lors de la mise à jour de l'embed de proposition:",
      error
    );
  }
};

client.on("ready", async () => {
  await sendPropositionEmbed();

  try {
  } catch (tempError) {
    console.warn(
      "Erreur temporaire lors de l'envoi du classement initial:",
      tempError
    );
  }
});

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
  addTournamentRole,
  removeTournamentRole,
  syncTournamentRoles,
  deleteTournamentRole,
  sendPropositionEmbed,
  deleteEmbedProposal,
  updateProposalEmbed,
  addGameRoleToUser,
  removeGameRoleFromUser,
  syncUserGameRoles,
  cleanupUnusedGameRoles,
  formatGameRoleName,
  client,
  sendChannelMessageIfNotDev,
  sendDirectMessageIfNotDev
};

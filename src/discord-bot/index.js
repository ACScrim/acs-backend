const {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const winston = require("winston");

// Récupérer les variables d'environnement
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID || "1330973733929615420"; // Valeur par défaut au cas où
const parentChannelId =
  process.env.DISCORD_PARENT_CHANNEL_ID || "1330973733929615424"; // ID du salon parent par défaut

// Configuration du logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "discord-bot" },
  transports: [
    // Correction: la configuration du transport Console
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

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// IDs des salons vocaux à conserver
const channelsToKeep = ["1351248026491949157", "1330973733929615426"];

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
 * Envoie une notification pour un tournoi imminent
 * @param {Object} tournament - L'objet tournoi
 * @returns {Promise<boolean>} Succès ou échec de l'envoi
 */
const sendTournamentReminder = async (tournament) => {
  try {
    logger.info(
      `Préparation de la notification pour le tournoi "${tournament.name}"`
    );

    const guild = await fetchGuild();
    if (!guild) {
      logger.error("Impossible de récupérer le serveur Discord");
      return false;
    }

    // Récupérer tous les canaux du serveur
    const channels = await guild.channels.fetch();
    logger.debug(`${channels.size} canaux récupérés sur le serveur`);

    // Récupérer le canal spécifique par son nom
    let targetChannel;

    // Si le tournoi a un canal Discord spécifié, l'utiliser
    if (tournament.discordChannelName) {
      logger.debug(
        `Recherche du canal nommé "${tournament.discordChannelName}"`
      );

      // Recherche exacte du canal par nom
      targetChannel = channels.find(
        (channel) =>
          channel.name.toLowerCase() ===
          tournament.discordChannelName.toLowerCase()
      );

      if (targetChannel) {
        logger.debug(
          `Canal spécifique trouvé: ${targetChannel.name} (${targetChannel.id})`
        );
      }
    }

    // Si aucun canal n'est spécifié dans le tournoi ou s'il n'a pas été trouvé,
    // utiliser un canal de notification par défaut
    if (!targetChannel) {
      logger.debug(
        "Canal spécifique non trouvé, recherche d'un canal par défaut"
      );

      // Liste des noms de canaux à essayer dans l'ordre de priorité
      const defaultChannelNames = [
        "annonces",
        "notifications",
        "général",
        "general",
      ];

      for (const name of defaultChannelNames) {
        const foundChannel = channels.find((channel) =>
          channel.name.toLowerCase().includes(name)
        );

        if (foundChannel) {
          targetChannel = foundChannel;
          logger.debug(`Canal par défaut trouvé: ${foundChannel.name}`);
          break;
        }
      }
    }

    // Si toujours aucun canal trouvé, utiliser le premier canal texte disponible
    if (!targetChannel) {
      logger.debug(
        "Aucun canal par défaut trouvé, recherche du premier canal texte"
      );
      targetChannel = channels.find(
        (channel) => channel.type === ChannelType.GuildText
      );
    }

    if (!targetChannel) {
      logger.error("Aucun canal de texte trouvé sur le serveur");
      return false;
    }

    logger.info(
      `Canal sélectionné pour l'envoi: ${targetChannel.name} (${targetChannel.id})`
    );

    // Créer un embed riche pour le message
    const embed = new EmbedBuilder()
      .setColor("#ec4899") // Rose cyberpunk
      .setTitle(`⚠️ RAPPEL: ${tournament.name} commence bientôt!`)
      .setDescription(`**Il ne reste que 24h pour faire votre check-in!**`)
      .addFields(
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
        }
      )
      .setFooter({
        text: "Pour faire votre check-in, connectez-vous sur acscrim.fr",
      })
      .setTimestamp();

    // Mentionner @everyone pour maximiser la visibilité
    try {
      await targetChannel.send({
        content:
          `**${tournament.name}** commence bientôt ! N'oubliez pas de faire votre check-in pour ce tournoi !\n` +
          `Rendez-vous sur https://acscrim.fr/tournois-a-venir pour plus d'informations.`,
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
/**
 * Formate une date en heure française (UTC+1 ou UTC+2 selon DST)
 * @param {Date} date - La date à formater
 * @returns {string} La date formatée en heure française
 */
function formatDateToFrenchTimezone(date) {
  // Convertir à la timezone française (Europe/Paris)
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

// Log in to Discord with your client's token
client
  .login(token)
  .then(() => logger.info("Connexion au bot Discord réussie"))
  .catch((error) =>
    logger.error("Échec de la connexion au bot Discord:", error)
  );

// Exporter les fonctions
module.exports = { deleteAndCreateChannels, sendTournamentReminder };

const Cobblemon = require("../models/Cobblemon");
const { Rcon } = require("rcon-client");

async function retrieveMessage(channel, textInMessage, page) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const message = messages.find((msg) =>
      msg.embeds && msg.embeds.length > 0 &&
      msg.embeds.some(embed => embed.title && embed.title.includes(textInMessage) && (page ? embed.footer && embed.footer.text.includes(`Page ${page}`) : true))
    );
    if (!message) {
      logger.error(`Message containing "${textInMessage}" not found in channel ${channel.id}.`);
      return null;
    }
    return message;
  } catch (error) {
    logger.error(`Error retrieving message from channel ${channel.id}:`, error);
    return null;
  }
}

async function updateMessage(channelId, textInMessage, newContent, page) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      logger.error(`Channel with ID ${channelId} not found.`);
      return null;
    }

    const message = await retrieveMessage(channel, textInMessage, page);
    if (!message) {
      await channel.send(newContent);
      logger.info(`New message sent in channel ${channelId}: ${newContent}`);
      return;
    }

    await message.edit(newContent);
  } catch (error) {
    logger.error(`Error updating message in channel ${channelId}:`, error);
  }
}

async function generateCobblemonContent(page, totalPages, playerStats) {
  const validPage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (validPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = Math.min(startIndex + PLAYERS_PER_PAGE, playerStats.length);

  let leaderboardText = "";
  for (let i = startIndex; i < endIndex; i++) {
    const player = playerStats[i];
    leaderboardText += `${i + 1}. **${player.name}** - ${player.caught} Pokémon (${player.shiny} shiny)\n`;
  }

  return {
    title: "🏆 Classement des Dresseurs Pokémon 🏆",
    description: leaderboardText || "Aucune donnée disponible",
    color: 0x3498db,
    footer: {
      text: `Page ${validPage}/${totalPages || 1} • Dernière mise à jour: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
    },
  };
}

async function updateMessages(channelId) {
  const cobblemonData = await Cobblemon.findOne();
  if (!cobblemonData) {
    logger.info("No opened Cobblemon data found.");
    return;
  }
  const playerStats = cobblemonData.playersData
    .map(player => {
      const playerObj = player.toObject ? player.toObject() : player; // Conversion Mongoose si nécessaire
      return {
        name: playerObj.playerName,
        caught: playerObj.capturesCount ?? 0,
        shiny: playerObj.shiniesCount ?? 0,
      };
    })
    .sort((a, b) => b.caught - a.caught || b.shiny - a.shiny);
  const totalPages = Math.ceil(playerStats.length / PLAYERS_PER_PAGE) || 1;

  await updateMessage(channelId, "⚙️ État du serveur Cobblemon ⚙️", {
    embeds: [{
      title: "⚙️ État du serveur Cobblemon ⚙️",
      description: `Le serveur Cobblemon est actuellement **${cobblemonData.opened ? "ouvert" : "fermé"}** !\n\nNombre de dresseurs enregistrés : **${playerStats.length}**\nNombre total de Pokémon capturés : **${playerStats.reduce((sum, player) => sum + player.caught, 0)}**\nNombre total de shinies capturés : **${playerStats.reduce((sum, player) => sum + player.shiny, 0)}**`,
      color: cobblemonData.opened ? 0x00ff00 : 0xff0000,
      footer: {
        text: `Dernière mise à jour: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
      },
    }]
  });
  for (let i = 1; i <= totalPages; i++) {
    const textInMessage = "🏆 Classement des Dresseurs Pokémon 🏆";
    const embedContent = await generateCobblemonContent(i, totalPages, playerStats);
    await updateMessage(channelId, textInMessage, { embeds: [embedContent] }, i);
  }
}

function createRconClient() {
  if (!process.env.RCON_HOST || !process.env.RCON_PORT || !process.env.RCON_PASSWORD) {
    logger.error("RCON_HOST, RCON_PORT, or RCON_PASSWORD is not set in environment variables.");
    return null;
  }
  return new Rcon({
    host: process.env.RCON_HOST,
    port: process.env.RCON_PORT,
    password: process.env.RCON_PASSWORD,
  });
}

async function connectRcon() {
  try {
    // Créer une nouvelle instance RCON à chaque tentative de connexion
    rcon = createRconClient();

    // Gérer les erreurs de connexion
    rcon.on("error", (error) => {
      rconReady = false;
      setTimeout(connectRcon, RETRY_TIME);
    });

    await rcon.connect();
    rconReady = true;
  } catch (error) {
    rconReady = false;
    setTimeout(connectRcon, RETRY_TIME);
  }
};

async function start(c, l) {
  client = c;
  logger = l;
  const channelId = process.env.COBBLEMON_CHANNEL_ID;
  if (!channelId) {
    logger.error("COBBLEMON_CHANNEL_ID is not set in environment variables.");
    return;
  }

  updateMessages(channelId);
  const updateInterval = 5 * 60 * 1000; // 5 minutes
  setInterval(async () => {
    updateMessages(channelId);
  }, updateInterval);
  logger.info("Cobblemon leaderboard updates started.");

  connectRcon();

  client.on("messageCreate", async (message) => {
    if (!rconReady) return;
    if (message.channel.id === process.env.COBBLEMON_WL_CHANNEL_ID && !message.author.bot) {
      try {
        const contentSpaces = message.content.split(" ");
        if (contentSpaces.length > 1) {
          await message.delete();
          return;
        }
        const authorMessagesCount = (await message.channel.messages.fetch({ limit: 100 })).filter(msg => msg.author.id === message.author.id).size;
        if (authorMessagesCount > 1) {
          await message.delete();
          return;
        }
        const rconMessage = await rcon.send("easywhitelist add " + message.content);
        await rcon.send("whitelist reload");
        if (rconMessage.includes("Added") || rconMessage.includes("already")) {
          await message.react("✅");
        } else {
          await message.react("❌");
        }
      } catch (error) {
        await message.react("❌");
        rconReady = false;
        connectRcon();
      }
    }
  });
}

const PLAYERS_PER_PAGE = 100;
let client;
let logger;
let rconReady = false;
let rcon;
const RETRY_TIME = 10000;
module.exports = { start, rconReady, rcon };
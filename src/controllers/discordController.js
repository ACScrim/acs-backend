const { client: discord } = require("../discord-bot")

const guildId = process.env.DISCORD_GUILD_ID;

// Cache pour stocker les membres
let membersCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const updateMembersCache = async () => {
  try {
    console.log("🔄 Mise à jour du cache des membres Discord...");
    const startTime = Date.now();
    
    const guild = await discord.guilds.fetch(guildId);
    
    // Récupérer seulement les premiers 1000 membres actifs
    const allMembers = await guild.members.fetch({ 
      limit: 1000,
      withPresences: false // Plus rapide sans les statuts de présence
    });
    
    // Filtrer et mapper en une seule opération
    membersCache = allMembers
      .filter(member => !member.user.bot && !member.user.system)
      .map(member => ({
        id: member.id,
        name: member.nickname || member.user.globalName || member.user.username,
        avatar: member.user.displayAvatarURL({ size: 32 })
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Trier alphabétiquement
    
    lastCacheUpdate = Date.now();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Cache mis à jour: ${membersCache.length} membres en ${duration}ms`);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du cache:", error);
  }
};

exports.getChannels = async (req, res) => {
  if (!guildId) {
    return res.status(400).json({ error: "Discord guild ID is not set." });
  }
  
  const channels = await (await discord.guilds.fetch(guildId)).channels.fetch();
  res.status(200).json({ data: channels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })) });
}

exports.getUsers = async (req, res) => {
  try {
    if (!guildId) {
      return res.status(400).json({ error: "Discord guild ID is not set." });
    }

    // Vérifier si le cache est valide
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_DURATION || membersCache.length === 0) {
      await updateMembersCache();
    }

    // Pagination optionnelle
    const { page = 1, limit = 10, search = "" } = req.query;
    let filteredMembers = membersCache;

    // Recherche si spécifiée
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMembers = membersCache.filter(member =>
        member.name.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    res.status(200).json({
      data: paginatedMembers,
      pagination: {
        total: filteredMembers.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(filteredMembers.length / limit)
      },
      cached: true,
      lastUpdate: new Date(lastCacheUpdate).toISOString()
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

exports.sendChannelMessage = async (req, res) => {
  const { channelId, message } = req.body;

  if (!channelId || !message) {
    return res.status(400).json({ error: "Channel ID and message content are required." });
  }

  try {
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.type !== 0) {
      return res.status(404).json({ error: "Channel not found or is not a text channel." });
    }

    await channel.send(message);
    res.status(200).json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
}

exports.sendPrivateMessage = async (req, res) => {
  const { userIds, message } = req.body;

  if (!userIds || !message) {
    return res.status(400).json({ error: "User IDs and message content are required." });
  }

  try {
    const users = await Promise.all(userIds.map(id => discord.users.fetch(id)));
    for (const user of users) {
      if (!user) continue;
      await user.send(message);
    }
    res.status(200).json({ success: true, message: "Private messages sent successfully." });
  } catch (error) {
    console.error("Error sending private messages:", error);
    res.status(500).json({ error: "Failed to send private messages." });
  }
}
const { client: discord, sendChannelMessageIfNotDev, sendDirectMessageIfNotDev } = require("../discord-bot")

const guildId = process.env.DISCORD_GUILD_ID;

exports.getChannels = async (req, res) => {
  if (!guildId) {
    return res.status(400).json({ error: "Discord guild ID is not set." });
  }
  
  const channels = await (await discord.guilds.fetch(guildId)).channels.fetch();
  res.status(200).json({ data: channels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })) });
}

exports.getUsers = async (req, res) => {
  if (!guildId) {
    return res.status(400).json({ error: "Discord guild ID is not set." });
  }

  const allMembers = await (await discord.guilds.fetch(guildId)).members.fetch();
  const users = allMembers.filter(member => !member.user.bot);
  res.status(200).json({ data: users.map(u => ({ id: u.id, name: u.nickname ?? u.displayName })) });
}

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

    const sent = await sendChannelMessageIfNotDev(
      channel,
      {
        content: message
      },
      `Message admin "${message}" envoyé dans #${channel.name}`
    );
    if (!sent) {
      return res.status(500).json({ error: "Failed to send message." });
    }
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
      const sent = await sendDirectMessageIfNotDev(
        user,
        {
          content: message
        },
        `Message admin "${message}" envoyé à ${user.username}`
      )
      if (!sent) {
        return res.status(500).json({ error: `Failed to send message to user ${user.username}.` });
      }
    }
    res.status(200).json({ success: true, message: "Private messages sent successfully." });
  } catch (error) {
    console.error("Error sending private messages:", error);
    res.status(500).json({ error: "Failed to send private messages." });
  }
}
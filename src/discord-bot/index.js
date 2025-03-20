const {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
} = require("discord.js");
const token = process.env.DISCORD_TOKEN;
// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

const fetchGuild = async () => {
  //Id du serveur Discord
  const guild = await client.guilds.fetch("1330973733929615420");
  return guild;
};
// IDs des salons vocaux à conserver (to, et Gaming)
const channelsToKeep = ["1351248026491949157", "1330973733929615426"];

const deleteChannel = async () => {
  console.log("allo");
  const guild = await fetchGuild();
  const channels = await guild.channels.fetch();
  channels.forEach(async (channel) => {
    if (
      channel.type === ChannelType.GuildVoice &&
      !channelsToKeep.includes(channel.id)
    ) {
      try {
        await channel.delete(channel.id);
        console.log(`Salon vocal ${channel.name} supprimé`);
      } catch (err) {
        console.error(
          `Erreur lors de la suppression du salon vocal ${channel.name}: ${err}`
        );
      }
    }
  });
};

const createChannel = async (nomTeam) => {
  const guild = await fetchGuild();
  const channel = await guild.channels.create({
    type: ChannelType.GuildVoice,
    name: nomTeam,
    //Id du salon parent (Salon vocaux)
    parent: "1330973733929615424",
  });
  console.log(`Salon vocal ${channel.name} créé`);
};

const deleteAndCreateChannels = async (nomsTeam) => {
  await deleteChannel();
  nomsTeam.map((nomTeam) => {
    createChannel(nomTeam);
  });
};

// Filtrer et supprimer les salons vocaux

// Log in to Discord with your client's token
client.login(token);
module.exports = { deleteAndCreateChannels };

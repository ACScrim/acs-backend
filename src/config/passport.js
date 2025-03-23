const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const User = require("../models/User");

// ID du serveur Discord obligatoire
const REQUIRED_GUILD_ID = "1330973733929615420";
// Lien d'invitation vers le serveur Discord
const DISCORD_INVITE_LINK = "https://discord.gg/ksCGJztmBd";

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_REDIRECT_URI,
      scope: ["identify", "email", "guilds"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Vérifier si les guilds sont présents dans le profil
        if (!profile.guilds) {
          console.log(
            `Impossible d'obtenir les serveurs de l'utilisateur ${profile.username}`
          );
          return done(null, false, {
            message:
              "Impossible d'accéder à la liste de vos serveurs Discord. Veuillez réessayer.",
            errorType: "discord_api_error",
          });
        }

        // Vérifier si l'utilisateur est membre du serveur Discord requis
        const isMemberOfRequiredGuild = profile.guilds.some(
          (guild) => guild.id === REQUIRED_GUILD_ID
        );

        if (!isMemberOfRequiredGuild) {
          console.log(
            `L'utilisateur ${profile.username} n'est pas membre du serveur Discord requis`
          );

          // Retourner une erreur spéciale pour indiquer le problème d'appartenance au serveur
          return done(null, false, {
            message:
              "Vous devez être membre du serveur Discord ACS pour vous connecter",
            errorType: "guild_membership_required",
            guildId: REQUIRED_GUILD_ID,
            inviteLink: DISCORD_INVITE_LINK,
          });
        }

        // Si l'utilisateur est membre, traiter l'authentification normalement
        let user = await User.findOne({ discordId: profile.id });
        const avatarUrl = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(profile.discriminator) % 5
            }.png`;

        if (!user) {
          // Créer un nouvel utilisateur
          user = await User.create({
            username: profile.username,
            email: profile.email,
            discordId: profile.id,
            accessToken,
            refreshToken,
            avatarUrl,
          });
        } else {
          // Mettre à jour les tokens si l'utilisateur existe déjà
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;

          // Vérifier si l'avatar a changé
          if (user.avatarUrl !== avatarUrl) {
            console.log(`Mise à jour de l'avatar pour ${profile.username}`);
            user.avatarUrl = avatarUrl;
          }

          // Vérifier si le nom d'utilisateur a changé
          if (user.username !== profile.username) {
            console.log(
              `Mise à jour du nom d'utilisateur: ${user.username} -> ${profile.username}`
            );
            user.username = profile.username;
          }

          // Sauvegarder les modifications
          await user.save();
        }

        // Authentification réussie
        return done(null, user);
      } catch (err) {
        console.error("Error in DiscordStrategy:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

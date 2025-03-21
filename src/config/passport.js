const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const User = require("../models/User");

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_REDIRECT_URI,
      scope: ["identify", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ discordId: profile.id });
        const avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;

        if (!user) {
          user = await User.create({
            username: profile.username,
            email: profile.email,
            discordId: profile.id,
            accessToken: accessToken,
            refreshToken: refreshToken,
            avatarUrl: avatarUrl,
          });
        } else {
          // Mettre à jour les tokens si l'utilisateur existe déjà
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
          await user.save();

          // Vérifier si l'avatar a changé
          if (user.avatarUrl !== avatarUrl) {
            console.log(
              `Mise à jour de l'avatar pour ${profile.username}: ${avatarUrl}`
            );
            user.avatarUrl = avatarUrl;
          }

          // Vérifier si le nom d'utilisateur a changé
          if (user.username !== profile.username) {
            console.log(
              `Mise à jour du nom d'utilisateur: ${user.username} -> ${profile.username}`
            );
            user.username = profile.username;
          }
        }
        done(null, user);
      } catch (err) {
        console.error("Error in DiscordStrategy:", err);
        done(err, null);
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

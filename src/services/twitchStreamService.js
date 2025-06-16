const axios = require("axios");
const User = require("../models/User");

class TwitchStreamService {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
  }

  /**
   * Obtient un token d'accès Twitch
   */
  async getTwitchAccessToken() {
    if (this.accessToken) return this.accessToken;

    try {
      const response = await axios.post("https://id.twitch.tv/oauth2/token", {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      });

      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error("Erreur lors de l'obtention du token Twitch:", error);
      throw new Error("Impossible d'obtenir le token Twitch");
    }
  }

  /**
   * Récupère les streams en live pour une liste d'utilisateurs Twitch
   */
  async getLiveStreams(twitchUsernames) {
    if (!twitchUsernames || twitchUsernames.length === 0) {
      return [];
    }

    try {
      const token = await this.getTwitchAccessToken();

      // L'API Twitch permet de récupérer jusqu'à 100 utilisateurs à la fois
      const userParams = twitchUsernames
        .map((username) => `user_login=${username}`)
        .join("&");

      const response = await axios.get(
        `https://api.twitch.tv/helix/streams?${userParams}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data.map((stream) => ({
        userId: stream.user_id,
        userName: stream.user_name,
        gameId: stream.game_id,
        gameName: stream.game_name,
        title: stream.title,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        thumbnailUrl: stream.thumbnail_url,
        isLive: true,
      }));
    } catch (error) {
      console.error("Erreur lors de la récupération des streams:", error);
      return [];
    }
  }

  /**
   * Récupère les participants d'un tournoi avec leurs noms Twitch
   */
  async getTournamentParticipantsWithTwitch(tournamentParticipants) {
    try {
      // Récupérer les IDs des participants
      const participantIds = tournamentParticipants.map(
        (p) => p.userId || p._id
      );

      // Récupérer les utilisateurs avec leurs profils Twitch
      const users = await User.find({
        _id: { $in: participantIds },
        "profile.twitchUsername": { $exists: true, $ne: null },
      }).select("_id username profile.twitchUsername");

      return users.map((user) => ({
        userId: user._id,
        username: user.username,
        twitchUsername: user.profile.twitchUsername,
      }));
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des participants Twitch:",
        error
      );
      return [];
    }
  }

  /**
   * Récupère tous les streams en live pour un tournoi donné
   */
  async getTournamentLiveStreams(tournamentParticipants) {
    try {
      // 1. Récupérer les participants avec leurs noms Twitch
      const participantsWithTwitch =
        await this.getTournamentParticipantsWithTwitch(tournamentParticipants);

      if (participantsWithTwitch.length === 0) {
        return [];
      }

      // 2. Extraire les noms Twitch
      const twitchUsernames = participantsWithTwitch.map(
        (p) => p.twitchUsername
      );

      // 3. Récupérer les streams en live
      const liveStreams = await this.getLiveStreams(twitchUsernames);

      // 4. Enrichir avec les infos des participants
      return liveStreams.map((stream) => {
        const participant = participantsWithTwitch.find(
          (p) =>
            p.twitchUsername.toLowerCase() === stream.userName.toLowerCase()
        );

        return {
          ...stream,
          participantId: participant?.userId,
          participantUsername: participant?.username,
        };
      });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des streams du tournoi:",
        error
      );
      return [];
    }
  }
}

module.exports = new TwitchStreamService();

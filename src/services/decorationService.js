// Methods CRONS
const winston = require("winston");
const { safeCronJob, startJobs } = require("./cronService");
const Decoration = require("../models/Decoration.js");
const Season = require("../models/Season.js");

// Utiliser le logger Winston déjà configuré dans l'application
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

const giveSeasonWinnerDecoration = async () => {
  // Vérifier si la décoration a déjà été donné
  const seasons = await Season.find().populate({
    path: "tournois",
    populate: {
      path: "teams",
      populate: {
        path: "players",
      },
    },
  });
  for (const season of seasons) {
    if (season.numero < seasons.length - 1 && season.numero > 0) {
      if (await Decoration.findOne({ ref: 'season-winner-' + season.numero })) {
        logger.info(`Décoration déjà donnée pour la saison ${season.numero}`);
        continue;
      }

      // Créer la décoration pour le gagnant de la saison
      const decoration = new Decoration({
        ref: 'season-winner-' + season.numero,
        name: `Gagnant de la saison ${season.numero}`,
        description: `Décoration pour le gagnant de la saison ${season.numero}`,
        // Vous pouvez ajouter une URL d'image si nécessaire
        svgPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', // SVG path for a star
      });

      let tournamentsToProcess = season.tournois;

      // Construire le classement en fonction des tournois de la saison
      const playerStats = {};

      for (const tournament of tournamentsToProcess) {
        // Ne considérer que les tournois terminés
        if (!tournament.finished) continue;

        // Parcourir les équipes du tournoi
        for (const team of tournament.teams) {
          // Vérifier si l'équipe a un classement (ranking de 1 = victoire)
          const isVictory = team.ranking === 1;

          // Mettre à jour les statistiques pour chaque joueur de l'équipe
          for (const player of team.players) {
            const playerId = player._id.toString();

            if (!playerStats[playerId]) {
              playerStats[playerId] = {
                playerId,
                username: player.username,
                totalTournaments: 0,
                totalVictories: 0,
              };
            }

            playerStats[playerId].totalTournaments++;

            if (isVictory) {
              playerStats[playerId].totalVictories++;
            }
          }
        }
      }

      // Convertir l'objet en tableau et trier par victoires décroissantes
      const rankings = Object.values(playerStats).sort((a, b) => {
        // Trier par victoires, puis par nombre de tournois si égalité
        if (b.totalVictories !== a.totalVictories) {
          return b.totalVictories - a.totalVictories;
        }
        return b.totalTournaments - a.totalTournaments;
      });

      decoration.users = [rankings[0].playerId];

      decoration.save();
    }
  }
}

const startDecorationScheduler = () => {
  const jobs = [
    {
      schedule: '*/30 * * * * *', // Every day at midnight
      task: safeCronJob(giveSeasonWinnerDecoration, 'giveSeasonWinnerDecoration'),
      name: 'give-season-winner-decoration',
    },
  ];

  startJobs(jobs);
}

module.exports = { startDecorationScheduler };

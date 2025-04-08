const Season = require("../models/Season");
const Tournament = require("../models/Tournament");
const Player = require("../models/Player");

/**
 * Récupère toutes les saisons
 */
exports.getAllSeasons = async (req, res) => {
  try {
    const seasons = await Season.find().sort({ numero: -1 });
    res.status(200).json(seasons);
  } catch (error) {
    console.error("Erreur lors de la récupération des saisons:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des saisons", error });
  }
};

/**
 * Récupère la saison en cours (numéro le plus élevé)
 */
exports.getCurrentSeason = async (req, res) => {
  try {
    const currentSeason = await Season.findOne()
      .sort({ numero: -1 })
      .populate("tournois");

    if (!currentSeason) {
      return res.status(404).json({ message: "Aucune saison n'a été trouvée" });
    }

    res.status(200).json(currentSeason);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de la saison actuelle:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération de la saison actuelle",
      error,
    });
  }
};

/**
 * Récupère les tournois disponibles pour une saison (non encore associés à aucune saison)
 */
exports.getAvailableTournaments = async (req, res) => {
  try {
    const { id } = req.params; // ID de la saison actuelle
    const { gameId } = req.query; // Optionnel : filtre par jeu

    // Trouver toutes les saisons
    const allSeasons = await Season.find();

    // Collecter tous les tournois qui sont déjà dans une saison (incluant celle actuelle)
    const assignedTournamentIds = new Set();

    for (const season of allSeasons) {
      // Ajouter tous les tournois de toutes les saisons
      if (season.tournois && season.tournois.length > 0) {
        for (const tournamentId of season.tournois) {
          assignedTournamentIds.add(tournamentId.toString());
        }
      }
    }

    // Construire la requête de recherche des tournois disponibles
    const query = { _id: { $nin: Array.from(assignedTournamentIds) } };

    // Ajouter le filtre par jeu si spécifié
    if (gameId) {
      query.game = gameId;
    }

    // Récupérer les tournois qui correspondent aux critères
    const availableTournaments = await Tournament.find(query).populate("game");

    res.status(200).json(availableTournaments);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des tournois disponibles:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération des tournois disponibles",
      error,
    });
  }
};

/**
 * Récupère une saison par son identifiant
 */
exports.getSeasonById = async (req, res) => {
  try {
    const { id } = req.params;
    const season = await Season.findById(id).populate("tournois");

    if (!season) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    res.status(200).json(season);
  } catch (error) {
    console.error("Erreur lors de la récupération de la saison:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de la saison", error });
  }
};

/**
 * Crée une nouvelle saison
 */
exports.createSeason = async (req, res) => {
  try {
    const { numero } = req.body;

    // Vérifier si le numéro de saison existe déjà
    const existingSeason = await Season.findOne({ numero });
    if (existingSeason) {
      return res
        .status(400)
        .json({ message: "Une saison avec ce numéro existe déjà" });
    }

    const newSeason = new Season({
      numero,
      tournois: [], // Initialement vide
    });

    await newSeason.save();
    res.status(201).json(newSeason);
  } catch (error) {
    console.error("Erreur lors de la création de la saison:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création de la saison", error });
  }
};

/**
 * Met à jour une saison existante
 */
exports.updateSeason = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, tournois } = req.body;

    // Vérifier si un autre saison avec le même numéro existe déjà (sauf celle-ci)
    if (numero) {
      const existingSeason = await Season.findOne({ numero, _id: { $ne: id } });
      if (existingSeason) {
        return res
          .status(400)
          .json({ message: "Une autre saison avec ce numéro existe déjà" });
      }
    }

    const updatedSeason = await Season.findByIdAndUpdate(
      id,
      { numero, tournois },
      { new: true, runValidators: true }
    ).populate("tournois");

    if (!updatedSeason) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    res.status(200).json(updatedSeason);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la saison:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de la saison", error });
  }
};

/**
 * Supprime une saison
 */
exports.deleteSeason = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSeason = await Season.findByIdAndDelete(id);

    if (!deletedSeason) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    res
      .status(200)
      .json({ message: "Saison supprimée avec succès", deletedSeason });
  } catch (error) {
    console.error("Erreur lors de la suppression de la saison:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression de la saison", error });
  }
};

/**
 * Ajoute un tournoi à une saison
 */
exports.addTournamentToSeason = async (req, res) => {
  try {
    const { id } = req.params;
    const { tournamentId } = req.body;

    // Vérifier si le tournoi existe
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Vérifier si le tournoi est déjà dans une saison
    const existingSeasonWithTournament = await Season.findOne({
      tournois: { $in: [tournamentId] },
      _id: { $ne: id }, // Exclure la saison actuelle
    });

    if (existingSeasonWithTournament) {
      return res.status(400).json({
        message: `Ce tournoi est déjà dans la saison ${existingSeasonWithTournament.numero}`,
      });
    }

    // Ajouter le tournoi à la saison
    const season = await Season.findById(id);
    if (!season) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    // Vérifier si le tournoi est déjà dans cette saison
    if (season.tournois.includes(tournamentId)) {
      return res
        .status(400)
        .json({ message: "Ce tournoi est déjà dans cette saison" });
    }

    // Ajouter le tournoi
    season.tournois.push(tournamentId);
    await season.save();

    const updatedSeason = await Season.findById(id).populate("tournois");
    res.status(200).json(updatedSeason);
  } catch (error) {
    console.error("Erreur lors de l'ajout du tournoi à la saison:", error);
    res.status(500).json({
      message: "Erreur lors de l'ajout du tournoi à la saison",
      error,
    });
  }
};

/**
 * Retire un tournoi d'une saison
 */
exports.removeTournamentFromSeason = async (req, res) => {
  try {
    const { id, tournamentId } = req.params;

    const season = await Season.findById(id);
    if (!season) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    // Vérifier si le tournoi est dans la saison
    if (!season.tournois.includes(tournamentId)) {
      return res
        .status(400)
        .json({ message: "Ce tournoi n'est pas dans cette saison" });
    }

    // Retirer le tournoi
    season.tournois = season.tournois.filter(
      (tournament) => tournament.toString() !== tournamentId
    );

    await season.save();

    const updatedSeason = await Season.findById(id).populate("tournois");
    res.status(200).json(updatedSeason);
  } catch (error) {
    console.error("Erreur lors du retrait du tournoi de la saison:", error);
    res.status(500).json({
      message: "Erreur lors du retrait du tournoi de la saison",
      error,
    });
  }
};

/**
 * Récupère le classement des joueurs pour une saison spécifique
 */
exports.getSeasonRanking = async (req, res) => {
  try {
    const { id } = req.params;
    const { gameId } = req.query; // Paramètre optionnel pour filtrer par jeu

    const season = await Season.findById(id).populate({
      path: "tournois",
      populate: {
        path: "teams",
        populate: {
          path: "players",
        },
      },
    });

    if (!season) {
      return res.status(404).json({ message: "Saison non trouvée" });
    }

    // Filtrer les tournois si un jeu est spécifié
    let tournamentsToProcess = season.tournois;
    if (gameId) {
      tournamentsToProcess = season.tournois.filter(
        (tournament) => tournament.game.toString() === gameId
      );
    }

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

    res.status(200).json({
      seasonNumber: season.numero,
      rankings,
      totalTournaments: tournamentsToProcess.filter((t) => t.finished).length,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du classement de la saison:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la récupération du classement de la saison",
      error,
    });
  }
};

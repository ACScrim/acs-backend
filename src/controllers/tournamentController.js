const Tournament = require("../models/Tournament");
const Player = require("../models/Player");
const User = require("../models/User");
const { deleteAndCreateChannels } = require("../discord-bot/index.js");
const { updateSignupMessages } = require("../services/schedulerService");
// Créer un tournoi
exports.createTournament = async (req, res) => {
  try {
    const { name, game, date, discordChannelName, players, description } =
      req.body;

    // Extraire uniquement les IDs des joueurs
    const playerIds = players.map((player) => player._id);

    // Initialiser la propriété checkIns avec les IDs des joueurs et la valeur false par défaut
    const checkIns = {};
    playerIds.forEach((id) => {
      checkIns[id] = false;
    });

    const newTournament = new Tournament({
      name,
      game,
      date,
      discordChannelName,
      players: playerIds,
      checkIns,
      description,
    });

    await newTournament.save();
    await updateSignupMessages();
    res.status(201).json(newTournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la création du tournoi", error });
  }
};

// Mettre à jour un tournoi
exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, discordChannelName, players, teams, description } =
      req.body;

    // Récupérer le tournoi existant pour la mise à jour
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Extraire les IDs des joueurs envoyés et existants
    const newPlayerIds = players.map((player) => player._id.toString());
    const existingPlayerIds = tournament.players.map((id) => id.toString());

    // Identifier les joueurs ajoutés et supprimés
    const addedPlayers = newPlayerIds.filter(
      (id) => !existingPlayerIds.includes(id)
    );
    const removedPlayers = existingPlayerIds.filter(
      (id) => !newPlayerIds.includes(id)
    );

    // Mettre à jour la liste des joueurs du tournoi
    tournament.players = newPlayerIds;

    // Mettre à jour les checkIns
    const checkIns = {};
    newPlayerIds.forEach((id) => {
      if (existingPlayerIds.includes(id) && tournament.checkIns.has(id)) {
        checkIns[id] = tournament.checkIns.get(id);
      } else {
        checkIns[id] = false;
      }
    });
    tournament.checkIns = checkIns;

    // 1. SUPPRIMER LES JOUEURS RETIRÉS DES ÉQUIPES
    if (tournament.teams && tournament.teams.length > 0) {
      for (let team of tournament.teams) {
        // Filtrer les joueurs retirés de l'équipe
        team.players = team.players.filter((playerId) =>
          newPlayerIds.includes(playerId.toString())
        );
      }
    }

    // 2. AJOUTER LES NOUVEAUX JOUEURS AUX ÉQUIPES
    if (
      tournament.teams &&
      tournament.teams.length > 0 &&
      addedPlayers.length > 0
    ) {
      // Pour chaque joueur ajouté
      for (let addedPlayerId of addedPlayers) {
        // Trouver l'équipe avec le moins de joueurs
        let minTeam = tournament.teams[0];
        let minPlayers = minTeam.players.length;

        for (let i = 1; i < tournament.teams.length; i++) {
          if (tournament.teams[i].players.length < minPlayers) {
            minTeam = tournament.teams[i];
            minPlayers = minTeam.players.length;
          }
        }

        // Ajouter le joueur à cette équipe
        minTeam.players.push(addedPlayerId);
      }
    }

    if (tournament.teams && teams) {
      for (let team of tournament.teams) {
        const matchingTeam = teams.find(
          (t) => t._id.toString() === team._id.toString()
        );

        // Vérifier si une équipe correspondante a été trouvée
        if (matchingTeam) {
          team.name = matchingTeam.name;
        }
      }
    }

    // Mettre à jour les autres propriétés du tournoi
    tournament.name = name;
    tournament.date = date;
    tournament.discordChannelName = discordChannelName;
    tournament.description = description;

    // Sauvegarder directement le document modifié
    await tournament.save();

    // Récupérer le tournoi mis à jour et peuplé pour la réponse
    const updatedTournament = await Tournament.findById(id).populate(
      "game players teams.players"
    );

    res.status(200).json(updatedTournament);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du tournoi:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du tournoi", error });
  }
};

// Supprimer un tournoi par son identifiant
exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    await Tournament.findByIdAndDelete(id);
    res.status(200).json({ message: "Tournoi supprimé avec succès" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du tournoi", error });
  }
};

// Récupérer tous les tournois
exports.getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find().populate(
      "game players teams.players description"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    console.error("Erreur lors de la récupération des tournois:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

// Récupérer un tournoi par son identifiant
exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id).populate(
      "game players teams.players description"
    );
    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du tournoi", error });
  }
};

// Récupérer les tournois par jeu
exports.getTournamentsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const tournaments = await Tournament.find({ game: gameId }).populate(
      "game players teams.players"
    );
    res.status(200).json(tournaments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des tournois", error });
  }
};

// Terminer un tournoi et déclarer une équipe gagnante
exports.finishTournament = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    tournament.finished = true;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la finalisation du tournoi", error });
  }
};

// Ajouter cet endpoint

// Marquer un tournoi comme terminé sans définir une équipe gagnante spécifique
exports.markTournamentAsFinished = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Vérifier qu'au moins une équipe a un ranking
    const hasRankings = tournament.teams.some((team) => team.ranking > 0);
    if (!hasRankings) {
      return res.status(400).json({
        message:
          "Impossible de terminer le tournoi : aucune équipe n'a de classement défini",
      });
    }

    tournament.finished = true;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors du marquage du tournoi comme terminé",
      error,
    });
  }
};

// Générer des équipes aléatoire en fonction d'un nombre d'équipes donné
exports.generateTeams = async (req, res) => {
  try {
    const { id } = req.params;
    const { numTeams } = req.body;
    const tournament = await Tournament.findById(id).populate("players");

    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const players = [...tournament.players];
    const teams = [];

    for (let i = 0; i < numTeams; i++) {
      teams.push({ name: `Équipe ${i + 1}`, players: [] });
    }

    while (players.length > 0) {
      for (let i = 0; i < teams.length && players.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * players.length);
        teams[i].players.push(players.splice(randomIndex, 1)[0]);
      }
    }

    tournament.teams = teams;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la génération des équipes", error });
  }
};

/**
 * Met à jour uniquement les équipes d'un tournoi
 * Endpoint dédié pour optimiser la gestion des équipes
 */
exports.updateTournamentTeams = async (req, res) => {
  try {
    const { id } = req.params;
    const { teams } = req.body;

    if (!teams || !Array.isArray(teams)) {
      return res
        .status(400)
        .json({ message: "Les équipes doivent être fournies dans un tableau" });
    }

    // Récupérer le tournoi existant
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Mise à jour des équipes uniquement
    tournament.teams = teams;

    // Sauvegarder le tournoi avec ses nouvelles équipes
    await tournament.save();

    // Renvoyer le tournoi mis à jour (populé pour avoir toutes les données des équipes)
    const updatedTournament = await Tournament.findById(id).populate(
      "teams.players"
    );

    res.status(200).json({
      message: "Équipes mises à jour avec succès",
      tournament: updatedTournament,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des équipes:", error);
    res.status(500).json({
      message: "Erreur lors de la mise à jour des équipes",
      error: error.message,
    });
  }
};

// Mettre à jour le classement d'une équipe dans un tournoi
exports.updateTeamRanking = async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { ranking } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const team = tournament.teams.id(teamId);
    if (!team) {
      return res.status(404).json({ message: "Équipe non trouvée" });
    }

    team.ranking = ranking;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du classement de l'équipe",
      error,
    });
  }
};

// Inscrire un joueur à un tournoi
exports.registerPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const player = await Player.findOne({ userId: userId });
    if (!player) return res.status(404).json({ message: "Joueur non trouvé" });

    const tournament = await Tournament.findById(id);
    if (!tournament)
      return res.status(404).json({ message: "Tournoi non trouvé" });

    if (!tournament.players.includes(player._id)) {
      tournament.players.push(player._id);
      tournament.checkIns.set(player._id, false); // Ajout dans checkIns avec "false"

      // Enregistrer la date d'inscription
      tournament.registrationDates.set(player._id, new Date());

      // Ajouter le joueur à une équipe
      if (tournament.teams && tournament.teams.length > 0) {
        // Trouver l'équipe la moins nombreuse
        let minTeam = tournament.teams[0];
        for (let team of tournament.teams) {
          if (team.players.length < minTeam.players.length) {
            minTeam = team;
          }
        }

        // Ajouter le joueur à l'équipe la moins nombreuse
        minTeam.players.push(player._id);
      }

      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de l'inscription au tournoi", error });
  }
};

// Désinscrire un joueur d'un tournoi
exports.unregisterPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const player = await Player.findOne({ userId: userId });
    if (!player) return res.status(404).json({ message: "Joueur non trouvé" });

    const tournament = await Tournament.findById(id);
    if (!tournament)
      return res.status(404).json({ message: "Tournoi non trouvé" });

    // Retirer le joueur de la liste des participants
    const playerIndex = tournament.players.indexOf(player._id);
    if (playerIndex !== -1) {
      tournament.players.splice(playerIndex, 1);
      tournament.checkIns.delete(player._id); // Supprime le check-in
      tournament.registrationDates.delete(player._id); // Supprime la date d'inscription

      // Retirer également le joueur de son équipe s'il en fait partie
      if (tournament.teams && tournament.teams.length > 0) {
        // Pour chaque équipe
        tournament.teams.forEach((team) => {
          // Rechercher le joueur dans l'équipe
          const teamPlayerIndex = team.players.indexOf(player._id);
          if (teamPlayerIndex !== -1) {
            // Retirer le joueur de l'équipe
            team.players.splice(teamPlayerIndex, 1);
          }
        });
      }

      await tournament.save();
    }

    res.status(200).json(tournament);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la désinscription du tournoi", error });
  }
};

// Check-in ou uncheck-in un joueur à un tournoi
exports.checkInPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, checkedIn } = req.body;

    // Récupérer le playerId à partir du userId
    const player = await Player.findOne({ userId: userId });
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    const playerId = player._id;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    if (!tournament.players.includes(playerId)) {
      return res.status(404).json({ message: "Joueur non inscrit au tournoi" });
    }

    tournament.checkIns.set(playerId, checkedIn);
    await tournament.save();

    res.status(200).json({ message: "Check-in mis à jour", tournament });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors du check-in", error });
  }
};

exports.createDiscordChannels = async (req, res) => {
  try {
    const { teams } = req.body;
    const nomsTeam = teams.map((team) => team.name);
    await deleteAndCreateChannels(nomsTeam);
    res.status(200).json({ message: "Salons vocaux créés" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la création des salons vocaux", error });
  }
};
exports.unmarkTournamentAsFinished = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    tournament.finished = false;
    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de l'annulation de la finalisation du tournoi",
      error,
    });
  }
};

// Mettre à jour le score d'une équipe dans un tournoi
exports.updateTeamScore = async (req, res) => {
  try {
    const { id, teamId } = req.params;
    const { score } = req.body;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    const team = tournament.teams.id(teamId);
    if (!team) {
      return res.status(404).json({ message: "Équipe non trouvée" });
    }

    // Mettre à jour le score de l'équipe
    team.score = score;

    // Modifier le nom de l'équipe pour inclure le score entre parenthèses
    const baseName = team.name.replace(/ \(\d+ Pts\)$/, ""); // Enlever score existant s'il y en a un
    team.name = `${baseName} (${score} Pts)`;

    await tournament.save();

    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour du score de l'équipe",
      error,
    });
  }
};

// Supprimer toutes les équipes d'un tournoi
exports.deleteAllTeams = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournoi non trouvé" });
    }

    // Réinitialiser le tableau d'équipes à un tableau vide
    tournament.teams = [];

    await tournament.save();

    res.status(200).json({
      message: "Toutes les équipes ont été supprimées avec succès",
      tournament,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression des équipes:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression des équipes",
      error: error.message,
    });
  }
};

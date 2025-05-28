const { sendPropositionEmbed, deleteEmbedProposal, updateProposalEmbed } = require("../discord-bot");
const GameProposal = require("../models/GameProposal");
const axios = require("axios");

// Créer une nouvelle proposition de jeu
exports.createProposal = async (req, res) => {
  try {
    const { name, description, rawgId, imageUrl } = req.body;
    const playerId = req.user._id;

    // Vérifier si le jeu a déjà été proposé
    const existingProposal = await GameProposal.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      status: { $in: ["pending", "approved"] },
    });

    if (existingProposal) {
      return res.status(409).json({
        message: "Ce jeu a déjà été proposé",
        proposal: existingProposal,
      });
    }

    const newProposal = new GameProposal({
      name,
      description,
      rawgId,
      imageUrl,
      proposedBy: playerId,
    });

    await newProposal.save();
    res.status(201).json(newProposal);
  } catch (error) {
    console.error("Erreur lors de la création d'une proposition:", error);
    res.status(500).json({
      message: "Erreur lors de la création de la proposition de jeu",
      error: error.message,
    });
  }
};

// Obtenir toutes les propositions de jeu (avec filtrage)
exports.getProposals = async (req, res) => {
  try {
    const { status, search } = req.query;

    // Construire la requête
    const query = {};

    // Filtre par statut si spécifié
    if (status && status !== "all") {
      query.status = status;
    }

    // Recherche par nom si spécifiée
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Récupération des propositions avec les votes
    let proposals = await GameProposal.find(query)
      .populate("proposedBy", "username")
      .populate("votes.player", "username")
      .sort({ createdAt: -1 });

    // Ajouter userVote pour l'utilisateur connecté
    if (req.user) {
      const userId = req.user._id.toString();

      proposals = proposals.map((proposal) => {
        const proposalObj = proposal.toObject();

        // Rechercher le vote de l'utilisateur dans le tableau des votes
        const userVote = proposal.votes.find(
          (vote) =>
            vote.player &&
            vote.player._id &&
            vote.player._id.toString() === userId
        );

        // Ajouter la propriété userVote
        proposalObj.userVote = userVote ? userVote.value : 0;

        return proposalObj;
      });
    }

    res.status(200).json(proposals);
  } catch (error) {
    console.error("Erreur lors de la récupération des propositions:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des propositions de jeux",
      error: error.message,
    });
  }
};

// Voter pour une proposition
exports.voteProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { value } = req.body; // 1 pour upvote, -1 pour downvote, 0 pour annuler
    const playerId = req.user._id;

    // Modification ici : accepter aussi la valeur 0
    if (value !== 1 && value !== -1 && value !== 0) {
      return res
        .status(400)
        .json({ message: "La valeur du vote doit être 1, -1 ou 0" });
    }

    const proposal = await GameProposal.findById(proposalId).populate("proposedBy", "username").populate("votes.player", "username");;
    if (!proposal) {
      return res.status(404).json({ message: "Proposition non trouvée" });
    }

    // Vérifier si l'utilisateur a déjà voté
    const existingVoteIndex = proposal.votes.findIndex(
      (vote) => vote.player.toString() === playerId.toString()
    );

    if (value === 0) {
      // Si la valeur est 0, supprimer le vote s'il existe
      if (existingVoteIndex >= 0) {
        proposal.votes.splice(existingVoteIndex, 1);
      }
    } else if (existingVoteIndex >= 0) {
      // Mettre à jour le vote existant
      proposal.votes[existingVoteIndex].value = value;
    } else {
      // Ajouter un nouveau vote
      proposal.votes.push({ player: playerId, value });
    }

    // Recalculer le total des votes
    proposal.calculateVotes();
    await proposal.save();

    updateProposalEmbed(proposal);

    res.status(200).json(proposal);
  } catch (error) {
    console.error("Erreur lors du vote:", error);
    res.status(500).json({
      message: "Erreur lors du vote pour la proposition",
      error: error.message,
    });
  }
};

// Modérer une proposition (admin uniquement)
exports.moderateProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const proposal = await GameProposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: "Proposition non trouvée" });
    }

    proposal.status = status;
    if (status === "rejected" && rejectionReason) {
      proposal.rejectionReason = rejectionReason;
    }

    await proposal.save();
    if (proposal.status === "approved") {
      await sendPropositionEmbed();
    }
    res.status(200).json(proposal);
  } catch (error) {
    console.error("Erreur lors de la modération de la proposition:", error);
    res.status(500).json({
      message: "Erreur lors de la modération de la proposition",
      error: error.message,
    });
  }
};

// Chercher des jeux via RAWG API
exports.searchGames = async (req, res) => {
  try {
    const { query } = req.query;
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      throw new Error("Clé API RAWG non configurée");
    }

    const response = await axios.get("https://api.rawg.io/api/games", {
      params: {
        key: apiKey,
        search: query,
        page_size: 10,
      },
    });

    res.status(200).json(response.data.results);
  } catch (error) {
    console.error("Erreur lors de la recherche de jeux:", error);
    res.status(500).json({
      message: "Erreur lors de la recherche de jeux",
      error: error.message,
    });
  }
};

exports.deleteProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    // Vérifier que l'utilisateur est admin
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({
        message: "Seuls les administrateurs peuvent supprimer des propositions",
      });
    }

    const proposal = await GameProposal.findByIdAndDelete(proposalId);

    if (!proposal) {
      return res.status(404).json({ message: "Proposition non trouvée" });
    }

    deleteEmbedProposal(proposal)

    res.status(200).json({ message: "Proposition supprimée avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de la proposition:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression de la proposition",
      error: error.message,
    });
  }
};

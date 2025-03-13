const Player = require("../models/Player");

// Récupérer la liste des joueurs
exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des joueurs" });
  }
};

// Récupérer un joueur par son ID
exports.getPlayerById = async (req, res) => {
  console.log("getplayerbyid");

  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    res.json(player);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du joueur" });
  }
};

// Ajouter un joueur
exports.addPlayer = async (req, res) => {
  const { username } = req.body;

  try {
    // Vérifier si un joueur avec le même username existe déjà (insensible à la casse)
    const existingPlayer = await Player.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    });
    if (existingPlayer) {
      return res.status(400).json({ message: "Le joueur existe déjà" });
    }

    const player = new Player({ username });
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la création du joueur" });
  }
};

// Supprimer un joueur
exports.deletePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }
    await Player.deleteOne({ _id: req.params.id });
    res.json({ message: "Joueur supprimé" });
  } catch (error) {
    console.error("Erreur lors de la suppression du joueur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du joueur" });
  }
};

exports.searchPlayers = async (req, res) => {
  try {
    console.log("Recherche des joueurs commencée");
    const { search } = req.query;
    console.log("Paramètre de recherche reçu:", search);

    const players = await Player.find({
      username: { $regex: search, $options: "i" },
    });

    console.log("Joueurs trouvés:", players);
    res.status(200).json(players);
  } catch (error) {
    console.error("Erreur lors de la recherche des joueurs:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la recherche des joueurs", error });
  }
};

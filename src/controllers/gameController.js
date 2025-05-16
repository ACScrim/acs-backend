const Game = require("../models/Game");

exports.getGames = async (req, res) => {
  const games = await Game.find();
  res.json(games);
};

exports.addGame = async (req, res) => {
  const { name, description, imageUrl, roles } = req.body;

  // Vérifier si un jeu avec le même nom existe déjà
  const gameExists = await Game.findOne({ name });

  if (gameExists) {
    return res.status(400).json({ message: "Ce jeu a déjà été créé" });
  }

  const game = new Game({ name, description, imageUrl, roles: roles || [] });
  await game.save();
  res.status(201).json(game);
};

exports.updateGame = async (req, res) => {
  const game = await Game.findById(req.params.id);

  if (game) {
    game.name = req.body.name || game.name;
    game.description = req.body.description || game.description;
    game.imageUrl = req.body.imageUrl || game.imageUrl;

    // Mise à jour des rôles si fournis
    if (req.body.roles) {
      game.roles = req.body.roles;
    }

    const updatedGame = await game.save();
    res.json(updatedGame);
  } else {
    res.status(404).json({ message: "Game not found" });
  }
};

exports.deleteGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    // Utiliser deleteOne() plutôt que remove()
    await Game.deleteOne({ _id: req.params.id });

    res.json({ message: "Game removed" });
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la suppression" });
  }
};

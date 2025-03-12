const Game = require("../models/Game");

exports.getGames = async (req, res) => {
  const games = await Game.find();
  res.json(games);
};

exports.addGame = async (req, res) => {
  const { name, description } = req.body;

  // Vérifier si un jeu avec le même nom existe déjà
  const gameExists = await Game.findOne({ name });

  if (gameExists) {
    return res.status(400).json({ message: "Ce jeu a déjà été créé" });
  }

  const game = new Game({ name, description });
  await game.save();
  res.status(201).json(game);
};

exports.updateGame = async (req, res) => {
  const game = await Game.findById(req.params.id);

  if (game) {
    game.name = req.body.name || game.name;
    game.description = req.body.description || game.description;
    const updatedGame = await game.save();
    res.json(updatedGame);
  } else {
    res.status(404).json({ message: "Game not found" });
  }
};

exports.deleteGame = async (req, res) => {
  const game = await Game.findById(req.params.id);

  if (game) {
    await game.remove();
    res.json({ message: "Game removed" });
  } else {
    res.status(404).json({ message: "Game not found" });
  }
};

const Player = require("../models/Player");

exports.getPlayers = async (req, res) => {
  const players = await Player.find().populate("game");
  res.json(players);
};

exports.addPlayer = async (req, res) => {
  const { name, tier, game } = req.body;
  const player = new Player({ name, tier, game });
  await player.save();
  res.status(201).json(player);
};

exports.updatePlayer = async (req, res) => {
  const player = await Player.findById(req.params.id);

  if (player) {
    player.name = req.body.name || player.name;
    player.tier = req.body.tier || player.tier;
    player.game = req.body.game || player.game;
    player.totalPoints = req.body.totalPoints || player.totalPoints;
    const updatedPlayer = await player.save();
    res.json(updatedPlayer);
  } else {
    res.status(404).json({ message: "Player not found" });
  }
};

exports.deletePlayer = async (req, res) => {
  const player = await Player.findById(req.params.id);

  if (player) {
    await player.remove();
    res.json({ message: "Player removed" });
  } else {
    res.status(404).json({ message: "Player not found" });
  }
};

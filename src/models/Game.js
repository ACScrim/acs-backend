const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
});

const Game = mongoose.model("Game", gameSchema);
module.exports = Game;

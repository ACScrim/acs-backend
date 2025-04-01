const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  imageUrl: { type: String, default: "" },
});

const Game = mongoose.model("Game", gameSchema);
module.exports = Game;

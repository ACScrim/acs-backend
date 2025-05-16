const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  imageUrl: { type: String, default: "" },
  // Ajout des rôles spécifiques au jeu
  roles: [
    {
      name: { type: String, required: true },
      color: { type: String, default: "#6B7280" },
    },
  ],
});

const Game = mongoose.model("Game", gameSchema);
module.exports = Game;

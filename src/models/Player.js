const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const playerSchema = new Schema({
  username: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  discordId: { type: String, default: null },
  badges: [{ type: Schema.Types.ObjectId, ref: "Badge" }], // Liste des badges associés
});

const Player = mongoose.model("Player", playerSchema);

module.exports = Player;

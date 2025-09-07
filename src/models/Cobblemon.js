const mongoose = require("mongoose");

const playerDataSchema = new mongoose.Schema({
  uuid: { type: String, required: true },
  name: { type: String, required: false },
  capturesCount: { type: Number, default: 0 },
  shiniesCount: { type: Number, default: 0 }
})

const cobblemonSchema = new mongoose.Schema({
  opened: { type: Boolean, default: false },
  playersData: [playerDataSchema]
});

const Cobblemon = mongoose.model("Cobblemon", cobblemonSchema);
module.exports = Cobblemon;

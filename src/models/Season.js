// filepath: d:\Dev\ACS\acs-backend\src\models\Saison.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const saisonSchema = new Schema({
  numero: { type: Number, required: true, unique: true },
  tournois: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tournament" }],
});

const Saison = mongoose.models.Saison || mongoose.model("Saison", saisonSchema);
module.exports = Saison;

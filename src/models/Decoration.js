const mongoose = require("mongoose");

const decorationSchema = new mongoose.Schema({
  ref: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String, default: null },
  svgPath: { type: String, default: null }, 
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }]
}, {
  timestamps: true // Optionnel : ajouter createdAt et updatedAt
});

const Decoration = mongoose.model("Decoration", decorationSchema);
module.exports = Decoration;

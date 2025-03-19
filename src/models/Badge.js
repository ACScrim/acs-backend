const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const badgeSchema = new Schema({
  title: { type: String, required: true, trim: true, minlength: 1 },
  imageUrl: { type: String, required: true, trim: true, minlength: 1 },
  description: { type: String, trim: true, default: "" }, // Ajout du champ description
});

const Badge = mongoose.model("Badge", badgeSchema);

module.exports = Badge;

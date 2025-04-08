const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const badgeSchema = new Schema({
  title: { type: String, required: true, trim: true, minlength: 1 },
  imageUrl: { type: String, required: true, trim: true, minlength: 1 },
  description: { type: String, trim: true, default: "" }, // Ajout du champ description
  // Nouveaux champs pour la catégorie
  categoryType: {
    type: String,
    required: true,
    enum: ["game", "acs"],
    default: "acs",
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Game",
    // Ce champ est requis uniquement si categoryType est 'game'
    required: function () {
      return this.categoryType === "game";
    },
  },
});

const Badge = mongoose.model("Badge", badgeSchema);

module.exports = Badge;

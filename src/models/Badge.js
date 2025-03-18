const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const badgeSchema = new Schema({
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
});

const Badge = mongoose.model("Badge", badgeSchema);

module.exports = Badge;

const express = require("express");
const {
  createBadge,
  getBadges,
  getBadgeById,
  assignBadgeToPlayer,
  removeBadgeFromPlayer,
  updateBadge,
  deleteBadge,
} = require("../controllers/badgeController");
const router = express.Router();

router.post("/", createBadge);
router.get("/", getBadges);
router.get("/:id", getBadgeById);
router.put("/:id", updateBadge); // Ajouter cette route
router.delete("/:id", deleteBadge); // Ajouter cette route
router.post("/assign", assignBadgeToPlayer);
router.post("/remove", removeBadgeFromPlayer);

module.exports = router;

const express = require("express");
const {
  createBadge,
  getBadges,
  getBadgeById,
  assignBadgeToPlayer,
  removeBadgeFromPlayer,
} = require("../controllers/badgeController");
const router = express.Router();

router.post("/", createBadge);
router.get("/", getBadges);
router.get("/:id", getBadgeById);
router.post("/assign", assignBadgeToPlayer);
router.post("/remove", removeBadgeFromPlayer);

module.exports = router;

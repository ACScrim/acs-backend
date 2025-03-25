const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcementController");
const { protect, admin } = require("../middleware/authMiddleware");

// Routes publiques
router.get("/", announcementController.getAnnouncements);
router.get("/:id", announcementController.getAnnouncement);

// Routes protégées (admin seulement)
router.post("/", protect, admin, announcementController.createAnnouncement);
router.put("/:id", protect, admin, announcementController.updateAnnouncement);
router.delete(
  "/:id",
  protect,
  admin,
  announcementController.deleteAnnouncement
);

module.exports = router;

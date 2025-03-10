// filepath: d:\Dev\ACS\acs-backend\src\routes\authRoutes.js
const express = require("express");
const passport = require("passport");
const {
  register,
  login,
  getProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);

// Discord OAuth routes
router.get("/discord", passport.authenticate("discord"));
router.get(
  "/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/login",
    successRedirect: "/",
  })
);

module.exports = router;

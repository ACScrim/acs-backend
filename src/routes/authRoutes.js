const express = require("express");
const passport = require("passport");
const {
  discordCallback,
  getMe,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.get("/discord", passport.authenticate("discord"));

router.get(
  "/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/login",
  }),
  discordCallback
);

router.get("/me", protect, getMe);

router.post("/logout", logout);

module.exports = router;

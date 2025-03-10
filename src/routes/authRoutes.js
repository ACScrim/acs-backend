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
  }),
  (req, res) => {
    // Redirige vers le frontend après une connexion réussie
    res.redirect("http://localhost:5173/");
  }
);

router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

module.exports = router;

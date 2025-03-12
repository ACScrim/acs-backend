const express = require("express");
const passport = require("passport");
const {
  register,
  login,
  getProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
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
    // Générer un token JWT
    const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Stocker le token dans un cookie HTTP-only
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600000, // 1 heure
    });

    // Redirige vers le frontend après une connexion réussie
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(frontendUrl);
  }
);

router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out" });
    }
    res.status(200).json({ message: "Logged out successfully" });
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");

// Route pour initier l'authentification Discord
router.get("/discord", passport.authenticate("discord"));

// Route de callback avec notre gestionnaire personnalisé
router.get("/discord/callback", authController.discordCallback);

// Route pour récupérer l'utilisateur connecté
router.get("/me", authController.getMe);

// Route de déconnexion
router.post("/logout", authController.logout);

module.exports = router;

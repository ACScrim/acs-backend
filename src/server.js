const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const passport = require("passport");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const gameRoutes = require("./routes/gameRoutes");

// Charger les variables d'environnement
dotenv.config();

// Importer la configuration de Passport.js
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 60000 * 60 * 24 * 7, // 7 jours
      httpOnly: false,
      secure: process.env.NODE_ENV === "production", // Utiliser des cookies sécurisés en production
      sameSite: "lax", // Protéger contre les attaques CSRF
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Configurer CORS pour autoriser les requêtes depuis le frontend
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // Utiliser l'URL du frontend depuis le fichier .env
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/games", gameRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

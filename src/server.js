const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const winston = require("winston");

// Charger les variables d'environnement
dotenv.config();

// Valider les variables d'environnement
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "CORS_ORIGIN"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(
      `Erreur: La variable d'environnement ${envVar} est manquante.`
    );
    process.exit(1);
  }
}

// Configurer Winston pour les logs
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

// Importer la configuration de Passport.js
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// Limiter les requêtes à 100 par IP toutes les 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use(limiter);

// Configurer CORS pour autoriser les requêtes depuis le frontend
const allowedOrigins = process.env.CORS_ORIGIN.split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origine non autorisée par CORS"));
      }
    },
    credentials: true,
  })
);

// Configurer les sessions
app.use(
  session({
    name: "acs.sid",
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 3 * 24 * 60 * 60, // 3 jours en secondes
    }),
    cookie: {
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 jours en millisecondes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const gameRoutes = require("./routes/gameRoutes");
const userRoutes = require("./routes/userRoutes");
const badgeRoutes = require("./routes/badgeRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/users", userRoutes);
app.use("/api/badges", badgeRoutes);

// Middleware pour les erreurs globales
app.use((err, req, res, next) => {
  logger.error("Erreur non gérée:", err);
  res.status(500).json({ message: "Une erreur interne est survenue." });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    retryWrites: true,
    w: "majority",
  })
  .then(() => logger.info("Connected to MongoDB"))
  .catch((err) => logger.error("Could not connect to MongoDB", err));

// Gestion des erreurs non capturées
process.on("uncaughtException", (err) => {
  logger.error("Erreur non capturée:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  logger.error("Promesse non gérée:", err);
  process.exit(1);
});

// Démarrer le serveur
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

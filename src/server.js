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
const discordbot = require("./discord-bot/index.js");
const { startScheduler } = require("./services/schedulerService");
const gameProposalRoutes = require("./routes/gameProposalRoutes");
const seasonRoutes = require("./routes/seasonRoutes");
const playerGameLevelRoutes = require("./routes/playerGameLevelRoutes");
const twitchRoutes = require("./routes/twitchRoutes");
const { initializeTwitchEventSubscriptions } = require("./discord-bot/twitch");

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
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  ],
});

// Importer la configuration de Passport.js
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration pour faire confiance au proxy - AJOUTEZ CECI
if (process.env.TRUST_PROXY === "true") {
  // Faire confiance au premier proxy (Nginx)
  app.set("trust proxy", 1);
  console.log("Express configuré pour faire confiance au proxy");
}

// Middleware
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      req.rawBody = buf.toString(encoding || 'utf8');
    } catch (e) {
      console.error("Erreur lors de la conversion du buffer rawBody en string:", e);
      req.rawBody = ''; // fallback
    }
  }
}));
app.use(cookieParser());
app.use(helmet());

// Limiter les requêtes à 100 par IP toutes les 15 minutes
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 350,
// });
// app.use(limiter);

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
    rolling: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60, // Augmenté à 7 jours en secondes pour plus de sécurité
      autoRemove: "native", // Utilise l'index TTL natif de MongoDB (important!)
      touchAfter: 15 * 60, // Réduit à 15 minutes pour actualiser plus fréquemment la date d'expiration
      crypto: {
        // Pour sécuriser les données de session
        secret: process.env.JWT_SECRET,
      },
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // Augmenté à 7 jours en millisecondes
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
app.use("/api/game-proposals", gameProposalRoutes);
app.use("/api/seasons", seasonRoutes);
app.use("/api/player-levels", playerGameLevelRoutes);
app.use("/api/twitch", twitchRoutes);

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
  .then(() => {
    logger.info("Connected to MongoDB")
    initializeTwitchEventSubscriptions().catch(err => {
      logger.error("Échec de l'initialisation des abonnements Twitch EventSub:", err);
    });
  })
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

startScheduler();

// Démarrer le serveur
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// filepath: d:\Dev\ACS\acs-backend\src\server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const passport = require("passport");
const session = require("express-session");
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const gameRoutes = require("./routes/gameRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

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

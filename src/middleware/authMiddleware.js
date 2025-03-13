exports.protect = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
};

exports.admin = (req, res, next) => {
  if (
    (req.user && req.user.role === "admin") ||
    (req.user && req.user.role === "superadmin")
  ) {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as an admin" });
  }
};

const User = require("../models/User");

exports.isSuperAdmin = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  const user = await User.findById(req.user.id);
  if (user.role !== "superadmin") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  next();
};

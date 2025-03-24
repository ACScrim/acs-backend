const express = require("express");
const {
  getAllUsers,
  updateUserRole,
  getUserById,
  deleteUser,
} = require("../controllers/userController");
const { isSuperAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllUsers);
router.put("/role", updateUserRole);
router.get("/:id", getUserById);
router.delete("/:id", isSuperAdmin, deleteUser); // Nouvelle route protégée par isSuperAdmin

module.exports = router;

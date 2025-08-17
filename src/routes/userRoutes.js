const express = require("express");
const {
  getAllUsers,
  updateUserRole,
  getUserById,
  deleteUser,
  updateUserProfile,
  getUsersWithGameRole,
  getUserAvatar,
} = require("../controllers/userController");
const { isSuperAdmin } = require("../middleware/authMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.put("/profile", protect, updateUserProfile);
router.get("/roles/game/:gameId", protect, getUsersWithGameRole);

router.get("/", getAllUsers);
router.put("/role", updateUserRole);
router.get("/:id", getUserById);
router.delete("/:id", isSuperAdmin, deleteUser);

router.get("/avatar/:id", protect, getUserAvatar);

module.exports = router;

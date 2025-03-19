const express = require("express");
const {
  getAllUsers,
  updateUserRole,
  getUserById,
} = require("../controllers/userController");
const { isSuperAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllUsers);
router.put("/role", updateUserRole);
router.get("/:id", getUserById);

module.exports = router;

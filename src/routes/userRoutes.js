const express = require("express");
const {
  getAllUsers,
  updateUserRole,
} = require("../controllers/userController");
const { isSuperAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", isSuperAdmin, getAllUsers);
router.put("/role", isSuperAdmin, updateUserRole);

module.exports = router;

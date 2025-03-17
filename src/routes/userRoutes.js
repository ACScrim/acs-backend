const express = require("express");
const {
  getAllUsers,
  updateUserRole,
} = require("../controllers/userController");
const { isSuperAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllUsers);
router.put("/role", updateUserRole);

module.exports = router;

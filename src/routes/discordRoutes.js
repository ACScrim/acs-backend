const express = require("express");
const { getChannels, getUsers, sendChannelMessage, sendPrivateMessage } = require("../controllers/discordController");
const router = express.Router();

router.get("/channels", getChannels);
router.get("/users", getUsers);
router.post("/send/channel", sendChannelMessage);
router.post("/send/private", sendPrivateMessage);

module.exports = router;
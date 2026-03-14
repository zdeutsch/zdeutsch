const express = require("express");
const path = require("path");
const { SHARE_DASHBOARD_DIR } = require("../config/constants");

const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(path.join(SHARE_DASHBOARD_DIR, "index.html"));
});

router.use(express.static(SHARE_DASHBOARD_DIR));

module.exports = router;

const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    now: new Date().toISOString()
  });
});

module.exports = router;

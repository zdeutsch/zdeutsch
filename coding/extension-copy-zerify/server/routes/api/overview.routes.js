const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { getOverview } = require("../../services/overviewService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await getOverview();
    res.json({ ok: true, data });
  })
);

module.exports = router;

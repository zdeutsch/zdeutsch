const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listLesenContributions,
  editLesenContribution,
  reviewLesenContribution
} = require("../../services/contributionService");

const router = express.Router();

router.get(
  "/lesen",
  asyncHandler(async (req, res) => {
    const data = await listLesenContributions(req.query);
    res.json({ ok: true, data });
  })
);

router.post(
  "/lesen/edit",
  asyncHandler(async (req, res) => {
    const data = await editLesenContribution(req.body);
    res.json({ ok: true, data });
  })
);

router.post(
  "/lesen/review",
  asyncHandler(async (req, res) => {
    const data = await reviewLesenContribution(req.body);
    res.json({ ok: true, data });
  })
);

module.exports = router;

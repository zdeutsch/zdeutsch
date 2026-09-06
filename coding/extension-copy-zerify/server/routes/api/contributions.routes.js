const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listLesenContributions,
  getLesenContributionAiInput,
  editLesenContribution,
  reviewLesenContribution
} = require("../../services/contributionService");
const {
  getContributionAiConfig,
  checkLesenContributionAnswers
} = require("../../services/contributionAiService");

const router = express.Router();

router.get(
  "/lesen",
  asyncHandler(async (req, res) => {
    const data = await listLesenContributions(req.query);
    res.json({ ok: true, data });
  })
);

router.get(
  "/lesen/ai-config",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: getContributionAiConfig() });
  })
);

router.post(
  "/lesen/ai-check",
  asyncHandler(async (req, res) => {
    const input = await getLesenContributionAiInput(req.body);
    const data = await checkLesenContributionAnswers(input, req.body.model);
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

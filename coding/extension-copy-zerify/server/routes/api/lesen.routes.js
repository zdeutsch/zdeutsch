const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listThemes,
  getTheme,
  listVersions,
  getPart,
  getEditorContext,
  updatePart,
  createTheme,
  updateTheme,
  deleteTheme,
  setThemeVisibility,
  moveTheme,
  createPart,
  setPartVisibility,
  deletePart
} = require("../../services/lesenService");
const { analyzeLesenAnswer } = require("../../services/lesenAiService");
const {
  getContributionAiConfig,
  checkLesenContributionAnswers
} = require("../../services/contributionAiService");

const router = express.Router();

router.get(
  "/themes",
  asyncHandler(async (req, res) => {
    const data = await listThemes(req.query.level);
    res.json({ ok: true, data });
  })
);

router.post(
  "/analyze-answer",
  asyncHandler(async (req, res) => {
    const data = await analyzeLesenAnswer(req.body);
    res.json({ ok: true, data });
  })
);

router.get(
  "/ai-config",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: getContributionAiConfig() });
  })
);

router.post(
  "/ai-check",
  asyncHandler(async (req, res) => {
    const data = await checkLesenContributionAnswers({ ...req.body, answerSet: "current" }, req.body.model);
    res.json({ ok: true, data });
  })
);

router.get(
  "/theme",
  asyncHandler(async (req, res) => {
    const data = await getTheme(req.query.level, req.query.themeKey);
    res.json({ ok: true, data });
  })
);

router.get(
  "/versions",
  asyncHandler(async (req, res) => {
    const data = await listVersions(req.query);
    res.json({ ok: true, data });
  })
);

router.get(
  "/editor-context",
  asyncHandler(async (req, res) => {
    const data = await getEditorContext(req.query);
    res.json({ ok: true, data });
  })
);

router.get(
  "/part",
  asyncHandler(async (req, res) => {
    const data = await getPart(req.query);
    res.json({ ok: true, data });
  })
);

router.post(
  "/theme",
  asyncHandler(async (req, res) => {
    const data = await createTheme(req.body);
    res.status(201).json({ ok: true, data });
  })
);

router.put(
  "/theme",
  asyncHandler(async (req, res) => {
    const data = await updateTheme(req.body);
    res.json({ ok: true, data });
  })
);

router.put(
  "/theme/visibility",
  asyncHandler(async (req, res) => {
    const data = await setThemeVisibility(req.body);
    res.json({ ok: true, data });
  })
);

router.put(
  "/theme/level",
  asyncHandler(async (req, res) => {
    const data = await moveTheme(req.body);
    res.json({ ok: true, data });
  })
);

router.post(
  "/part",
  asyncHandler(async (req, res) => {
    const data = await createPart(req.body);
    res.status(201).json({ ok: true, data });
  })
);

router.put(
  "/part",
  asyncHandler(async (req, res) => {
    const data = await updatePart(req.body);
    res.json({ ok: true, data });
  })
);

router.put(
  "/part/visibility",
  asyncHandler(async (req, res) => {
    const data = await setPartVisibility(req.body);
    res.json({ ok: true, data });
  })
);

router.delete(
  "/part",
  asyncHandler(async (req, res) => {
    const data = await deletePart(req.body);
    res.json({ ok: true, data });
  })
);

router.delete(
  "/theme",
  asyncHandler(async (req, res) => {
    const data = await deleteTheme(req.body);
    res.json({ ok: true, data });
  })
);

module.exports = router;

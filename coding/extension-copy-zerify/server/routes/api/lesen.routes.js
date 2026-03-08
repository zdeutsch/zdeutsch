const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listThemes,
  getTheme,
  listVersions,
  getPart,
  updatePart,
  createTheme,
  updateTheme,
  deleteTheme
} = require("../../services/lesenService");

const router = express.Router();

router.get(
  "/themes",
  asyncHandler(async (req, res) => {
    const data = await listThemes(req.query.level);
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
  "/part",
  asyncHandler(async (req, res) => {
    const data = await updatePart(req.body);
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

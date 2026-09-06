const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  getSprechenContext,
  createSprechenLevel,
  updateSprechenPart,
  setSprechenPartVisibility
} = require("../../services/sprechenService");

const router = express.Router();

router.get(
  "/editor-context",
  asyncHandler(async (req, res) => {
    const data = await getSprechenContext(req.query);
    res.json({ ok: true, data });
  })
);

router.post(
  "/level",
  asyncHandler(async (req, res) => {
    const data = await createSprechenLevel(req.body);
    res.status(201).json({ ok: true, data });
  })
);

router.put(
  "/part",
  asyncHandler(async (req, res) => {
    const data = await updateSprechenPart(req.body);
    res.json({ ok: true, data });
  })
);

router.put(
  "/part/visibility",
  asyncHandler(async (req, res) => {
    const data = await setSprechenPartVisibility(req.body);
    res.json({ ok: true, data });
  })
);

module.exports = router;

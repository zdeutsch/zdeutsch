const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  getRepositoryStatus,
  syncRepositoryData,
  discardRepositoryData,
  publishRepositoryData
} = require("../../services/repositoryService");

const router = express.Router();

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const data = await getRepositoryStatus();
    res.json({ ok: true, data });
  })
);

router.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const data = await syncRepositoryData();
    res.json({ ok: true, data });
  })
);

router.post(
  "/publish",
  asyncHandler(async (req, res) => {
    const data = await publishRepositoryData(req.body?.message);
    res.json({ ok: true, data });
  })
);

router.post(
  "/discard",
  asyncHandler(async (req, res) => {
    const data = await discardRepositoryData();
    res.json({ ok: true, data });
  })
);

module.exports = router;

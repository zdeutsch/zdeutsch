const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { listFiles, getFile, replaceFile } = require("../../services/fileService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const files = await listFiles();
    res.json({ ok: true, data: files });
  })
);

router.get(
  "/:fileKey",
  asyncHandler(async (req, res) => {
    const file = await getFile(req.params.fileKey);
    res.json({ ok: true, data: file });
  })
);

router.put(
  "/:fileKey",
  asyncHandler(async (req, res) => {
    const updated = await replaceFile(req.params.fileKey, req.body);
    res.json({ ok: true, data: updated });
  })
);

module.exports = router;

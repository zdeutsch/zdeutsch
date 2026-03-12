const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const { getConfig, updateConfig, uploadBannerImage } = require("../../services/configService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const config = await getConfig();
    res.json({ ok: true, data: config });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const config = await updateConfig(req.body);
    res.json({ ok: true, data: config });
  })
);

router.post(
  "/banner-upload",
  asyncHandler(async (req, res) => {
    const uploaded = await uploadBannerImage(req.body);
    res.json({ ok: true, data: uploaded });
  })
);

module.exports = router;

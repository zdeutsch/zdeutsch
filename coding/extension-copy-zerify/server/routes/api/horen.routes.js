const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  PART_ORDER
} = require("../../services/horenService");

const router = express.Router();

router.get(
  "/meta",
  (req, res) => {
    res.json({
      ok: true,
      data: {
        parts: PART_ORDER
      }
    });
  }
);

router.get(
  "/topics",
  asyncHandler(async (req, res) => {
    const data = await listTopics(req.query);
    res.json({ ok: true, data });
  })
);

router.post(
  "/topics",
  asyncHandler(async (req, res) => {
    const data = await createTopic(req.body);
    res.status(201).json({ ok: true, data });
  })
);

router.put(
  "/topics/:topicId",
  asyncHandler(async (req, res) => {
    const data = await updateTopic({
      ...req.body,
      topicId: req.params.topicId
    });
    res.json({ ok: true, data });
  })
);

router.delete(
  "/topics/:topicId",
  asyncHandler(async (req, res) => {
    const data = await deleteTopic({
      ...req.body,
      ...req.query,
      topicId: req.params.topicId
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;

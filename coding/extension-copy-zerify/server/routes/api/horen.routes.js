const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  uploadTopicAudio,
  deleteTopicAudio,
  PART_ORDER
} = require("../../services/horenService");
const AppError = require("../../utils/appError");

const router = express.Router();
const parseAudioBody = express.raw({
  type: () => true,
  limit: "50mb"
});

function audioBody(req, res, next) {
  parseAudioBody(req, res, (error) => {
    if (error?.type === "entity.too.large") {
      next(new AppError("Audio file is too large (maximum 50 MB)", 413));
      return;
    }
    next(error);
  });
}

function decodeFileName(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (error) {
    return String(value || "");
  }
}

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

router.put(
  "/topics/:topicId/audio",
  audioBody,
  asyncHandler(async (req, res) => {
    const data = await uploadTopicAudio({
      ...req.query,
      topicId: req.params.topicId,
      fileName: decodeFileName(req.get("X-Audio-File-Name")),
      buffer: req.body
    });
    res.json({ ok: true, data });
  })
);

router.delete(
  "/topics/:topicId/audio",
  asyncHandler(async (req, res) => {
    const data = await deleteTopicAudio({
      ...req.query,
      topicId: req.params.topicId
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;

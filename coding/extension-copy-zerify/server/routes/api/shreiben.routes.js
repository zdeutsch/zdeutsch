const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  extractTaskFromImage
} = require("../../services/shreibenService");

const router = express.Router();

router.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const data = await listTasks(req.query);
    res.json({ ok: true, data });
  })
);

router.post(
  "/tasks",
  asyncHandler(async (req, res) => {
    const data = await createTask(req.body);
    res.status(201).json({ ok: true, data });
  })
);

router.put(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const data = await updateTask({
      ...req.body,
      taskId: req.params.taskId
    });
    res.json({ ok: true, data });
  })
);

router.delete(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const data = await deleteTask({
      ...req.body,
      ...req.query,
      taskId: req.params.taskId
    });
    res.json({ ok: true, data });
  })
);

router.post(
  "/extract-task",
  asyncHandler(async (req, res) => {
    const data = await extractTaskFromImage(req.body);
    res.json({ ok: true, data });
  })
);

module.exports = router;

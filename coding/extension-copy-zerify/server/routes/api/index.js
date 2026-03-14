const express = require("express");

const healthRoutes = require("./health.routes");
const overviewRoutes = require("./overview.routes");
const filesRoutes = require("./files.routes");
const configRoutes = require("./config.routes");
const lesenRoutes = require("./lesen.routes");
const horenRoutes = require("./horen.routes");
const shreibenRoutes = require("./shreiben.routes");
const shareRoutes = require("./share.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/overview", overviewRoutes);
router.use("/files", filesRoutes);
router.use("/config", configRoutes);
router.use("/lesen", lesenRoutes);
router.use("/horen", horenRoutes);
router.use("/shreiben", shreibenRoutes);
router.use("/share", shareRoutes);

module.exports = router;

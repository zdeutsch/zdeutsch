const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");
const shareDashboardRoutes = require("./routes/shareDashboard.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { SITE_DIR, DASHBOARD_DIR } = require("./config/constants");

const app = express();

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

app.use("/api", apiRoutes);
app.use("/share-dashboard", shareDashboardRoutes);

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(DASHBOARD_DIR, "index.html"));
});

app.use("/dashboard", express.static(DASHBOARD_DIR));
app.use(express.static(SITE_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(SITE_DIR, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

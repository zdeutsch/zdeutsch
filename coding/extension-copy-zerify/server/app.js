const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { DASHBOARD_DIR, DASHBOARD_DIST_DIR } = require("./config/constants");

const app = express();

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use("/api", apiRoutes);

app.get("/dashboard/index.html", (req, res) => res.redirect(302, "/dashboard"));
app.get("/dashboard/lesen.html", (req, res) => res.redirect(302, "/dashboard/lesen"));
app.get("/dashboard/lesen-teil-:part([1-3]).html", (req, res) => {
  const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  res.redirect(302, `/dashboard/lesen/teil-${req.params.part}${query}`);
});

app.use("/dashboard", express.static(DASHBOARD_DIST_DIR, {
  immutable: true,
  maxAge: "1y",
  index: false,
  redirect: false
}));
app.use("/dashboard", express.static(DASHBOARD_DIR, { index: false, redirect: false }));
app.use("/dashboard/legacy", express.static(DASHBOARD_DIR, { index: false, redirect: false }));

app.get(["/dashboard", "/dashboard/", "/dashboard/lesen", "/dashboard/lesen/teil-:part([1-3])"], (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(DASHBOARD_DIST_DIR, "index.html"));
});

app.get("/", (req, res) => {
  res.redirect(302, "/dashboard");
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

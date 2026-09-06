const PORT = Number.parseInt(process.env.PORT || "3080", 10);
const HOST = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

module.exports = {
  PORT,
  HOST
};

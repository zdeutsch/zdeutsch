const AppError = require("../utils/appError");

module.exports = function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  const payload = {
    ok: false,
    message
  };

  if (isAppError && err.details) {
    payload.details = err.details;
  }

  if (!isAppError) {
    payload.trace = process.env.NODE_ENV === "production" ? undefined : err.stack;
  }

  res.status(statusCode).json(payload);
};

const logger = require("../config/logger");

function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

function errorHandler(err, req, res, next) {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Internal server error"
  });
}

module.exports = {
  notFound,
  errorHandler
};

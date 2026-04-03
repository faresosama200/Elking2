const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const env = require("./config/env");
const logger = require("./config/logger");
const authRoutes = require("./routes/auth.routes");
const {
  usersRouter,
  studentsRouter,
  companiesRouter,
  universitiesRouter,
  jobsRouter,
  skillsRouter
} = require("./routes/crud.routes");
const { notFound, errorHandler } = require("./middlewares/error-handler");

const app = express();

function getAllowedOrigins(rawOrigins) {
  if (!rawOrigins || rawOrigins.trim() === "*") return null;

  const configured = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env.nodeEnv !== "production") {
    configured.push("http://127.0.0.1:5500", "http://localhost:5500");
  }

  return new Set(configured);
}

const allowedOrigins = getAllowedOrigins(env.corsOrigin);

function corsOrigin(origin, callback) {
  // In development, allow everything (file://, null, localhost variants)
  if (env.nodeEnv !== "production") {
    callback(null, true);
    return;
  }

  if (!allowedOrigins) {
    callback(null, true);
    return;
  }

  // Allow requests with no Origin header (e.g. server-to-server)
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.has(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("CORS origin not allowed"));
}

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRouter);
app.use("/api/students", studentsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/universities", universitiesRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/skills", skillsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

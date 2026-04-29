const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const env = require("./config/env");
const logger = require("./config/logger");
const prisma = require("./config/prisma");
const authRoutes = require("./routes/auth.routes");
const authController = require("./controllers/auth.controller");
const { requireAuth, requireRole } = require("./middlewares/auth");
const {
  usersRouter,
  studentsRouter,
  companiesRouter,
  universitiesRouter,
  jobsRouter,
  skillsRouter,
  applicationsRouter
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

// Dashboard stats endpoint (all authenticated roles)
app.get("/api/dashboard", requireAuth, async (req, res, next) => {
  try {
    const [students, companies, universities, jobs, applications, studentsByUniversity, jobsByType] = await Promise.all([
      prisma.student.count(),
      prisma.company.count(),
      prisma.university.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.university.findMany({
        take: 6,
        orderBy: { students: { _count: "desc" } },
        select: {
          name: true,
          _count: {
            select: {
              students: true
            }
          }
        }
      }),
      prisma.job.groupBy({
        by: ["type"],
        _count: {
          _all: true
        }
      })
    ]);

    res.json({
      stats: { students, companies, universities, jobs, applications },
      charts: {
        studentsByUniversity: studentsByUniversity.map((u) => ({
          name: u.name,
          count: u._count.students
        })),
        jobsByType: jobsByType.map((j) => ({
          type: j.type,
          count: j._count._all
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

app.use("/api/auth", authRoutes);

// Profile endpoint (GET + PUT) for all authenticated roles
const profileRouter = express.Router();
profileRouter.get("/", requireAuth, authController.getProfile);
profileRouter.put("/", requireAuth, authController.updateProfile);

// Student: add skill to own profile (by skillId OR create new by name+category)
profileRouter.post("/skills", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });
    const { skillId, name, category } = req.body;
    let targetSkillId = skillId;
    if (!skillId && name) {
      const existing = await prisma.skill.findUnique({ where: { name: String(name).trim() } });
      if (existing) {
        targetSkillId = existing.id;
      } else {
        const newSkill = await prisma.skill.create({
          data: { name: String(name).trim(), category: String(category || "أخرى").trim(), status: "ACTIVE" }
        });
        targetSkillId = newSkill.id;
      }
    }
    if (!targetSkillId) return res.status(400).json({ message: "skillId or name required" });
    await prisma.studentSkill.upsert({
      where: { studentId_skillId: { studentId: student.id, skillId: targetSkillId } },
      create: { studentId: student.id, skillId: targetSkillId },
      update: {}
    });
    return res.json({ message: "Skill added" });
  } catch (error) {
    return next(error);
  }
});

// Student: remove skill from own profile
profileRouter.delete("/skills/:skillId", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });
    await prisma.studentSkill.deleteMany({
      where: { studentId: student.id, skillId: req.params.skillId }
    });
    return res.json({ message: "Skill removed" });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/profile", profileRouter);

app.use("/api/users", usersRouter);
app.use("/api/students", studentsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/universities", universitiesRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/applications", applicationsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

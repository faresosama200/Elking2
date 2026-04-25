const express = require("express");
const validate = require("../middlewares/validate");
const { requireAuth, requireRole } = require("../middlewares/auth");
const createCrudHandlers = require("../controllers/crud.controller");
const {
  querySchema,
  idParamSchema,
  userCreateSchema,
  userUpdateSchema,
  studentCreateSchema,
  studentUpdateSchema,
  companyCreateSchema,
  companyUpdateSchema,
  universityCreateSchema,
  universityUpdateSchema,
  jobCreateSchema,
  jobUpdateSchema,
  skillCreateSchema,
  skillUpdateSchema,
  applicationCreateSchema,
  applicationUpdateSchema
} = require("../validators/resource.schemas");

function buildCrudRouter(config, createSchema, updateSchema, roles = ["ADMIN"]) {
  const router = express.Router();
  const handlers = createCrudHandlers(config);

  router.use(requireAuth, requireRole(...roles));
  router.get("/", validate(querySchema, "query"), handlers.list);
  router.get("/:id", validate(idParamSchema, "params"), handlers.getOne);
  router.post("/", validate(createSchema), handlers.create);
  router.put("/:id", validate(idParamSchema, "params"), validate(updateSchema), handlers.update);
  router.delete("/:id", validate(idParamSchema, "params"), handlers.remove);

  return router;
}

const usersRouter = buildCrudRouter(
  {
    model: "user",
    searchFields: ["fullName", "email"]
  },
  userCreateSchema,
  userUpdateSchema,
  ["ADMIN"]
);

const studentsRouter = buildCrudRouter(
  {
    model: "student",
    searchFields: ["bio"],
    include: { user: true, university: true, skills: { include: { skill: true } } }
  },
  studentCreateSchema,
  studentUpdateSchema,
  ["ADMIN", "UNIVERSITY"]
);

const companiesRouter = buildCrudRouter(
  {
    model: "company",
    searchFields: ["name", "industry"],
    include: { user: true }
  },
  companyCreateSchema,
  companyUpdateSchema,
  ["ADMIN"]
);

const universitiesRouter = buildCrudRouter(
  {
    model: "university",
    searchFields: ["name", "location"],
    include: { user: true }
  },
  universityCreateSchema,
  universityUpdateSchema,
  ["ADMIN"]
);

const jobsRouter = express.Router();
const jobHandlers = createCrudHandlers({
  model: "job",
  searchFields: ["title", "location", "description"],
  include: { company: true, skills: { include: { skill: true } } }
});
// All authenticated users can read jobs
jobsRouter.get("/", requireAuth, validate(querySchema, "query"), jobHandlers.list);
jobsRouter.get("/:id", requireAuth, validate(idParamSchema, "params"), jobHandlers.getOne);
// Only ADMIN/COMPANY can create/update/delete
jobsRouter.post("/", requireAuth, requireRole("ADMIN", "COMPANY"), validate(jobCreateSchema), jobHandlers.create);
jobsRouter.put("/:id", requireAuth, requireRole("ADMIN", "COMPANY"), validate(idParamSchema, "params"), validate(jobUpdateSchema), jobHandlers.update);
jobsRouter.delete("/:id", requireAuth, requireRole("ADMIN", "COMPANY"), validate(idParamSchema, "params"), jobHandlers.remove);

const skillsRouter = buildCrudRouter(
  {
    model: "skill",
    searchFields: ["name", "category"]
  },
  skillCreateSchema,
  skillUpdateSchema,
  ["ADMIN"]
);

const applicationsRouter = buildCrudRouter(
  {
    model: "application",
    searchFields: [],
    include: { student: { include: { user: true } }, job: { include: { company: true } } }
  },
  applicationCreateSchema,
  applicationUpdateSchema,
  ["ADMIN", "STUDENT", "COMPANY"]
);

module.exports = {
  usersRouter,
  studentsRouter,
  companiesRouter,
  universitiesRouter,
  jobsRouter,
  skillsRouter,
  applicationsRouter
};

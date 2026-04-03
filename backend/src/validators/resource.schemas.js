const { z } = require("zod");

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().trim().optional()
});

const idParamSchema = z.object({
  id: z.string().min(2)
});

const userCreateSchema = z.object({
  fullName: z.string().trim().min(3),
  email: z.string().email().transform((value) => value.toLowerCase()),
  passwordHash: z.string().min(6),
  role: z.enum(["ADMIN", "STUDENT", "COMPANY", "UNIVERSITY"]),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional()
});

const userUpdateSchema = userCreateSchema.partial();

const studentCreateSchema = z.object({
  userId: z.string().min(2),
  universityId: z.string().min(2).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional()
});

const studentUpdateSchema = studentCreateSchema.partial();

const companyCreateSchema = z.object({
  userId: z.string().min(2),
  name: z.string().trim().min(2),
  industry: z.string().trim().min(2),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional()
});

const companyUpdateSchema = companyCreateSchema.partial();

const universityCreateSchema = z.object({
  userId: z.string().min(2),
  name: z.string().trim().min(2),
  location: z.string().trim().min(2),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional()
});

const universityUpdateSchema = universityCreateSchema.partial();

const jobCreateSchema = z.object({
  companyId: z.string().min(2),
  title: z.string().trim().min(2),
  location: z.string().trim().min(2),
  type: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "REMOTE"]),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  description: z.string().max(1000).optional().nullable()
});

const jobUpdateSchema = jobCreateSchema.partial();

const skillCreateSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional()
});

const skillUpdateSchema = skillCreateSchema.partial();

module.exports = {
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
  skillUpdateSchema
};

const { z } = require("zod");

const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include uppercase letter")
    .regex(/[a-z]/, "Password must include lowercase letter")
    .regex(/[0-9]/, "Password must include number"),
  role: z.enum(["STUDENT", "COMPANY", "UNIVERSITY", "ADMIN"]).default("STUDENT"),
  profile: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      industry: z.string().trim().min(2).max(120).optional(),
      location: z.string().trim().min(2).max(120).optional()
    })
    .optional()
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema
};

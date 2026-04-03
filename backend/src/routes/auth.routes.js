const express = require("express");
const validate = require("../middlewares/validate");
const { requireAuth } = require("../middlewares/auth");
const authController = require("../controllers/auth.controller");
const { registerSchema, loginSchema, refreshSchema } = require("../validators/auth.schemas");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.get("/me", requireAuth, authController.me);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;

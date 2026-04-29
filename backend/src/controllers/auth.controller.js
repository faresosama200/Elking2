const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function serializeAuth(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email
  };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status
    }
  };
}

async function register(req, res, next) {
  try {
    const { fullName, email, password, role, profile } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        fullName,
        email: normalizedEmail,
        passwordHash,
        role
      }
    });

    if (role === "STUDENT") {
      await prisma.student.create({
        data: {
          userId: created.id,
          bio: profile?.name || null,
          status: "PENDING"
        }
      });
    }

    if (role === "COMPANY") {
      await prisma.company.create({
        data: {
          userId: created.id,
          name: profile?.name || fullName,
          industry: profile?.industry || "General",
          status: "PENDING"
        }
      });
    }

    if (role === "UNIVERSITY") {
      await prisma.university.create({
        data: {
          userId: created.id,
          name: profile?.name || fullName,
          location: profile?.location || "Unknown",
          status: "PENDING"
        }
      });
    }

    const authData = serializeAuth(created);
    await prisma.user.update({
      where: { id: created.id },
      data: { refreshToken: authData.refreshToken }
    });

    return res.status(201).json({
      message: "Registered successfully",
      ...authData
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const authData = serializeAuth(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: authData.refreshToken }
    });

    return res.json({
      message: "Login successful",
      ...authData
    });
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const authData = serializeAuth(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: authData.refreshToken }
    });

    return res.json({
      message: "Token refreshed",
      ...authData
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

async function getProfile(req, res, next) {
  try {
    const user = req.user;
    const data = {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status
    };
    if (user.role === "COMPANY") {
      data.company = await prisma.company.findUnique({ where: { userId: user.id } });
    } else if (user.role === "UNIVERSITY") {
      data.university = await prisma.university.findUnique({ where: { userId: user.id } });
    } else if (user.role === "STUDENT") {
      data.student = await prisma.student.findUnique({
        where: { userId: user.id },
        include: { university: true, skills: { include: { skill: true } } }
      });
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    const { fullName, name, industry, location, bio } = req.body;
    if (fullName) {
      await prisma.user.update({ where: { id: user.id }, data: { fullName } });
    }
    if (user.role === "COMPANY") {
      const patch = {};
      if (name) patch.name = name;
      if (industry) patch.industry = industry;
      if (Object.keys(patch).length) {
        await prisma.company.update({ where: { userId: user.id }, data: patch });
      }
    } else if (user.role === "UNIVERSITY") {
      const patch = {};
      if (name) patch.name = name;
      if (location) patch.location = location;
      if (Object.keys(patch).length) {
        await prisma.university.update({ where: { userId: user.id }, data: patch });
      }
    } else if (user.role === "STUDENT") {
      if (bio !== undefined) {
        await prisma.student.update({ where: { userId: user.id }, data: { bio } });
      }
    }
    return res.json({ message: "Profile updated" });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null }
    });
    return res.json({ message: "Logged out" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  refresh,
  me,
  getProfile,
  updateProfile,
  logout
};

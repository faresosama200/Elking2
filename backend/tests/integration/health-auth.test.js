import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("health and auth", () => {
  const email = `admin_${Date.now()}@talenthub.test`;

  beforeAll(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
  });

  it("returns health", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("registers and logs in user", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      fullName: "Admin User",
      email,
      password: "Admin1234",
      role: "ADMIN"
    });

    expect([201, 409]).toContain(registerResponse.status);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email,
      password: "Admin1234"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTruthy();
  });
});

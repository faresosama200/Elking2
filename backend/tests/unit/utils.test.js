import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken, buildPagination } from "../../src/utils.js";

describe("utils", () => {
  it("signs and verifies access token", () => {
    const token = signAccessToken({ sub: "user-1", role: "ADMIN" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("builds bounded pagination", () => {
    const value = buildPagination({ page: "0", limit: "500" });
    expect(value.page).toBe(1);
    expect(value.limit).toBe(100);
    expect(value.skip).toBe(0);
  });
});

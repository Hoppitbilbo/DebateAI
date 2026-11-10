import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

import { authApi } from "./authApi";

afterEach(() => vi.clearAllMocks());

describe("authApi", () => {
  it("logs in with an identifier, e-mail or username", async () => {
    await authApi.login("anna", "secret123");
    expect(mocks.post).toHaveBeenCalledWith("/api/auth/login", { identifier: "anna", password: "secret123" });
  });

  it("reads a class link without sending anything but the code", async () => {
    await authApi.classInvite("AB/CD");
    expect(mocks.get).toHaveBeenCalledWith("/api/auth/class-invite/AB%2FCD");
  });

  it("registers from a class link with code, username, password and language only", async () => {
    await authApi.registerClass({ code: "C", username: "anna", password: "secret123", locale: "it" });
    expect(mocks.post).toHaveBeenCalledWith("/api/auth/register-class", { code: "C", username: "anna", password: "secret123", locale: "it" });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { post: mocks.post } }));

import { requestPasswordReset } from "./teacherApi";

afterEach(() => vi.clearAllMocks());

describe("teacherApi", () => {
  it("asks the server for an assisted reset link of a class member", async () => {
    mocks.post.mockResolvedValue({ url: "https://site/reset-password?token=t", expiresAt: "2026-10-30T10:15:00Z" });
    const link = await requestPasswordReset(3, 42);
    expect(mocks.post).toHaveBeenCalledWith("/api/classes/3/members/42/password-reset");
    expect(link.url).toContain("token=t");
  });
});

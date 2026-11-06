import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatAiError } from "./aiService";

const text = (code: string) => i18n.t(`platform.aiErrors.${code}`);

describe("formatAiError", () => {
  it("translates the codes the interface knows", () => {
    expect(formatAiError(new ApiError(429, "daily_limit", "quota exceeded"))).toBe(text("daily_limit"));
  });

  it("never shows the raw text of an unknown code", () => {
    expect(formatAiError(new ApiError(502, "provider_5xx", "upstream: 503 Service Unavailable (key sk-…)"))).toBe(text("ai_error"));
    expect(formatAiError(new ApiError(429, "slow_down", "Too Many Requests"))).toBe(text("rate_limited"));
    expect(formatAiError(new ApiError(400, "bad_request", "json: cannot unmarshal"))).toBe(text("generic"));
  });

  it("says the server cannot be reached when the request does not leave", () => {
    expect(formatAiError(new TypeError("Failed to fetch"))).toBe(text("server_unreachable"));
  });

  it("hides other errors behind the generic message", () => {
    expect(formatAiError(new SyntaxError("Unexpected token < in JSON"))).toBe(text("generic"));
    expect(formatAiError("boom")).toBe(text("generic"));
  });
});

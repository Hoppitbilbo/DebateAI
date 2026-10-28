import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

afterEach(() => vi.unstubAllGlobals());

describe("prefersReducedMotion", () => {
  it("follows the reader's system setting", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(prefers-reduced-motion: reduce)" }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is false where the browser cannot tell", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

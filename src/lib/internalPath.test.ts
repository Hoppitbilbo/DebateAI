import { describe, expect, it } from "vitest";
import { internalPath } from "./internalPath";

describe("internalPath", () => {
  it("keeps paths of the site with their query", () => {
    expect(internalPath("/iscriviti?code=ABC")).toBe("/iscriviti?code=ABC");
    expect(internalPath("/account")).toBe("/account");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example", "evil", "javascript:alert(1)", "/\t/evil.example", "", null, undefined]) {
      expect(internalPath(bad)).toBeNull();
    }
  });
});

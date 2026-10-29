import { describe, expect, it } from "vitest";
import { conversationOver, doneForAssignment, handedIn } from "./attemptStatus";

describe("attempt status", () => {
  it("keeps the three meanings apart", () => {
    const rows = (["active", "goal_reached", "turn_limit", "completed", "abandoned", undefined] as const).map((s) => [
      s, handedIn(s), conversationOver(s), doneForAssignment(s),
    ]);
    expect(rows).toEqual([
      ["active", false, false, false],
      ["goal_reached", false, true, true],
      ["turn_limit", false, true, false],
      ["completed", true, true, true],
      ["abandoned", false, false, false],
      [undefined, false, false, false],
    ]);
  });
});

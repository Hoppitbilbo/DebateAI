import { describe, expect, it } from "vitest";
import { htmlToText } from "./text";

describe("htmlToText", () => {
  it("decodes the entities of Wikipedia snippets and drops their tags", () => {
    expect(htmlToText(`l&#039;ex presidente <span class="searchmatch">Alberto</span> &quot;Fujimori&quot; &amp; co.`)).toBe(`l'ex presidente Alberto "Fujimori" & co.`);
  });
  it("leaves plain text alone and never runs markup", () => {
    expect(htmlToText("Dante Alighieri")).toBe("Dante Alighieri");
    expect(htmlToText(`<img src=x onerror="window.hacked=1">ok`)).toBe("ok");
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
    expect(htmlToText("")).toBe("");
  });
});

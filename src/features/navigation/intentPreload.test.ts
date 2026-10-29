import { afterEach, describe, expect, it, vi } from "vitest";

const preloadPath = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/lazyPage", () => ({ preloadPath }));

import { intendedPath, preloadOnIntent } from "./intentPreload";

afterEach(() => {
  document.body.innerHTML = "";
  preloadPath.mockClear();
});

describe("intendedPath", () => {
  it("reads internal links and data-preload, not external ones", () => {
    document.body.innerHTML = `<a id="in" href="/apps/x"><span id="inner">go</span></a><a id="out" href="https://x.org">x</a>
      <a id="proto" href="//x.org">x</a><button id="btn" data-preload="/apps/y">y</button>`;
    const el = (id: string) => document.getElementById(id);
    expect(intendedPath(el("inner"))).toBe("/apps/x");
    expect(intendedPath(el("btn"))).toBe("/apps/y");
    expect(intendedPath(el("out"))).toBeNull();
    expect(intendedPath(el("proto"))).toBeNull();
    expect(intendedPath(document.body)).toBeNull();
  });
});

describe("preloadOnIntent", () => {
  it("preloads the page of a focused or touched link, and stops after cleanup", () => {
    document.body.innerHTML = `<a id="a" href="/apps/x">x</a>`;
    const stop = preloadOnIntent();
    const link = document.getElementById("a")!;
    link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(preloadPath).toHaveBeenCalledWith("/apps/x");
    stop();
    link.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(preloadPath).toHaveBeenCalledTimes(1);
  });

  it("nothing is downloaded without intent", () => {
    const stop = preloadOnIntent();
    expect(preloadPath).not.toHaveBeenCalled();
    stop();
  });
});

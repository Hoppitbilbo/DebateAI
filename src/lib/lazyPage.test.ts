import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { lazyPage, preloadPath, preloadPrefix } from "./lazyPage";

const Hello = () => null;
const loaderOf = () => vi.fn(() => Promise.resolve({ default: Hello }));

// The registry of paths is module-wide: every test uses its own paths.
describe("lazyPage", () => {
  it("suspends until the code arrives, then renders the page at once", async () => {
    const load = loaderOf();
    const Page = lazyPage(load);
    let thrown: unknown;
    try {
      Page({});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);
    await thrown;
    expect((Page({}) as ReactElement).type).toBe(Hello);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("downloads the code only once", async () => {
    const load = loaderOf();
    const Page = lazyPage(load);
    await Promise.all([Page.preload(), Page.preload()]);
    await Page.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed download", async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Hello }>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ default: Hello });
    const Page = lazyPage(load);
    await expect(Page.preload()).rejects.toThrow("offline");
    await Page.preload();
    expect(load).toHaveBeenCalledTimes(2);
    expect((Page({}) as ReactElement).type).toBe(Hello);
  });
});

describe("preloadPath", () => {
  it("finds the page of a path with query and hash", async () => {
    const load = loaderOf();
    lazyPage(load, ["/test/query"]);
    await preloadPath("/test/query?x=1#top");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("never rejects, also for unknown paths and failed downloads", async () => {
    lazyPage(() => Promise.reject(new Error("offline")), ["/test/broken"]);
    await expect(preloadPath("/test/broken")).resolves.toBeUndefined();
    await expect(preloadPath("/test/unknown")).resolves.toBeUndefined();
  });

  it("preloads every page under a prefix and nothing else", async () => {
    const inside = loaderOf();
    const outside = loaderOf();
    lazyPage(inside, ["/prefix/a", "/prefix/b"]);
    lazyPage(outside, ["/other/a"]);
    await preloadPrefix("/prefix/");
    expect(inside).toHaveBeenCalledTimes(1);
    expect(outside).not.toHaveBeenCalled();
  });
});

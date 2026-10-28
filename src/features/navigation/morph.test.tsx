import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appMorph, settleMorph, useMorphClick, useMorphNavigate } from "./morph";

vi.mock("@/lib/lazyPage", () => ({ preloadPath: () => Promise.resolve() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
});

const reducedMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: reduce }));

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const Opener = ({ to }: { to: string }) => {
  const morphTo = useMorphNavigate();
  return (
    <>
      <div {...appMorph("/apps/convinci-tu", "card")} data-testid="card" />
      <button onClick={() => void morphTo(to)}>open</button>
    </>
  );
};

const LinkLike = ({ to }: { to: string }) => {
  const morph = useMorphClick();
  return <a href={to} onClick={morph(to)}>link</a>;
};

const at = (path: string, ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<>{ui}<Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("morph navigation", () => {
  it("marks app cards with the app and the part", () => {
    expect(appMorph("/apps/convinci-tu?x=1", "title")).toEqual({ "data-morph-app": "convinci-tu", "data-morph": "title" });
    expect(appMorph("/about", "card")).toEqual({ "data-morph-app": undefined, "data-morph": "card" });
  });

  it("navigates without a transition when the browser has none", async () => {
    at("/apps", <Opener to="/apps/convinci-tu" />);
    fireEvent.click(screen.getByText("open"));
    await flush();
    expect(screen.getByTestId("where").textContent).toBe("/apps/convinci-tu");
  });

  it("skips the transition with reduced motion", async () => {
    reducedMotion(true);
    const start = vi.fn();
    Object.assign(document, { startViewTransition: start });
    at("/apps", <Opener to="/apps/convinci-tu" />);
    fireEvent.click(screen.getByText("open"));
    await flush();
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByTestId("where").textContent).toBe("/apps/convinci-tu");
  });

  it("pairs the opened app's card for the transition and unpairs it after", async () => {
    reducedMotion(false);
    let finish!: () => void;
    const finished = new Promise<void>((r) => (finish = r));
    Object.assign(document, {
      startViewTransition: (update: () => Promise<void>) => {
        void update();
        return { finished };
      },
    });
    at("/apps", <Opener to="/apps/convinci-tu" />);
    fireEvent.click(screen.getByText("open"));
    await flush();
    const card = screen.getByTestId("card");
    expect(card.style.getPropertyValue("view-transition-name")).toBe("app-card-convinci-tu");
    act(() => settleMorph());
    await act(async () => {
      finish();
      await finished;
    });
    expect(card.style.getPropertyValue("view-transition-name")).toBe("");
  });

  it("does nothing for the current page", async () => {
    at("/apps", <Opener to="/apps" />);
    fireEvent.click(screen.getByText("open"));
    await flush();
    expect(screen.getByTestId("where").textContent).toBe("/apps");
  });

  it("leaves new-tab clicks to the browser", async () => {
    at("/", <LinkLike to="/apps" />);
    // Record whether the morph took the click, then stop jsdom from following the link.
    let taken: boolean | undefined;
    const record = (e: Event) => {
      taken = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener("click", record);
    fireEvent.click(screen.getByText("link"), { metaKey: true });
    document.removeEventListener("click", record);
    expect(taken).toBe(false);
    expect(screen.getByTestId("where").textContent).toBe("/");
    fireEvent.click(screen.getByText("link"));
    await flush();
    expect(screen.getByTestId("where").textContent).toBe("/apps");
  });
});

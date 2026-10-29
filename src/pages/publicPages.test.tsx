import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import FeaturesSection from "@/components/FeaturesSection";
import HeroSection from "@/components/HeroSection";
import DebateStory from "@/components/DebateStory";
import AppsPage from "./AppsPage";
import TutorialsPage from "./TutorialsPage";

// Fixes what the public pages link to, in which order, before the app list
// moves into one catalog (refactoring phase 11).

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const reducedMotion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));

beforeAll(async () => {
  await i18n.changeLanguage("it");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** The apps of a page, in order, as marked for the morph. */
const morphCards = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-morph="card"]')].map((el) => el.dataset.morphApp);

const hrefs = (container: HTMLElement) => [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));

describe("app lists", () => {
  it("shows five apps on the home page", () => {
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const { container } = inRouter(<FeaturesSection />);
    expect(morphCards(container)).toEqual(["you-moderate", "personaggio-misterioso", "doppia-intervista", "convinci-tu", "impersona-tu"]);
    expect(screen.getByText("Modera tu")).toBeTruthy();
  });

  it("shows every app on the apps page, the prompt one not yet open", () => {
    const { container } = inRouter(<AppsPage />);
    expect(morphCards(container)).toEqual([
      "you-moderate",
      "doppia-intervista",
      "wiki-chatbot",
      "personaggio-misterioso",
      "prompt-engineer",
      "convinci-tu",
      "impersona-tu",
    ]);
    const launch = screen.getAllByRole("button").filter((b) => !b.hasAttribute("disabled"));
    expect(launch).toHaveLength(6);
  });

  it("links each tutorial card to its app and tutorial", () => {
    const { container } = inRouter(<TutorialsPage />);
    expect(hrefs(container)).toEqual([
      "/apps/you-moderate",
      "/apps/you-moderate/tutorial",
      "/apps/doppia-intervista",
      "/apps/doppia-intervista/tutorial",
      "/apps/convinci-tu",
      "/apps/convinci-tu/tutorial",
      "/apps/personaggio-misterioso",
      "/apps/personaggio-misterioso/tutorial",
      "/apps/impersona-tu",
      "/apps/impersona-tu/tutorial",
      "/apps/wiki-chatbot",
      "/apps/wiki-chatbot/tutorial", // every app has the students' tutorial
      "/teacher-guide",
      "/apps",
      "/about",
    ]);
    // Four numbered steps, three tips, three resources.
    for (const n of ["1", "2", "3", "4"]) expect(screen.getByText(n)).toBeTruthy();
  });

  it("offers a random app from the home hero", () => {
    reducedMotion(false);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { container } = inRouter(<HeroSection />);
    expect(hrefs(container)).toEqual(["/apps", "/apps/impersona-tu"]);
  });
});

describe("DebateStory", () => {
  const scrolledTo = (top: number) =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top, height: 3 * window.innerHeight } as DOMRect);
  const bubbles = () => screen.queryAllByText(/Galileo!|Allora dimmi|Ma sei sicuro|E alla fine|Certo!|Volevo vedere|Ottima obiezione|Scrivi cosa/);

  it("shows the whole chat at once with reduced motion", () => {
    reducedMotion(true);
    inRouter(<DebateStory />);
    expect(bubbles()).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Prova anche tu" }).getAttribute("tabindex")).toBe("0");
  });

  it("builds the chat as the page scrolls", async () => {
    reducedMotion(false);
    const rect = scrolledTo(0);
    inRouter(<DebateStory />);
    expect(bubbles()).toHaveLength(0);

    // Half way through the section: 4.4 of 8 messages.
    rect.mockReturnValue({ top: -window.innerHeight, height: 3 * window.innerHeight } as DOMRect);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(bubbles()).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Prova anche tu" }).getAttribute("tabindex")).toBe("-1");

    rect.mockReturnValue({ top: -2 * window.innerHeight, height: 3 * window.innerHeight } as DOMRect);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(bubbles()).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Prova anche tu" }).getAttribute("tabindex")).toBe("0");
  });
});

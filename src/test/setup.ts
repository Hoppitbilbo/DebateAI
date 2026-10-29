import { vi } from "vitest";

// Chat avatars load portraits from Wikipedia; tests never reach the network.
vi.mock("@/features/activity/wikiImage", () => ({
  fetchWikiImage: async () => null,
  useWikiImage: () => null,
}));

// Every test file starts in Italian, the bundled language: with jsdom's
// "en-US" the start-up would download English asynchronously and could
// switch back a language a test has just chosen (see src/i18n/index.ts).
try {
  localStorage.setItem("i18nextLng", "it");
} catch {
  /* no storage */
}

import { vi } from "vitest";

// Chat avatars load portraits from Wikipedia; tests never reach the network.
vi.mock("@/features/activity/wikiImage", () => ({
  fetchWikiImage: async () => null,
  useWikiImage: () => null,
}));

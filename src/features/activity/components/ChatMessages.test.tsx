import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatMessages from "./ChatMessages";
import type { AvatarFallback } from "../speakerAvatar";
import type { ActivityMessage } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }),
}));
vi.mock("@/components/shared/MarkdownViewer", () => ({ default: ({ content }: { content: string }) => <div>{content}</div> }));
// Only Galileo's page has a portrait.
vi.mock("@/features/activity/wikiImage", () => ({
  useWikiImage: (title?: string) => (title === "Galileo Galilei" ? "https://upload.wikimedia.org/galileo.jpg" : null),
}));

afterEach(cleanup);

const avatarOf = (message: Omit<ActivityMessage, "id" | "content">, avatarFallback?: AvatarFallback) => {
  const { container } = render(
    <ChatMessages messages={[{ id: "1", content: "testo", ...message }]} heightClass="h-96" avatarFallback={avatarFallback} />,
  );
  return container.querySelector("img")?.getAttribute("src");
};

describe("chat avatars", () => {
  it("shows the Wikipedia portrait of a character", () => {
    expect(avatarOf({ role: "assistant", name: "Galileo Galilei" })).toBe("https://upload.wikimedia.org/galileo.jpg");
  });

  it("falls back to a person, or a page for WikiChat", () => {
    expect(avatarOf({ role: "assistant", name: "Nessuna foto" })).toBe("/avatars/unknown-person.webp");
    expect(avatarOf({ role: "assistant", name: "Nessuna foto" }, "page")).toBe("/avatars/page.webp");
    expect(avatarOf({ role: "assistant" })).toBe("/avatars/unknown-person.webp");
    expect(avatarOf({ role: "assistant", name: "AI" })).toBe("/avatars/unknown-person.webp");
  });

  it("never reveals the mystery character", () => {
    expect(avatarOf({ role: "assistant", name: "???" })).toBe("/avatars/mystery.webp");
  });

  it("shows the student, or the character the student plays", () => {
    expect(avatarOf({ role: "user" })).toBe("/avatars/student-cap.webp");
    expect(avatarOf({ role: "user", name: "Galileo Galilei" })).toBe("https://upload.wikimedia.org/galileo.jpg");
    expect(avatarOf({ role: "user", name: "Nessuna foto" })).toBe("/avatars/unknown-person.webp");
  });

  it("gives system lines no avatar", () => {
    expect(avatarOf({ role: "system" })).toBeUndefined();
  });
});

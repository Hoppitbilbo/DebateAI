import { expect, it } from "vitest";
import i18n, { i18nReady } from "@/i18n";

it("keeps <html lang> in step with the interface language", async () => {
  await i18nReady;
  await i18n.changeLanguage("de");
  expect(document.documentElement.lang).toBe("de");
  await i18n.changeLanguage("it");
  expect(document.documentElement.lang).toBe("it");
});

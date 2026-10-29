import i18n from "@/i18n";
import type { AppType } from "@/lib/api";
import type { PromptRecipe } from "@/services/aiService";
import { DEFAULT_DIFFICULTY } from "./difficulty";

/** The longest topic a student can write (the server refuses longer ones). */
export const MAX_TOPIC_CHARS = 500;

/** The fields a page fills; the rest has defaults. */
export type RecipeFields = Omit<PromptRecipe, "app" | "kind" | "difficulty" | "uiLang"> &
  Partial<Pick<PromptRecipe, "kind" | "difficulty">>;

/**
 * The recipe of a character's reply: the server writes the system prompt
 * from it, in the assignment's language or else the interface's.
 */
export const recipeFor = (app: AppType, fields: RecipeFields): PromptRecipe => ({
  kind: "reply",
  difficulty: DEFAULT_DIFFICULTY,
  ...fields,
  app,
  uiLang: (i18n.language || "it").slice(0, 2).toLowerCase(),
});

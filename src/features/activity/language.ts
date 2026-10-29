import i18n from "@/i18n";
import type { Assignment } from "@/lib/api";

// The language the characters speak. By default the student's interface
// language; a teacher can fix another one in an assignment, so students
// practise a foreign language while the interface stays in theirs.

export interface PracticeLanguage {
  code: string;
  /** English name, used in the prompts. */
  prompt: string;
  /** The language's own name, shown to people. */
  label: string;
  /** BCP 47 tag for speech dictation. */
  speech: string;
}

export const PRACTICE_LANGUAGES: readonly PracticeLanguage[] = [
  { code: "it", prompt: "Italian", label: "Italiano", speech: "it-IT" },
  { code: "en", prompt: "English", label: "English", speech: "en-GB" },
  { code: "es", prompt: "Spanish", label: "Español", speech: "es-ES" },
  { code: "fr", prompt: "French", label: "Français", speech: "fr-FR" },
  { code: "de", prompt: "German", label: "Deutsch", speech: "de-DE" },
  { code: "pt", prompt: "Portuguese", label: "Português", speech: "pt-PT" },
  { code: "la", prompt: "Latin (simple classical Latin, suitable for school students)", label: "Latina", speech: "it-IT" },
];

const byCode = (code?: string) => PRACTICE_LANGUAGES.find((l) => l.code === code);

const uiCode = () => (i18n.language || "it").slice(0, 2);

/** The interface language as a practice language (Italian when unknown). */
export const uiPracticeLanguage = (): PracticeLanguage => byCode(uiCode()) ?? PRACTICE_LANGUAGES[0];

/** The language the characters of an assignment speak. */
export const practiceLanguage = (assignment?: Pick<Assignment, "config"> | null): PracticeLanguage =>
  byCode(assignment?.config.language) ?? uiPracticeLanguage();

/** True when the teacher fixed a language other than the student's interface. */
export const isForeignPractice = (assignment?: Pick<Assignment, "config"> | null) =>
  !!assignment?.config.language && practiceLanguage(assignment).code !== uiCode();

export const languageLabel = (code?: string) => byCode(code)?.label ?? "";

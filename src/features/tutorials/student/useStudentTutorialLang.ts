import { useTranslation } from "react-i18next";

/**
 * Texts of the student tutorials and the language they are in: the
 * interface language when the tutorials are translated into it, Italian
 * otherwise (the voice must match the words it reads).
 */
export const useStudentTutorialLang = () => {
  const { t, i18n } = useTranslation("studentTutorial");
  const current = (i18n.language || "it").slice(0, 2);
  const lang = i18n.hasResourceBundle(current, "studentTutorial") ? current : "it";
  return { t, lang };
};

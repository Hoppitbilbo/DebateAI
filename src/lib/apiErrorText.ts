import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api";

/**
 * The translated text of a failed request: `<scope>.<code>` if the caller
 * words that code itself, else `platform.errors.<code>`; a request that never
 * reached the server is a network error.
 */
export const apiErrorText = (err: unknown, t: TFunction, scope?: string) => {
  if (err instanceof ApiError) {
    for (const key of [scope && `${scope}.${err.code}`, `platform.errors.${err.code}`]) {
      if (key && i18n.exists(key)) return t(key);
    }
    return t("platform.errors.generic");
  }
  if (err instanceof TypeError) return t("platform.errors.network");
  return t("platform.errors.generic");
};

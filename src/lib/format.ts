// Display formats shared by the dashboards.

/** Short date and time in the reader's locale, or a dash. */
export const formatDate = (iso?: string, locale?: string) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "–");

/** A cost in US dollars, with more decimals for tiny amounts. */
export const usd = (v: number | undefined) =>
  v === undefined ? "–" : v === 0 ? "$0" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;

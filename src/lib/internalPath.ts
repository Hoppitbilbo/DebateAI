/**
 * A `next` parameter as a path of this site, or null. Only "/…" paths are
 * kept: "//host", "/\host", full URLs and control characters could lead the
 * browser to another site after the login.
 */
export const internalPath = (raw: string | null | undefined): string | null => {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
};

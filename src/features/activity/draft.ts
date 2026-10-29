// The message a student is writing, kept in this browser so that a reload
// or a crashed tab does not lose it. Scoped to the account and to the app
// and assignment (a reload starts a new attempt, so the attempt itself
// cannot be the key; another student on the same school PC never sees it),
// and dropped after DRAFT_TTL_MS. Without storage (private mode) drafts
// simply are not kept.

const PREFIX = "debateai:draft:";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredDraft {
  text: string;
  at: number;
}

/** The storage key of a draft: who writes, and where (e.g. "convinci-tu:12", app and assignment). */
export const draftKey = (userId: number | null | undefined, where: string) => `${PREFIX}${userId ?? "guest"}:${where}`;

export const loadDraft = (key: string, now = Date.now()): string => {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null") as StoredDraft | null;
    if (d && typeof d.text === "string" && now - d.at < DRAFT_TTL_MS) return d.text;
    localStorage.removeItem(key);
  } catch {
    /* no storage */
  }
  return "";
};

export const saveDraft = (key: string, text: string, now = Date.now()) => {
  try {
    if (text.trim()) localStorage.setItem(key, JSON.stringify({ text, at: now } satisfies StoredDraft));
    else localStorage.removeItem(key);
  } catch {
    /* no storage */
  }
};

/** Drops the expired drafts of every account (called once in a while). */
export const pruneDrafts = (now = Date.now()) => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) loadDraft(key, now);
    }
  } catch {
    /* no storage */
  }
};

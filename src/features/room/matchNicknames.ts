// Suggests which student of a class a room guest is, from the nickname:
// "Marco R" or "marco" matches "Marco Rossi" when no other student fits.
// The teacher always confirms; a wrong guess only pre-fills a select.

export interface NamedStudent { userId: number; name: string }

const words = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Whether every word of the nickname starts a different word of the name. */
const fits = (nick: string[], name: string[]) => {
  const left = [...name];
  return nick.every((w) => {
    const i = left.findIndex((n) => n.startsWith(w));
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
};

/** The student a nickname points to, or 0 when none or more than one fit. */
export const suggestStudent = (nickname: string, students: NamedStudent[]): number => {
  const nick = words(nickname);
  if (nick.length === 0) return 0;
  const found = students.filter((s) => fits(nick, words(s.name)));
  return found.length === 1 ? found[0].userId : 0;
};

/** Suggestions for every guest; a student is never suggested twice. */
export const suggestAll = (nicknames: string[], students: NamedStudent[]): Record<string, number> => {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const n of nicknames) {
    const id = suggestStudent(n, students);
    out[n] = id && !used.has(id) ? id : 0;
    if (out[n]) used.add(id);
  }
  return out;
};

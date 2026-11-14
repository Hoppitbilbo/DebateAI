// Rules of the mystery character game (PersonaggioMisterioso).

// Titles that resolve on it/en/es/fr/de Wikipedia (redirects are followed).
export const RANDOM_CHARACTERS = [
  "Leonardo da Vinci", "Galileo Galilei", "Marie Curie", "Albert Einstein", "Isaac Newton", "Charles Darwin",
  "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Dante Alighieri", "William Shakespeare", "Mahatma Gandhi",
  "Nelson Mandela", "Frida Kahlo", "Pablo Picasso", "Ada Lovelace", "Nikola Tesla", "Michelangelo",
  "Giuseppe Garibaldi", "Rita Levi-Montalcini", "Vincent van Gogh", "Johann Sebastian Bach", "Cleopatra",
  "Giulio Cesare", "Marco Polo", "Alessandro Volta", "Maria Montessori", "Napoleone Bonaparte",
];

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Short words of names ("da", "van", "de", "von"...) never identify a person. */
const MIN_NAME_WORD = 4;

// Mirrored in server/internal/app/mystery.go (cases in testdata/mystery_names.json).
/**
 * Words that start the part of a title telling where or what the person was
 * ("Elisabetta I d'Inghilterra", "Alexander the Great"): ordinary words, not
 * the name. Surname particles ("da Vinci", "van Gogh") are not here.
 */
const EPITHET_PARTICLES = new Set(["di", "d", "of", "the", "il"]);
/** Titles and epithets, never the name itself. */
const TITLE_WORDS = new Set([
  "queen", "king", "pope", "papa", "regina", "saint", "santa", "santo", "great", "magno", "grande", "emperor",
  "empress", "imperatore", "imperatrice", "prince", "princess", "principe", "principessa", "lady", "lord", "duke",
  "duca", "duchessa", "tsar", "czar",
]);
const ROMAN_NUMERAL = /^[ivxl]+$/;

/** The words of a name that identify the person on their own. */
const identifyingWords = (normalized: string) => {
  const out: string[] = [];
  for (const [i, w] of normalized.split(" ").entries()) {
    if (i > 0 && EPITHET_PARTICLES.has(w)) break;
    if (w.length >= MIN_NAME_WORD && !TITLE_WORDS.has(w) && !ROMAN_NUMERAL.test(w)) out.push(w);
  }
  return out;
};

/**
 * An identifying word this long is still found with one typo (a letter
 * changed, added, or two swapped); shorter words must be exact, so "tante"
 * never wins for Dante. A cut word ("Galile") is never a typo.
 */
const MIN_TYPO_WORD = 7;

/** Whether w is name with one letter changed, one added, or two neighbours swapped. */
const oneTypo = (w: string, name: string) => {
  if (w.length === name.length) {
    const diff = [...w].flatMap((c, i) => (c !== name[i] ? [i] : []));
    return diff.length === 1 ||
      (diff.length === 2 && diff[1] === diff[0] + 1 && w[diff[0]] === name[diff[1]] && w[diff[1]] === name[diff[0]]);
  }
  if (w.length === name.length + 1) return [...w].some((_, i) => w.slice(0, i) + w.slice(i + 1) === name);
  return false;
};

/**
 * Name match: the guess is right when it holds the full name as whole words,
 * or one of the identifying words of the answer ("Vinci", "Leonardo"; not
 * "Inghilterra" or "great"), long ones even with one typo ("Einstien").
 * Fragments ("Da", "Leo", "Galile") are wrong.
 */
export const isCorrectGuess = (guess: string, answer: string) => {
  const g = normalize(guess);
  const name = normalize(answer);
  if (!g || !name) return false;
  if (` ${g} `.includes(` ${name} `)) return true;
  const guessWords = new Set(g.split(" "));
  return identifyingWords(name).some((w) =>
    guessWords.has(w) || (w.length >= MIN_TYPO_WORD && [...guessWords].some((t) => oneTypo(t, w))));
};

/**
 * The question that won a saved game (the first that names the character), or
 * null while the game is open: what a reload needs to show a won game as won.
 */
export const winningQuestion = (messages: readonly { role: string; content: string }[], answer: string): string | null =>
  messages.find((m) => m.role === "user" && isCorrectGuess(m.content, answer))?.content ?? null;

/** How many questions a game can have, and the default when nobody chooses. */
export const QUESTIONS = { min: 3, max: 20, default: 7 } as const;

/**
 * The questions the student really gets: the chosen number, kept within
 * QUESTIONS, and never more than the assignment's turn limit (each question
 * is one student message), so the game never ends before the count it
 * announced.
 */
export const availableQuestions = (questions: number | undefined, maxTurns = 0) => {
  const chosen = Math.min(QUESTIONS.max, Math.max(QUESTIONS.min, Math.round(questions || QUESTIONS.default)));
  return maxTurns > 0 ? Math.min(chosen, maxTurns) : chosen;
};

/** Hints a teacher can write for the mystery game, from the vaguest to the clearest. */
export const MAX_TEACHER_HINTS = 3;

/**
 * The next hint for a student who already asked `used` of them: the
 * teacher's own hints come first, in order; after them (or without them)
 * null, and the character makes one up.
 */
export const nextTeacherHint = (teacherHints: string[] | undefined, used: number): string | null =>
  teacherHints?.map((h) => h.trim()).filter(Boolean)[used] ?? null;

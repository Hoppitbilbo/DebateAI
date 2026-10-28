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

/** The words of a name that identify it: at least MIN_NAME_WORD letters. */
const nameWords = (s: string) => normalize(s).split(" ").filter((w) => w.length >= MIN_NAME_WORD);

/**
 * Strict name match: the guess is right when it is the full name or contains,
 * as a whole word, one of the significant words of the answer ("Vinci",
 * "Leonardo"). Fragments ("Da", "Leo") and misspellings are wrong.
 */
export const isCorrectGuess = (guess: string, answer: string) => {
  const g = normalize(guess);
  if (!g) return false;
  if (g === normalize(answer)) return true;
  const guessWords = new Set(g.split(" "));
  return nameWords(answer).some((w) => guessWords.has(w));
};

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

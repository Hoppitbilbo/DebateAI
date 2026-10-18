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
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Lenient name match: full containment or a shared significant surname. */
export const isCorrectGuess = (guess: string, answer: string) => {
  const g = normalize(guess);
  const a = normalize(answer);
  if (!g) return false;
  if (a.includes(g) || g.includes(a)) return true;
  const sig = (s: string) => s.split(" ").filter((w) => w.length > 3);
  return sig(a).some((w) => sig(g).includes(w));
};

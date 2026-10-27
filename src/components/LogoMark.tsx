/** The brand mark: Galileo's star in a purple bubble answering a student's cap in a yellow one. */
const LogoMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M14 8H32Q40 8 40 16V26Q40 34 32 34H21L12 42V33.5Q6 32 6 26V16Q6 8 14 8Z" fill="#6A3BD4" stroke="#1E1A2E" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M23 13Q24.5 19.5 31 21Q24.5 22.5 23 29Q21.5 22.5 15 21Q21.5 19.5 23 13Z" fill="#FFC52A" />
    <path d="M32 30H50Q58 30 58 38V46Q58 53 51 54V60L44 54H32Q24 54 24 46V38Q24 30 32 30Z" fill="#FFC52A" stroke="#1E1A2E" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M35 42.5V47Q41 50 47 47V42.5" fill="#4B2A99" />
    <path d="M31 40L41 35.5L51 40L41 44.5Z" fill="#6A3BD4" stroke="#1E1A2E" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M51 40V46.5" stroke="#1E1A2E" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="51" cy="47.5" r="1.6" fill="#1E1A2E" />
  </svg>
);

export default LogoMark;

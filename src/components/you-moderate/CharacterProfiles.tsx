
import { Character } from "./types";

interface CharacterProfilesProps {
  characters: [Character, Character];
  theme: string;
}

const CharacterProfiles = ({ characters, theme }: CharacterProfilesProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 m-0">
      {characters.map((character, index) => (
        <div key={index} className="mb-6">
          <h2 className="text-2xl font-bold mb-2">{character.name}</h2>
          <p><strong>Theme:</strong> {theme}</p>
          <p><strong>From:</strong> {character.wikiTitle}</p>
          <p className="mt-2">{character.bio}</p>
        </div>
      ))}
    </div>
  );
};

export default CharacterProfiles;

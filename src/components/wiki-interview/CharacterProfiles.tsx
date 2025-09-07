/**
 * @file Renders the profiles of the two characters participating in the WikiInterview.
 * @remarks This component displays the name, theme, original Wikipedia title, and biography for each character.
 */

import { Character } from "./types";

/**
 * @interface CharacterProfilesProps
 * @description Defines the props for the CharacterProfiles component.
 * @property {[Character, Character]} characters - An array containing the two character objects to be displayed.
 * @property {string} theme - The common theme or topic of the interview.
 */
interface CharacterProfilesProps {
  characters: [Character, Character];
  theme: string;
}

/**
 * @function CharacterProfiles
 * @description A component that displays the detailed profiles of the two interview participants.
 * @param {CharacterProfilesProps} props - The props for the component.
 * @returns {JSX.Element} The rendered character profiles section.
 */
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

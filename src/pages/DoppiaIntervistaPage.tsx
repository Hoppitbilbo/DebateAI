/**
 * @file Renders the main page for the "Doppia Intervista" (Double Interview) educational game.
 * @remarks This page handles the initial setup phase where the user selects two characters
 * and then transitions to the main chat interface for the interview.
 */

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DoppiaIntervistaChat from "@/components/DoppiaIntervistaChat";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * @interface WikiSearchResult
 * @description Represents a character selected from a Wikipedia search.
 * @property {string} title - The name of the character.
 * @property {string} snippet - A brief description of the character.
 * @property {number} pageid - The unique ID of the Wikipedia page.
 */
interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @function DoppiaIntervistaPage
 * @description The main page component for the "Doppia Intervista" game. It manages the state
 * for character selection and conditionally renders either the setup UI or the chat interface.
 * @returns {JSX.Element} The rendered Doppia Intervista page.
 */
const DoppiaIntervistaPage = () => {
  const { t } = useTranslation();
  const [selectedCharacters, setSelectedCharacters] = useState<WikiSearchResult[]>([]);
  const [showChat, setShowChat] = useState(false);

  /**
   * @function handleCharacterSelect
   * @description Updates the state with the selected character for a given index.
   * @param {number} index - The index of the character to update (0 or 1).
   * @param {WikiSearchResult} result - The selected character data.
   */
  const handleCharacterSelect = (index: number, result: WikiSearchResult) => {
    const newSelectedCharacters = [...selectedCharacters];
    while (newSelectedCharacters.length <= index) {
      newSelectedCharacters.push({} as WikiSearchResult);
    }
    newSelectedCharacters[index] = result;
    setSelectedCharacters(newSelectedCharacters);
  };

  /**
   * @function handleStartDialogue
   * @description Transitions the view from the setup screen to the chat interface if two valid,
   * different characters have been selected.
   */
  const handleStartDialogue = () => {
    if (selectedCharacters.length >= 2 && selectedCharacters[0] && selectedCharacters[1] && selectedCharacters[0].title && selectedCharacters[1].title && selectedCharacters[0].title !== selectedCharacters[1].title) {
      setShowChat(true);
    }
  };

  return <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold sm:text-4xl text-[#D8FF8F]">
              {t('apps.doppiaIntervista.title')}
            </h1>
            <p className="mt-3 text-xl text-gray-500 dark:text-gray-400">
              {t('apps.doppiaIntervista.description')}
            </p>
          </div>
          
          {!showChat ? <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>{t('apps.doppiaIntervista.setup.chooseCharacters')}</CardTitle>
                  <CardDescription>
                    {t('apps.doppiaIntervista.setup.selectDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[0, 1].map(index => <div key={index} className="space-y-2">
                        <label className="block text-sm font-medium text-education">
                          {t('apps.doppiaIntervista.setup.character')} {index + 1}
                        </label>
                        <WikiSearchSelect onSelect={result => handleCharacterSelect(index, result)} />
                      </div>)}
                  </div>
                  
                  <Button onClick={handleStartDialogue} disabled={selectedCharacters.length < 2 || !selectedCharacters[0]?.title || !selectedCharacters[1]?.title || selectedCharacters[0].title === selectedCharacters[1].title} className="w-full bg-education hover:bg-education-dark">
                    {t('apps.doppiaIntervista.setup.startButton')} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div> : <div className="max-w-6xl mx-auto">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {t('apps.doppiaIntervista.chat.dialogueTitle')}: {selectedCharacters[0]?.title} & {selectedCharacters[1]?.title}
                </h2>
                <Button variant="outline" onClick={() => setShowChat(false)} className="border-education text-education hover:bg-education hover:text-white">
                  {t('apps.doppiaIntervista.chat.changeCharacters')}
                </Button>
              </div>
              <DoppiaIntervistaChat character1={{
            name: selectedCharacters[0]?.title || "",
            snippet: selectedCharacters[0]?.snippet || ""
          }} character2={{
            name: selectedCharacters[1]?.title || "",
            snippet: selectedCharacters[1]?.snippet || ""
          }} />
            </div>}
        </div>
      </main>
      
      <Footer />
    </div>;
};
export default DoppiaIntervistaPage;
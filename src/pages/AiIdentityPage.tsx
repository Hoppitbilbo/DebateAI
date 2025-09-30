import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AiIdentityChat from "@/components/AiIdentityChat";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

const AiIdentityPage = () => {
  const { t } = useTranslation();
  const [selectedCharacters, setSelectedCharacters] = useState<WikiSearchResult[]>([]);
  const [showChat, setShowChat] = useState(false);

  const handleCharacterSelect = (index: number, result: WikiSearchResult) => {
    const newSelectedCharacters = [...selectedCharacters];
    while (newSelectedCharacters.length <= index) {
      newSelectedCharacters.push({} as WikiSearchResult);
    }
    newSelectedCharacters[index] = result;
    setSelectedCharacters(newSelectedCharacters);
  };

  const handleStartDialogue = () => {
    if (selectedCharacters.length >= 2 && 
        selectedCharacters[0] && 
        selectedCharacters[1] && 
        selectedCharacters[0].title && 
        selectedCharacters[1].title && 
        selectedCharacters[0].title !== selectedCharacters[1].title) {
      setShowChat(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold sm:text-4xl text-[#D8FF8F]">
              {t('apps.aiIdentity.title')}
            </h1>
            <p className="mt-3 text-xl text-gray-500 dark:text-gray-400">
              {t('apps.aiIdentity.description')}
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link to="/apps/ai-identity/tutorial">
                <Button
                  variant="outline"
                  className="border-education text-education hover:bg-education hover:text-white"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {t('common.tutorial')}
                </Button>
              </Link>
            </div>
          </div>
          
          {!showChat ? (
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>{t('apps.aiIdentity.setup.chooseCharacters')}</CardTitle>
                  <CardDescription>
                    {t('apps.aiIdentity.setup.selectDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[0, 1].map(index => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="block text-sm font-medium text-education">
                            {t('apps.aiIdentity.setup.character')} {index + 1}
                          </label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  {t('apps.aiIdentity.setup.characterTooltip')}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <WikiSearchSelect onSelect={result => handleCharacterSelect(index, result)} />
                      </div>
                    ))}
                  </div>
                  
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">
                      {t('apps.aiIdentity.setup.difficultyTitle')}
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>{t('apps.aiIdentity.easy')}:</strong> {t('apps.aiIdentity.setup.easyDesc')}</li>
                      <li>• <strong>{t('apps.aiIdentity.medium')}:</strong> {t('apps.aiIdentity.setup.mediumDesc')}</li>
                      <li>• <strong>{t('apps.aiIdentity.hard')}:</strong> {t('apps.aiIdentity.setup.hardDesc')}</li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={handleStartDialogue} 
                    disabled={selectedCharacters.length < 2 || !selectedCharacters[0]?.title || !selectedCharacters[1]?.title || selectedCharacters[0].title === selectedCharacters[1].title} 
                    className="w-full bg-education hover:bg-education-dark"
                  >
                    {t('apps.aiIdentity.setup.startButton')} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {t('apps.aiIdentity.chat.dialogueTitle')}: {selectedCharacters[0]?.title} & {selectedCharacters[1]?.title}
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => setShowChat(false)} 
                  className="border-education text-education hover:bg-education hover:text-white"
                >
                  {t('apps.aiIdentity.chat.changeCharacters')}
                </Button>
              </div>
              <AiIdentityChat 
                character1={{
                  name: selectedCharacters[0]?.title || "",
                  snippet: selectedCharacters[0]?.snippet || ""
                }} 
                character2={{
                  name: selectedCharacters[1]?.title || "",
                  snippet: selectedCharacters[1]?.snippet || ""
                }} 
              />
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AiIdentityPage;
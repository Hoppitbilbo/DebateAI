
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import WikiChatInterface from "@/components/WikiChatInterface";
import { useTranslation } from "react-i18next";
// Removed imports for WikiChatbotReflection, WikiChatbotFeedback, ConversationData, getAIGameAndReflectionEvaluation, AIScoreEvaluation, Message
// as their responsibilities are now encapsulated in WikiChatInterface or not needed at this level.

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

const WikiChatbotPage = () => {
  const { t, i18n } = useTranslation();
  const [selectedWiki, setSelectedWiki] = useState<WikiSearchResult | null>(null);
  const [wikiSummary, setWikiSummary] = useState<string>("");
  const [activityPhase, setActivityPhase] = useState<"selecting" | "chatting">("selecting"); // Simplified activity phases

  const getWikipediaLanguageCode = () => {
    const langMap: { [key: string]: string } = {
      'it': 'it',
      'en': 'en', 
      'es': 'es',
      'fr': 'fr',
      'de': 'de'
    };
    return langMap[i18n.language] || 'it';
  };

  // Removed userReflection, aiEvaluation, isEvaluating, messages states

  const handleWikiSelect = (result: WikiSearchResult) => {
    setSelectedWiki(result);
    // When a wiki is selected, get its full summary
    fetchWikiSummary(result.title);
  };

  const fetchWikiSummary = async (title: string) => {
    try {
      const wikiLang = getWikipediaLanguageCode();
      const endpoint = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*&redirects=1`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(t('apps.wikiChatbot.errors.fetchError'));
      const data = await response.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract || "";
      setWikiSummary(extract);
    } catch (error) {
      console.error("Errore:", error);
      setWikiSummary(t('apps.wikiChatbot.errors.summaryError'));
    }
  };

  // Removed handleMessagesUpdate

  const handleStartChat = () => {
    if (selectedWiki && wikiSummary) {
      setActivityPhase("chatting");
    }
  };

  // Removed handleEndChatInPage, handleSubmitReflection, evaluateReflection

  const handleStartNewChat = () => { // This function is now called by onSessionComplete from WikiChatInterface
    setSelectedWiki(null);
    setWikiSummary("");
    setActivityPhase("selecting");
    // No need to reset userReflection, aiEvaluation, messages as they are not here anymore
  };

  return <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-education-light sm:text-4xl">
              {t('apps.wikiChatbot.title')}
            </h1>
            <p className="mt-3 text-xl text-gray-200 dark:text-gray-400">
              {t('apps.wikiChatbot.description')}
            </p>
          </div>
          
          {/* Conditionally render content based on activity phase */}
          {activityPhase === "selecting" && (
            <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('apps.wikiChatbot.setup.chooseWikiTopic')}</CardTitle>
                    <CardDescription className="text-education">
                      {t('apps.wikiChatbot.setup.selectDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-education mb-2">
                          {t('apps.wikiChatbot.setup.wikiTopicLabel')}
                        </label>
                        <WikiSearchSelect onSelect={handleWikiSelect} />
                      </div>

                      {selectedWiki && <div className="mt-4 p-4 bg-gray-50 rounded-md">
                          <h3 className="font-medium">{selectedWiki.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{selectedWiki.snippet.replace(/<\/?[^>]+(>|$)/g, "")}</p>
                        </div>}
                    </div>

                    <Button onClick={handleStartChat} disabled={!selectedWiki || !wikiSummary} className="w-full bg-education hover:bg-education-dark">
                      {t('apps.wikiChatbot.setup.startChatButton')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activityPhase === "chatting" && selectedWiki && (
                <div className="max-w-4xl mx-auto">
                  <div className="mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">
                      {t('apps.wikiChatbot.chat.chatWithTitle', { title: selectedWiki?.title || '' })}
                    </h2>
                    {/* You might want to keep the 'Cambia Argomento' button here or move it */}
                  </div>
                  <WikiChatInterface 
                    wikiTitle={selectedWiki.title} 
                    wikiSummary={wikiSummary} 
                    onSessionComplete={handleStartNewChat} 
                  />
                </div>
            )}

            {/* Removed reflecting, evaluating, and feedback phases rendering as they are handled by WikiChatInterface */}
        </div>
      </main>
      <Footer />
    </div>;
};

export default WikiChatbotPage;

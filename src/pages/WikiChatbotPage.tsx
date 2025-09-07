/**
 * @file Renders the main page for the WikiChatbot educational game.
 * @remarks This page handles the initial setup where the user selects a Wikipedia topic.
 * Once a topic is selected and its summary is fetched, it transitions to the main
 * `WikiChatInterface` to begin the chat session.
 */

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import WikiChatInterface from "@/components/WikiChatInterface";
import { useTranslation } from "react-i18next";

/**
 * @interface WikiSearchResult
 * @description Represents a topic selected from a Wikipedia search.
 * @property {string} title - The title of the Wikipedia article.
 * @property {string} snippet - A brief description of the article.
 * @property {number} pageid - The unique ID of the Wikipedia page.
 */
interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @function WikiChatbotPage
 * @description The main page component for the WikiChatbot game. It manages the state for
 * topic selection and conditionally renders either the setup UI or the chat interface.
 * @returns {JSX.Element} The rendered WikiChatbot page.
 */
const WikiChatbotPage = () => {
  const { t, i18n } = useTranslation();
  const [selectedWiki, setSelectedWiki] = useState<WikiSearchResult | null>(null);
  const [wikiSummary, setWikiSummary] = useState<string>("");
  const [activityPhase, setActivityPhase] = useState<"selecting" | "chatting">("selecting");

  /**
   * @function getWikipediaLanguageCode
   * @description Determines the appropriate Wikipedia language code based on the current i18n language setting.
   * @returns {string} The two-letter language code for the Wikipedia API (e.g., 'it', 'en').
   */
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

  /**
   * @function handleWikiSelect
   * @description Updates the state with the selected topic and fetches its summary.
   * @param {WikiSearchResult} result - The selected topic data.
   */
  const handleWikiSelect = (result: WikiSearchResult) => {
    setSelectedWiki(result);
    fetchWikiSummary(result.title);
  };

  /**
   * @function fetchWikiSummary
   * @description Fetches the full summary of a Wikipedia article.
   * @param {string} title - The title of the article to fetch.
   */
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

  /**
   * @function handleStartChat
   * @description Transitions the view to the chat interface if a topic has been selected and its summary loaded.
   */
  const handleStartChat = () => {
    if (selectedWiki && wikiSummary) {
      setActivityPhase("chatting");
    }
  };

  /**
   * @function handleStartNewChat
   * @description Resets the page to the initial selection phase, ready for a new session.
   */
  const handleStartNewChat = () => {
    setSelectedWiki(null);
    setWikiSummary("");
    setActivityPhase("selecting");
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
                  </div>
                  <WikiChatInterface 
                    wikiTitle={selectedWiki.title} 
                    wikiSummary={wikiSummary} 
                    onSessionComplete={handleStartNewChat} 
                  />
                </div>
            )}
        </div>
      </main>
      <Footer />
    </div>;
};

export default WikiChatbotPage;

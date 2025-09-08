/**
 * @file Renders the main page for the "WikiInterview" educational game.
 * @remarks This page manages the entire lifecycle of the WikiInterview activity,
 * including character selection, theme definition, the chat phase, reflection, and feedback.
 */

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WikiInterviewChat from "@/components/WikiInterviewChat";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { ConversationData, getAIGameAndReflectionEvaluation, AIScoreEvaluation } from "@/utils/evaluationUtils";
import { Message } from "@/types/conversation";
import WikiInterviewReflection from "@/components/WikiInterview/WikiInterviewReflection";
import WikiInterviewFeedback from "@/components/WikiInterview/WikiInterviewFeedback";
import { Message as WikiInterviewMessage } from "@/components/wiki-interview/types";
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
 * @interface CharacterDetail
 * @description Extends WikiSearchResult with additional details needed for the interview.
 * @property {string} name - The character's name.
 * @property {string} wikiTitle - The original Wikipedia title.
 * @property {string} bio - The fetched summary/biography for the character.
 * @property {string} dialogueStyle - A descriptor for the character's speaking style.
 * @property {string} [summary] - Optional full summary if different from the bio.
 */
export interface CharacterDetail extends WikiSearchResult {
    name: string;
    wikiTitle: string;
    bio: string;
    dialogueStyle: string;
    summary?: string;
}

/**
 * @function WikiInterviewPage
 * @description The main page component for the "WikiInterview" game. It orchestrates the setup,
 * chat, reflection, and feedback phases of the activity.
 * @returns {JSX.Element} The rendered WikiInterview page.
 */
const WikiInterviewPage = () => {
  const { t, i18n } = useTranslation();
  const [selectedCharacters, setSelectedCharacters] = useState<(WikiSearchResult | null)[]>([]);
  const [theme, setTheme] = useState("");
  const [characterSummaries, setCharacterSummaries] = useState<{ [key: number]: string | null }>({});
  const [currentPhase, setCurrentPhase] = useState<"selecting" | "chatting" | "reflecting" | "feedback">("selecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<AIScoreEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  /**
   * @function getWikipediaLanguageCode
   * @description Determines the language code for Wikipedia API calls based on the current app language.
   * @returns {string} The language code (e.g., 'en', 'it').
   */
  const getWikipediaLanguageCode = () => {
    const langMap: { [key: string]: string } = {
      'it': 'it', 'en': 'en', 'es': 'es', 'fr': 'fr', 'de': 'de'
    };
    return langMap[i18n.language] || 'it';
  };

  /**
   * @function fetchWikiSummary
   * @description Fetches the introductory summary of a Wikipedia article for a given character.
   * @param {string} title - The title of the Wikipedia article.
   * @param {number} index - The index (0 or 1) of the character being fetched.
   */
  const fetchWikiSummary = async (title: string, index: number) => {
    setCharacterSummaries(prev => ({ ...prev, [index]: null })); // Set to null to indicate loading
    try {
      const wikiLang = getWikipediaLanguageCode();
      const endpoint = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*&redirects=1`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(t('apps.wikiInterview.errors.fetchError', { title }));
      const data = await response.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract || t('apps.wikiInterview.errors.noSummary');
      setCharacterSummaries(prev => ({ ...prev, [index]: extract }));
    } catch (error) {
      console.error("Errore fetchWikiSummary:", error);
      setCharacterSummaries(prev => ({ ...prev, [index]: t('apps.wikiInterview.errors.summaryError') }));
    }
  };

  /**
   * @function handleCharacterSelect
   * @description Updates the selected character and triggers fetching their summary.
   * @param {number} index - The index of the character being selected.
   * @param {WikiSearchResult | null} result - The selected character data, or null if cleared.
   */
  const handleCharacterSelect = (index: number, result: WikiSearchResult | null) => {
    const newSelectedCharacters = [...selectedCharacters];
    newSelectedCharacters[index] = result;
    setSelectedCharacters(newSelectedCharacters);

    if (result && result.title) {
      fetchWikiSummary(result.title, index); 
    } else {
      setCharacterSummaries(prev => {
        const newSummaries = { ...prev };
        delete newSummaries[index];
        return newSummaries;
      });
    }
  };
  
  /**
   * @function handleStartDialogue
   * @description Validates the setup and transitions the page to the "chatting" phase.
   */
  const handleStartDialogue = () => {
    const errorMessage = t('apps.wikiInterview.errors.summaryError');
    if (selectedCharacters[0] && selectedCharacters[1] && characterSummaries[0] && characterSummaries[1] && theme.trim() && characterSummaries[0] !== errorMessage && characterSummaries[1] !== errorMessage) {
      setMessages([]);
      setCurrentPhase("chatting");
    }
  };

  /**
   * @function handleMessagesUpdate
   * @description A callback to update the page's message state from the child chat component.
   * @param {WikiInterviewMessage[]} updatedMessagesFromChat - The updated message list from the chat component.
   */
  const handleMessagesUpdate = useCallback((updatedMessagesFromChat: WikiInterviewMessage[]) => {
    const mappedMessages: Message[] = updatedMessagesFromChat.map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
      characterName: (msg.role === "character1" || msg.role === "character2") ? msg.character : undefined,
    }));
    setMessages(mappedMessages);
  }, []);

  /**
   * @function handleEndChatInPage
   * @description A callback to transition the page from "chatting" to "reflecting".
   */
  const handleEndChatInPage = useCallback(() => {
    setCurrentPhase("reflecting");
  }, []);

  /**
   * @function evaluateCurrentReflection
   * @description Sends the conversation and reflection data to the server for AI evaluation.
   * @param {string} reflection - The user's written reflection.
   */
  const evaluateCurrentReflection = useCallback(async (reflection: string) => {
    if (!selectedCharacters[0] || !selectedCharacters[1] || !theme || messages.length === 0) {
      setAiEvaluation({ textualFeedback: t('apps.wikiInterview.errors.insufficientData') } as AIScoreEvaluation);
      setCurrentPhase("feedback");
      return;
    }
    setIsEvaluating(true);
    setAiEvaluation(null);
    try {
      const conversationData: ConversationData = {
        character: `${selectedCharacters[0].title} & ${selectedCharacters[1].title}`,
        topic: theme,
        messages: messages,
      };
      const evaluationResult = await getAIGameAndReflectionEvaluation(conversationData, reflection);
      setAiEvaluation(evaluationResult);
    } catch (error) {
      console.error("Errore durante la valutazione:", error);
      setAiEvaluation({ textualFeedback: t('apps.wikiInterview.errors.technicalReflection') } as AIScoreEvaluation);
    } finally {
      setIsEvaluating(false);
      setCurrentPhase("feedback");
    }
  }, [selectedCharacters, theme, messages, t]);

  /**
   * @function handleSubmitReflection
   * @description Sets the user's reflection and triggers the evaluation process.
   * @param {string} reflection - The user's submitted reflection text.
   */
  const handleSubmitReflection = useCallback(async (reflection: string) => {
    setUserReflection(reflection);
    await evaluateCurrentReflection(reflection);
  }, [evaluateCurrentReflection]);

  /**
   * @function handleStartNewDialogue
   * @description Resets all state to begin a new interview session from the setup screen.
   */
  const handleStartNewDialogue = () => {
    setSelectedCharacters([]);
    setCharacterSummaries({});
    setTheme("");
    setCurrentPhase("selecting");
    setUserReflection("");
    setAiEvaluation(null);
    setMessages([]);
  };

  /**
   * @function getChatCharactersDetails
   * @description A helper to format the selected character data into the structure required by the `WikiInterviewChat` component.
   * @returns {[CharacterDetail, CharacterDetail] | null} An array of two character details, or null if setup is incomplete.
   */
  const getChatCharactersDetails = (): [CharacterDetail, CharacterDetail] | null => {
    const char1 = selectedCharacters[0];
    const char2 = selectedCharacters[1];
    const summary1 = characterSummaries[0];
    const summary2 = characterSummaries[1];
    const errorMessage = t('apps.wikiInterview.errors.summaryError');

    if (char1 && char2 && summary1 && summary2 && summary1 !== errorMessage && summary2 !== errorMessage) {
      return [
        { ...char1, name: char1.title, wikiTitle: char1.title, bio: summary1, dialogueStyle: t('apps.wikiInterview.characterStyles.erudite') },
        { ...char2, name: char2.title, wikiTitle: char2.title, bio: summary2, dialogueStyle: t('apps.wikiInterview.characterStyles.reflective') },
      ];
    }
    return null;
  };

  const isLoadingSummaries = Object.values(characterSummaries).some(summary => summary === null);

  return <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl text-education-light">
              {t('apps.wikiInterview.title')}
            </h1>
            <p className="mt-4 text-xl text-gray-300 max-w-2xl mx-auto">
              {t('apps.wikiInterview.description')}
            </p>
          </div>
          
          {currentPhase === "selecting" && (
            <div className="max-w-3xl mx-auto">
              <Card className="bg-gray-800 border-gray-700 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-3xl text-education-light">{t('apps.wikiInterview.setup.buildDialogue')}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {t('apps.wikiInterview.setup.selectDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[0, 1].map(index => (
                    <div key={index} className="space-y-3 p-4 bg-gray-700/50 rounded-lg">
                      <label className="block text-lg font-medium text-education-lighter">
                        {t(`apps.wikiInterview.setup.character${index + 1}`)}
                      </label>
                      <WikiSearchSelect onSelect={result => handleCharacterSelect(index, result)} />
                      {selectedCharacters[index] && (
                        <div className="mt-3 p-3 bg-gray-800 rounded-md text-sm text-gray-300 border border-gray-600">
                          <h4 className="font-semibold text-education-lighter">{selectedCharacters[index]?.title}</h4>
                          <p className="text-xs italic truncate">{selectedCharacters[index]?.snippet.replace(/<\/?[^>]+(>|$)/g, "")}</p>
                          {characterSummaries[index] === null && <p className="text-xs text-yellow-400 mt-1">{t('apps.wikiInterview.setup.loadingSummary')}</p>}
                          {characterSummaries[index] === t('apps.wikiInterview.errors.summaryError') && <p className="text-xs text-red-400 mt-1">{characterSummaries[index]}</p>}
                          {characterSummaries[index] && characterSummaries[index] !== null && characterSummaries[index] !== t('apps.wikiInterview.errors.summaryError') && (
                            <p className="text-xs text-green-400 mt-1">{t('apps.wikiInterview.setup.summaryLoaded')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="space-y-3 p-4 bg-gray-700/50 rounded-lg">
                    <label className="block text-lg font-medium text-education-lighter">
                      {t('apps.wikiInterview.setup.themeLabel')}
                    </label>
                    <Input 
                        placeholder={t('apps.wikiInterview.setup.themePlaceholder')} 
                        value={theme} 
                        onChange={e => setTheme(e.target.value)} 
                        className="bg-gray-800 border-gray-600 placeholder-gray-500 text-white focus:ring-education focus:border-education"
                    />
                  </div>
                  <Button 
                    onClick={handleStartDialogue} 
                    disabled={!getChatCharactersDetails() || !theme.trim() || isLoadingSummaries}
                    className="w-full bg-education hover:bg-education-dark text-white py-3 text-lg font-semibold disabled:opacity-50"
                  >
                    {t('apps.wikiInterview.setup.startButton')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {currentPhase === "chatting" && getChatCharactersDetails() && (
            <div className="max-w-5xl mx-auto">
              <WikiInterviewChat
                characters={getChatCharactersDetails()!} 
                theme={theme}
                onMessagesUpdate={handleMessagesUpdate}
                handleEndChat={handleEndChatInPage}
              />
            </div>
          )}

          {currentPhase === "reflecting" && (
            <WikiInterviewReflection onSubmit={handleSubmitReflection} />
          )}

          {currentPhase === "feedback" && (
            <WikiInterviewFeedback
              userReflection={userReflection} 
              aiEvaluation={aiEvaluation?.textualFeedback || ""} 
              isLoading={isEvaluating}
              onStartNewChat={handleStartNewDialogue}
              messages={messages}
              character1Name={selectedCharacters[0]?.title || t('common.na', { defaultValue: 'N/A' })}
              character2Name={selectedCharacters[1]?.title || t('common.na', { defaultValue: 'N/A' })}
              topic={theme}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>;
};
export default WikiInterviewPage;

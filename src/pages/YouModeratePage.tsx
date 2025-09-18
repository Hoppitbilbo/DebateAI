import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import YouModerateChat from "@/components/YouModerateChat";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen } from "lucide-react";
import { ConversationData, getAIGameAndReflectionEvaluation, AIScoreEvaluation } from "@/utils/evaluationUtils";
import { Message } from "@/types/conversation"; // Using the global Message type
import YouModerateReflection from "@/components/YouModerate/YouModerateReflection";
import YouModerateFeedback from "@/components/YouModerate/YouModerateFeedback";
// Import local Message type from you-moderate for the handler
import { Message as YouModerateMessage } from "@/components/you-moderate/types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

//This interface is used within YouModeratePage and passed to YouModerateChat
export interface CharacterDetail extends WikiSearchResult {
    name: string; // Already in WikiSearchResult as title, but explicit for clarity
    wikiTitle: string; // Same as title, for consistency with other components
    bio: string; // This will be the fetched summary
    dialogueStyle: string; // Example: "formal", "analytical"
    summary?: string; // Optional: full summary if different from bio snippet used initially
}

const YouModeratePage = () => {
  const { t, i18n } = useTranslation();
  const [selectedCharacters, setSelectedCharacters] = useState<WikiSearchResult[]>([]);
  const [theme, setTheme] = useState("");
  const [characterSummaries, setCharacterSummaries] = useState<{ [key: string]: string }>({});
  const [currentPhase, setCurrentPhase] = useState<"selecting" | "chatting" | "reflecting" | "feedback">("selecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<AIScoreEvaluation | null>(null);

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
  const [isEvaluating, setIsEvaluating] = useState(false);

  const fetchWikiSummary = async (title: string, index: number) => {
    setCharacterSummaries(prevSummaries => {
      const newSummaries = { ...prevSummaries };
      newSummaries[index] = null; // Indicate loading
      return newSummaries;
    });
    try {
      const wikiLang = getWikipediaLanguageCode();
      const endpoint = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*&redirects=1`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(t('apps.youModerate.errors.fetchError', { title }));
      const data = await response.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract || t('apps.youModerate.errors.noSummary');
      setCharacterSummaries(prevSummaries => {
        const newSummaries = { ...prevSummaries };
        newSummaries[index] = extract;
        return newSummaries;
      });
    } catch (error) {
      console.error("Errore fetchWikiSummary:", error);
      setCharacterSummaries(prevSummaries => {
        const newSummaries = { ...prevSummaries };
        newSummaries[index] = t('apps.youModerate.errors.summaryError');
        return newSummaries;
      });
    }
  };

  const handleCharacterSelect = (index: number, result: WikiSearchResult | null) => {
    const newSelectedCharacters = [...selectedCharacters];
    newSelectedCharacters[index] = result;
    setSelectedCharacters(newSelectedCharacters);

    if (result && result.title) {
      fetchWikiSummary(result.title, index); 
    } else {
      setCharacterSummaries(prevSummaries => {
        const newSummaries = { ...prevSummaries };
        delete newSummaries[index];
        return newSummaries;
      });
    }
  };
  
  const handleStartDialogue = () => {
    const errorMessage = t('apps.youModerate.errors.summaryError');
    if (selectedCharacters[0] && selectedCharacters[1] && characterSummaries[0] && characterSummaries[1] && theme.trim() && characterSummaries[0] !== errorMessage && characterSummaries[1] !== errorMessage) {
      setMessages([]);
      setCurrentPhase("chatting");
    }
  };

  const handleMessagesUpdate = useCallback((updatedMessagesFromChat: YouModerateMessage[]) => {
    // Map messages from YouModerateChat's local type to the global Message type
    const mappedMessages: Message[] = updatedMessagesFromChat.map(msg => {
      let role: "user" | "assistant" | "system" | "character" = "assistant"; // Default for character messages
      if (msg.role === "user") role = "user";
      else if (msg.role === "system") role = "system";
      // For 'character1' and 'character2', we map to 'assistant' and use characterName
      return {
        role: role,
        content: msg.content,
        characterName: (msg.role === "character1" || msg.role === "character2") ? msg.character : undefined,
        // id and timestamp can be added if needed by global Message type
      };
    });
    setMessages(mappedMessages);
  }, []);

  const handleEndChatInPage = useCallback(() => {
    setCurrentPhase("reflecting");
  }, []);

  const evaluateCurrentReflection = useCallback(async (reflection: string) => {
    if (!selectedCharacters[0] || !selectedCharacters[1] || !theme || messages.length === 0) {
      setAiEvaluation({
        textualFeedback: t('apps.youModerate.errors.insufficientData', {
          defaultValue:
            'Dati insufficienti per la valutazione (personaggi, tema o messaggi mancanti).',
        }),
      } as AIScoreEvaluation);
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
      setAiEvaluation({
        textualFeedback: t('apps.youModerate.errors.technicalReflection', {
          defaultValue:
            'Si è verificato un errore tecnico durante la valutazione della riflessione.',
        }),
      } as AIScoreEvaluation);
    } finally {
      setIsEvaluating(false);
      setCurrentPhase("feedback");
    }
  }, [selectedCharacters, theme, messages, t]);

  const handleSubmitReflection = useCallback(async (reflection: string) => {
    setUserReflection(reflection);
    setCurrentPhase("reflecting");
    await evaluateCurrentReflection(reflection);
  }, [evaluateCurrentReflection]);

  const handleStartNewDialogue = () => {
    setSelectedCharacters([null, null]);
    setCharacterSummaries({});
    setTheme("");
    setCurrentPhase("selecting");
    setUserReflection("");
    setAiEvaluation(null);
    setMessages([]);
  };

  const getChatCharactersDetails = (): [CharacterDetail, CharacterDetail] | null => {
    if (selectedCharacters[0] && selectedCharacters[1] && characterSummaries[0] && characterSummaries[1]) {
      // Ensure summaries are not error messages or null before proceeding
      const errorMessage = t('apps.youModerate.errors.summaryError');
      if (characterSummaries[0] === errorMessage || characterSummaries[1] === errorMessage || characterSummaries[0] === null || characterSummaries[1] === null) {
        return null;
      }
      return [
        {
          ...selectedCharacters[0],
          name: selectedCharacters[0].title,
          wikiTitle: selectedCharacters[0].title,
          bio: characterSummaries[0],
          dialogueStyle: t('apps.youModerate.characterStyles.erudite')
        },
        {
          ...selectedCharacters[1],
          name: selectedCharacters[1].title,
          wikiTitle: selectedCharacters[1].title,
          bio: characterSummaries[1],
          dialogueStyle: t('apps.youModerate.characterStyles.reflective')
        },
      ];
    }
    return null;
  };

  const isLoadingSummaries = Object.values(characterSummaries).some(summary => summary === null) && selectedCharacters.length > 0;

  return <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl text-education-light">
              {t('apps.youModerate.title')}
            </h1>
            <p className="mt-4 text-xl text-gray-300 max-w-2xl mx-auto">
              {t('apps.youModerate.description')}
            </p>
            <div className="mt-6">
              <Link to="/apps/you-moderate/tutorial">
                <Button
                  variant="outline"
                  className="inline-flex items-center space-x-2 border-education-light text-education-light hover:bg-education-light hover:text-gray-900"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t('common.viewTutorial', 'View Tutorial')}</span>
                </Button>
              </Link>
            </div>
          </div>
          
          {currentPhase === "selecting" && (
            <div className="max-w-3xl mx-auto">
              <Card className="bg-gray-800 border-gray-700 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-3xl text-education-light">{t('apps.youModerate.setup.buildDialogue')}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {t('apps.youModerate.setup.selectDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[0, 1].map(index => (
                    <div key={index} className="space-y-3 p-4 bg-gray-700/50 rounded-lg">
                      <label className="block text-lg font-medium text-education-lighter">
                        {t(`apps.youModerate.setup.character${index + 1}`)}
                      </label>
                      <WikiSearchSelect onSelect={result => handleCharacterSelect(index, result)} />
                      {selectedCharacters[index] && (
                        <div className="mt-3 p-3 bg-gray-800 rounded-md text-sm text-gray-300 border border-gray-600">
                          <h4 className="font-semibold text-education-lighter">{selectedCharacters[index]?.title}</h4>
                          <p className="text-xs italic truncate">{selectedCharacters[index]?.snippet.replace(/<\/?[^>]+(>|$)/g, "")}</p>
                          {characterSummaries[index] === null && <p className="text-xs text-yellow-400 mt-1">{t('apps.youModerate.setup.loadingSummary')}</p>}
                          {characterSummaries[index] === t('apps.youModerate.errors.summaryError') && <p className="text-xs text-red-400 mt-1">{characterSummaries[index]}</p>}
                          {characterSummaries[index] && characterSummaries[index] !== null && characterSummaries[index] !== t('apps.youModerate.errors.summaryError') && (
                            <p className="text-xs text-green-400 mt-1">{t('apps.youModerate.setup.summaryLoaded')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="space-y-3 p-4 bg-gray-700/50 rounded-lg">
                    <label className="block text-lg font-medium text-education-lighter">
                      {t('apps.youModerate.setup.themeLabel')}
                    </label>
                    <Input 
                        placeholder={t('apps.youModerate.setup.themePlaceholder')}
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
                    {t('apps.youModerate.setup.startButton')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {currentPhase === "chatting" && getChatCharactersDetails() && (
            <div className="max-w-5xl mx-auto">
              <YouModerateChat
                characters={getChatCharactersDetails()!} 
                theme={theme}
                onMessagesUpdate={handleMessagesUpdate}
                handleEndChat={handleEndChatInPage}
              />
            </div>
          )}

          {currentPhase === "reflecting" && (
            <YouModerateReflection onSubmit={handleSubmitReflection} />
          )}

          {currentPhase === "reflecting" && isEvaluating && (
            <div className="max-w-2xl mx-auto text-center py-10">
              <p className="text-2xl text-gray-300">
                {t('apps.youModerate.status.evaluating', {
                  defaultValue: 'Valutazione della riflessione in corso...',
                })}
              </p>
              {/* Consider adding a visual loader/spinner */}
            </div>
          )}

          {currentPhase === "feedback" && (
            <YouModerateFeedback
              userReflection={userReflection} 
              aiEvaluation={aiEvaluation?.textualFeedback || ""} 
              isLoading={isEvaluating}
              onStartNewChat={handleStartNewDialogue}
              messages={messages} // These are now global Message[]
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
export default YouModeratePage;

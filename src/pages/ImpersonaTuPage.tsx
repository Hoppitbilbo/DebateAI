
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import ImpersonaTuChat from "@/components/ImpersonaTuChat";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

const ImpersonaTuPage = () => {
  const { t } = useTranslation();
  const [aiCharacter, setAiCharacter] = useState<WikiSearchResult | null>(null);
  const [userCharacter, setUserCharacter] = useState<WikiSearchResult | null>(null);
  const [topic, setTopic] = useState("");
  const [showChat, setShowChat] = useState(false);

  const handleStartChat = () => {
    if (aiCharacter && userCharacter && topic) {
      setShowChat(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-education-light sm:text-4xl">
              {t('apps.impersonaTu.page.title')}
            </h1>
            <p className="mt-3 text-xl text-foreground">
              {t('apps.impersonaTu.page.subtitle')}
            </p>
            <div className="mt-6">
              <Link to="/apps/impersona-tu/tutorial">
                <Button variant="outline" className="border-education text-education hover:bg-education hover:text-white">
                  <BookOpen className="w-4 h-4 mr-2" />
                  {t('common.viewTutorial')}
                </Button>
              </Link>
            </div>
          </div>
          
          {!showChat ? (
            <div className="max-w-2xl mx-auto">
              <Card className="bg-card text-card-foreground">
                <CardHeader>
                  <CardTitle className="text-education-light">{t('apps.impersonaTu.page.setup.title')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('apps.impersonaTu.page.setup.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-education-light">
                        {t('apps.impersonaTu.page.setup.aiCharacterLabel')}
                      </label>
                      <WikiSearchSelect onSelect={setAiCharacter} />
                      {aiCharacter && (
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">{aiCharacter.title}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-education-light">
                        {t('apps.impersonaTu.page.setup.yourCharacterLabel')}
                      </label>
                      <WikiSearchSelect onSelect={setUserCharacter} />
                      {userCharacter && (
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">{userCharacter.title}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-education-light">
                        {t('apps.impersonaTu.page.setup.topicLabel')}
                      </label>
                      <Input
                        placeholder={t('apps.impersonaTu.page.setup.topicPlaceholder')}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      />
                    </div>

                    <Button 
                      onClick={handleStartChat}
                      disabled={!aiCharacter || !userCharacter || !topic.trim()}
                      className="w-full bg-education hover:bg-education-dark"
                    >
                      {t('apps.impersonaTu.page.setup.startConversationButton')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-education-light">
                  {t('apps.impersonaTu.page.chat.conversationTitle', { user: userCharacter?.title, ai: aiCharacter?.title })}
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => setShowChat(false)}
                  className="border-education text-education hover:bg-education hover:text-white"
                >
                  {t('apps.impersonaTu.page.chat.changeCharacters')}
                </Button>
              </div>
              <ImpersonaTuChat
                aiCharacter={{
                  name: aiCharacter?.title || "",
                  bio: aiCharacter?.snippet || "",
                }}
                userCharacter={{
                  name: userCharacter?.title || "",
                  bio: userCharacter?.snippet || "",
                }}
                topic={topic}
              />
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ImpersonaTuPage;

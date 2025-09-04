import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, MessageSquare, User, Bot } from 'lucide-react';
import { Message } from '@/types/conversation';
import MarkdownViewer from './MarkdownViewer';

interface FeedbackInterfaceProps {
  userReflection: string;
  aiEvaluation: string | null;
  isLoading?: boolean;
  onStartNewChat: () => void;
  messages?: Message[];
  characterName?: string;
  topic?: string;
  gameResult?: {
    correctGuess?: boolean;
    finalGuess?: string;
    score?: number;
  };
  className?: string;
}

const FeedbackInterface: React.FC<FeedbackInterfaceProps> = ({
  userReflection,
  aiEvaluation,
  isLoading = false,
  onStartNewChat,
  messages = [],
  characterName,
  topic,
  gameResult,
  className = ''
}) => {
  const { t } = useTranslation();
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-education/10 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-education" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-education-dark mb-2">
            {t('common.activityFeedback.title', { defaultValue: "Feedback dell'Attività" })}
          </h2>
          <p className="text-education-muted">
            {t('common.activityFeedback.subtitle', { defaultValue: 'Ecco il riepilogo della tua esperienza e il feedback dell\'IA' })}
          </p>
        </div>
      </Card>

      {/* Activity Summary */}
      {(characterName || topic || gameResult) && (
        <Card className="p-6 bg-education/5 border-education/20">
          <h3 className="font-semibold text-education-dark mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-education" />
            {t('common.activitySummary', { defaultValue: "Riepilogo Attività" })}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {characterName && (
              <div>
                <span className="font-medium text-education-dark">{t('common.character', { defaultValue: 'Personaggio:' })}</span>
                <p className="font-semibold">{t('common.you', { defaultValue: 'Tu' })}</p>
              </div>
            )}
            {topic && (
              <div>
                <span className="font-medium text-education-dark">{t('common.topic', { defaultValue: 'Argomento:' })}</span>
                <p className="text-education-muted">{topic}</p>
              </div>
            )}
            {gameResult?.finalGuess && (
              <div>
                <span className="font-medium text-education-dark">{t('common.yourAnswer', { defaultValue: 'La tua risposta:' })}</span>
                <p className="text-education-muted">{gameResult.finalGuess}</p>
              </div>
            )}
            {gameResult?.correctGuess !== undefined && (
              <div>
                <span className="font-medium text-education-dark">{t('common.result', { defaultValue: 'Risultato:' })}</span>
                <Badge variant={gameResult.correctGuess ? "default" : "secondary"} className="ml-2">
                  {gameResult.correctGuess ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('common.correctShort', { defaultValue: 'Corretto' })}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('common.incorrect', { defaultValue: 'Non corretto' })}
                    </>
                  )}
                </Badge>
              </div>
            )}
            {messages.length > 0 && (
              <div>
                <span className="font-medium text-education-dark">{t('common.messagesExchanged', { defaultValue: 'Messaggi scambiati:' })}</span>
                <p className="text-education-muted">{messages.length}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* User Reflection */}
      <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
        <h3 className="font-semibold text-education-dark mb-4 flex items-center">
          <User className="h-5 w-5 mr-2 text-education" />
          {t('feedback.yourReflection', { defaultValue: 'La Tua Riflessione' })}
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-gray-700 whitespace-pre-wrap">{userReflection}</p>
        </div>
      </Card>

      {/* AI Evaluation */}
      <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
        <h3 className="font-semibold text-education-dark mb-4 flex items-center">
          <Bot className="h-5 w-5 mr-2 text-education" />
          {t('common.aiFeedback.title', { defaultValue: "Feedback dell'IA" })}
        </h3>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-education border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-education-muted">{t('common.aiFeedback.generating', { defaultValue: 'Generazione del feedback in corso...' })}</p>
            </div>
          </div>
        ) : aiEvaluation ? (
          <div className="bg-education/5 rounded-lg p-4 border border-education/20">
            <MarkdownViewer content={aiEvaluation} />
          </div>
        ) : (
          <div className="text-center py-8 text-education-muted">
            <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{t('common.aiFeedback.empty', { defaultValue: 'Nessun feedback disponibile al momento.' })}</p>
          </div>
        )}
      </Card>

      {/* Conversation History (if available) */}
      {messages.length > 0 && (
        <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
          <h3 className="font-semibold text-education-dark mb-4">
            {t('common.conversationHistory', { defaultValue: 'Cronologia Conversazione' })}
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-3 bg-gray-50 rounded-lg p-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-education text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-80">
                    {message.role === 'user' ? t('common.you', { defaultValue: 'Tu' }) : (message.characterName || 'AI')}
                  </p>
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <MarkdownViewer content={message.content} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
        <div className="text-center">
                    <Button onClick={onStartNewChat} className="w-full bg-education hover:bg-education-dark">{t('common.startNewReflection')}</Button>
        </div>
      </Card>
    </div>
  );
};

export default FeedbackInterface;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lightbulb, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { generateInquiryDialogueQuestions } from "@/services/aiService";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface InquiryDialogueQuestionSuggestionsProps {
  character1Name: string;
  character2Name: string;
  onQuestionSelect: (question: string) => void;
  className?: string;
}

export default function InquiryDialogueQuestionSuggestions({
  character1Name,
  character2Name,
  onQuestionSelect,
  className
}: InquiryDialogueQuestionSuggestionsProps) {
  const { t, i18n } = useTranslation();
  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerateQuestions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedQuestions = await generateInquiryDialogueQuestions(
        character1Name,
        character2Name,
        i18n.language
      );
      
      if (generatedQuestions.length === 0) {
        setError(t('apps.inquiryDialogue.setup.questionGenerationError'));
      } else {
        setQuestions(generatedQuestions);
        setIsExpanded(true);
      }
    } catch (err) {
      console.error('Error generating questions:', err);
      setError(t('apps.inquiryDialogue.setup.questionGenerationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionClick = (question: string) => {
    onQuestionSelect(question);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={cn("space-y-4", className)}>
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-amber-500/30 shadow-lg shadow-amber-500/10">
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          {t('inquiryDialogue.suggestedQuestions')}
        </CardTitle>
        <CardDescription>
          {t('inquiryDialogue.generateQuestions')}
        </CardDescription>
      </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {questions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuestionClick(question)}
                  className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm text-gray-200 hover:text-white border border-gray-600 hover:border-education-light"
                >
                  {question}
                </button>
              ))}
            </div>
          </CardContent>
        )}
        
        <CardContent className={isExpanded ? "pt-0" : ""}>
          <div className="flex flex-col gap-3">
            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded border border-red-800">
                {error}
              </div>
            )}
            
            <Button
              onClick={handleGenerateQuestions}
              disabled={isLoading}
              variant="outline"
            size="sm"
            className="w-full border-amber-200 text-amber-200 hover:bg-amber-200 hover:text-gray-900"
          >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('apps.inquiryDialogue.setup.generatingQuestions')}
                </>
              ) : (
                t('apps.inquiryDialogue.setup.generateQuestions')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
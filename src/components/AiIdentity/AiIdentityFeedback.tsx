import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AiIdentityFeedbackProps {
  onPositive: () => void;
  onNegative: () => void;
  onReset: () => void;
}

const AiIdentityFeedback = ({ onPositive, onNegative, onReset }: AiIdentityFeedbackProps) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6 bg-white/90 backdrop-blur-sm">
      <div className="text-center space-y-4">
        <h3 className="text-xl font-bold text-education-dark">
          {t('apps.aiIdentity.feedbackTitle')}
        </h3>
        <p className="text-gray-600">
          {t('apps.aiIdentity.feedbackDescription')}
        </p>
        
        <div className="flex justify-center gap-4">
          <Button
            onClick={onPositive}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600"
          >
            <ThumbsUp className="h-4 w-4" />
            {t('feedback.positive')}
          </Button>
          
          <Button
            onClick={onNegative}
            variant="outline"
            className="flex items-center gap-2 border-red-500 text-red-500 hover:bg-red-50"
          >
            <ThumbsDown className="h-4 w-4" />
            {t('feedback.negative')}
          </Button>
        </div>
        
        <div className="pt-4 border-t">
          <Button
            onClick={onReset}
            variant="ghost"
            className="flex items-center gap-2 mx-auto"
          >
            <RotateCcw className="h-4 w-4" />
            {t('apps.aiIdentity.tryAgain')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AiIdentityFeedback;
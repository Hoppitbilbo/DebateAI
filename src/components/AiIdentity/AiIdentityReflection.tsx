import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface AiIdentityReflectionProps {
  onSubmit: (reflection: string) => void;
  onReset: () => void;
}

const AiIdentityReflection = ({ onSubmit, onReset }: AiIdentityReflectionProps) => {
  const { t } = useTranslation();
  const [reflection, setReflection] = useState("");

  const handleSubmit = () => {
    if (reflection.trim()) {
      onSubmit(reflection.trim());
    }
  };

  return (
    <Card className="p-6 bg-white/90 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Brain className="h-12 w-12 text-education" />
          </div>
          <h3 className="text-xl font-bold text-education-dark mb-2">
            {t('apps.aiIdentity.reflectionTitle')}
          </h3>
          <p className="text-gray-600 mb-4">
            {t('apps.aiIdentity.reflectionDescription')}
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('reflection.yourThoughts')}
          </label>
          <Textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={t('apps.aiIdentity.reflectionPlaceholder')}
            className="min-h-[150px] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={!reflection.trim()}
            className="flex-1"
          >
            {t('reflection.submit')}
          </Button>
          
          <Button
            onClick={onReset}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t('common.startOver')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AiIdentityReflection;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

export interface SelfReflectionProps {
  title?: string;
  description?: string;
  questions: string[];
  onSubmit: (reflection: string) => void;
  className?: string;
  placeholder?: string;
  minLength?: number;
  submitButtonText?: string;
}

export const SelfReflection: React.FC<SelfReflectionProps> = ({
  title,
  description,
  questions = [],
  onSubmit,
  placeholder,
  minLength = 50,
  submitButtonText,
  className = "",
}) => {
  const { t } = useTranslation();
  const [reflection, setReflection] = useState("");

  const handleSubmit = () => {
    if (reflection.trim()) {
      onSubmit(reflection);
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <CardTitle className="text-2xl font-bold text-education">{title || t('common.reflection')}</CardTitle>
      <p className="text-gray-600 mt-2">{description || t('common.reflectOnExperience')}</p>
      
      {/* Reverted text color for questions back to text-education */}
      <ul className="list-disc pl-5 mb-6 space-y-2 text-education">
        {questions.map((question, index) => (
          <li key={index} className="text-education">{question}</li>
        ))}
      </ul>
      
      <Textarea 
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder={placeholder || t('common.reflectionPlaceholder')}
        className="min-h-[200px] mb-4"
      />
      
      <Button 
        onClick={handleSubmit}
        disabled={!reflection.trim()}
        className="w-full bg-education hover:bg-education-dark"
      >
        {submitButtonText || t('common.submitReflection')}
      </Button>
    </Card>
  );
};

export default SelfReflection;

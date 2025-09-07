/**
 * @file A component to guide users through a self-reflection process with a list of questions.
 * @remarks This component presents a set of questions to the user and provides a textarea for them
 * to write and submit their reflection.
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

/**
 * @interface SelfReflectionProps
 * @description Defines the props for the SelfReflection component.
 * @property {string} [title] - The title of the reflection card.
 * @property {string} [description] - A description or instructions for the reflection.
 * @property {string[]} questions - An array of questions to guide the user's reflection.
 * @property {(reflection: string) => void} onSubmit - Callback function triggered when the user submits their reflection.
 * @property {string} [className] - Optional additional CSS classes for the root element.
 * @property {string} [placeholder] - Optional placeholder text for the textarea.
 * @property {number} [minLength] - The minimum required length for the reflection (not currently enforced in this component).
 * @property {string} [submitButtonText] - Optional custom text for the submit button.
 */
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

/**
 * @function SelfReflection
 * @description A reusable component that provides a structured format for self-reflection,
 * including a list of guiding questions and a text area for the user's response.
 * @param {SelfReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection component.
 */
export const SelfReflection: React.FC<SelfReflectionProps> = ({
  title,
  description,
  questions = [],
  onSubmit,
  placeholder,
  submitButtonText,
  className = "",
}) => {
  const { t } = useTranslation();
  const [reflection, setReflection] = useState("");

  /**
   * @function handleSubmit
   * @description Calls the onSubmit callback with the trimmed reflection text if it's not empty.
   */
  const handleSubmit = () => {
    if (reflection.trim()) {
      onSubmit(reflection);
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <h2 className="text-2xl font-bold text-education">{title || t('common.reflection')}</h2>
      <p className="text-gray-600 mt-2">{description || t('common.reflectOnExperience')}</p>
      
      <ul className="list-disc pl-5 mb-6 space-y-2 text-education mt-4">
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

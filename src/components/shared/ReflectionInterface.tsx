/**
 * @file A generic component for guiding users through a self-reflection process.
 * @remarks This component provides a structured interface with a title, description, and a text area
 * for users to write their reflections. It includes a character counter and a minimum length requirement.
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookOpen, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * @interface ReflectionInterfaceProps
 * @description Defines the props for the ReflectionInterface component.
 * @property {string} [title] - Optional title for the reflection card.
 * @property {string} [description] - Optional description or instructions for the reflection.
 * @property {(reflection: string) => void} onSubmit - Callback function triggered when the user submits a valid reflection.
 * @property {string} [placeholder] - Optional placeholder text for the textarea.
 * @property {number} [minLength=50] - The minimum number of characters required for the reflection.
 * @property {string} [characterName] - Optional name of a character, for personalizing prompts.
 * @property {object} [gameResult] - Optional object containing the results of a game to be displayed as context.
 * @property {boolean} [gameResult.correctGuess] - Whether the user's guess was correct.
 * @property {string} [gameResult.finalGuess] - The user's final guess.
 * @property {string} [className] - Optional additional CSS classes for the root element.
 */
interface ReflectionInterfaceProps {
  title?: string;
  description?: string;
  onSubmit: (reflection: string) => void;
  placeholder?: string;
  minLength?: number;
  characterName?: string;
  gameResult?: {
    correctGuess?: boolean;
    finalGuess?: string;
  };
  className?: string;
}

/**
 * @function ReflectionInterface
 * @description A reusable UI component that provides a form for users to write and submit their reflections.
 * It validates the input length and provides feedback to the user.
 * @param {ReflectionInterfaceProps} props - The props for the component.
 * @returns {JSX.Element} The rendered reflection interface.
 */
const ReflectionInterface: React.FC<ReflectionInterfaceProps> = ({
  title,
  description,
  onSubmit,
  placeholder,
  minLength = 50,
  characterName,
  gameResult,
  className = ''
}) => {
  const [reflection, setReflection] = useState('');
  const { t } = useTranslation();

  /**
   * @function handleSubmit
   * @description Validates the reflection length and calls the `onSubmit` callback if valid.
   */
  const handleSubmit = () => {
    if (reflection.trim().length >= minLength) {
      onSubmit(reflection.trim());
    }
  };

  const isValid = reflection.trim().length >= minLength;

  return (
    <Card className={`p-6 bg-white/90 backdrop-blur-sm border-education/20 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-education/10 rounded-full mb-4">
            <BookOpen className="h-8 w-8 text-education" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-education-dark mb-2">
            {title || t('common.reflection.title')}
          </h2>
          <p className="text-education-muted">
            {description || t('common.reflection.description')}
          </p>
        </div>

        {/* Game Result Summary (if applicable) */}
        {gameResult && (
          <Card className="p-4 bg-education/5 border-education/20">
            <h3 className="font-semibold text-education-dark mb-2">
              {t('common.activitySummary')}
            </h3>
            <div className="space-y-1 text-sm text-gray-800">
              {characterName && (
                <p><span className="font-medium">{t('common.character')}</span> {characterName}</p>
              )}
              {gameResult.finalGuess && (
                <p><span className="font-medium">{t('common.yourAnswer')}</span> {gameResult.finalGuess}</p>
              )}
              {gameResult.correctGuess !== undefined && (
                <p>
                  <span className="font-medium">{t('common.result')}</span>{' '}
                  <span className={gameResult.correctGuess ? 'text-green-600' : 'text-red-600'}>
                    {gameResult.correctGuess
                      ? t('common.correct')
                      : t('common.incorrect')}
                  </span>
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Reflection Form */}
        <div className="space-y-4">
          <Label htmlFor="reflection" className="text-base font-medium text-education-dark">
            {t('common.reflection.prompt', { characterName })}
          </Label>
          <Textarea
            id="reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={placeholder || t('common.reflection.placeholder')}
            className="min-h-[200px] border-education/30 focus:border-education focus:ring-education/20 resize-none"
          />
          <div className="flex justify-between items-center text-sm">
            <span className={`${
              isValid ? 'text-green-600' : 'text-education-muted'
            }`}>
              {t('common.reflection.counter', { count: reflection.length, min: minLength })}
            </span>
            {!isValid && reflection.length > 0 && (
              <span className="text-amber-600">
                {t('common.reflection.remaining', { remaining: minLength - reflection.length })}
              </span>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-education hover:bg-education-dark text-white disabled:opacity-50"
          size="lg"
        >
          <Send className="mr-2 h-4 w-4" />
          {t('common.reflection.submit')}
        </Button>
      </div>
    </Card>
  );
};

export default ReflectionInterface;

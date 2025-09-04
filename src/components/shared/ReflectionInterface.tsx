import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookOpen, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

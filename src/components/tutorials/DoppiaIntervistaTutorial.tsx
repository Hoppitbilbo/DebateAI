import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Users, MessageCircle, Eye, Brain, Lightbulb, Target, BookOpen } from 'lucide-react';

interface Slide {
  id: string;
  titleKey: string;
  contentKey: string;
  icon: React.ReactNode;
  bullets?: string[];
}

const DoppiaIntervistaTutorial: React.FC = () => {
  const { t } = useTranslation('tutorials');
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 'welcome',
      titleKey: 'doppiaIntervista.slides.welcome.title',
      contentKey: 'doppiaIntervista.slides.welcome.content',
      icon: <Play className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.welcome.bullet1',
        'doppiaIntervista.slides.welcome.bullet2',
        'doppiaIntervista.slides.welcome.bullet3',
        'doppiaIntervista.slides.welcome.bullet4'
      ]
    },
    {
      id: 'characterComparison',
      titleKey: 'doppiaIntervista.slides.characterComparison.title',
      contentKey: 'doppiaIntervista.slides.characterComparison.content',
      icon: <MessageCircle className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.characterComparison.bullet1',
        'doppiaIntervista.slides.characterComparison.bullet2',
        'doppiaIntervista.slides.characterComparison.bullet3',
        'doppiaIntervista.slides.characterComparison.bullet4'
      ]
    },
    {
      id: 'strategicQuestioning',
      titleKey: 'doppiaIntervista.slides.strategicQuestioning.title',
      contentKey: 'doppiaIntervista.slides.strategicQuestioning.content',
      icon: <Target className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.strategicQuestioning.bullet1',
        'doppiaIntervista.slides.strategicQuestioning.bullet2',
        'doppiaIntervista.slides.strategicQuestioning.bullet3',
        'doppiaIntervista.slides.strategicQuestioning.bullet4'
      ]
    },
    {
      id: 'collaborativeAnalysis',
      titleKey: 'doppiaIntervista.slides.collaborativeAnalysis.title',
      contentKey: 'doppiaIntervista.slides.collaborativeAnalysis.content',
      icon: <Users className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.collaborativeAnalysis.bullet1',
        'doppiaIntervista.slides.collaborativeAnalysis.bullet2',
        'doppiaIntervista.slides.collaborativeAnalysis.bullet3',
        'doppiaIntervista.slides.collaborativeAnalysis.bullet4'
      ]
    },
    {
      id: 'criticalThinking',
      titleKey: 'doppiaIntervista.slides.criticalThinking.title',
      contentKey: 'doppiaIntervista.slides.criticalThinking.content',
      icon: <Brain className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.criticalThinking.bullet1',
        'doppiaIntervista.slides.criticalThinking.bullet2',
        'doppiaIntervista.slides.criticalThinking.bullet3',
        'doppiaIntervista.slides.criticalThinking.bullet4'
      ]
    },
    {
      id: 'selfEvaluation',
      titleKey: 'doppiaIntervista.slides.selfEvaluation.title',
      contentKey: 'doppiaIntervista.slides.selfEvaluation.content',
      icon: <Eye className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.selfEvaluation.bullet1',
        'doppiaIntervista.slides.selfEvaluation.bullet2',
        'doppiaIntervista.slides.selfEvaluation.bullet3',
        'doppiaIntervista.slides.selfEvaluation.bullet4'
      ]
    },
    {
      id: 'reflection',
      titleKey: 'doppiaIntervista.slides.reflection.title',
      contentKey: 'doppiaIntervista.slides.reflection.content',
      icon: <Lightbulb className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.reflection.bullet1',
        'doppiaIntervista.slides.reflection.bullet2',
        'doppiaIntervista.slides.reflection.bullet3',
        'doppiaIntervista.slides.reflection.bullet4'
      ]
    },
    {
      id: 'examples',
      titleKey: 'doppiaIntervista.slides.examples.title',
      contentKey: 'doppiaIntervista.slides.examples.content',
      icon: <BookOpen className="w-8 h-8 text-education" />,
      bullets: [
        'doppiaIntervista.slides.examples.bullet1',
        'doppiaIntervista.slides.examples.bullet2',
        'doppiaIntervista.slides.examples.bullet3',
        'doppiaIntervista.slides.examples.bullet4'
      ]
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-education-dark mb-2">
          {t('doppiaIntervista.title')}
        </h1>
        <p className="text-lg text-education-muted">
          {t('doppiaIntervista.subtitle')}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex justify-center mb-6">
        <div className="flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentSlide
                  ? 'bg-education'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Slide */}
      <Card className="bg-white/95 backdrop-blur-sm border-education/20 shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              {currentSlideData.icon}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-education-dark mb-4">
                {t(currentSlideData.titleKey)}
              </h2>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                {t(currentSlideData.contentKey)}
              </p>
              
              {currentSlideData.bullets && (
                <ul className="space-y-3">
                  {currentSlideData.bullets.map((bulletKey, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-education rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{t(bulletKey)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          onClick={prevSlide}
          variant="outline"
          disabled={currentSlide === 0}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('common.back')}</span>
        </Button>

        <span className="text-sm text-gray-500">
          {currentSlide + 1} / {slides.length}
        </span>

        <Button
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className="flex items-center space-x-2 bg-education hover:bg-education-dark"
        >
          <span>{t('common.next')}</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Start Button */}
      {currentSlide === slides.length - 1 && (
        <div className="text-center pt-6">
          <Button
            size="lg"
            className="bg-education hover:bg-education-dark text-white px-8 py-3"
            onClick={() => window.location.href = '/apps/doppia-intervista'}
          >
            {t('doppiaIntervista.startApp')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DoppiaIntervistaTutorial;

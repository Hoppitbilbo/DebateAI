import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Users, Lightbulb, BookOpen, Target, MessageSquare, Brain, Eye } from 'lucide-react';

interface Slide {
  id: string;
  titleKey: string;
  contentKey: string;
  icon: React.ReactNode;
  bullets?: string[];
}

const ConvinciTuTutorial: React.FC = () => {
  const { t } = useTranslation('tutorial');
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 'welcome',
      titleKey: 'convinciTu.slides.welcome.title',
      contentKey: 'convinciTu.slides.welcome.content',
      icon: <Play className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.welcome.bullet1',
        'convinciTu.slides.welcome.bullet2',
        'convinciTu.slides.welcome.bullet3',
        'convinciTu.slides.welcome.bullet4'
      ]
    },
    {
      id: 'howItWorks',
      titleKey: 'convinciTu.slides.howItWorks.title',
      contentKey: 'convinciTu.slides.howItWorks.content',
      icon: <Target className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.howItWorks.bullet1',
        'convinciTu.slides.howItWorks.bullet2',
        'convinciTu.slides.howItWorks.bullet3',
        'convinciTu.slides.howItWorks.bullet4'
      ]
    },
    {
      id: 'debatePreparation',
      titleKey: 'convinciTu.slides.debatePreparation.title',
      contentKey: 'convinciTu.slides.debatePreparation.content',
      icon: <Brain className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.debatePreparation.bullet1',
        'convinciTu.slides.debatePreparation.bullet2',
        'convinciTu.slides.debatePreparation.bullet3',
        'convinciTu.slides.debatePreparation.bullet4'
      ]
    },
    {
      id: 'collaborativeLearning',
      titleKey: 'convinciTu.slides.collaborativeLearning.title',
      contentKey: 'convinciTu.slides.collaborativeLearning.content',
      icon: <Users className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.collaborativeLearning.bullet1',
        'convinciTu.slides.collaborativeLearning.bullet2',
        'convinciTu.slides.collaborativeLearning.bullet3',
        'convinciTu.slides.collaborativeLearning.bullet4'
      ]
    },
    {
      id: 'visibleThinking',
      titleKey: 'convinciTu.slides.visibleThinking.title',
      contentKey: 'convinciTu.slides.visibleThinking.content',
      icon: <Eye className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.visibleThinking.bullet1',
        'convinciTu.slides.visibleThinking.bullet2',
        'convinciTu.slides.visibleThinking.bullet3',
        'convinciTu.slides.visibleThinking.bullet4'
      ]
    },
    {
      id: 'teacherEvaluation',
      titleKey: 'convinciTu.slides.teacherEvaluation.title',
      contentKey: 'convinciTu.slides.teacherEvaluation.content',
      icon: <BookOpen className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.teacherEvaluation.bullet1',
        'convinciTu.slides.teacherEvaluation.bullet2',
        'convinciTu.slides.teacherEvaluation.bullet3',
        'convinciTu.slides.teacherEvaluation.bullet4'
      ]
    },
    {
      id: 'selfReflection',
      titleKey: 'convinciTu.slides.selfReflection.title',
      contentKey: 'convinciTu.slides.selfReflection.content',
      icon: <Lightbulb className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.selfReflection.bullet1',
        'convinciTu.slides.selfReflection.bullet2',
        'convinciTu.slides.selfReflection.bullet3',
        'convinciTu.slides.selfReflection.bullet4'
      ]
    },
    {
      id: 'examples',
      titleKey: 'convinciTu.slides.examples.title',
      contentKey: 'convinciTu.slides.examples.content',
      icon: <MessageSquare className="w-8 h-8 text-education" />,
      bullets: [
        'convinciTu.slides.examples.bullet1',
        'convinciTu.slides.examples.bullet2',
        'convinciTu.slides.examples.bullet3',
        'convinciTu.slides.examples.bullet4'
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
          {t('convinciTu.title')}
        </h1>
        <p className="text-lg text-education-muted">
          {t('convinciTu.subtitle')}
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
            onClick={() => window.location.href = '/apps/convinci-tu'}
          >
            {t('convinciTu.startApp')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConvinciTuTutorial;

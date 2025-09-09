import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Users, Lightbulb, BookOpen, Target, MessageSquare, Search } from 'lucide-react';

interface Slide {
  id: string;
  titleKey: string;
  contentKey: string;
  icon: React.ReactNode;
  image?: string;
  bullets?: string[];
}

const PersonaggioMisteriosoTutorial: React.FC = () => {
  const { t } = useTranslation('tutorial');
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 'welcome',
      titleKey: 'personaggioMisterioso.slides.welcome.title',
      contentKey: 'personaggioMisterioso.slides.welcome.content',
      icon: <Play className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.welcome.bullet1',
        'personaggioMisterioso.slides.welcome.bullet2',
        'personaggioMisterioso.slides.welcome.bullet3'
      ]
    },
    {
      id: 'howItWorks',
      titleKey: 'personaggioMisterioso.slides.howItWorks.title',
      contentKey: 'personaggioMisterioso.slides.howItWorks.content',
      icon: <Target className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.howItWorks.bullet1',
        'personaggioMisterioso.slides.howItWorks.bullet2',
        'personaggioMisterioso.slides.howItWorks.bullet3',
        'personaggioMisterioso.slides.howItWorks.bullet4'
      ]
    },
    {
      id: 'selectCharacter',
      titleKey: 'personaggioMisterioso.slides.selectCharacter.title',
      contentKey: 'personaggioMisterioso.slides.selectCharacter.content',
      icon: <Search className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.selectCharacter.bullet1',
        'personaggioMisterioso.slides.selectCharacter.bullet2',
        'personaggioMisterioso.slides.selectCharacter.bullet3'
      ]
    },
    {
      id: 'askQuestions',
      titleKey: 'personaggioMisterioso.slides.askQuestions.title',
      contentKey: 'personaggioMisterioso.slides.askQuestions.content',
      icon: <MessageSquare className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.askQuestions.bullet1',
        'personaggioMisterioso.slides.askQuestions.bullet2',
        'personaggioMisterioso.slides.askQuestions.bullet3',
        'personaggioMisterioso.slides.askQuestions.bullet4'
      ]
    },
    {
      id: 'technology',
      titleKey: 'personaggioMisterioso.slides.technology.title',
      contentKey: 'personaggioMisterioso.slides.technology.content',
      icon: <Lightbulb className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.technology.bullet1',
        'personaggioMisterioso.slides.technology.bullet2',
        'personaggioMisterioso.slides.technology.bullet3',
        'personaggioMisterioso.slides.technology.bullet4'
      ]
    },
    {
      id: 'classroomUse',
      titleKey: 'personaggioMisterioso.slides.classroomUse.title',
      contentKey: 'personaggioMisterioso.slides.classroomUse.content',
      icon: <Users className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.classroomUse.bullet1',
        'personaggioMisterioso.slides.classroomUse.bullet2',
        'personaggioMisterioso.slides.classroomUse.bullet3',
        'personaggioMisterioso.slides.classroomUse.bullet4'
      ]
    },
    {
      id: 'examples',
      titleKey: 'personaggioMisterioso.slides.examples.title',
      contentKey: 'personaggioMisterioso.slides.examples.content',
      icon: <BookOpen className="w-8 h-8 text-education" />,
      bullets: [
        'personaggioMisterioso.slides.examples.bullet1',
        'personaggioMisterioso.slides.examples.bullet2',
        'personaggioMisterioso.slides.examples.bullet3',
        'personaggioMisterioso.slides.examples.bullet4'
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
          {t('personaggioMisterioso.title')}
        </h1>
        <p className="text-lg text-education-muted">
          {t('personaggioMisterioso.subtitle')}
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
            onClick={() => window.location.href = '/apps/personaggio-misterioso'}
          >
            {t('personaggioMisterioso.startApp')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PersonaggioMisteriosoTutorial;

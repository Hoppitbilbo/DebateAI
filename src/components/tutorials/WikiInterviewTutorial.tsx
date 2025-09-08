import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Users, MessageCircle, Target, Lightbulb, BookOpen, CheckCircle, Zap } from 'lucide-react';

interface Slide {
  id: string;
  titleKey: string;
  contentKey: string;
  icon: React.ReactNode;
  image?: string;
  bullets?: string[];
}

const WikiInterviewTutorial: React.FC = () => {
  const { t } = useTranslation('tutorials');
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 'welcome',
      titleKey: 'wikiInterview.slides.welcome.title',
      contentKey: 'wikiInterview.slides.welcome.content',
      icon: <Play className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.welcome.bullet1',
        'wikiInterview.slides.welcome.bullet2',
        'wikiInterview.slides.welcome.bullet3'
      ]
    },
    {
      id: 'moderatorRole',
      titleKey: 'wikiInterview.slides.moderatorRole.title',
      contentKey: 'wikiInterview.slides.moderatorRole.content',
      icon: <Users className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.moderatorRole.bullet1',
        'wikiInterview.slides.moderatorRole.bullet2',
        'wikiInterview.slides.moderatorRole.bullet3',
        'wikiInterview.slides.moderatorRole.bullet4'
      ]
    },
    {
      id: 'peerCollaboration',
      titleKey: 'wikiInterview.slides.peerCollaboration.title',
      contentKey: 'wikiInterview.slides.peerCollaboration.content',
      icon: <MessageCircle className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.peerCollaboration.bullet1',
        'wikiInterview.slides.peerCollaboration.bullet2',
        'wikiInterview.slides.peerCollaboration.bullet3',
        'wikiInterview.slides.peerCollaboration.bullet4'
      ]
    },
    {
      id: 'setupDebate',
      titleKey: 'wikiInterview.slides.setupDebate.title',
      contentKey: 'wikiInterview.slides.setupDebate.content',
      icon: <Target className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.setupDebate.bullet1',
        'wikiInterview.slides.setupDebate.bullet2',
        'wikiInterview.slides.setupDebate.bullet3',
        'wikiInterview.slides.setupDebate.bullet4'
      ]
    },
    {
      id: 'moderationSkills',
      titleKey: 'wikiInterview.slides.moderationSkills.title',
      contentKey: 'wikiInterview.slides.moderationSkills.content',
      icon: <Lightbulb className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.moderationSkills.bullet1',
        'wikiInterview.slides.moderationSkills.bullet2',
        'wikiInterview.slides.moderationSkills.bullet3',
        'wikiInterview.slides.moderationSkills.bullet4'
      ]
    },
    {
      id: 'criticalThinking',
      titleKey: 'wikiInterview.slides.criticalThinking.title',
      contentKey: 'wikiInterview.slides.criticalThinking.content',
      icon: <Zap className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.criticalThinking.bullet1',
        'wikiInterview.slides.criticalThinking.bullet2',
        'wikiInterview.slides.criticalThinking.bullet3',
        'wikiInterview.slides.criticalThinking.bullet4'
      ]
    },
    {
      id: 'reflection',
      titleKey: 'wikiInterview.slides.reflection.title',
      contentKey: 'wikiInterview.slides.reflection.content',
      icon: <CheckCircle className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.reflection.bullet1',
        'wikiInterview.slides.reflection.bullet2',
        'wikiInterview.slides.reflection.bullet3',
        'wikiInterview.slides.reflection.bullet4'
      ]
    },
    {
      id: 'applications',
      titleKey: 'wikiInterview.slides.applications.title',
      contentKey: 'wikiInterview.slides.applications.content',
      icon: <BookOpen className="w-8 h-8 text-education" />,
      bullets: [
        'wikiInterview.slides.applications.bullet1',
        'wikiInterview.slides.applications.bullet2',
        'wikiInterview.slides.applications.bullet3',
        'wikiInterview.slides.applications.bullet4'
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
          {t('wikiInterview.title')}
        </h1>
        <p className="text-lg text-education-muted">
          {t('wikiInterview.subtitle')}
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
            onClick={() => window.location.href = '/apps/wiki-interview'}
          >
            {t('wikiInterview.startApp')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default WikiInterviewTutorial;

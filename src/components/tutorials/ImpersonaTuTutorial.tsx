import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Play, Users, Brain, MessageSquare, Eye, BookOpen, Target, Lightbulb, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ImpersonaTuTutorial = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const totalSlides = 8;
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const startApp = () => {
    navigate('/apps/impersona-tu');
  };

  const getSlideIcon = (slideIndex: number) => {
    const icons = [Users, Brain, MessageSquare, Eye, BookOpen, Target, Lightbulb, CheckCircle];
    const IconComponent = icons[slideIndex];
    return <IconComponent className="w-8 h-8 text-education mb-4" />;
  };

  const renderSlideContent = () => {
    const slideKey = `tutorials.impersonaTu.slides.${getSlideKeys()[currentSlide]}`;
    
    return (
      <div className="text-center space-y-6">
        {getSlideIcon(currentSlide)}
        <h2 className="text-2xl font-bold text-education-dark">
          {t(`${slideKey}.title`)}
        </h2>
        <p className="text-lg text-gray-700 leading-relaxed">
          {t(`${slideKey}.content`)}
        </p>
        <div className="space-y-3 text-left max-w-2xl mx-auto">
          <div className="flex items-start space-x-3">
            <span className="text-education text-lg">•</span>
            <span className="text-gray-700">{t(`${slideKey}.bullet1`)}</span>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-education text-lg">•</span>
            <span className="text-gray-700">{t(`${slideKey}.bullet2`)}</span>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-education text-lg">•</span>
            <span className="text-gray-700">{t(`${slideKey}.bullet3`)}</span>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-education text-lg">•</span>
            <span className="text-gray-700">{t(`${slideKey}.bullet4`)}</span>
          </div>
        </div>
      </div>
    );
  };

  const getSlideKeys = () => [
    'welcome',
    'peerLearning', 
    'thinkAloud',
    'criticalThinking',
    'collaborativeReview',
    'teacherFacilitation',
    'reflectionAndGrowth',
    'examples'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-education-dark mb-2">
            {t('tutorials.impersonaTu.title')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('tutorials.impersonaTu.subtitle')}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              {t('common.progress')}: {currentSlide + 1} / {totalSlides}
            </span>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Content Card */}
        <Card className="bg-white/90 backdrop-blur-sm border-education/20 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-education">
              {t('common.slide')} {currentSlide + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 py-6">
            {renderSlideContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            variant="outline"
            className="border-education text-education hover:bg-education hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t('common.previous')}
          </Button>

          <div className="flex space-x-2">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i === currentSlide ? 'bg-education' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {currentSlide === totalSlides - 1 ? (
            <Button
              onClick={startApp}
              className="bg-education hover:bg-education-dark text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              {t('tutorials.impersonaTu.startApp')}
            </Button>
          ) : (
            <Button
              onClick={nextSlide}
              className="bg-education hover:bg-education-dark text-white"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImpersonaTuTutorial;

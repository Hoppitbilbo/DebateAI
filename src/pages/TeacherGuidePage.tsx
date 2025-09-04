import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { School, ArrowLeft, ArrowRight } from 'lucide-react';
import Slide1Intro from '@/components/TeacherGuideSlides/Slide1Intro';
import Slide2WhyAI from '@/components/TeacherGuideSlides/Slide2WhyAI';
import Slide3Scenarios from '@/components/TeacherGuideSlides/Slide3Scenarios';
import Slide4TeachingStyles from '@/components/TeacherGuideSlides/Slide4TeachingStyles';
import Slide5Conclusion from '@/components/TeacherGuideSlides/Slide5Conclusion';
import { useTranslation } from 'react-i18next';

// Define the total number of slides
const TOTAL_SLIDES = 5; // Adjust as we add more slides

const TeacherGuidePage = () => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(1);

  const goToNextSlide = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, TOTAL_SLIDES));
  };

  const goToPreviousSlide = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 1));
  };

  const renderSlide = () => {
    switch (currentSlide) {
      case 1:
        return <Slide1Intro />;
      case 2:
        return <Slide2WhyAI />;
      case 3:
        return <Slide3Scenarios />;
      case 4:
        return <Slide4TeachingStyles />;
      case 5:
        return <Slide5Conclusion />;
      default:
        return <Slide1Intro />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl p-6 md:p-8 bg-slate-800 shadow-2xl rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <School className="h-10 w-10 text-sky-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-sky-300">
              {t('teacherGuidePage.title')}
            </h1>
          </div>

          <div className="slide-content min-h-[400px] flex flex-col justify-center">
            {renderSlide()}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={goToPreviousSlide}
              disabled={currentSlide === 1}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              {t('common.back')}
            </button>
            <span className="text-slate-400">
              {t('teacherGuidePage.slideCounter', { current: currentSlide, total: TOTAL_SLIDES })}
            </span>
            <button
              onClick={goToNextSlide}
              disabled={currentSlide === TOTAL_SLIDES}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out flex items-center gap-2"
            >
              {t('common.next')}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TeacherGuidePage;

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DoppiaIntervistaTutorial from '@/components/tutorials/DoppiaIntervistaTutorial';

const DoppiaIntervistaTutorialPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <DoppiaIntervistaTutorial />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DoppiaIntervistaTutorialPage;

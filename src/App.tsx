/**
 * @file The root component of the application.
 * @remarks This component sets up all the top-level providers (React Query, Tooltip, Animation, Router)
 * and defines the application's routes.
 */

import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimationProvider } from "@/context/AnimationContext";
import PageFlipAnimation from "@/components/PageFlipAnimation";
import Index from "./pages/Index";
import AppsPage from "./pages/AppsPage";
import WikiInterviewPage from "./pages/WikiInterviewPage";
import WikiChatbotPage from "./pages/WikiChatbotPage";
import DoppiaIntervistaPage from "./pages/DoppiaIntervistaPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";
import ConvinciTuPage from "./pages/ConvinciTuPage";
import PersonaggioMisteriosoPage from "./pages/PersonaggioMisteriosoPage";
import TeacherGuidePage from "./pages/TeacherGuidePage";
import ImpersonaTuPage from "./pages/ImpersonaTuPage";

/**
 * @description The query client for `react-query`.
 */
const queryClient = new QueryClient();

/**
 * @function App
 * @description The main application component that wraps all pages and providers.
 * @returns {JSX.Element} The rendered application.
 */
const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <AnimationProvider>
            <Toaster />
            <Sonner />
            <PageFlipAnimation />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/apps" element={<AppsPage />} />
                <Route path="/apps/wiki-interview" element={<WikiInterviewPage />} />
                <Route path="/apps/wiki-chatbot" element={<WikiChatbotPage />} />
                <Route path="/apps/doppia-intervista" element={<DoppiaIntervistaPage />} />
                <Route path="/apps/convinci-tu" element={<ConvinciTuPage />} />
                <Route path="/apps/personaggio-misterioso" element={<PersonaggioMisteriosoPage />} />
                <Route path="/apps/impersona-tu" element={<ImpersonaTuPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/teacher-guide" element={<TeacherGuidePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AnimationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;


import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimationProvider } from "@/context/AnimationContext";
import PageFlipAnimation from "@/components/PageFlipAnimation";
import I18nDebugFloatingButton from "@/components/debug/I18nDebugFloatingButton";
import Index from "./pages/Index";
import AppsPage from "./pages/AppsPage";
import YouModeratePage from "./pages/YouModeratePage";
import YouModerateTutorialPage from "./pages/YouModerateTutorialPage";
import WikiChatbotPage from "./pages/WikiChatbotPage";
import DoppiaIntervistaPage from "./pages/DoppiaIntervistaPage";
import DoppiaIntervistaTutorialPage from "./pages/DoppiaIntervistaTutorialPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";
import ConvinciTuPage from "./pages/ConvinciTuPage";
import ConvinciTuTutorialPage from "./pages/ConvinciTuTutorialPage";
import PersonaggioMisteriosoPage from "./pages/PersonaggioMisteriosoPage";
import PersonaggioMisteriosoTutorialPage from "./pages/PersonaggioMisteriosoTutorialPage";
import TeacherGuidePage from "./pages/TeacherGuidePage";
import ImpersonaTuPage from "./pages/ImpersonaTuPage";
import ImpersonaTuTutorialPage from "./pages/ImpersonaTuTutorialPage";

const queryClient = new QueryClient();

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <AnimationProvider>
            <Toaster />
            <Sonner />
            <PageFlipAnimation />
            <I18nDebugFloatingButton />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/apps" element={<AppsPage />} />
                <Route path="/apps/you-moderate" element={<YouModeratePage />} />
                <Route path="/apps/you-moderate/tutorial" element={<YouModerateTutorialPage />} />
                <Route path="/apps/wiki-chatbot" element={<WikiChatbotPage />} />
                <Route path="/apps/doppia-intervista" element={<DoppiaIntervistaPage />} />
                <Route path="/apps/doppia-intervista/tutorial" element={<DoppiaIntervistaTutorialPage />} />
                <Route path="/apps/convinci-tu" element={<ConvinciTuPage />} />
                <Route path="/apps/convinci-tu/tutorial" element={<ConvinciTuTutorialPage />} />
                <Route path="/apps/personaggio-misterioso" element={<PersonaggioMisteriosoPage />} />
                <Route path="/apps/personaggio-misterioso/tutorial" element={<PersonaggioMisteriosoTutorialPage />} />
                <Route path="/apps/impersona-tu" element={<ImpersonaTuPage />} />
                <Route path="/apps/impersona-tu/tutorial" element={<ImpersonaTuTutorialPage />} />
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

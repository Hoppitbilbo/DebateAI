import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { dashboardPath, useAuth } from "@/context/auth";
import { lazyPage } from "@/lib/lazyPage";
import i18n from "@/i18n";
import { APP_TYPES } from "@/features/activity/appCatalog";
import MorphGate from "@/features/navigation/MorphGate";
import TourProvider from "@/features/tour/TourProvider";

import Index from "./pages/Index";
const AppsPage = lazyPage(() => import("./pages/AppsPage"), ["/apps"]);
const YouModeratePage = lazyPage(() => import("./pages/YouModeratePage"), ["/apps/you-moderate"]);
const WikiChatbotPage = lazyPage(() => import("./pages/WikiChatbotPage"), ["/apps/wiki-chatbot"]);
const DoppiaIntervistaPage = lazyPage(() => import("./pages/DoppiaIntervistaPage"), ["/apps/doppia-intervista"]);
const AboutPage = lazyPage(() => import("./pages/AboutPage"), ["/about"]);
const NotFound = lazyPage(() => import("./pages/NotFound"));
const LegalPage = lazyPage(() => import("./pages/LegalPage"), ["/privacy", "/terms"]);
const ConvinciTuPage = lazyPage(() => import("./pages/ConvinciTuPage"), ["/apps/convinci-tu"]);
const PersonaggioMisteriosoPage = lazyPage(() => import("./pages/PersonaggioMisteriosoPage"), ["/apps/personaggio-misterioso"]);
const TeacherGuidePage = lazyPage(() => import("./pages/TeacherGuidePage"), ["/teacher-guide"]);
const ImpersonaTuPage = lazyPage(() => import("./pages/ImpersonaTuPage"), ["/apps/impersona-tu"]);
// The tutorial texts are separate downloads (see i18n): their pages are ready
// once the code and the texts have arrived.
const withTexts = <M,>(load: () => Promise<M>, ...ns: string[]) => () =>
  Promise.all([load(), i18n.loadNamespaces(ns)]).then(([m]) => m);
const TutorialsPage = lazyPage(withTexts(() => import("./pages/TutorialsPage"), "tutorialsPage"), ["/tutorials"]);
const TutorialPage = lazyPage(withTexts(() => import("./pages/TutorialPage"), "tutorial", "studentTutorial"), APP_TYPES.map((a) => `/apps/${a}/tutorial`));
const TutorialPlayerPage = lazyPage(withTexts(() => import("./pages/TutorialPlayerPage"), "studentTutorial"), APP_TYPES.map((a) => `/tutorial-player/${a}`));
const named = <T extends string>(loader: () => Promise<Record<T, React.ComponentType>>, key: T, paths: string[] = []) =>
  lazyPage(() => loader().then((m) => ({ default: m[key] })), paths);
const authPages = () => import("./pages/auth/AuthPages");
const LoginPage = named(authPages, "LoginPage", ["/login"]);
const RegisterPage = named(authPages, "RegisterPage", ["/register"]);
const ForgotPasswordPage = named(authPages, "ForgotPasswordPage");
const ResetPasswordPage = named(authPages, "ResetPasswordPage");
const SetupPage = named(authPages, "SetupPage");
const AccountPage = named(authPages, "AccountPage", ["/account"]);
import { RequireRole, Spinner } from "./pages/dashboard/common";
const StudentDashboard = lazyPage(() => import("./pages/dashboard/StudentDashboard"), ["/student"]);
const SessionDetailPage = lazyPage(() => import("./pages/dashboard/SessionDetailPage"));
const TeacherDashboard = lazyPage(() => import("./pages/dashboard/teacher/TeacherDashboard"), ["/teacher"]);
const ClassPage = lazyPage(() => import("./pages/dashboard/teacher/ClassPage"));
const AssignmentProgressPage = lazyPage(() => import("./pages/dashboard/teacher/AssignmentProgressPage"));
const AdminPage = lazyPage(() => import("./pages/admin/AdminPage"), ["/admin"]);
const JoinRoomPage = lazyPage(() => import("./pages/room/JoinRoomPage"), ["/entra"]);
const GuestRoomPage = lazyPage(() => import("./pages/room/GuestRoomPage"), ["/aula"]);
const OpenRoomPage = lazyPage(() => import("./pages/room/OpenRoomPage"), ["/aula/nuova"]);
const HostRoomPage = lazyPage(() => import("./pages/room/HostRoomPage"));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const DashboardRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={dashboardPath(user)} replace />;
};

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MorphGate />
          <AuthProvider>
            <TourProvider>
            <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/apps" element={<AppsPage />} />
              <Route path="/apps/you-moderate" element={<YouModeratePage />} />
              <Route path="/apps/you-moderate/tutorial" element={<TutorialPage app="you-moderate" />} />
              <Route path="/apps/wiki-chatbot" element={<WikiChatbotPage />} />
              <Route path="/apps/wiki-chatbot/tutorial" element={<TutorialPage app="wiki-chatbot" />} />
              <Route path="/apps/doppia-intervista" element={<DoppiaIntervistaPage />} />
              <Route path="/apps/doppia-intervista/tutorial" element={<TutorialPage app="doppia-intervista" />} />
              <Route path="/apps/convinci-tu" element={<ConvinciTuPage />} />
              <Route path="/apps/convinci-tu/tutorial" element={<TutorialPage app="convinci-tu" />} />
              <Route path="/apps/personaggio-misterioso" element={<PersonaggioMisteriosoPage />} />
              <Route path="/apps/personaggio-misterioso/tutorial" element={<TutorialPage app="personaggio-misterioso" />} />
              <Route path="/apps/impersona-tu" element={<ImpersonaTuPage />} />
              <Route path="/apps/impersona-tu/tutorial" element={<TutorialPage app="impersona-tu" />} />
              <Route path="/tutorials" element={<TutorialsPage />} />
              <Route path="/tutorial-player/:app" element={<TutorialPlayerPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/teacher-guide" element={<TeacherGuidePage />} />
              <Route path="/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/terms" element={<LegalPage kind="terms" />} />

              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />

              <Route path="/student" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
              <Route path="/sessions/:id" element={<RequireRole role="student"><SessionDetailPage /></RequireRole>} />
              <Route path="/teacher" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
              <Route path="/teacher/classes/:id" element={<RequireRole role="teacher"><ClassPage /></RequireRole>} />
              <Route path="/teacher/assignments/:id" element={<RequireRole role="teacher"><AssignmentProgressPage /></RequireRole>} />
              <Route path="/admin" element={<RequireRole role="admin"><AdminPage /></RequireRole>} />
              {/* temporary rooms ("aula lampo"): no registration for students */}
              <Route path="/entra" element={<JoinRoomPage />} />
              <Route path="/aula" element={<GuestRoomPage />} />
              <Route path="/aula/nuova" element={<OpenRoomPage />} />
              <Route path="/aula/gestisci/:id" element={<HostRoomPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </TourProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;

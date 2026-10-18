import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AnimationProvider } from "@/context/AnimationContext";
import { AuthProvider, dashboardPath, useAuth } from "@/context/AuthContext";
import PageFlipAnimation from "@/components/PageFlipAnimation";

import Index from "./pages/Index";
const AppsPage = lazy(() => import("./pages/AppsPage"));
const YouModeratePage = lazy(() => import("./pages/YouModeratePage"));
const WikiChatbotPage = lazy(() => import("./pages/WikiChatbotPage"));
const DoppiaIntervistaPage = lazy(() => import("./pages/DoppiaIntervistaPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const ConvinciTuPage = lazy(() => import("./pages/ConvinciTuPage"));
const PersonaggioMisteriosoPage = lazy(() => import("./pages/PersonaggioMisteriosoPage"));
const TeacherGuidePage = lazy(() => import("./pages/TeacherGuidePage"));
const ImpersonaTuPage = lazy(() => import("./pages/ImpersonaTuPage"));
const TutorialsPage = lazy(() => import("./pages/TutorialsPage"));
const TutorialPage = lazy(() => import("./pages/TutorialPage"));
const named = <T extends string>(loader: () => Promise<Record<T, React.ComponentType>>, key: T) => lazy(() => loader().then((m) => ({ default: m[key] })));
const authPages = () => import("./pages/auth/AuthPages");
const LoginPage = named(authPages, "LoginPage");
const RegisterPage = named(authPages, "RegisterPage");
const ForgotPasswordPage = named(authPages, "ForgotPasswordPage");
const ResetPasswordPage = named(authPages, "ResetPasswordPage");
const SetupPage = named(authPages, "SetupPage");
const AccountPage = named(authPages, "AccountPage");
import { RequireRole, Spinner } from "./pages/dashboard/common";
const StudentDashboard = lazy(() => import("./pages/dashboard/StudentDashboard"));
const SessionDetailPage = lazy(() => import("./pages/dashboard/SessionDetailPage"));
const teacherPages = () => import("./pages/dashboard/TeacherPages");
const TeacherDashboard = named(teacherPages, "TeacherDashboard");
const ClassPage = named(teacherPages, "ClassPage");
const AssignmentProgressPage = named(teacherPages, "AssignmentProgressPage");
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));

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
        <AnimationProvider>
          <Toaster />
          <Sonner />
          <PageFlipAnimation />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/apps" element={<AppsPage />} />
                <Route path="/apps/you-moderate" element={<YouModeratePage />} />
                <Route path="/apps/you-moderate/tutorial" element={<TutorialPage app="you-moderate" />} />
                <Route path="/apps/wiki-chatbot" element={<WikiChatbotPage />} />
                <Route path="/apps/doppia-intervista" element={<DoppiaIntervistaPage />} />
                <Route path="/apps/doppia-intervista/tutorial" element={<TutorialPage app="doppia-intervista" />} />
                <Route path="/apps/convinci-tu" element={<ConvinciTuPage />} />
                <Route path="/apps/convinci-tu/tutorial" element={<TutorialPage app="convinci-tu" />} />
                <Route path="/apps/personaggio-misterioso" element={<PersonaggioMisteriosoPage />} />
                <Route path="/apps/personaggio-misterioso/tutorial" element={<TutorialPage app="personaggio-misterioso" />} />
                <Route path="/apps/impersona-tu" element={<ImpersonaTuPage />} />
                <Route path="/apps/impersona-tu/tutorial" element={<TutorialPage app="impersona-tu" />} />
                <Route path="/tutorials" element={<TutorialsPage />} />
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

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </AnimationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;

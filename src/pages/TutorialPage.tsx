import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppType } from "@/lib/api";
import { APPS } from "@/features/activity/types";
import TutorialSlides from "@/features/tutorials/TutorialSlides";
import { TUTORIALS } from "@/features/tutorials/tutorials";
import StudentTutorialPlayer from "@/features/tutorials/student/StudentTutorialPlayer";

/** The tutorials of one app: the 8-bit video for students and, when there is one, the slides for teachers. */
const TutorialPage = ({ app }: { app: AppType }) => {
  const { t } = useTranslation();
  const teacher = TUTORIALS[app];
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-6 font-heading text-3xl font-bold text-primary">{t(`apps.${APPS[app].i18nKey}.title`)}</h1>
          <Tabs defaultValue="student">
            {teacher && (
              <TabsList className="mb-4">
                <TabsTrigger value="student">{t("platform.tutorialPlayer.forStudents")}</TabsTrigger>
                <TabsTrigger value="teacher">{t("platform.tutorialPlayer.forTeachers")}</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="student">
              <StudentTutorialPlayer app={app} />
            </TabsContent>
            {teacher && (
              <TabsContent value="teacher">
                <TutorialSlides tutorial={teacher} appPath={APPS[app].path} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TutorialPage;

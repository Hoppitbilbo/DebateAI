import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { AppType } from "@/lib/api";
import { APPS } from "@/features/activity/types";
import TutorialSlides from "@/features/tutorials/TutorialSlides";
import { TUTORIALS } from "@/features/tutorials/tutorials";
import NotFound from "./NotFound";

/** The teacher tutorial of one app. */
const TutorialPage = ({ app }: { app: AppType }) => {
  const tutorial = TUTORIALS[app];
  if (!tutorial) return <NotFound />;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <TutorialSlides tutorial={tutorial} appPath={APPS[app].path} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TutorialPage;

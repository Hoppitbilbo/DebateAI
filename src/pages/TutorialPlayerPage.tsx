import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { AppType } from "@/lib/api";
import { RenderStage } from "@/features/tutorials/student/RenderStage";
import { StudentTutorialPlayer } from "@/features/tutorials/student/StudentTutorialPlayer";
import { STUDENT_TUTORIALS } from "@/features/tutorials/student/studentTutorials";
import NotFound from "./NotFound";

/** A student tutorial alone on the screen, for projecting in class (and, with ?render=1, for the video export). */
const TutorialPlayerPage = () => {
  const { app } = useParams();
  const [search] = useSearchParams();
  const { t } = useTranslation();
  if (!app || !(app in STUDENT_TUTORIALS)) return <NotFound />;
  const appType = app as AppType;
  if (search.get("render") === "1") return <RenderStage app={appType} />;
  return (
    <div className="relative h-screen w-screen bg-[#141221]">
      <Link to={`/apps/${appType}/tutorial`} className="absolute right-3 top-3 z-10 rounded bg-black/50 p-2 text-white hover:bg-black/70" aria-label={t("platform.tutorialPlayer.exit")}>
        <X className="h-5 w-5" />
      </Link>
      <StudentTutorialPlayer app={appType} variant="presentation" />
    </div>
  );
};

export default TutorialPlayerPage;

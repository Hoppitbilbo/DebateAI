import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { useMyClasses } from "@/features/teacher/teacherApi";
import { DashboardLayout, Spinner } from "../common";
import ClassCreateDialog from "./ClassCreateDialog";
import ClassGrid from "./ClassGrid";
import { usePageTour } from "@/features/tour/tour";

/** The teacher's home: their classes. */
const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { classes, refresh } = useMyClasses();
  usePageTour("teacher");
  return (
    <DashboardLayout
      title={t("platform.teacher.title")}
      subtitle={t("platform.teacher.subtitle", { name: user?.name })}
      actions={<Button onClick={() => setOpen(true)} data-tour="new-class"><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newClass")}</Button>}
    >
      <div data-tour="class-grid">{classes.isLoading ? <Spinner /> : <ClassGrid classes={classes.data ?? []} />}</div>
      <ClassCreateDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
    </DashboardLayout>
  );
};

export default TeacherDashboard;

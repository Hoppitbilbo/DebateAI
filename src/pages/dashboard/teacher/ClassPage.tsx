import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Assignment } from "@/lib/api";
import { useClass } from "@/features/teacher/teacherApi";
import { DashboardLayout, EmptyState, Spinner } from "../common";
import AssignmentForm from "../AssignmentForm";
import ClassAssignments from "./ClassAssignments";
import ClassMembers from "./ClassMembers";
import ClassProgress from "./ClassProgress";
import ClassSettings from "./ClassSettings";

/** One class: assignments, students, progress matrix and settings. */
const ClassPage = () => {
  const { id } = useParams();
  const classId = Number(id);
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "assignments";
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const klass = useClass(classId, tab === "progress");
  const { detail, assignments, progress, refresh } = klass;

  if (detail.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  if (!detail.data) return <DashboardLayout title={t("platform.errors.notFound")}><EmptyState>{t("platform.errors.notFound")}</EmptyState></DashboardLayout>;
  const { class: cls, members } = detail.data;
  const students = members.filter((m) => m.role === "student");

  return (
    <DashboardLayout
      title={cls.name}
      subtitle={cls.description}
      actions={
        <>
          <Button variant="outline" asChild><Link to="/teacher">{t("platform.teacher.allClasses")}</Link></Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newAssignment")}</Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="assignments">{t("platform.teacher.tabs.assignments")}</TabsTrigger>
          <TabsTrigger value="students">{t("platform.teacher.tabs.students")} ({students.length})</TabsTrigger>
          <TabsTrigger value="progress">{t("platform.teacher.tabs.progress")}</TabsTrigger>
          <TabsTrigger value="settings">{t("platform.teacher.tabs.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4 space-y-3">
          <ClassAssignments
            assignments={assignments}
            onEdit={(a) => { setEditing(a); setFormOpen(true); }}
            onDelete={klass.deleteAssignment}
          />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <ClassMembers detail={detail.data} onRemoveMember={klass.removeMember} onRegenerateCode={klass.regenerateCode} onInvited={refresh} />
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <ClassProgress students={students} assignments={assignments} progress={progress} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ClassSettings cls={cls} onUpdate={klass.update} onDelete={klass.remove} />
        </TabsContent>
      </Tabs>

      <AssignmentForm classId={classId} open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={refresh} />
    </DashboardLayout>
  );
};

export default ClassPage;

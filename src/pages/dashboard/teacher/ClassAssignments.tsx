import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { UseQueryResult } from "@tanstack/react-query";
import { CalendarClock, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Assignment } from "@/lib/api";
import { AppName, EmptyState, formatDate, Spinner } from "../common";
import ConfirmButton from "../ConfirmButton";

interface ClassAssignmentsProps {
  assignments: UseQueryResult<Assignment[]>;
  onEdit: (a: Assignment) => void;
  onDelete: (id: number) => Promise<void>;
}

/** The class assignments with how many students completed each. */
const ClassAssignments = ({ assignments, onEdit, onDelete }: ClassAssignmentsProps) => {
  const { t, i18n } = useTranslation();
  return (
    <>
    {assignments.isLoading ? <Spinner /> : (assignments.data ?? []).length === 0 ? <EmptyState>{t("platform.teacher.noAssignments")}</EmptyState> : (
      assignments.data!.map((a) => (
        <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{a.title}</h3>
              {!a.published && <Badge variant="outline">{t("platform.teacher.draft")}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <AppName type={a.appType} />
              {a.goals.length > 0 && <span>{t("platform.teacher.goalsCount", { count: a.goals.length })}</span>}
              {a.dueAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(a.dueAt, i18n.language)}</span>}
            </div>
          </div>
          {a.stats && (
            <div className="w-full md:w-48">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("platform.teacher.completedOf", { done: a.stats.completed, total: a.stats.students })}</span>
              </div>
              <Progress value={a.stats.students ? (a.stats.completed / a.stats.students) * 100 : 0} />
            </div>
          )}
          <div className="flex gap-1">
            <Button size="sm" asChild><Link to={`/teacher/assignments/${a.id}`}><Eye className="mr-2 h-4 w-4" />{t("platform.teacher.progress")}</Link></Button>
            <Button size="icon" variant="ghost" onClick={() => onEdit(a)} aria-label={t("platform.common.edit")}><Pencil className="h-4 w-4" /></Button>
            <ConfirmButton
              title={t("platform.teacher.deleteAssignment")}
              description={t("platform.teacher.deleteAssignmentText")}
              icon={<Trash2 className="h-4 w-4" />}
              onConfirm={() => onDelete(a.id)}
            />
          </div>
        </div>
      ))
    )}
    </>
  );
};

export default ClassAssignments;

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Assignment, Member } from "@/lib/api";
import { cn } from "@/lib/utils";
import { doneForAssignment } from "@/features/activity/attemptStatus";
import type { ProgressCell } from "@/features/teacher/teacherApi";
import { EmptyState, Panel, Spinner } from "../common";

interface ClassProgressProps {
  students: Member[];
  assignments: UseQueryResult<Assignment[]>;
  progress: UseQueryResult<{ cells: ProgressCell[] }>;
}

/** Students × assignments matrix with the best attempt of each student. */
const ClassProgress = ({ students, assignments, progress }: ClassProgressProps) => {
  const { t } = useTranslation();
  return (
    <Panel title={t("platform.teacher.progressMatrix")}>
      {progress.isLoading || assignments.isLoading ? <Spinner /> : students.length === 0 || (assignments.data ?? []).length === 0 ? <EmptyState>{t("platform.teacher.matrixEmpty")}</EmptyState> : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card py-2 pr-4 text-left">{t("platform.common.student")}</th>
                {assignments.data!.map((a) => (
                  <th key={a.id} className="max-w-[140px] px-2 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                    <Link to={`/teacher/assignments/${a.id}`} className="line-clamp-2 hover:text-primary">{a.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.userId} className="border-t border-border">
                  <td className="sticky left-0 bg-card py-2 pr-4 font-medium">{s.name}</td>
                  {assignments.data!.map((a) => {
                    const c = progress.data?.cells.find((x) => x.userId === s.userId && x.assignmentId === a.id);
                    return (
                      <td key={a.id} className="px-2 py-1.5">
                        {c ? (
                          <Link to={`/sessions/${c.sessionId}`} className={cn("block rounded px-2 py-1 text-center text-xs font-semibold",
                            doneForAssignment(c.status) ? "bg-primary text-primary-foreground" : "bg-sky-500/20 text-info")}
                            title={t(`platform.status.${c.status}`)}>
                            {c.progress}%{c.score !== undefined ? ` · ${c.score}` : ""}
                            {c.teacherScore !== undefined && <span className="ml-1 underline" title={t("platform.teacher.teacherScore")}>{c.teacherScore}</span>}
                          </Link>
                        ) : <span className="block text-center text-muted-foreground">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">{t("platform.teacher.matrixLegend")}</p>
        </div>
      )}
    </Panel>
  );
};

export default ClassProgress;

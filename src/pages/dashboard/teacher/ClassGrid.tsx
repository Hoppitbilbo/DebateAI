import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { ClassInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState } from "../common";

/** Cards linking to each class. */
const ClassGrid = ({ classes }: { classes: ClassInfo[] }) => {
  const { t } = useTranslation();
  if (classes.length === 0) return <EmptyState>{t("platform.teacher.noClasses")}</EmptyState>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((c) => (
        <Link key={c.id} to={`/teacher/classes/${c.id}`} className={cn("rounded-lg border border-border bg-card p-5 transition hover:border-primary", c.archived && "opacity-60")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{c.name}</h3>
            {c.archived && <Badge variant="outline">{t("platform.teacher.archived")}</Badge>}
          </div>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{t("platform.teacher.studentsCount", { count: c.studentCount })}</span>
            <span>{t("platform.teacher.assignmentsCount", { count: c.assignmentCount })}</span>
            {c.ownerName && <span>{c.ownerName}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ClassGrid;

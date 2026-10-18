import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle } from "lucide-react";
import { useOverview } from "@/features/admin/adminApi";
import { Panel, Spinner, StatTile } from "../../dashboard/common";
import { usd } from "@/lib/format";

/** Key numbers and the setup checklist of a new installation. */
const OverviewTab = () => {
  const { t } = useTranslation();
  const q = useOverview();
  if (!q.data) return <Spinner />;
  const o = q.data;
  const steps = [
    { done: o.providers > 0, label: t("platform.admin.overview.stepProvider"), tab: "ai" },
    { done: o.routingComplete, label: t("platform.admin.overview.stepRouting"), tab: "ai" },
    { done: o.mailConfigured, label: t("platform.admin.overview.stepMail"), tab: "settings" },
    { done: o.users.teacher > 0, label: t("platform.admin.overview.stepTeachers"), tab: "users" },
    { done: o.classes > 0, label: t("platform.admin.overview.stepClasses"), tab: "classes" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("platform.admin.overview.teachers")} value={o.users.teacher} hint={t("platform.admin.overview.admins", { count: o.users.admin })} />
        <StatTile label={t("platform.admin.overview.students")} value={o.users.student} hint={t("platform.admin.overview.pending", { count: o.pendingInvites })} />
        <StatTile label={t("platform.admin.overview.classes")} value={o.classes} hint={t("platform.admin.overview.assignments", { count: o.assignments })} />
        <StatTile label={t("platform.admin.overview.sessions")} value={o.sessions} />
        <StatTile label={t("platform.admin.overview.monthSpend")} value={usd(o.monthSpendUsd)} hint={o.monthBudgetUsd > 0 ? t("platform.admin.costs.ofBudget", { budget: usd(o.monthBudgetUsd) }) : t("platform.admin.costs.noBudget")} tone={o.budgetExceeded ? "warn" : undefined} />
        <StatTile label={t("platform.admin.overview.todaySpend")} value={usd(o.todaySpendUsd)} />
        <StatTile label={t("platform.admin.overview.requestsToday")} value={o.requestsToday} />
        <StatTile label={t("platform.admin.overview.errorsToday")} value={o.errorsToday} tone={o.errorsToday > 0 ? "warn" : undefined} />
      </div>
      <Panel title={t("platform.admin.overview.checklist")}>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <Link to={`/admin?tab=${s.tab}`} className={s.done ? "text-muted-foreground" : "hover:text-primary"}>{s.label}</Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

export default OverviewTab;

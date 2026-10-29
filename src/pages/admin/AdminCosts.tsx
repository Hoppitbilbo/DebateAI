import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Agg, useUsageLog, useUsageSummary } from "@/features/admin/adminApi";
import { EmptyState, Panel, Spinner, StatTile } from "../dashboard/common";
import { formatDate, usd } from "@/lib/format";

const num = (n: number) => n.toLocaleString();

/** SVG presentation attributes do not resolve var(): read the theme token. */
const themeColor = (token: string, alpha = 1) => {
  const v = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() : "";
  return v ? `hsl(${v.replace(/ /g, ", ")}${alpha < 1 ? `, ${alpha}` : ""})`.replace("hsl(", alpha < 1 ? "hsla(" : "hsl(") : "#8bc34a";
};

const AggTable = ({ rows, keyLabel, labelFor }: { rows: Agg[]; keyLabel: string; labelFor?: (r: Agg) => string }) => {
  const { t } = useTranslation();
  if (rows.length === 0) return <EmptyState>{t("platform.admin.costs.noData")}</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">{keyLabel}</th>
            <th className="py-2 pr-3 text-right">{t("platform.admin.costs.requests")}</th>
            <th className="py-2 pr-3 text-right">{t("platform.admin.costs.errors")}</th>
            <th className="py-2 pr-3 text-right">{t("platform.admin.costs.tokensIn")}</th>
            <th className="py-2 pr-3 text-right">{t("platform.admin.costs.tokensOut")}</th>
            <th className="py-2 text-right">{t("platform.common.cost")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1.5 pr-3">{labelFor ? labelFor(r) : r.key}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{num(r.requests)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{r.errors > 0 ? <span className="text-amber-400">{num(r.errors)}</span> : 0}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{num(r.inputTokens)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{num(r.outputTokens)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{usd(r.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Spend monitoring: budget, daily spend, breakdowns and the raw request log. */
const AdminCosts = () => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState("30");
  const summary = useUsageSummary(days);
  const log = useUsageLog();

  if (summary.isLoading || !summary.data) return <Spinner />;
  const s = summary.data;
  const total = s.byDay.reduce((p, d) => p + d.costUsd, 0);
  const requests = s.byDay.reduce((p, d) => p + d.requests, 0);
  const errors = s.byDay.reduce((p, d) => p + d.errors, 0);
  const budgetPct = s.budget.monthlyUsd > 0 ? Math.min(100, (s.monthSpendUsd / s.budget.monthlyUsd) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44" aria-label={t("platform.admin.costs.period")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {["7", "30", "90", "365"].map((d) => <SelectItem key={d} value={d}>{t("platform.admin.costs.lastDays", { count: Number(d) })}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("platform.admin.costs.periodSpend")} value={usd(total)} />
        <StatTile
          label={t("platform.admin.costs.monthSpend")}
          value={usd(s.monthSpendUsd)}
          hint={s.budget.monthlyUsd > 0 ? t("platform.admin.costs.ofBudget", { budget: usd(s.budget.monthlyUsd) }) : t("platform.admin.costs.noBudget")}
          tone={s.budget.monthlyUsd > 0 && budgetPct >= s.budget.warnPercent ? "warn" : undefined}
        />
        <StatTile label={t("platform.admin.costs.requests")} value={num(requests)} />
        <StatTile label={t("platform.admin.costs.errorRate")} value={requests ? `${((errors / requests) * 100).toFixed(1)}%` : "–"} tone={errors / Math.max(1, requests) > 0.1 ? "warn" : undefined} />
      </div>

      {s.budget.monthlyUsd > 0 && (
        <Panel title={t("platform.admin.costs.budget")}>
          <Progress value={budgetPct} aria-label={t("platform.admin.costs.budget")} />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("platform.admin.costs.budgetText", { spent: usd(s.monthSpendUsd), budget: usd(s.budget.monthlyUsd), pct: budgetPct.toFixed(0) })}
            {s.budget.blockPaidWhenExceeded && ` ${t("platform.admin.costs.budgetBlock")}`}
          </p>
        </Panel>
      )}

      <Panel title={t("platform.admin.costs.dailySpend")}>
        {s.byDay.length === 0 ? <EmptyState>{t("platform.admin.costs.noData")}</EmptyState> : (
          <div className="h-64" role="img" aria-label={t("platform.admin.costs.dailySpend")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={themeColor("border")} strokeOpacity={0.6} />
                <XAxis dataKey="key" tickLine={false} axisLine={false} tick={{ fill: themeColor("muted-foreground"), fontSize: 12 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: themeColor("muted-foreground"), fontSize: 12 }} tickFormatter={(v: number) => usd(v)} />
                <Tooltip
                  cursor={{ fill: themeColor("muted"), opacity: 0.4 }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                  formatter={(v: number, _n, item) => [`${usd(v)} · ${num((item.payload as Agg).requests)} req`, t("platform.common.cost")]}
                  labelFormatter={(l: string) => new Date(l).toLocaleDateString(i18n.language)}
                />
                <Bar dataKey="costUsd" fill={themeColor("primary")} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t("platform.admin.costs.byModel")}><AggTable rows={s.byModel} keyLabel={t("platform.admin.costs.model")} /></Panel>
        <Panel title={t("platform.admin.costs.byTask")}><AggTable rows={s.byTask} keyLabel={t("platform.admin.costs.task")} labelFor={(r) => t(`platform.admin.tasks.${r.key}`, { defaultValue: r.key })} /></Panel>
        <Panel title={t("platform.admin.costs.byUser")}><AggTable rows={s.byUser} keyLabel={t("platform.admin.costs.user")} labelFor={(r) => r.label || t("platform.admin.costs.guest")} /></Panel>
        <Panel title={t("platform.admin.costs.byClass")}><AggTable rows={s.byClass} keyLabel={t("platform.admin.costs.class")} labelFor={(r) => r.label || t("platform.admin.costs.noClass")} /></Panel>
      </div>

      <Panel title={t("platform.admin.costs.log")}>
        {log.isLoading ? <Spinner /> : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">{t("platform.common.date")}</th><th className="py-2 pr-2">{t("platform.admin.costs.user")}</th>
                  <th className="py-2 pr-2">{t("platform.admin.costs.task")}</th><th className="py-2 pr-2">{t("platform.admin.costs.model")}</th>
                  <th className="py-2 pr-2 text-right">{t("platform.admin.costs.tokensIn")}</th><th className="py-2 pr-2 text-right">{t("platform.admin.costs.tokensOut")}</th>
                  <th className="py-2 pr-2 text-right">ms</th><th className="py-2 text-right">{t("platform.common.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {(log.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border" title={r.error}>
                    <td className="py-1 pr-2 whitespace-nowrap">{formatDate(r.createdAt, i18n.language)}</td>
                    <td className="py-1 pr-2">{r.user || t("platform.admin.costs.guest")}</td>
                    <td className="py-1 pr-2">{r.task}</td>
                    <td className="py-1 pr-2">
                      {!r.ok && <span className="mr-1 text-amber-400" aria-label={t("platform.admin.costs.errors")}>⚠</span>}
                      {r.provider} / {r.model}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{num(r.inputTokens)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {num(r.outputTokens)}
                      {r.estimated && <span className="ml-1 text-muted-foreground" title={t("platform.admin.costs.estimatedHint")}>({t("platform.admin.costs.estimated")})</span>}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{r.latencyMs}</td>
                    <td className="py-1 text-right tabular-nums">
                      {r.unpriced ? <span className="text-muted-foreground" title={t("platform.admin.costs.unpricedHint")}>{t("platform.admin.costs.unpriced")}</span> : usd(r.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AdminCosts;

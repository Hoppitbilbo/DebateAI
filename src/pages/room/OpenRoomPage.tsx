import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, LogIn, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, AppType, Assignment } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useBusyAction } from "@/hooks/useBusyAction";
import { useAiClient } from "@/services/aiClient";
import { useMyClasses } from "@/features/teacher/teacherApi";
import type { AssignmentDraft } from "@/features/teacher/assignmentDraft";
import { uiPracticeLanguage } from "@/features/activity/language";
import { hostKeys, roomApi, RoomRequest } from "@/features/room/roomApi";
import { autoTitle, MAX_PATH_STEPS, newStep, pagesOf, pathBody, PathStep, sameActivity, stepFromSuggestion } from "@/features/room/roomPath";
import { Suggestion, suggestActivities } from "@/features/room/suggestions";
import { EmptyState, Spinner } from "../dashboard/common";
import Navbar from "@/components/Navbar";
import WizardProgress from "./open/WizardProgress";
import { WIZARD_STEPS, WizardStep } from "./open/wizardSteps";
import AppChooser from "./open/AppChooser";
import StepEditor from "./open/StepEditor";
import SuggestionsPanel, { SuggestionsState } from "./open/SuggestionsPanel";
import LaunchStep from "./open/LaunchStep";

/** The assignments of the teacher's active classes. */
const useMyAssignments = (enabled: boolean) => {
  const { classes } = useMyClasses();
  return useQuery({
    queryKey: ["room-assignments", classes.data?.map((c) => c.id)],
    enabled: enabled && !!classes.data,
    queryFn: async () => (await Promise.all((classes.data ?? []).filter((c) => !c.archived).map((c) => api.get<Assignment[]>(`/api/classes/${c.id}/assignments`)))).flat(),
  });
};

/** Ideas for the path from the first stop's pages; asked again when they change. */
const useSuggestions = (theme: { appType: AppType; pages: string[] } | null, active: boolean) => {
  const ai = useAiClient();
  const { t } = useTranslation();
  const [state, setState] = useState<SuggestionsState>({ status: "idle" });
  const asked = useRef("");
  const signature = theme ? `${theme.appType}:${theme.pages.join("|")}` : "";

  const load = async () => {
    if (!theme?.pages.length) return;
    asked.current = signature;
    setState({ status: "loading" });
    try {
      setState({ status: "ready", items: await suggestActivities(ai, theme) });
    } catch (e) {
      setState({ status: "error", message: `${t("room.wizard.suggestionsError")} ${ai.formatError(e)}` });
    }
  };

  useEffect(() => {
    if (active && signature && asked.current !== signature) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only when the theme changes
  }, [active, signature]);

  return { state, reload: () => void load(), drop: (s: Suggestion) => setState((st) => (st.status === "ready" ? { ...st, items: st.items.filter((x) => x !== s) } : st)) };
};

/**
 * Opens a temporary room in three playful steps: the theme (the first
 * activity and its characters), the path (more activities, with ideas
 * built from the theme's Wikipedia links) and the launch (language the
 * characters speak, duration). What the teacher fixes is locked for the
 * students; what is left empty they choose.
 */
const OpenRoomPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, config, loading } = useAuth();
  const isTeacher = !!user && user.role !== "student";
  const maxMinutes = config?.roomMaxMinutes ?? 120;
  const [wizard, setWizard] = useState<WizardStep>("theme");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [language, setLanguage] = useState(() => uiPracticeLanguage().code);
  const [minutes, setMinutes] = useState(Math.min(60, maxMinutes));
  const [useExisting, setUseExisting] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const { busy, run } = useBusyAction();
  const mine = useMyAssignments(isTeacher);

  const first = steps[0];
  const theme = useMemo(() => (first ? { appType: first.draft.appType, pages: pagesOf(first.draft) } : null), [first]);
  const suggestions = useSuggestions(theme?.pages.length ? theme : null, wizard === "path");
  const freshIdeas: SuggestionsState = suggestions.state.status === "ready"
    ? { status: "ready", items: suggestions.state.items.filter((s) => !steps.some((st) => sameActivity(st, s))) }
    : suggestions.state;

  if (loading) return <Spinner />;
  const canOpen = config?.roomsEnabled && (isTeacher || (!user && config.anonymousRooms));
  const hasAssignments = isTeacher && !!mine.data?.length;
  const titleOf = (d: AssignmentDraft) => autoTitle(d, t(`platform.appNames.${d.appType}`), t("room.wizard.mysteryTitle"));

  const go = (next: WizardStep) => {
    setDirection(WIZARD_STEPS.indexOf(next) > WIZARD_STEPS.indexOf(wizard) ? "forward" : "back");
    setWizard(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const canGo = (s: WizardStep) => s === "theme" || (useExisting ? s === "launch" && !!assignmentId : !!first);

  const pickTheme = (app: AppType) => {
    const step = first?.draft.appType === app ? first : newStep(app);
    setSteps((list) => [step, ...list.slice(1)]);
    setOpenKey(step.key);
  };
  const update = (key: string, draft: AssignmentDraft) => setSteps((list) => list.map((s) => (s.key === key ? { ...s, draft } : s)));
  const remove = (key: string) => setSteps((list) => list.filter((s) => s.key !== key));
  const add = (step: PathStep) => {
    if (steps.length >= MAX_PATH_STEPS) return;
    setSteps((list) => [...list, step]);
    setOpenKey(step.key);
    setAdding(false);
  };
  const addSuggestion = (s: Suggestion) => {
    add(stepFromSuggestion(s));
    setOpenKey(null);
    suggestions.drop(s);
    toast.success(t("room.wizard.added", { title: s.title }));
  };

  const request = (): RoomRequest | null => {
    if (useExisting) return assignmentId ? { assignmentId: Number(assignmentId), minutes } : null;
    return steps.length ? { assignments: pathBody(steps, language, titleOf), minutes } : null;
  };

  const open = () => run(async () => {
    const r = request();
    if (!r) return void toast.error(useExisting ? t("room.open.pickAssignment") : t("room.wizard.pickTheme"));
    const { room, hostKey } = await roomApi.open(r);
    hostKeys.save(room.id, hostKey);
    navigate(`/aula/gestisci/${room.id}#k=${encodeURIComponent(hostKey)}`);
  });

  if (!canOpen) {
    return (
      <Page>
        <EmptyState>
          {config?.roomsEnabled ? t("room.open.loginNeeded") : t("room.open.disabled")}
          {config?.roomsEnabled && <Button asChild variant="outline" className="ml-3"><Link to="/login?next=/aula/nuova"><LogIn className="mr-2 h-4 w-4" />{t("platform.auth.login")}</Link></Button>}
        </EmptyState>
      </Page>
    );
  }

  const stepIndex = WIZARD_STEPS.indexOf(wizard);
  const nextStep = WIZARD_STEPS[stepIndex + 1];
  const prevStep = WIZARD_STEPS[stepIndex - 1];

  return (
    <Page>
      <header className="space-y-2 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-sun px-3 py-1 text-sm font-semibold shadow-[2px_2px_0_0_hsl(var(--foreground))]">
          <Zap className="h-4 w-4" aria-hidden="true" /> {t("room.open.title")}
        </p>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">{t(`room.wizard.titles.${wizard}`)}</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">{t(`room.wizard.subtitles.${wizard}`, { hours: maxMinutes / 60 })}</p>
      </header>

      <WizardProgress step={wizard} onGo={go} canGo={canGo} />

      <div key={wizard} className={direction === "forward" ? "wizard-enter-forward" : "wizard-enter-back"}>
        {wizard === "theme" && (useExisting ? (
          <div className="mx-auto max-w-xl space-y-3 rounded-xl border-2 border-foreground bg-card p-5">
            <Label>{t("room.open.assignmentLabel")}</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger><SelectValue placeholder={t("room.open.pickAssignment")} /></SelectTrigger>
              <SelectContent>
                {(mine.data ?? []).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.className ? `${a.className} · ` : ""}{a.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("room.open.assignmentHint")}</p>
            <Button type="button" variant="link" className="px-0" onClick={() => setUseExisting(false)}>{t("room.wizard.backToNew")}</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <AppChooser onPick={pickTheme} selected={first?.draft.appType} />
            {first && (
              <StepEditor
                step={first}
                index={0}
                open={openKey === first.key}
                onToggle={() => setOpenKey(openKey === first.key ? null : first.key)}
                onChange={(d) => update(first.key, d)}
                placeholderTitle={titleOf(first.draft)}
              />
            )}
            {hasAssignments && (
              <p className="text-center text-sm">
                <Button type="button" variant="link" onClick={() => setUseExisting(true)}>
                  <ClipboardList className="mr-2 h-4 w-4" />{t("room.wizard.useExisting")}
                </Button>
              </p>
            )}
          </div>
        ))}

        {wizard === "path" && (
          <div className="space-y-6">
            <ol className="path-list space-y-3">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <StepEditor
                    step={s}
                    index={i}
                    open={openKey === s.key}
                    onToggle={() => setOpenKey(openKey === s.key ? null : s.key)}
                    onChange={(d) => update(s.key, d)}
                    onRemove={i > 0 ? () => remove(s.key) : undefined}
                    placeholderTitle={titleOf(s.draft)}
                  />
                </li>
              ))}
            </ol>
            {steps.length < MAX_PATH_STEPS && (adding ? (
              <div className="phase-enter space-y-3 rounded-xl border-2 border-dashed border-foreground/40 p-4">
                <p className="text-sm font-medium">{t("room.wizard.addWhich")}</p>
                <AppChooser compact onPick={(app) => add(newStep(app))} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>{t("platform.common.cancel")}</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full border-2 border-dashed" onClick={() => setAdding(true)}>
                <Plus className="mr-2 h-4 w-4" /> {t("room.wizard.addStep", { count: MAX_PATH_STEPS - steps.length })}
              </Button>
            ))}
            <SuggestionsPanel
              theme={theme?.pages.length ? (first.draft.appType === "personaggio-misterioso" ? t("room.wizard.suggestionsTitleMystery") : t("room.wizard.suggestionsTitle", { theme: theme.pages[0] })) : null}
              state={freshIdeas}
              onAdd={addSuggestion}
              onRefresh={suggestions.reload}
              full={steps.length >= MAX_PATH_STEPS}
            />
          </div>
        )}

        {wizard === "launch" && (
          <LaunchStep
            language={language}
            onLanguage={setLanguage}
            minutes={minutes}
            onMinutes={setMinutes}
            maxMinutes={maxMinutes}
            path={useExisting ? [] : steps.map((s) => ({ appType: s.draft.appType, title: titleOf(s.draft) }))}
          />
        )}
      </div>

      <footer className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {prevStep ? (
          <Button type="button" variant="ghost" onClick={() => go(useExisting ? "theme" : prevStep)}><ArrowLeft className="mr-2 h-4 w-4" />{t("room.wizard.back")}</Button>
        ) : <span />}
        {nextStep ? (
          <Button type="button" size="lg" onClick={() => go(useExisting ? "launch" : nextStep)} disabled={!canGo(useExisting ? "launch" : nextStep)}>
            {t("room.wizard.next")}<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" size="lg" className="lampo-launch" onClick={() => void open()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}{t("room.open.submit")}
          </Button>
        )}
      </footer>
      {!user && <p className="text-center text-xs text-muted-foreground">{t("room.open.anonymousNote")}</p>}
    </Page>
  );
};

/** A light page: no dashboard chrome, just the navbar and a centred column. */
const Page = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <Navbar />
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">{children}</main>
  </div>
);

export default OpenRoomPage;

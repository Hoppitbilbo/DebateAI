import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Award, Bot, Download, LayoutDashboard, Loader2, MessagesSquare, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { useAuth } from "@/context/auth";
import type { ActivityMessage } from "../types";
import type { EvaluationResult } from "@/utils/evaluationUtils";
import DiffusionText from "../diffusion/DiffusionText";
import { useDiffusionPreference } from "../diffusion/useDiffusionPreference";

/** The easter egg: this many clicks on the feedback title, close together, switch the diffusion effect. */
const SECRET_CLICKS = 3;
const SECRET_WINDOW_MS = 800;

/** Counts quick clicks; calls `onSecret` at the third one. */
const useSecretClicks = (onSecret: () => void) => {
  const clicks = useRef<number[]>([]);
  return () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < SECRET_WINDOW_MS), now];
    if (clicks.current.length < SECRET_CLICKS) return;
    clicks.current = [];
    onSecret();
  };
};

interface FeedbackStepProps {
  evaluation: EvaluationResult | null;
  partial: string;
  loading: boolean;
  error?: string | null;
  reflection: string;
  messages: ActivityMessage[];
  facts?: { label: string; value: React.ReactNode }[];
  onRestart: () => void;
  restartLabel?: string;
  isAssignment?: boolean;
  title: string;
  /** Whether the work reached the teacher (see SubmitNotice). */
  submission?: React.ReactNode;
}

const ScoreCard = ({ label, value }: { label: string; value?: number }) => (
  <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 font-heading text-3xl font-bold text-primary">{value ?? "–"}<span className="text-base text-muted-foreground">/10</span></p>
  </div>
);

const FeedbackStep = ({ evaluation, partial, loading, error, reflection, messages, facts, onRestart, restartLabel, isAssignment, title, submission }: FeedbackStepProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const diffusion = useDiffusionPreference();
  /** The feedback text the diffusion already settled into (it plays once per text). */
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const onTitleClick = useSecretClicks(() => {
    toast(diffusion.enabled ? t("platform.feedback.diffusionOff") : t("platform.feedback.diffusionOn"));
    diffusion.toggle();
    setSettledFor(null);
  });
  const final = evaluation?.markdown ?? "";
  const shown = evaluation?.markdown || partial;
  // With the effect on, the streamed text stays hidden: it appears all at once, from noise.
  const diffusing = diffusion.active && !!final && !loading && settledFor !== final;
  const waiting = diffusion.active ? loading || !final : !shown;

  const download = () => {
    const lines = [
      `# ${title}`,
      "",
      ...(facts ?? []).map((f) => `- **${f.label}**: ${typeof f.value === "string" ? f.value : ""}`),
      "",
      `## ${t("platform.feedback.conversation")}`,
      ...messages.filter((m) => m.content).map((m) => `**${m.role === "user" ? m.name || t("platform.common.you") : m.name || "AI"}**: ${m.content}`),
      "",
      `## ${t("platform.feedback.yourReflection")}`,
      reflection || "-",
      "",
      `## ${t("platform.feedback.aiFeedback")}`,
      evaluation?.markdown ?? partial,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {submission}
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Award className="h-7 w-7 text-primary" />
          <h2 className="font-heading text-2xl font-bold">{t("platform.feedback.title")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreCard label={t("platform.feedback.scoreConversation")} value={evaluation?.scoreConversation} />
          <ScoreCard label={t("platform.feedback.scoreReflection")} value={evaluation?.scoreReflection} />
        </div>
        {facts && facts.length > 0 && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-2">
                <dt className="font-medium text-muted-foreground">{f.label}:</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Bot className="h-5 w-5 text-primary" />
          <button type="button" onClick={onTitleClick} className="cursor-text select-none text-left [font:inherit]">{t("platform.feedback.aiFeedback")}</button>
        </h3>
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : diffusing ? (
          <DiffusionText markdown={final} onDone={() => setSettledFor(final)} />
        ) : waiting ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("platform.feedback.generating")}
          </p>
        ) : (
          <div className={diffusion.active ? "phase-enter" : undefined}>
            <MarkdownViewer content={shown} />
          </div>
        )}
        {loading && !waiting && <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />}
      </section>

      {reflection && (
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <User className="h-5 w-5 text-primary" /> {t("platform.feedback.yourReflection")}
          </h3>
          <p className="whitespace-pre-wrap text-sm">{reflection}</p>
        </section>
      )}

      <details className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <MessagesSquare className="h-5 w-5 text-primary" /> {t("platform.feedback.conversation")} ({messages.filter((m) => m.role !== "system").length})
        </summary>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto text-sm">
          {messages.filter((m) => m.content).map((m) => (
            <p key={m.id}>
              <span className="font-semibold text-primary">{m.role === "user" ? m.name || t("platform.common.you") : m.role === "system" ? "•" : m.name || "AI"}:</span>{" "}
              {m.content}
            </p>
          ))}
        </div>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onRestart} disabled={loading}>
          <RotateCcw className="mr-2 h-4 w-4" /> {restartLabel ?? t("platform.feedback.newActivity")}
        </Button>
        <Button variant="outline" onClick={download} disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> {t("platform.feedback.download")}
        </Button>
        {user && (
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" /> {user.roomId ? t("room.guest.backToPath") : isAssignment ? t("platform.feedback.backToAssignments") : t("platform.nav.dashboard")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default FeedbackStep;

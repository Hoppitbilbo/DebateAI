import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityPhase, AppMeta } from "../types";
import type { ActivityFlow, EvaluationBrief } from "../useActivityFlow";
import ActivityShell from "./ActivityShell";
import ChatPanel from "./ChatPanel";
import FeedbackStep from "./FeedbackStep";
import ReflectionStep from "./ReflectionStep";
import { SetupCard } from "./SetupCard";

type ChatPanelProps = ComponentProps<typeof ChatPanel>;

interface ActivityRunnerProps {
  app: AppMeta;
  flow: ActivityFlow;
  /** Restarts the activity (usually flow.restart with the app's own reset). */
  onRestart: () => void;
  phaseLabels?: Partial<Record<ActivityPhase, string>>;
  setup: {
    title: string;
    description: string;
    canStart: boolean;
    starting?: boolean;
    onStart: () => void;
    children: ReactNode;
  };
  chat: {
    /** False while the choices needed by the chat are missing. */
    ready: boolean;
    /** Replaces the chat panel (e.g. the final guess of the mystery game). */
    replacement?: ReactNode;
  } & Pick<ChatPanelProps, "onSend" | "placeholder"> &
    Partial<Omit<ChatPanelProps, "onSend" | "placeholder" | "messages">>;
  reflection: {
    prompt: string;
    summary?: ReactNode;
    /** Whether to say why the chat ended (goal reached, turn limit); default true. */
    showEndReason?: boolean;
    /** What the evaluator must know about this activity. */
    brief: () => EvaluationBrief;
  };
  feedback: {
    title: string;
    facts: { label: string; value: ReactNode }[];
  };
}

/**
 * The page of a learning app (Template Method by composition): it lays out
 * setup → chat → reflection → feedback with the shared behaviour, and the app
 * fills in only its own parts.
 */
const ActivityRunner = ({ app, flow, onRestart, phaseLabels, setup, chat, reflection, feedback }: ActivityRunnerProps) => {
  const { t } = useTranslation();
  const { phase, session, engine, evaluation, minTurns } = flow;
  const { ready, replacement, ...chatProps } = chat;

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={onRestart} phaseLabels={phaseLabels}>
      {phase === "setup" && (
        <SetupCard title={setup.title} description={setup.description} onStart={setup.onStart} canStart={setup.canStart} starting={setup.starting}>
          {setup.children}
        </SetupCard>
      )}

      {phase === "chat" && ready && (replacement ?? (
        <ChatPanel
          messages={engine.messages}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          onEnd={flow.finishChat}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
          onRetry={(id) => void engine.retry(id)}
          canRetry={engine.canRetry}
          {...chatProps}
        />
      ))}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={reflection.prompt}
          summary={reflection.summary}
          onSubmit={(text) => flow.submitReflection(text, reflection.brief())}
          optional={!session.requireReflection}
          endReason={reflection.showEndReason === false ? undefined : session.endReason}
        />
      )}

      {phase === "feedback" && (
        <FeedbackStep
          title={feedback.title}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={feedback.facts}
          onRestart={onRestart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default ActivityRunner;

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { WikiRef } from "@/lib/api";
import ActivityShell from "@/features/activity/components/ActivityShell";
import ChatPanel from "@/features/activity/components/ChatPanel";
import ReflectionStep from "@/features/activity/components/ReflectionStep";
import FeedbackStep from "@/features/activity/components/FeedbackStep";
import { CharacterPicker, SetupCard } from "@/features/activity/components/SetupCard";
import { useActivitySession, EndReason } from "@/features/activity/useActivitySession";
import { useChatEngine } from "@/features/activity/useChatEngine";
import { useEvaluationFlow } from "@/features/activity/useEvaluationFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { prompts } from "@/features/activity/prompts";
import { APPS, ActivityPhase } from "@/features/activity/types";

const app = APPS["wiki-chatbot"];

const WikiChatbotPage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [page, setPage] = useState<WikiRef | null>(null);

  useEffect(() => {
    if (preset.character) setPage(preset.character);
  }, [preset.character]);

  const { summaries, loading } = useWikiSummaries([page]);
  const summary = bioOf(page, summaries);
  const system = page ? prompts.wikiChat(page.title, summary, session.assignment) : "";

  const onEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
    setPhase("reflection");
  }, [t]);

  const engine = useChatEngine({
    session,
    live: phase === "chat" && page ? { systemInstruction: system, characterName: page.title, characterBio: summary } : null,
    context: { page: page?.title },
    onEnded,
  });
  const evaluation = useEvaluationFlow(session);

  const start = async () => {
    if (!page) return;
    await session.begin(page.title, { page });
    engine.reset([{ id: "welcome", role: "assistant", name: page.title, content: t("platform.apps.wikiChatbot.welcome", { title: page.title }) }]);
    setPhase("chat");
  };

  const send = (text: string) => engine.runTurn(text, () => engine.respond({ system, name: page?.title }));

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.character) setPage(null);
    setPhase("setup");
  };

  const minTurns = Math.max(2, session.minTurns);

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={restart}>
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.wikiChatbot.setupTitle")}
          description={t("platform.apps.wikiChatbot.setupDescription")}
          onStart={start}
          canStart={!!page && !loading}
          starting={loading}
        >
          <CharacterPicker label={t("platform.apps.wikiChatbot.topicLabel")} value={page} onChange={setPage} locked={!!preset.character} />
          {page && summary && <p className="line-clamp-6 rounded-md bg-background/50 p-3 text-sm text-muted-foreground">{summary}</p>}
        </SetupCard>
      )}

      {phase === "chat" && page && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          placeholder={t("platform.apps.wikiChatbot.placeholder", { title: page.title })}
          live={engine.live}
          onEnd={() => {
            session.markManualEnd();
            engine.live.stopLive();
            setPhase("reflection");
          }}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
        />
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.wikiChatbot.reflectionPrompt", { title: page?.title })}
          onSubmit={(reflection) => {
            setPhase("feedback");
            void evaluation.run({
              activity: `${t("apps.wikiChatbot.title")}: ${page?.title}`,
              characters: page?.title ?? "",
              topic: page?.title,
              messages: engine.messagesRef.current,
              reflection,
            });
          }}
          optional={!session.requireReflection}
          endReason={session.endReason}
        />
      )}

      {phase === "feedback" && (
        <FeedbackStep
          title={`${t("apps.wikiChatbot.title")} - ${page?.title ?? ""}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[{ label: t("platform.apps.wikiChatbot.topicLabel"), value: page?.title }]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default WikiChatbotPage;

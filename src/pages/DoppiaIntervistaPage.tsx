import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { WikiRef } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ActivityShell from "@/features/activity/components/ActivityShell";
import ChatPanel from "@/features/activity/components/ChatPanel";
import ReflectionStep from "@/features/activity/components/ReflectionStep";
import FeedbackStep from "@/features/activity/components/FeedbackStep";
import { CharacterPicker, SetupCard } from "@/features/activity/components/SetupCard";
import { useActivitySession, EndReason } from "@/features/activity/useActivitySession";
import { toHistory, useChatEngine } from "@/features/activity/useChatEngine";
import { useEvaluationFlow } from "@/features/activity/useEvaluationFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { prompts } from "@/features/activity/prompts";
import { APPS, ActivityPhase } from "@/features/activity/types";

const app = APPS["doppia-intervista"];
type Target = "both" | "a" | "b";

const SPEAKER_STYLES = {
  a: "border-l-4 border-l-sky-400",
  b: "border-l-4 border-l-amber-400",
};

const DoppiaIntervistaPage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [chars, setChars] = useState<[WikiRef | null, WikiRef | null]>([null, null]);
  const [target, setTarget] = useState<Target>("both");

  useEffect(() => {
    if (preset.characters?.length === 2) setChars([preset.characters[0], preset.characters[1]]);
  }, [preset.characters]);

  const [a, b] = chars;
  const { summaries, loading } = useWikiSummaries(chars);

  const onEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
    setPhase("reflection");
  }, [t]);

  const engine = useChatEngine({ session, context: { characters: [a?.title, b?.title] }, onEnded });
  const evaluation = useEvaluationFlow(session);

  const canStart = !!a && !!b && a.title !== b.title && !loading;

  const start = async () => {
    if (!a || !b) return;
    await session.begin(`${a.title} & ${b.title}`, { characters: [a, b] });
    engine.reset([
      { id: "ga", role: "assistant", name: a.title, speakerKey: "a", content: t("platform.apps.doppiaIntervista.greeting", { name: a.title }) },
      { id: "gb", role: "assistant", name: b.title, speakerKey: "b", content: t("platform.apps.doppiaIntervista.greeting", { name: b.title }) },
    ]);
    setPhase("chat");
  };

  const send = (text: string) => {
    if (!a || !b) return;
    const to = target === "both" ? undefined : target;
    return engine.runTurn(
      text,
      async () => {
        const speakers = target === "both" ? (["a", "b"] as const) : ([target] as const);
        for (const key of speakers) {
          const me = key === "a" ? a : b;
          const other = key === "a" ? b : a;
          await engine.respond({
            system: prompts.interview(me.title, bioOf(me, summaries), other.title, session.assignment),
            history: toHistory(engine.messagesRef.current, key),
            name: me.title,
            speakerKey: key,
          });
        }
      },
      undefined,
      to,
    );
  };

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.characters) setChars([null, null]);
    setTarget("both");
    setPhase("setup");
  };

  const minTurns = Math.max(2, session.minTurns);

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={restart}>
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.doppiaIntervista.setupTitle")}
          description={t("platform.apps.doppiaIntervista.setupDescription")}
          onStart={start}
          canStart={canStart}
          starting={loading}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <CharacterPicker label={t("platform.apps.common.characterN", { n: 1 })} value={a} onChange={(v) => setChars([v, b])} locked={!!preset.characters} />
            <CharacterPicker label={t("platform.apps.common.characterN", { n: 2 })} value={b} onChange={(v) => setChars([a, v])} locked={!!preset.characters} />
          </div>
          {a && b && a.title === b.title && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
        </SetupCard>
      )}

      {phase === "chat" && a && b && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          speakerStyles={SPEAKER_STYLES}
          placeholder={t("platform.apps.doppiaIntervista.placeholder")}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("platform.apps.doppiaIntervista.askTo")}</span>
              <ToggleGroup type="single" size="sm" value={target} onValueChange={(v) => v && setTarget(v as Target)}>
                <ToggleGroupItem value="both">{t("platform.apps.doppiaIntervista.both")}</ToggleGroupItem>
                <ToggleGroupItem value="a" className="data-[state=on]:text-sky-300">{a.title}</ToggleGroupItem>
                <ToggleGroupItem value="b" className="data-[state=on]:text-amber-300">{b.title}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          }
          onEnd={() => {
            session.markManualEnd();
            setPhase("reflection");
          }}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
        />
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.doppiaIntervista.reflectionPrompt", { a: a?.title, b: b?.title })}
          onSubmit={(reflection) => {
            setPhase("feedback");
            void evaluation.run({
              activity: `${t("apps.doppiaIntervista.title")}: ${t("platform.apps.doppiaIntervista.evalActivity", { a: a?.title, b: b?.title })}`,
              characters: `${a?.title} & ${b?.title}`,
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
          title={`${t("apps.doppiaIntervista.title")} - ${a?.title} & ${b?.title}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[{ label: t("platform.apps.common.characters"), value: `${a?.title} & ${b?.title}` }]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default DoppiaIntervistaPage;

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AppType, Assignment, TranscriptMessage } from "@/lib/api";
import type { PromptRecipe } from "@/services/aiService";
import type { EvaluationInput } from "@/utils/evaluationUtils";
import { type ActivityMessage, type ActivityPhase, newId } from "./types";
import { EndReason, useActivitySession } from "./useActivitySession";
import { useChatEngine } from "./useChatEngine";
import { useEvaluationFlow } from "./useEvaluationFlow";

interface LiveConfig {
  recipe?: PromptRecipe;
  characterName?: string;
  characterBio?: string;
}

interface FlowOptions {
  /** Gemini Live voice settings for the current phase, or null when voice is off. */
  live?: (phase: ActivityPhase, assignment: Assignment | null) => LiveConfig | null;
  /** Extra context saved with the transcript (characters, topic...), fixed or depending on the assignment. */
  context?: Record<string, unknown> | ((assignment: Assignment | null) => Record<string, unknown>);
  /**
   * Called when the server ends the activity. By default the chat stays on
   * screen, so the student can read the last reply, and they move on to the
   * reflection with the chat's continue button.
   */
  onEnded?: (reason: EndReason) => void;
  /**
   * Rebuilds the app's setup (characters, topic…) from the context saved
   * with an attempt, when it is taken up again after a reload.
   */
  restore?: (context: Record<string, unknown>, messages: ActivityMessage[]) => void;
}

/** A title saved as text or as a Wikipedia reference ({ title }). */
export const titleOf = (v: unknown): string | undefined => {
  const title = typeof v === "string" ? v : (v as { title?: unknown } | null)?.title;
  return typeof title === "string" && title.trim() ? title : undefined;
};

/**
 * The saved conversation as chat messages. In apps with two characters
 * (context.characters) each line gets its speaker back from the name.
 */
export const restoredMessages = (transcript: TranscriptMessage[], context: Record<string, unknown>): ActivityMessage[] => {
  const pair = Array.isArray(context.characters) ? context.characters.map(titleOf) : [];
  return (transcript ?? []).map((m) => {
    const index = m.role === "assistant" && m.name ? pair.indexOf(m.name) : -1;
    return { id: newId(), role: m.role, content: m.content, name: m.name, ...(index === 0 || index === 1 ? { speakerKey: index === 0 ? "a" : "b" } : {}) };
  });
};

/** What the evaluator needs besides the conversation and the reflection. */
export type EvaluationBrief = Omit<EvaluationInput, "messages" | "reflection" | "assignment" | "jev" | "sessionId">;

/**
 * The steps every activity goes through: setup → chat → reflection → feedback.
 * It owns the phase, the server session, the chat engine and the evaluation,
 * so that an app only describes what is specific to it (see ActivityRunner).
 */
export const useActivityFlow = (appType: AppType, { live, context, onEnded, restore }: FlowOptions = {}) => {
  const { t } = useTranslation();
  const session = useActivitySession(appType);
  const [phase, setPhase] = useState<ActivityPhase>("setup");

  const defaultOnEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
  }, [t]);

  const engine = useChatEngine({
    session,
    live: live?.(phase, session.assignment) ?? null,
    context: typeof context === "function" ? context(session.assignment) : context,
    onEnded: onEnded ?? defaultOnEnded,
  });
  const evaluation = useEvaluationFlow(session);

  // After a reload, the attempt in the address is taken up again (once, when
  // the assignment it belongs to has loaded). Only the one there when the
  // page opened: starting an attempt writes its own id in the address.
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const resumeTried = useRef(false);
  const resumeId = useRef(session.resumeId).current;
  const { loadingAssignment, user } = session;
  useEffect(() => {
    if (resumeTried.current || !resumeId || !user || loadingAssignment) return;
    resumeTried.current = true;
    void session.resume().then((d) => {
      if (!d) return;
      const saved = d.context ?? {};
      const messages = restoredMessages(d.transcript, saved);
      restoreRef.current?.(saved, messages);
      engine.reset(messages);
      setPhase("chat");
      toast.info(t("platform.activity.resumed"));
    });
  }, [resumeId, user, loadingAssignment, session, engine, t]);

  /**
   * Starts a server session and opens the chat with the given first messages.
   * Returns false, staying on the setup, when an assignment's attempt could
   * not be created: work the teacher expects must not silently go unsaved.
   * Free practice goes on locally (session.startFailed tells the student).
   */
  const begin = async (title: string, sessionContext: Record<string, unknown>, intro: ActivityMessage[]) => {
    if (session.starting) return false;
    const id = await session.begin(title, sessionContext);
    if (id === null && session.user && session.assignment) {
      toast.error(t("platform.activity.startFailed"));
      return false;
    }
    engine.reset(intro);
    setPhase("chat");
    return true;
  };

  /** The student ends the conversation, or moves on after the server ended it (its reason is kept). */
  const finishChat = () => {
    session.markManualEnd();
    engine.live.stopLive();
    setPhase("reflection");
  };

  /** Hands in the reflection and asks for the AI evaluation. */
  const submitReflection = (reflection: string, brief: EvaluationBrief) => {
    setPhase("feedback");
    void evaluation.run({ ...brief, messages: engine.messagesRef.current, reflection });
  };

  /** Back to the setup; resetSetup clears the app's own choices. */
  const restart = (resetSetup?: () => void) => {
    session.forget(); // a restart is a new attempt
    engine.reset();
    evaluation.reset();
    resetSetup?.();
    setPhase("setup");
  };

  return {
    session,
    /** Values the teacher fixed in the assignment (empty without one). */
    preset: session.assignment?.config ?? {},
    phase,
    setPhase,
    engine,
    evaluation,
    /** Turns the student must take before ending the chat. */
    minTurns: Math.max(2, session.minTurns),
    begin,
    finishChat,
    submitReflection,
    restart,
  };
};

export type ActivityFlow = ReturnType<typeof useActivityFlow>;

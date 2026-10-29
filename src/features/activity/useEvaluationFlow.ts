import { useCallback, useState } from "react";
import i18n from "@/i18n";
import { evaluateActivity, EvaluationInput, EvaluationResult, parseEvaluation } from "@/utils/evaluationUtils";
import { useAiClient } from "@/services/aiClient";
import type { ActivitySession } from "./useActivitySession";

/**
 * Reflection → AI evaluation → session completion, shared by all apps. A
 * saved attempt is evaluated and handed in by the server, from the
 * transcript it stored; without a session the evaluation runs through the
 * generic AI endpoint and nothing is handed in.
 */
export const useEvaluationFlow = (session: ActivitySession) => {
  const ai = useAiClient();
  const [reflection, setReflection] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [partial, setPartial] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (input: Omit<EvaluationInput, "assignment" | "jev" | "sessionId">) => {
    setReflection(input.reflection);
    setEvaluation(null);
    setPartial("");
    setError(null);
    setLoading(true);
    try {
      const preview = (_d: string, full: string) => setPartial(parseEvaluation(full).markdown);
      const { messages: _messages, reflection, ...about } = input;
      const graded = await session.evaluate({ ...about, reflection, locale: i18n.language || "it" }, preview);
      if (graded) {
        setEvaluation({ markdown: graded.evaluation, scoreConversation: graded.scoreConversation, scoreReflection: graded.scoreReflection });
        return;
      }
      setEvaluation(await evaluateActivity({ ...input, assignment: session.assignment, jev: session.jev, sessionId: null }, setPartial, ai));
    } catch (e) {
      setError(ai.formatError(e));
      await session.complete({ reflection: input.reflection });
    } finally {
      setLoading(false);
    }
  }, [session, ai]);

  const reset = useCallback(() => {
    setReflection("");
    setEvaluation(null);
    setPartial("");
    setError(null);
    setLoading(false);
  }, []);

  return { reflection, evaluation, partial, loading, error, run, reset };
};

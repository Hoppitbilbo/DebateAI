import { useCallback, useState } from "react";
import { evaluateActivity, EvaluationInput, EvaluationResult } from "@/utils/evaluationUtils";
import { useAiClient } from "@/services/aiClient";
import type { ActivitySession } from "./useActivitySession";

/** Reflection → AI evaluation → session completion, shared by all apps. */
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
      const res = await evaluateActivity(
        { ...input, assignment: session.assignment, jev: session.jev, sessionId: session.getSessionId() },
        setPartial,
        ai,
      );
      setEvaluation(res);
      await session.complete({
        reflection: input.reflection,
        evaluation: res.markdown,
        scoreConversation: res.scoreConversation,
        scoreReflection: res.scoreReflection,
      });
    } catch (e) {
      setError(ai.formatError(e));
      await session.complete({ reflection: input.reflection, evaluation: "" });
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

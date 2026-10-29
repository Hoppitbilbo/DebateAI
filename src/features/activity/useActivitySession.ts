import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, AppType, Assignment, JudgeResult, SessionSummary, TranscriptMessage } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { evaluateSession, EvaluationRequest, SessionEvaluation } from "@/services/aiService";
import type { ActivityMessage } from "./types";

/** Why the conversation ended; "identified": the mystery character was found (judged by the server). */
export type EndReason = "goal_reached" | "turn_limit" | "identified" | "manual" | null;

/** Whether the last transcript save reached the server. */
export type SaveState = "idle" | "saving" | "saved" | "failed";
/** Whether the work was handed in (separate from getting the AI feedback). */
export type SubmitState = "idle" | "submitting" | "submitted" | "failed";

/** A hand-in without an AI evaluation: the server owns evaluations and scores. */
type Completion = { reflection: string };

/** The attempt was already handed in (e.g. a retry of a request that went through). */
const alreadyHandedIn = (e: unknown) => (e as { code?: string }).code === "session_completed";

interface SyncResponse {
  status: SessionSummary["status"];
  turns: number;
  progress: number;
  ended: boolean;
  reason?: string;
  maxTurns?: number;
  jev?: JudgeResult;
  revision: number;
}

/**
 * Connects an app to the platform: loads the assignment from ?assignment=ID,
 * creates the server-side session (for logged-in users), saves the transcript
 * after each turn and receives the JEV judgement that may end the activity.
 * Works in "guest mode" too: everything is simply kept local.
 */
export const useActivitySession = (appType: AppType) => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const assignmentId = Number(params.get("assignment") || 0);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(assignmentId > 0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [jev, setJev] = useState<JudgeResult | null>(null);
  const [judging, setJudging] = useState(false);
  const [turns, setTurns] = useState(0);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [starting, setStarting] = useState(false);
  /** A logged-in user's attempt could not be created: nothing is saved. */
  const [startFailed, setStartFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const lastSave = useRef<Parameters<typeof sync> | null>(null);
  const lastCompletion = useRef<Completion | null>(null);
  const sessionRef = useRef<number | null>(null);
  const syncSeq = useRef(0);
  // Saves go out one at a time, each on top of the revision the previous one
  // returned: the server refuses a save that lost a race instead of letting
  // an older transcript overwrite a newer one.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const revisionRef = useRef<number | null>(null);
  // Whether the last saved turn was judged by the server (JEV configured,
  // an assignment): otherwise the app decides what the judge would have.
  const judgedRef = useRef(false);

  useEffect(() => {
    if (!assignmentId) {
      setAssignment(null);
      setLoadingAssignment(false);
      return;
    }
    if (!user) {
      setLoadingAssignment(false);
      return;
    }
    let cancelled = false;
    setLoadingAssignment(true);
    api.get<Assignment>(`/api/assignments/${assignmentId}`)
      .then((a) => {
        if (cancelled) return;
        if (a.appType !== appType) {
          setAssignmentError("wrong_app");
        } else {
          setAssignment(a);
        }
      })
      .catch((e: Error) => !cancelled && setAssignmentError(e.message))
      .finally(() => !cancelled && setLoadingAssignment(false));
    return () => {
      cancelled = true;
    };
  }, [assignmentId, appType, user]);

  /** Starts a new attempt. Safe to call for guests (no server session). */
  const begin = useCallback(async (title: string, context: Record<string, unknown> = {}) => {
    setJev(null);
    setTurns(0);
    setEndReason(null);
    setStartFailed(false);
    setSaveState("idle");
    setSubmitState("idle");
    lastSave.current = null;
    lastCompletion.current = null;
    judgedRef.current = false;
    sessionRef.current = null;
    revisionRef.current = null;
    setSessionId(null);
    if (!user) return null;
    setStarting(true);
    try {
      const s = await api.post<SessionSummary>("/api/sessions", {
        appType,
        assignmentId: assignment?.id ?? 0,
        title,
        context,
      });
      sessionRef.current = s.id;
      revisionRef.current = 0;
      setSessionId(s.id);
      return s.id;
    } catch (e) {
      console.warn("Could not create activity session", e);
      setStartFailed(true);
      return null;
    } finally {
      setStarting(false);
    }
  }, [appType, assignment, user]);

  /**
   * Saves the transcript and, for assignments, runs the JEV judge.
   * Returns the end reason when the server decided the activity is over.
   */
  const sync = useCallback(async (messages: ActivityMessage[], context?: Record<string, unknown>, opts: { judge?: boolean } = {}): Promise<EndReason> => {
    const userTurns = messages.filter((m) => m.role === "user" && m.content.trim()).length;
    setTurns(userTurns);
    const id = sessionRef.current;
    if (!id) {
      if (assignment?.maxTurns && userTurns >= assignment.maxTurns) {
        setEndReason("turn_limit");
        return "turn_limit";
      }
      return null;
    }
    const transcript: TranscriptMessage[] = messages
      .filter((m) => !m.streaming && !m.error && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content, name: m.name }));
    const seq = ++syncSeq.current;
    lastSave.current = [messages, context, opts];
    setSaveState("saving");
    if (assignment) setJudging(true);
    const save = async () => {
      const base = sessionRef.current === id ? revisionRef.current : null;
      const res = await api.put<SyncResponse>(`/api/sessions/${id}/transcript`, {
        messages: transcript, context, ...(opts.judge !== undefined ? { judge: opts.judge } : {}), ...(base !== null ? { baseRevision: base } : {}),
      });
      if (sessionRef.current === id && typeof res.revision === "number") revisionRef.current = res.revision;
      return res;
    };
    const queued = saveQueue.current.then(save);
    saveQueue.current = queued.catch(() => undefined);
    try {
      const res = await queued;
      if (seq !== syncSeq.current) return null; // a newer sync superseded this one
      setSaveState("saved");
      judgedRef.current = !!res.jev && res.jev.engine !== "none" && !res.jev.error;
      if (res.jev && res.jev.engine !== "none") setJev(res.jev);
      if (res.ended && res.reason) {
        const reason = res.reason as EndReason;
        setEndReason(reason);
        return reason;
      }
    } catch (e) {
      // Saved elsewhere meanwhile (e.g. a retried request that did go
      // through): the next save goes out without a base revision.
      if ((e as { code?: string }).code === "stale_revision" && sessionRef.current === id) revisionRef.current = null;
      console.warn("Transcript sync failed", e);
      if (seq === syncSeq.current) setSaveState("failed");
    } finally {
      if (seq === syncSeq.current) setJudging(false);
    }
    return null;
  }, [assignment]);

  /** Sends the latest transcript again after a failed save. */
  const retrySave = useCallback(async () => {
    if (lastSave.current) await sync(...lastSave.current);
  }, [sync]);

  /** Hands the work in; true once the server acknowledged it (or there is no server session). */
  const complete = useCallback(async (data: Completion) => {
    const id = sessionRef.current;
    if (!id) return true;
    lastCompletion.current = data;
    setSubmitState("submitting");
    try {
      await saveQueue.current; // the last transcript save goes first
      await api.post(`/api/sessions/${id}/complete`, data);
      setSubmitState("submitted");
      return true;
    } catch (e) {
      if (alreadyHandedIn(e)) {
        setSubmitState("submitted");
        return true;
      }
      console.warn("Could not complete session", e);
      setSubmitState("failed");
      return false;
    }
  }, []);

  /**
   * Has the server evaluate the saved attempt and hand it in with the
   * result, after the last transcript save. Null without a server session
   * (the caller evaluates locally, nothing is saved). Throws when the
   * evaluation failed: the caller then hands in the reflection alone.
   */
  const evaluate = useCallback(async (request: EvaluationRequest, onDelta: (chunk: string, full: string) => void): Promise<SessionEvaluation | null> => {
    const id = sessionRef.current;
    if (!id) return null;
    lastCompletion.current = { reflection: request.reflection };
    setSubmitState("submitting");
    await saveQueue.current; // the last transcript save goes first
    const res = await evaluateSession(id, request, onDelta);
    setSubmitState("submitted");
    return res;
  }, []);

  /** Hands in again what a failed submission carried. */
  const retrySubmit = useCallback(async () => {
    if (lastCompletion.current) return complete(lastCompletion.current);
    return false;
  }, [complete]);

  const getSessionId = useCallback(() => sessionRef.current, []);
  /** Whether the server judged the last saved turn. */
  const judgedLastTurn = useCallback(() => judgedRef.current, []);

  const markManualEnd = useCallback(() => setEndReason((r) => r ?? "manual"), []);

  const turnsLeft = assignment?.maxTurns ? Math.max(0, assignment.maxTurns - turns) : null;

  return {
    user,
    assignmentId,
    assignment,
    assignmentError,
    loadingAssignment,
    sessionId,
    getSessionId,
    judgedLastTurn,
    jev,
    judging,
    turns,
    turnsLeft,
    endReason,
    starting,
    startFailed,
    saveState,
    submitState,
    begin,
    sync,
    retrySave,
    complete,
    evaluate,
    retrySubmit,
    markManualEnd,
    allowLive: assignment ? assignment.allowLive : true,
    requireReflection: assignment ? assignment.requireReflection : true,
    minTurns: assignment?.minTurns ?? 0,
  };
};

export type ActivitySession = ReturnType<typeof useActivitySession>;

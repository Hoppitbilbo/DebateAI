import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, AppType, Assignment, JudgeResult, SessionSummary, TranscriptMessage } from "@/lib/api";
import { useAuth } from "@/context/auth";
import type { ActivityMessage } from "./types";

export type EndReason = "goal_reached" | "turn_limit" | "manual" | null;

interface SyncResponse {
  status: SessionSummary["status"];
  turns: number;
  progress: number;
  ended: boolean;
  reason?: string;
  maxTurns?: number;
  jev?: JudgeResult;
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
  const sessionRef = useRef<number | null>(null);
  const syncSeq = useRef(0);

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
    sessionRef.current = null;
    setSessionId(null);
    if (!user) return null;
    try {
      const s = await api.post<SessionSummary>("/api/sessions", {
        appType,
        assignmentId: assignment?.id ?? 0,
        title,
        context,
      });
      sessionRef.current = s.id;
      setSessionId(s.id);
      return s.id;
    } catch (e) {
      console.warn("Could not create activity session", e);
      return null;
    }
  }, [appType, assignment, user]);

  /**
   * Saves the transcript and, for assignments, runs the JEV judge.
   * Returns the end reason when the server decided the activity is over.
   */
  const sync = useCallback(async (messages: ActivityMessage[], context?: Record<string, unknown>): Promise<EndReason> => {
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
      .filter((m) => !m.streaming && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content, name: m.name }));
    const seq = ++syncSeq.current;
    if (assignment) setJudging(true);
    try {
      const res = await api.put<SyncResponse>(`/api/sessions/${id}/transcript`, { messages: transcript, context });
      if (seq !== syncSeq.current) return null; // a newer sync superseded this one
      if (res.jev && res.jev.engine !== "none") setJev(res.jev);
      if (res.ended && res.reason) {
        const reason = res.reason as EndReason;
        setEndReason(reason);
        return reason;
      }
    } catch (e) {
      console.warn("Transcript sync failed", e);
    } finally {
      if (seq === syncSeq.current) setJudging(false);
    }
    return null;
  }, [assignment]);

  const complete = useCallback(async (data: { reflection: string; evaluation: string; scoreConversation?: number; scoreReflection?: number }) => {
    const id = sessionRef.current;
    if (!id) return;
    try {
      await api.post(`/api/sessions/${id}/complete`, data);
    } catch (e) {
      console.warn("Could not complete session", e);
    }
  }, []);

  const getSessionId = useCallback(() => sessionRef.current, []);

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
    jev,
    judging,
    turns,
    turnsLeft,
    endReason,
    begin,
    sync,
    complete,
    markManualEnd,
    allowLive: assignment ? assignment.allowLive : true,
    requireReflection: assignment ? assignment.requireReflection : true,
    minTurns: assignment?.minTurns ?? 0,
  };
};

export type ActivitySession = ReturnType<typeof useActivitySession>;

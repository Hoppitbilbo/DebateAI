import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Assignment, ClassInfo, Invite, InviteResult, Member, Role, SessionSummary } from "@/lib/api";

// Data layer of the teacher pages: classes, their members and assignments,
// and the students' progress.

export interface ClassDetail { class: ClassInfo; members: Member[]; invites: Invite[] }

/** The best attempt of a student on an assignment. */
export interface ProgressCell { assignmentId: number; userId: number; status: SessionSummary["status"]; progress: number; sessionId: number; score?: number; costUsd: number }

export interface ProgressRow { userId: number; name: string; email: string; session?: SessionSummary; attemptCount: number }

export const createClass = (c: { name: string; description: string; ownerId?: number }) => api.post<ClassInfo>("/api/classes", c);

export const useMyClasses = () => {
  const qc = useQueryClient();
  return {
    classes: useQuery({ queryKey: ["classes", "mine"], queryFn: () => api.get<ClassInfo[]>("/api/classes?mine=1") }),
    refresh: () => void qc.invalidateQueries({ queryKey: ["classes"] }),
  };
};

/** Everything the class page shows; the progress matrix loads only when needed. */
export const useClass = (classId: number, withProgress: boolean) => {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["class", classId] });
    void qc.invalidateQueries({ queryKey: ["class-assignments", classId] });
    void qc.invalidateQueries({ queryKey: ["class-progress", classId] });
  };
  /** Runs a change, then reloads the class. */
  const andRefresh = <A extends unknown[]>(f: (...args: A) => Promise<unknown>) => async (...args: A) => {
    await f(...args);
    refresh();
  };
  return {
    detail: useQuery({ queryKey: ["class", classId], queryFn: () => api.get<ClassDetail>(`/api/classes/${classId}`) }),
    assignments: useQuery({ queryKey: ["class-assignments", classId], queryFn: () => api.get<Assignment[]>(`/api/classes/${classId}/assignments`) }),
    progress: useQuery({
      queryKey: ["class-progress", classId],
      queryFn: () => api.get<{ cells: ProgressCell[] }>(`/api/classes/${classId}/progress`),
      enabled: withProgress,
    }),
    refresh,
    deleteAssignment: andRefresh((assignmentId: number) => api.del(`/api/assignments/${assignmentId}`)),
    removeMember: andRefresh((userId: number) => api.del(`/api/classes/${classId}/members/${userId}`)),
    regenerateCode: andRefresh(() => api.post(`/api/classes/${classId}/code`)),
    update: andRefresh((change: Partial<Pick<ClassInfo, "name" | "description" | "archived">>) => api.patch(`/api/classes/${classId}`, change)),
    remove: () => api.del(`/api/classes/${classId}`),
  };
};

/** A teacher's view of one assignment, refreshed every 20 seconds. */
export const useAssignmentProgress = (id: string | undefined) =>
  useQuery({
    queryKey: ["assignment-progress", id],
    queryFn: () => api.get<{ assignment: Assignment; students: ProgressRow[] }>(`/api/assignments/${id}/progress`),
    refetchInterval: 20000,
  });

/** Creates an assignment in a class, or updates `existing`. */
export const saveAssignment = (classId: number, existing: Assignment | null, form: Record<string, unknown>) =>
  existing ? api.patch<Assignment>(`/api/assignments/${existing.id}`, form) : api.post<Assignment>(`/api/classes/${classId}/assignments`, form);

/** A bulk invitation: e-mails separated by commas, spaces or new lines. */
export interface InviteRequest { emails: string[]; role: Role; locale: string }

/** Sends invitations and returns one result per address. */
export type InviteSender = (req: InviteRequest) => Promise<InviteResult[]>;

const sendInvites = (endpoint: string): InviteSender => async (req) =>
  (await api.post<{ results: InviteResult[] }>(endpoint, req)).results;

/** Invites into a class (existing accounts are added at once). */
export const inviteToClass = (classId: number) => sendInvites(`/api/classes/${classId}/invite`);

/** Invites new accounts to the platform (admin). */
export const inviteToPlatform: InviteSender = sendInvites("/api/admin/invites");

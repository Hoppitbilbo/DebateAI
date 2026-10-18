import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Assignment, ClassInfo, SessionDetail, SessionSummary } from "@/lib/api";

// Data layer of the student dashboard and of a session's detail page.

export const useMyAssignments = () => useQuery({ queryKey: ["my-assignments"], queryFn: () => api.get<Assignment[]>("/api/me/assignments") });

export const useMyClasses = () => useQuery({ queryKey: ["my-classes"], queryFn: () => api.get<ClassInfo[]>("/api/me/classes") });

export const useMySessions = () => useQuery({ queryKey: ["my-sessions"], queryFn: () => api.get<SessionSummary[]>("/api/me/sessions") });

/** Joins a class with its code and reloads everything (new classes bring new assignments). */
export const useJoinClass = () => {
  const qc = useQueryClient();
  return async (code: string) => {
    const res = await api.post<{ name: string }>("/api/classes/join", { code });
    void qc.invalidateQueries();
    return res;
  };
};

/** One session with its transcript, for its owner or the class teacher. */
export const useSession = (id: string | undefined) =>
  useQuery({ queryKey: ["session", id], queryFn: () => api.get<SessionDetail>(`/api/sessions/${id}`) });

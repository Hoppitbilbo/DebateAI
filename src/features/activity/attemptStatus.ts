import type { SessionSummary } from "@/lib/api";

// What an attempt's status means, in one place. The views ask different
// questions on purpose:
// - the dashboards count an assignment as done once its goals are reached
//   or the work is handed in (doneForAssignment), as the server's class
//   statistics do; using up the turns without reaching the goals is not done;
// - a room's path moves on to the next stop once the conversation is over,
//   whatever the reason (conversationOver);
// - "handed in" means the reflection was submitted (handedIn).

type Status = SessionSummary["status"] | undefined | null;

/** The reflection was handed in. */
export const handedIn = (s: Status) => s === "completed";

/** The conversation can no longer go on (goals reached, turns used up, or handed in). */
export const conversationOver = (s: Status) => s === "goal_reached" || s === "turn_limit" || s === "completed";

/** The assignment counts as done for the student and the teacher's progress. */
export const doneForAssignment = (s: Status) => s === "goal_reached" || s === "completed";

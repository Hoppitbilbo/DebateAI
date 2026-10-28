// Interactive guided tours (data-driven): each page that has one lists its
// steps here. A step points at the element marked with data-tour="<target>";
// without a target (or when the element is not on screen) the step is shown
// in the middle of the page. Texts: platform.tour.<tour>.<step>.title/body.

export type TourId = "teacher" | "classPage" | "student" | "activity";

export interface TourStep {
  id: string;
  target?: string;
}

export const TOURS: Record<TourId, TourStep[]> = {
  teacher: [
    { id: "welcome" },
    { id: "newClass", target: "new-class" },
    { id: "classes", target: "class-grid" },
    { id: "apps", target: "nav-links" },
    { id: "menu", target: "user-menu" },
    { id: "done" },
  ],
  classPage: [
    { id: "newAssignment", target: "new-assignment" },
    { id: "assignments", target: "tab-assignments" },
    { id: "students", target: "tab-students" },
    { id: "progress", target: "tab-progress" },
    { id: "export", target: "export-grades" },
  ],
  student: [
    { id: "welcome" },
    { id: "todo", target: "student-todo" },
    { id: "join", target: "join-class" },
    { id: "practice", target: "free-practice" },
    { id: "history", target: "student-history" },
    { id: "menu", target: "user-menu" },
  ],
  activity: [
    { id: "steps", target: "activity-steps" },
    { id: "assignment", target: "assignment-panel" },
    { id: "setup", target: "activity-main" },
    { id: "tutorial", target: "app-tutorial" },
  ],
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];

/** The i18n keys of one step. */
export const stepKeys = (tour: TourId, step: TourStep) => ({
  title: `platform.tour.${tour}.${step.id}.title`,
  body: `platform.tour.${tour}.${step.id}.body`,
});

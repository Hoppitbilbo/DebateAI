/** The steps of /aula/nuova, in order. */
export const WIZARD_STEPS = ["theme", "path", "launch"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

import { useState } from "react";
import { toast } from "sonner";

const errorMessage = (err: unknown) => (err as Error).message;

/**
 * Runs a form's action with the form busy, and shows a failure as an error
 * toast. `errorText` turns the error into the text to show.
 */
export const useBusyAction = (errorText: (err: unknown) => string = errorMessage) => {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
};

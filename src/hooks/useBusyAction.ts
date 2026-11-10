import { useRef, useState } from "react";
import { toast } from "sonner";

const errorMessage = (err: unknown) => (err as Error).message;

interface BusyActionOptions {
  /** Keep the error text in `error` (shown next to the form) instead of a toast. */
  inline?: boolean;
}

/**
 * Runs a form's action with the form busy, and shows a failure as an error
 * toast (or in `error` with `inline`). `errorText` turns the error into the
 * text to show. A second run while one is in flight is ignored, so a double
 * click sends one request.
 */
export const useBusyAction = (errorText: (err: unknown) => string = errorMessage, { inline = false }: BusyActionOptions = {}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      if (inline) setError(errorText(err));
      else toast.error(errorText(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, run, error, clearError: () => setError(null) };
};

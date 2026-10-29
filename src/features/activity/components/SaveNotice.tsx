import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveState, SubmitState } from "../useActivitySession";

const bar = "flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm";

/**
 * Says when the conversation is not reaching the server: the student must
 * not believe work is saved when it is not. Silent while saves go through.
 */
export const ChatSaveNotice = ({ saveState, startFailed, onRetry }: { saveState: SaveState; startFailed: boolean; onRetry: () => void }) => {
  const { t } = useTranslation();
  if (startFailed) {
    return (
      <p role="status" className={`${bar} border-border bg-muted text-muted-foreground`}>
        <CloudOff className="h-4 w-4 shrink-0" />{t("platform.activity.notSaved")}
      </p>
    );
  }
  if (saveState !== "failed") return null;
  return (
    <div role="alert" className={`${bar} border-destructive/50 bg-destructive/10 text-destructive`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t("platform.activity.saveFailed")}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />{t("platform.activity.retry")}
      </Button>
    </div>
  );
};

/** Whether the work was handed in, kept apart from the AI feedback. */
export const SubmitNotice = ({ state, assignment, onRetry }: { state: SubmitState; assignment: boolean; onRetry: () => void }) => {
  const { t } = useTranslation();
  switch (state) {
    case "submitting":
      return (
        <p role="status" className={`${bar} border-border text-muted-foreground`}>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />{t("platform.feedback.submitting")}
        </p>
      );
    case "submitted":
      return (
        <p role="status" className={`${bar} border-border text-foreground`}>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{t(assignment ? "platform.feedback.submitted" : "platform.feedback.savedToHistory")}
        </p>
      );
    case "failed":
      return (
        <div role="alert" className={`${bar} border-destructive/50 bg-destructive/10 text-destructive`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("platform.feedback.submitFailed")}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />{t("platform.activity.retry")}
          </Button>
        </div>
      );
    default:
      return null;
  }
};

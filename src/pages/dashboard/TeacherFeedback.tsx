import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SessionDetail } from "@/lib/api";
import { useGiveFeedback } from "@/features/teacher/teacherApi";
import { formatDate } from "@/lib/format";
import { Panel } from "./common";

const NO_SCORE = "none";

/** The teacher writes feedback and an optional 0-10 score on a student's attempt. */
export const TeacherFeedbackForm = ({ session }: { session: SessionDetail }) => {
  const { t } = useTranslation();
  const give = useGiveFeedback(session.id);
  const [text, setText] = useState(session.teacherFeedback ?? "");
  const [score, setScore] = useState(session.teacherScore === undefined ? NO_SCORE : String(session.teacherScore));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await give(text, score === NO_SCORE ? null : Number(score));
      toast.success(t("platform.session.feedbackSaved"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={t("platform.session.teacherFeedback")} className="print:hidden">
      <div className="space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("platform.session.feedbackPlaceholder")} className="min-h-[120px]"
          aria-label={t("platform.session.teacherFeedback")} />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={score} onValueChange={setScore}>
            <SelectTrigger className="w-44" aria-label={t("platform.session.teacherScore")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SCORE}>{t("platform.session.noScore")}</SelectItem>
              {Array.from({ length: 11 }, (_, i) => <SelectItem key={i} value={String(i)}>{t("platform.session.teacherScore")}: {i}/10</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={saving || (!text.trim() && score === NO_SCORE)}>
            <Send className="mr-2 h-4 w-4" />{t("platform.session.saveFeedback")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("platform.session.feedbackHint")}</p>
      </div>
    </Panel>
  );
};

/** What the student (and the printout) sees of the teacher's feedback. */
export const TeacherFeedbackView = ({ session }: { session: SessionDetail }) => {
  const { t, i18n } = useTranslation();
  if (!session.teacherFeedback && session.teacherScore === undefined) return null;
  return (
    <Panel title={t("platform.session.teacherFeedback")}>
      {session.teacherScore !== undefined && (
        <p className="mb-2 font-heading text-2xl font-bold text-primary">{session.teacherScore}/10</p>
      )}
      {session.teacherFeedback && <p className="whitespace-pre-wrap text-sm">{session.teacherFeedback}</p>}
      {session.teacherFeedbackAt && (
        <p className="mt-2 text-xs text-muted-foreground">{t("platform.session.givenOn", { date: formatDate(session.teacherFeedbackAt, i18n.language) })}</p>
      )}
    </Panel>
  );
};

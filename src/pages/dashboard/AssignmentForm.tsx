import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Assignment } from "@/lib/api";
import { saveAssignment } from "@/features/teacher/teacherApi";
import { AssignmentDraft, draftBody, draftOf } from "@/features/teacher/assignmentDraft";
import AssignmentFields, { ToggleRow } from "./AssignmentFields";

interface Props {
  classId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Assignment | null;
  onSaved: (a: Assignment) => void;
}

const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Create / edit a class assignment: the activity fields plus due date, publication and e-mail. */
const AssignmentForm = ({ classId, open, onOpenChange, initial, onSaved }: Props) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AssignmentDraft>(draftOf());
  const [published, setPublished] = useState(true);
  const [notify, setNotify] = useState(true);
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(initial));
    setPublished(initial?.published ?? true);
    setNotify(!initial);
    setDueAt(toLocalInput(initial?.dueAt));
  }, [open, initial]);

  const save = async () => {
    if (!draft.title.trim()) return toast.error(t("platform.teacher.form.titleRequired"));
    setSaving(true);
    const body = { ...draftBody(draft), published, notify, dueAt: dueAt ? new Date(dueAt).toISOString() : "" };
    try {
      const a = await saveAssignment(classId, initial ?? null, body);
      toast.success(t("platform.common.saved"));
      onSaved(a);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("platform.teacher.form.editTitle") : t("platform.teacher.form.newTitle")}</DialogTitle>
          <DialogDescription>{t("platform.teacher.form.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <AssignmentFields draft={draft} onChange={setDraft} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="a-due">{t("platform.teacher.form.dueAt")}</Label>
              <Input id="a-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <ToggleRow label={t("platform.teacher.form.published")} hint={t("platform.teacher.form.publishedHint")} checked={published} onChange={setPublished} />
            {published && (!initial || !initial.published) && (
              <ToggleRow label={t("platform.teacher.form.notify")} hint={t("platform.teacher.form.notifyHint")} checked={notify} onChange={setNotify} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("platform.common.cancel")}</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("platform.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentForm;

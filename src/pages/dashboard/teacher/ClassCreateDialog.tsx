import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClassInfo, EnrollmentMode } from "@/lib/api";
import { createClass } from "@/features/teacher/teacherApi";
import { useBusyAction } from "@/hooks/useBusyAction";
import { apiErrorText } from "@/lib/apiErrorText";

/** The two ways students enrol, with literal keys so check:i18n sees them. */
const MODES: { mode: EnrollmentMode; label: string; hint: string }[] = [
  { mode: "standard", label: "platform.teacher.enrollment.standard", hint: "platform.teacher.enrollment.standardHint" },
  { mode: "username", label: "platform.teacher.enrollment.username", hint: "platform.teacher.enrollment.usernameHint" },
];

/** New class: name, description and how the students enrol (e-mail invitations by default). */
const ClassCreateDialog = ({ open, onOpenChange, onCreated, ownerId }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (c: ClassInfo) => void; ownerId?: number }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<EnrollmentMode>("standard");
  const { busy, run, error, clearError } = useBusyAction((e) => apiErrorText(e, t), { inline: true });

  const reset = () => {
    setName("");
    setDescription("");
    setMode("standard");
    clearError();
  };
  const submit = () =>
    run(async () => {
      const c = await createClass({ name, description, enrollmentMode: mode, ownerId });
      onCreated(c);
      reset();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { if (!o) clearError(); onOpenChange(o); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("platform.teacher.newClass")}</DialogTitle>
          <DialogDescription className="sr-only">{t("platform.teacher.enrollment.label")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) void submit(); }}
        >
          <div className="space-y-2"><Label htmlFor="c-name">{t("platform.teacher.className")}</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="3A - Storia" required /></div>
          <div className="space-y-2"><Label htmlFor="c-desc">{t("platform.teacher.classDescription")}</Label><Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <fieldset className="space-y-2">
            <legend id="c-mode-label" className="text-sm font-medium">{t("platform.teacher.enrollment.label")}</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as EnrollmentMode)} aria-labelledby="c-mode-label">
              {MODES.map(({ mode: m, label, hint }) => (
                <div key={m} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem id={`c-mode-${m}`} value={m} className="mt-0.5" aria-describedby={`c-mode-${m}-hint`} />
                  <div className="space-y-1">
                    <Label htmlFor={`c-mode-${m}`}>{t(label)}</Label>
                    <p id={`c-mode-${m}-hint`} className="text-xs text-muted-foreground">{t(hint)}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {mode === "username" && <p className="text-xs text-muted-foreground">{t("platform.teacher.enrollment.pseudonym")}</p>}
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t("platform.common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClassCreateDialog;

import { useTranslation } from "react-i18next";
import { ChevronDown, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { appIconSrc } from "@/lib/appArt";
import type { AssignmentDraft } from "@/features/teacher/assignmentDraft";
import type { PathStep } from "@/features/room/roomPath";
import { pagesOf } from "@/features/room/roomPath";
import PresetFields from "../../dashboard/PresetFields";
import { GoalsEditor, LimitFields, OptionToggles } from "../../dashboard/AssignmentFields";

/**
 * One stop of the room's path. Closed, it says what the students will do;
 * open, it shows the choices that matter (characters, topic, difficulty)
 * and keeps the rest under "More options".
 */
const StepEditor = ({ step, index, open, onToggle, onChange, onRemove, placeholderTitle }: {
  step: PathStep;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (d: AssignmentDraft) => void;
  onRemove?: () => void;
  placeholderTitle: string;
}) => {
  const { t } = useTranslation();
  const { draft } = step;
  const id = `step-${step.key}`;
  const pages = pagesOf(draft);
  const summary = draft.appType === "personaggio-misterioso"
    ? t("room.wizard.mysterySummary", { count: pages.length })
    : pages.join(" · ") || t("room.wizard.studentsChoose");

  return (
    <article className={cn("path-stop story-pop", open && "path-stop--open")}>
      <span className="path-stop__number" aria-hidden="true">{index + 1}</span>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <img src={appIconSrc(draft.appType)} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="min-w-0 flex-1 text-left">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground">{t(`platform.appNames.${draft.appType}`)}</span>
          <span className="block truncate font-heading text-lg font-semibold">{draft.title.trim() || placeholderTitle}</span>
          {!open && <span className="block truncate text-sm text-muted-foreground">{summary}</span>}
        </button>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t("room.wizard.removeStep")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={onToggle} aria-label={open ? t("room.wizard.closeStep") : t("room.wizard.editStep")}>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
        </Button>
      </div>
      {open && (
        <div id={id} className="phase-enter space-y-5 border-t border-border p-4">
          <PresetFields draft={draft} onChange={(config) => onChange({ ...draft, config })} idPrefix={id} />
          <details className="group rounded-md border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> {t("room.wizard.moreOptions")}
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 border-t border-border p-3">
              <div className="space-y-2">
                <Label htmlFor={`${id}-title`}>{t("platform.teacher.form.title")}</Label>
                <Input id={`${id}-title`} value={draft.title} placeholder={placeholderTitle} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-instr`}>{t("platform.teacher.form.instructions")}</Label>
                <Textarea id={`${id}-instr`} value={draft.instructions} onChange={(e) => onChange({ ...draft, instructions: e.target.value })} placeholder={t("platform.teacher.form.instructionsPlaceholder")} />
              </div>
              <GoalsEditor draft={draft} onChange={onChange} />
              <LimitFields draft={draft} onChange={onChange} idPrefix={id} />
              <OptionToggles draft={draft} onChange={onChange} showLive={false} />
            </div>
          </details>
        </div>
      )}
    </article>
  );
};

export default StepEditor;

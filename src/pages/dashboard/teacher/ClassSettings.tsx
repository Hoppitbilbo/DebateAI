import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClassInfo } from "@/lib/api";
import { Panel } from "../common";
import ConfirmButton from "../ConfirmButton";

interface ClassSettingsProps {
  cls: ClassInfo;
  onUpdate: (change: Partial<Pick<ClassInfo, "name" | "description" | "archived">>) => Promise<void>;
  onDelete: () => Promise<unknown>;
}

/** Rename, archive or delete a class. */
const ClassSettings = ({ cls, onUpdate, onDelete }: ClassSettingsProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(cls.name);
  const [description, setDescription] = useState(cls.description);
  return (
    <Panel title={t("platform.teacher.tabs.settings")} className="max-w-2xl">
      <div className="space-y-3">
        <div className="space-y-2"><Label htmlFor="cs-name">{t("platform.teacher.className")}</Label><Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="cs-desc">{t("platform.teacher.classDescription")}</Label><Textarea id="cs-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => { await onUpdate({ name, description }); toast.success(t("platform.common.saved")); }}>{t("platform.common.save")}</Button>
          <Button variant="outline" onClick={() => onUpdate({ archived: !cls.archived })}>
            <Archive className="mr-2 h-4 w-4" /> {cls.archived ? t("platform.teacher.unarchive") : t("platform.teacher.archive")}
          </Button>
          <ConfirmButton
            variant="destructive"
            label={t("platform.teacher.deleteClass")}
            title={t("platform.teacher.deleteClass")}
            description={t("platform.teacher.deleteClassText")}
            onConfirm={async () => { await onDelete(); window.location.href = "/teacher"; }}
          />
        </div>
      </div>
    </Panel>
  );
};

export default ClassSettings;

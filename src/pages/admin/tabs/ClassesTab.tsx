import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminClasses, useTeachers } from "@/features/admin/adminApi";
import { Panel, Spinner } from "../../dashboard/common";
import ClassCreateDialog from "../../dashboard/teacher/ClassCreateDialog";
import ClassGrid from "../../dashboard/teacher/ClassGrid";

const ClassesTab = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<string>("");
  const { classes, refresh } = useAdminClasses();
  const teachers = useTeachers();
  return (
    <Panel
      title={t("platform.admin.tabs.classes")}
      actions={
        <div className="flex gap-2">
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("platform.admin.classes.ownerMe")} /></SelectTrigger>
            <SelectContent>{(teachers.data ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newClass")}</Button>
        </div>
      }
    >
      {classes.isLoading ? <Spinner /> : <ClassGrid classes={classes.data ?? []} />}
      <ClassCreateDialog open={open} onOpenChange={setOpen} ownerId={owner ? Number(owner) : undefined} onCreated={refresh} />
    </Panel>
  );
};

export default ClassesTab;

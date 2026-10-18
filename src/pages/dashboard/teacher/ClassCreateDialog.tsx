import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClassInfo } from "@/lib/api";
import { createClass } from "@/features/teacher/teacherApi";

const ClassCreateDialog = ({ open, onOpenChange, onCreated, ownerId }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (c: ClassInfo) => void; ownerId?: number }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("platform.teacher.newClass")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label htmlFor="c-name">{t("platform.teacher.className")}</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="3A - Storia" /></div>
          <div className="space-y-2"><Label htmlFor="c-desc">{t("platform.teacher.classDescription")}</Label><Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              try {
                const c = await createClass({ name, description, ownerId });
                onCreated(c);
                setName("");
                setDescription("");
                onOpenChange(false);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {t("platform.common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassCreateDialog;

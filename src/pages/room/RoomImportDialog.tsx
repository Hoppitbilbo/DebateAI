import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ClassDetail, useMyClasses } from "@/features/teacher/teacherApi";
import { ImportResult, roomApi } from "@/features/room/roomApi";
import { avatarUrl } from "@/features/room/avatars";
import { suggestAll } from "@/features/room/matchNicknames";

interface ImportGuest { nickname: string; avatar: string; sessions: number }

/** Where the guests come from: an open room, or an exported .aula file. */
export type ImportSource = { kind: "room"; roomId: number; hostKey?: string; guests: ImportGuest[] } | { kind: "file" };

const SKIP = "0";

/**
 * Moves the work of a room's guests to the students of a class: the teacher
 * matches each nickname with a student (or skips it); unmatched guests are
 * deleted with the room.
 */
const RoomImportDialog = ({ open, onOpenChange, source, classId: fixedClass, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: ImportSource;
  /** The class to import into; when missing the teacher picks one. */
  classId?: number;
  onDone: (classId: number, r: ImportResult) => void;
}) => {
  const { t } = useTranslation();
  const { classes } = useMyClasses();
  const [classId, setClassId] = useState<number | undefined>(fixedClass);
  const [file, setFile] = useState<string | null>(null);
  const [fileGuests, setFileGuests] = useState<ImportGuest[] | null>(null);
  const [matches, setMatches] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const detail = useQuery({
    queryKey: ["class", classId],
    queryFn: () => api.get<ClassDetail>(`/api/classes/${classId}`),
    enabled: open && !!classId,
  });
  const students = (detail.data?.members ?? []).filter((m) => m.role === "student");
  const guests = source.kind === "room" ? source.guests : fileGuests;

  // Pre-fill the matches when both lists are known.
  useEffect(() => {
    if (guests && detail.data) setMatches(suggestAll(guests.map((g) => g.nickname), students));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, detail.data]);

  const readFile = async (f: File | undefined) => {
    if (!f || !classId) return;
    try {
      const text = await f.text();
      const preview = await roomApi.importPreview(classId, text);
      setFile(text);
      setFileGuests(preview.guests);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirm = async () => {
    if (!classId) return;
    setBusy(true);
    try {
      const list = Object.entries(matches).map(([nickname, studentId]) => ({ nickname, studentId }));
      const from = source.kind === "room" ? { roomId: source.roomId, hostKey: source.hostKey } : { file: file ?? "" };
      const r = await roomApi.importIntoClass(classId, from, list);
      onDone(classId, r);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const matched = Object.values(matches).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("room.import.title")}</DialogTitle>
          <DialogDescription>{source.kind === "room" ? t("room.import.roomText") : t("room.import.fileText")}</DialogDescription>
        </DialogHeader>

        {!fixedClass && (
          <div className="space-y-2">
            <Label>{t("room.import.classLabel")}</Label>
            <Select value={classId ? String(classId) : ""} onValueChange={(v) => setClassId(Number(v))}>
              <SelectTrigger><SelectValue placeholder={t("room.import.classPlaceholder")} /></SelectTrigger>
              <SelectContent>{(classes.data ?? []).filter((c) => !c.archived).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        {source.kind === "file" && classId && !fileGuests && (
          <Label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center text-sm">
            <Upload className="h-6 w-6 text-primary" />{t("room.import.pickFile")}
            <input type="file" accept=".aula,application/json" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
          </Label>
        )}

        {classId && guests && (
          detail.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (
            <div className="space-y-2">
              {students.length === 0 && <p className="text-sm text-amber-700">{t("room.import.noStudents")}</p>}
              <ul className="divide-y divide-border rounded-md border border-border">
                {guests.map((g) => (
                  <li key={g.nickname} className="flex items-center gap-3 p-2">
                    <img src={avatarUrl(g.avatar)} alt="" width={32} height={32} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{g.nickname}</p>
                      <p className="text-xs text-muted-foreground">{t("room.import.attempts", { count: g.sessions })}</p>
                    </div>
                    <Select value={String(matches[g.nickname] ?? 0)} onValueChange={(v) => setMatches((m) => ({ ...m, [g.nickname]: Number(v) }))}>
                      <SelectTrigger className="w-48" aria-label={t("room.import.studentFor", { nickname: g.nickname })}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>{t("room.import.skip")}</SelectItem>
                        {students.map((s) => <SelectItem key={s.userId} value={String(s.userId)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("room.import.summary", { matched, skipped: guests.length - matched })}</p>
            </div>
          )
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("platform.common.cancel")}</Button>
          <Button onClick={() => void confirm()} disabled={busy || !classId || !guests || matched === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{source.kind === "room" ? t("room.import.confirmRoom") : t("room.import.confirmFile")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoomImportDialog;

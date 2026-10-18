import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kind, providerActions } from "@/features/admin/aiAdminApi";
import { Preset, PRESETS } from "@/features/admin/aiPresets";

const AddProviderDialog = ({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) => {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [name, setName] = useState(PRESETS[0].name);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [kind, setKind] = useState<Kind>(PRESETS[0].kind);
  const [busy, setBusy] = useState(false);

  const choose = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(p);
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setKind(p.kind);
  };

  const save = async () => {
    setBusy(true);
    try {
      await providerActions.add({
        name, kind, baseUrl, apiKey,
        models: preset.models?.map((id) => ({ id, free: id.endsWith("-free") || id === "big-pickle" })),
      });
      toast.success(t("platform.admin.ai.providerAdded"));
      setApiKey("");
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("platform.admin.ai.addProvider")}</DialogTitle>
          <DialogDescription>{t("platform.admin.ai.addProviderHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("platform.admin.ai.preset")}</Label>
            <Select value={preset.id} onValueChange={choose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.free ? ` · ${t("platform.admin.ai.freeTier")}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preset.note && <p className="text-xs text-muted-foreground">{t(`platform.admin.ai.${preset.note}`)}</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="p-name">{t("platform.admin.ai.name")}</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {preset.id === "custom" && (
            <div className="space-y-2">
              <Label>{t("platform.admin.ai.kind")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI-compatible</SelectItem>
                  <SelectItem value="anthropic">Anthropic Messages</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="jev">Jev / System One</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {kind !== "gemini" && (
            <div className="space-y-2"><Label htmlFor="p-url">{t("platform.admin.ai.baseUrl")}</Label><Input id="p-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" /></div>
          )}
          {!preset.noKey && (
            <div className="space-y-2">
              <Label htmlFor="p-key" className="flex items-center justify-between">
                {t("platform.admin.ai.apiKey")}
                {preset.keyUrl && <a href={preset.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">{t("platform.admin.ai.getKey")} <ExternalLink className="h-3 w-3" /></a>}
              </Label>
              <Input id="p-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("platform.admin.ai.keyEncrypted")}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || !name.trim() || (!preset.noKey && !apiKey.trim() && preset.id !== "custom")}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("platform.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProviderDialog;

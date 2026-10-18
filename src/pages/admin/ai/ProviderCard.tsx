import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FlaskConical, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Provider, providerActions } from "@/features/admin/aiAdminApi";
import ConfirmButton from "../../dashboard/ConfirmButton";
import ModelInput from "./ModelInput";

const ProviderCard = ({ p, onChanged }: { p: Provider; onChanged: () => void }) => {
  const { t } = useTranslation();
  const [testModel, setTestModel] = useState(p.models[0]?.id ?? "");
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const refreshModels = async () => {
    setRefreshing(true);
    try {
      const m = await providerActions.refreshModels(p.id);
      toast.success(t("platform.admin.ai.modelsFound", { count: m.length }));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await providerActions.test(p.id, testModel);
      setResult(`✅ ${r.latencyMs} ms — ${r.output.slice(0, 160)}`);
    } catch (e) {
      setResult(`❌ ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{p.name}</h3>
            <Badge variant="outline">{p.kind}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{p.baseUrl || "generativelanguage.googleapis.com"} · {p.hasKey ? `🔑 ${p.keyHint ?? "••••"}` : t("platform.admin.ai.noKey")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={p.enabled} onCheckedChange={async (v) => { await providerActions.setEnabled(p.id, v); onChanged(); }} aria-label={t("platform.admin.ai.enabled")} />
          <ConfirmButton title={t("platform.admin.ai.deleteProvider", { name: p.name })} icon={<Trash2 className="h-4 w-4" />} onConfirm={async () => { await providerActions.remove(p.id); onChanged(); }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {t("platform.admin.ai.modelsCount", { count: p.models.length })} · {t("platform.admin.ai.freeCount", { count: p.models.filter((m) => m.free).length })}
        </span>
        <Button size="sm" variant="ghost" onClick={refreshModels} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} {t("platform.admin.ai.refreshModels")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <ModelInput provider={p} value={testModel} onChange={setTestModel} className="min-w-[220px] flex-1" />
        <Button size="sm" variant="outline" onClick={test} disabled={testing || !testModel}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />} {t("platform.admin.ai.test")}
        </Button>
      </div>
      {result && <p className="break-words rounded bg-background/60 p-2 font-mono text-xs">{result}</p>}

      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await providerActions.replaceKey(p.id, newKey); setNewKey(""); toast.success(t("platform.common.saved")); onChanged(); }}>
        <Input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={t("platform.admin.ai.replaceKey")} className="h-8 text-xs" />
        <Button size="sm" variant="ghost" disabled={!newKey}>{t("platform.common.save")}</Button>
      </form>
    </div>
  );
};

export default ProviderCard;

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Provider, usePrices } from "@/features/admin/aiAdminApi";
import { Panel, Spinner } from "../../dashboard/common";
import ModelInput from "./ModelInput";

const PricesEditor = ({ providers }: { providers: Provider[] }) => {
  const { t } = useTranslation();
  const { prices, put } = usePrices();
  const [draft, setDraft] = useState<{ providerId: number; model: string; inputPerM: number; outputPerM: number }>({ providerId: providers[0]?.id ?? 0, model: "", inputPerM: 0, outputPerM: 0 });

  return (
    <Panel title={t("platform.admin.ai.pricesTitle")}>
      <p className="mb-4 text-sm text-muted-foreground">{t("platform.admin.ai.pricesHint")}</p>
      {prices.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">{t("platform.admin.ai.provider")}</th><th className="py-2 pr-3">{t("platform.admin.costs.model")}</th><th className="py-2 pr-3">{t("platform.admin.ai.inputPrice")}</th><th className="py-2 pr-3">{t("platform.admin.ai.outputPrice")}</th><th /></tr>
            </thead>
            <tbody>
              {(prices.data ?? []).map((r) => (
                <tr key={`${r.providerId}-${r.model}`} className="border-t border-border">
                  <td className="py-1.5 pr-3">{r.providerName}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.model}</td>
                  <td className="py-1.5 pr-3"><Input type="number" step="0.01" min="0" defaultValue={r.inputPerM} className="h-8 w-28" onBlur={(e) => Number(e.target.value) !== r.inputPerM && void put({ ...r, inputPerM: Number(e.target.value) })} /></td>
                  <td className="py-1.5 pr-3"><Input type="number" step="0.01" min="0" defaultValue={r.outputPerM} className="h-8 w-28" onBlur={(e) => Number(e.target.value) !== r.outputPerM && void put({ ...r, outputPerM: Number(e.target.value) })} /></td>
                  <td className="py-1.5 text-right"><Button size="icon" variant="ghost" onClick={() => void put({ ...r, delete: true })} aria-label={t("platform.common.delete")}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="py-2 pr-3">
                  <Select value={String(draft.providerId)} onValueChange={(v) => setDraft({ ...draft, providerId: Number(v) })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-2 pr-3"><ModelInput provider={providers.find((p) => p.id === draft.providerId)} value={draft.model} onChange={(m) => setDraft({ ...draft, model: m })} className="h-8 w-56" /></td>
                <td className="py-2 pr-3"><Input type="number" step="0.01" min="0" value={draft.inputPerM} onChange={(e) => setDraft({ ...draft, inputPerM: Number(e.target.value) })} className="h-8 w-28" /></td>
                <td className="py-2 pr-3"><Input type="number" step="0.01" min="0" value={draft.outputPerM} onChange={(e) => setDraft({ ...draft, outputPerM: Number(e.target.value) })} className="h-8 w-28" /></td>
                <td className="py-2 text-right"><Button size="sm" disabled={!draft.model} onClick={() => { void put(draft); setDraft({ ...draft, model: "" }); }}><Plus className="h-4 w-4" /></Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

export default PricesEditor;

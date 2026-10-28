import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiRefresh, useAiSettings, useProviders } from "@/features/admin/aiAdminApi";
import { EmptyState, Panel, Spinner } from "../dashboard/common";
import AddProviderDialog from "./ai/AddProviderDialog";
import PricesEditor from "./ai/PricesEditor";
import ProviderCard from "./ai/ProviderCard";
import RoutingEditor from "./ai/RoutingEditor";
import RoomsEditor from "./ai/RoomsEditor";

/** Admin → AI: providers, routing (JEV router), JEV judge and prices. */
const AdminAI = () => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const providers = useProviders();
  const settings = useAiSettings();
  const refresh = useAiRefresh();

  if (providers.isLoading || settings.isLoading) return <Spinner />;
  const list = providers.data ?? [];

  return (
    <div className="space-y-6">
      <Panel title={t("platform.admin.ai.providers")} actions={<Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.admin.ai.addProvider")}</Button>}>
        {list.length === 0 ? <EmptyState>{t("platform.admin.ai.noProviders")}</EmptyState> : (
          <div className="grid gap-4 xl:grid-cols-2">{list.map((p) => <ProviderCard key={p.id} p={p} onChanged={refresh} />)}</div>
        )}
      </Panel>
      {settings.data && <RoutingEditor providers={list} settings={settings.data} onSaved={refresh} />}
      {settings.data?.rooms && <RoomsEditor providers={list} settings={settings.data} onSaved={refresh} />}
      {list.length > 0 && <PricesEditor providers={list} />}
      <AddProviderDialog open={adding} onOpenChange={setAdding} onAdded={refresh} />
    </div>
  );
};

export default AdminAI;

import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "../dashboard/common";
import AdminAI from "./AdminAI";
import AdminCosts from "./AdminCosts";
import ClassesTab from "./tabs/ClassesTab";
import InvitesTab from "./tabs/InvitesTab";
import OverviewTab from "./tabs/OverviewTab";
import SettingsTab from "./tabs/SettingsTab";
import UsersTab from "./tabs/UsersTab";

const TABS = ["overview", "costs", "ai", "users", "invites", "classes", "settings"] as const;

const AdminPage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab")! : "overview";
  return (
    <DashboardLayout title={t("platform.admin.title")} subtitle={t("platform.admin.subtitle")}>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {TABS.map((k) => <TabsTrigger key={k} value={k}>{t(`platform.admin.tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="costs" className="mt-4"><AdminCosts /></TabsContent>
        <TabsContent value="ai" className="mt-4"><AdminAI /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="invites" className="mt-4"><InvitesTab /></TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminPage;

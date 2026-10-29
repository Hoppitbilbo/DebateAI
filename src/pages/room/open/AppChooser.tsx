import { useTranslation } from "react-i18next";
import type { AppType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { appIconSrc } from "@/lib/appArt";
import { APP_TYPES } from "@/features/activity/appCatalog";

/** The six apps as big friendly tiles: the icon wobbles on hover, the tiles land one after the other. */
const AppChooser = ({ onPick, selected, compact = false }: { onPick: (app: AppType) => void; selected?: AppType; compact?: boolean }) => {
  const { t } = useTranslation();
  return (
    <ul className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {APP_TYPES.map((app, i) => (
        <li key={app} className="story-pop" style={{ animationDelay: `${i * 45}ms` }}>
          <button
            type="button"
            onClick={() => onPick(app)}
            aria-pressed={selected === app}
            className={cn("app-tile group", selected === app && "app-tile--active", compact && "app-tile--compact")}
          >
            <span className="app-tile__blob" aria-hidden="true">
              <img src={appIconSrc(app)} alt="" width={48} height={48} className="app-tile__icon" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block font-heading text-lg font-semibold leading-tight">{t(`platform.appNames.${app}`)}</span>
              {!compact && <span className="mt-0.5 block text-sm text-muted-foreground">{t(`room.wizard.apps.${app}`)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default AppChooser;

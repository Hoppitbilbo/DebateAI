import { cn } from "@/lib/utils";
import { appIconSrc, appSceneSrc } from "@/lib/appArt";
import type { AppSlug } from "@/features/apps/catalog";

/** The app's icon on a yellow blob; on desktop hover its scene rises from behind. */
const AppArt = ({ slug, className }: { slug: AppSlug; className?: string }) => (
  <div className={cn("app-art", className)} aria-hidden="true">
    <img className="app-art__scene" src={appSceneSrc(slug)} alt="" width={440} height={440} loading="lazy" decoding="async" />
    <span className="app-art__blob" />
    <img className="app-art__icon" src={appIconSrc(slug)} alt="" width={80} height={80} decoding="async" />
  </div>
);

export default AppArt;

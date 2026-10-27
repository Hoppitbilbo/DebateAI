import { cn } from "@/lib/utils";
import { appSceneSrc, type AppArtSlug } from "@/lib/appArt";

/**
 * The colour icon that says what the app does. On a desktop pointer, hovering
 * the surrounding `.group` makes the app's scene rise from behind it.
 */
const AppArt = ({ slug, className }: { slug: AppArtSlug; className?: string }) => (
  <div className={cn("app-art", className)} aria-hidden="true">
    <img className="app-art__scene" src={appSceneSrc(slug)} alt="" width={440} height={440} loading="lazy" decoding="async" />
    <span className="app-art__blob" />
    <img className="app-art__icon" src={`/icons/apps/${slug}.webp`} alt="" width={80} height={80} decoding="async" />
  </div>
);

export default AppArt;

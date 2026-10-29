import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { appIconSrc } from "@/lib/appArt";
import LanguagePicker from "@/features/activity/components/LanguagePicker";
import type { AppType } from "@/lib/api";

const DURATIONS = [30, 60, 90, 120];

/** Last step: the language the characters speak, how long the room lasts, and the path at a glance. */
const LaunchStep = ({ language, onLanguage, minutes, onMinutes, maxMinutes, path }: {
  language: string;
  onLanguage: (code: string) => void;
  minutes: number;
  onMinutes: (m: number) => void;
  maxMinutes: number;
  path: { appType: AppType; title: string }[];
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-xl border-2 border-foreground bg-card p-4">
        <LanguagePicker value={language} onChange={(c) => c && onLanguage(c)} label={t("room.wizard.languageLabel")} />
        <p className="text-xs text-muted-foreground">{t("room.wizard.languageHint")}</p>
      </div>

      <fieldset className="space-y-2 rounded-xl border-2 border-foreground bg-card p-4">
        <legend className="sr-only">{t("room.open.durationLabel")}</legend>
        <p className="flex items-center gap-2 text-sm font-medium" aria-hidden="true"><Clock className="h-4 w-4" />{t("room.open.durationLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.filter((d) => d <= maxMinutes).map((d) => (
            <button key={d} type="button" aria-pressed={minutes === d} onClick={() => onMinutes(d)} className={minutes === d ? "language-chip language-chip--active" : "language-chip"}>
              {t("room.open.minutes", { count: d })}
            </button>
          ))}
        </div>
      </fieldset>

      {path.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("room.wizard.pathSummary", { count: path.length })}</p>
          <ol className="flex flex-wrap items-center gap-2">
            {path.map((p, i) => (
              <li key={i} className="story-pop inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm" style={{ animationDelay: `${i * 60}ms` }}>
                <img src={appIconSrc(p.appType)} alt="" width={24} height={24} className="h-6 w-6" />
                <span className="font-medium">{i + 1}.</span> <span className="max-w-[14rem] truncate">{p.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default LaunchStep;

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { avatarUrl, ROOM_AVATARS } from "@/features/room/avatars";

/** The grid of animals a guest picks from, as a radio group. */
const AvatarPicker = ({ value, onChange }: { value: string; onChange: (slug: string) => void }) => {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t("room.join.avatarLabel")}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup">
        {ROOM_AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            aria-label={t(`room.avatars.${a}`)}
            title={t(`room.avatars.${a}`)}
            onClick={() => onChange(a)}
            className={cn("rounded-lg border-2 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === a ? "border-primary bg-sun-light" : "border-transparent hover:border-border")}
          >
            <img src={avatarUrl(a)} alt="" className="h-full w-full" width={64} height={64} />
          </button>
        ))}
      </div>
    </fieldset>
  );
};

export default AvatarPicker;

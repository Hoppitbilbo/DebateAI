import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScriptLine, Speaker } from "@/features/story/script";

const AVATARS: Record<Speaker, string> = {
  galileo: "/avatars/galileo.webp",
  student: "/avatars/student.webp",
};

const Avatar = ({ speaker }: { speaker: Speaker }) => (
  <img
    src={AVATARS[speaker]}
    alt=""
    width={40}
    height={40}
    className={cn("h-10 w-10 shrink-0 rounded-full border-2 border-foreground object-cover", speaker === "student" ? "bg-sun-light p-0.5" : "object-top")}
  />
);

/** A chat row, the student on the right. */
const Row = ({ speaker, children }: { speaker: Speaker; children: React.ReactNode }) => (
  <div className={cn("flex items-end gap-2", speaker === "student" && "flex-row-reverse")}>
    <Avatar speaker={speaker} />
    {children}
  </div>
);

interface StoryChatProps {
  lines: readonly ScriptLine[];
  typing: ScriptLine | null;
  done: boolean;
}

/** The chat card with Galileo: lines so far, who is typing, and the call to try an app once it ends. */
const StoryChat = ({ lines, typing, done }: StoryChatProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-foreground bg-card shadow-[6px_6px_0_0_hsl(var(--foreground))] lg:h-[min(560px,calc(100svh-9rem))] h-[min(520px,calc(100svh-12rem))]">
      <div className="flex items-center gap-3 border-b-2 border-foreground bg-primary px-4 py-3 text-primary-foreground">
        <Avatar speaker="galileo" />
        <div className="leading-tight">
          <p className="font-heading text-lg font-semibold">{t("hero.story.galileo")}</p>
          <p className="text-xs opacity-80">{typing?.speaker === "galileo" ? t("hero.story.typing") : t("hero.story.online")}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-4" aria-live="polite">
        {lines.map(({ speaker, key }) => (
          <Row key={key} speaker={speaker}>
            <p
              className={cn(
                "story-bubble max-w-[78%] rounded-2xl border-2 border-foreground px-4 py-2.5 text-sm sm:text-base",
                speaker === "student" ? "story-bubble--right rounded-br-sm bg-sun" : "rounded-bl-sm bg-card",
              )}
            >
              {t(`hero.story.messages.${key}`)}
            </p>
          </Row>
        ))}
        {typing && (
          <Row speaker={typing.speaker}>
            <span className="story-bubble flex gap-1 rounded-2xl border-2 border-foreground bg-card px-4 py-3" aria-label={t("hero.story.typing")}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </Row>
        )}
      </div>

      <div className={cn("border-t-2 border-foreground px-4 py-3 transition-opacity duration-300", done ? "opacity-100" : "opacity-0")}>
        <Button asChild className="story-pop w-full" tabIndex={done ? 0 : -1}>
          <Link to="/apps">{t("hero.story.cta")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default StoryChat;

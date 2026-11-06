import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The teacher's words to practise (P2), each ticked once the student has
 * used it. Shown above the chat input and in the feedback.
 */
const TargetWords = ({ words, used, className }: { words: string[]; used: Set<string>; className?: string }) => {
  const { t } = useTranslation();
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {words.map((w) => {
        const done = used.has(w);
        return (
          <li
            key={w}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              done ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {done && <Check className="h-3 w-3" aria-hidden="true" />}
            {w}
            <span className="sr-only">({t(done ? "platform.vocabulary.used" : "platform.vocabulary.notUsed")})</span>
          </li>
        );
      })}
    </ul>
  );
};

export default TargetWords;

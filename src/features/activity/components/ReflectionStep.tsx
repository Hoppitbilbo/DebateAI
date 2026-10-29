import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen, Send, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EndReason } from "../useActivitySession";

interface ReflectionStepProps {
  prompt: string;
  placeholder?: string;
  onSubmit: (reflection: string) => void;
  /** When reflection is optional (assignment setting), allow skipping. */
  optional?: boolean;
  endReason?: EndReason;
  summary?: React.ReactNode;
  minLength?: number;
}

const ReflectionStep = ({ prompt, placeholder, onSubmit, optional, endReason, summary, minLength = 50 }: ReflectionStepProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const valid = text.trim().length >= minLength;

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <NotebookPen className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-heading text-2xl font-bold">{t("platform.reflection.title")}</h2>
        {endReason === "goal_reached" && <p className="font-medium text-primary">🎯 {t("platform.reflection.goalReached")}</p>}
        {endReason === "turn_limit" && <p className="font-medium text-warning">{t("platform.reflection.turnLimit")}</p>}
        <p className="text-muted-foreground">{t("platform.reflection.description")}</p>
      </div>

      {summary}

      <div className="space-y-2">
        <Label htmlFor="reflection" className="text-base">{prompt}</Label>
        <Textarea
          id="reflection"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || t("platform.reflection.placeholder")}
          className="min-h-[200px]"
        />
        <p className={valid ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
          {t("platform.reflection.counter", { count: text.trim().length, min: minLength })}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" size="lg" disabled={!valid} onClick={() => onSubmit(text.trim())}>
          <Send className="mr-2 h-4 w-4" /> {t("platform.reflection.submit")}
        </Button>
        {optional && (
          <Button variant="outline" size="lg" onClick={() => onSubmit("")}>
            <SkipForward className="mr-2 h-4 w-4" /> {t("platform.reflection.skip")}
          </Button>
        )}
      </div>
    </section>
  );
};

export default ReflectionStep;

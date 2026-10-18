import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Flag, Loader2, Mic, MicOff, Radio, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import type { LiveControls } from "@/hooks/useLiveAi";
import type { ActivityMessage } from "../types";

interface ChatPanelProps {
  messages: ActivityMessage[];
  onSend: (text: string) => void;
  busy?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  /** Label for the student's own bubbles (e.g. the character they play). */
  userLabel?: string;
  /** Colour accents per speakerKey in multi-character conversations. */
  speakerStyles?: Record<string, string>;
  live?: LiveControls | null;
  onEnd?: () => void;
  endLabel?: string;
  canEnd?: boolean;
  /** Content rendered between the messages and the input (e.g. target selector). */
  toolbar?: React.ReactNode;
  footerNote?: React.ReactNode;
  heightClass?: string;
}

/** The one chat component used by every app. */
const ChatPanel = ({
  messages,
  onSend,
  busy,
  disabled,
  disabledReason,
  placeholder,
  userLabel,
  speakerStyles,
  live,
  onEnd,
  endLabel,
  canEnd = true,
  toolbar,
  footerNote,
  heightClass = "h-[min(60vh,560px)]",
}: ChatPanelProps) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dictation = useSpeechDictation(i18n.language, setInput);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy || disabled) return;
    dictation.stop();
    onSend(text);
    setInput("");
  };

  const liveOn = !!live?.liveMode;

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      {live?.liveAvailable && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("h-2.5 w-2.5 rounded-full", liveOn ? "animate-pulse bg-red-500" : "bg-muted-foreground/50")} />
            <span className="text-muted-foreground">
              {liveOn ? t(`platform.live.state.${live.liveState}`) : t("platform.live.offHint")}
            </span>
          </div>
          <Button size="sm" variant={liveOn ? "default" : "outline"} onClick={live.toggleLive} disabled={disabled} aria-pressed={liveOn}>
            <Radio className="mr-2 h-4 w-4" />
            {liveOn ? t("platform.live.stop") : t("platform.live.start")}
          </Button>
        </div>
      )}

      <div ref={scrollRef} className={cn("space-y-4 overflow-y-auto p-4", heightClass)} aria-live="polite">
        {messages.length === 0 && (
          <p className="flex h-full items-center justify-center text-center text-muted-foreground">{t("platform.activity.emptyChat")}</p>
        )}
        {messages.map((m) =>
          m.role === "system" ? (
            <div key={m.id} className="mx-auto max-w-[90%] rounded-md bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className={cn("flex items-end gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role !== "user" && <Bot className="mb-1 h-5 w-5 shrink-0 text-primary" aria-hidden />}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm",
                  m.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : cn("rounded-bl-sm border border-border bg-background/60", m.speakerKey && speakerStyles?.[m.speakerKey]),
                  m.error && "border-destructive/60 bg-destructive/10",
                )}
              >
                <p className="mb-0.5 text-xs font-semibold opacity-80">
                  {m.role === "user" ? m.name || userLabel || t("platform.common.you") : m.name || "AI"}
                </p>
                {m.content ? (
                  m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  ) : (
                    <MarkdownViewer content={m.content} className="prose-sm prose-invert" />
                  )
                ) : (
                  <span className="flex gap-1 py-1" aria-label={t("platform.activity.typing")}>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
                  </span>
                )}
              </div>
              {m.role === "user" && <User className="mb-1 h-5 w-5 shrink-0 text-primary" aria-hidden />}
            </div>
          ),
        )}
      </div>

      {toolbar && <div className="border-t border-border px-4 py-2">{toolbar}</div>}

      <div className="space-y-3 border-t border-border p-4">
        {disabled && disabledReason ? (
          <p className="rounded-md bg-primary/10 p-3 text-center text-sm font-medium text-primary">{disabledReason}</p>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={liveOn ? t("platform.live.typeWhileLive") : placeholder || t("platform.activity.placeholder")}
              disabled={busy || disabled}
              rows={2}
              className="min-h-[44px] resize-none"
              aria-label={placeholder || t("platform.activity.placeholder")}
            />
            {dictation.supported && !liveOn && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                disabled={busy || disabled}
                title={dictation.listening ? t("platform.activity.stopDictation") : t("platform.activity.dictate")}
                aria-pressed={dictation.listening}
              >
                {dictation.listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button type="button" size="icon" onClick={submit} disabled={busy || disabled || !input.trim()} aria-label={t("platform.activity.send")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
        {(onEnd || footerNote) && (
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="text-xs text-muted-foreground">{footerNote}</div>
            {onEnd && (
              <Button variant="secondary" size="sm" onClick={onEnd} disabled={busy || !canEnd}>
                <Flag className="mr-2 h-4 w-4" />
                {endLabel || t("platform.activity.endAndReflect")}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ChatPanel;

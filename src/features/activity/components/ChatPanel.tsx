import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Flag, Loader2, Mic, MicOff, Radio, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ChatMessages from "./ChatMessages";
import type { AvatarFallback } from "../speakerAvatar";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import type { LiveControls } from "@/hooks/useLiveAi";
import type { ActivityMessage } from "../types";

interface ChatPanelProps {
  messages: ActivityMessage[];
  /** Language of the dictation (BCP 47) when the teacher fixed one; the interface language otherwise. */
  speechLang?: string;
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
  /** Asks again for a failed AI reply (shown on the error bubble). */
  onRetry?: (id: string) => void;
  canRetry?: (id: string) => boolean;
  /** Picture for an AI speaker whose Wikipedia page has none (default: a person). */
  avatarFallback?: AvatarFallback;
  /**
   * The server ended the chat: the messages stay readable and this notice,
   * with its continue button, replaces the input.
   */
  ended?: ChatEnd | null;
}

export interface ChatEnd {
  message: string;
  continueLabel: string;
  onContinue: () => void;
}

/**
 * Shown in place of the input when the server ended the chat. The continue
 * button takes the focus (the input it replaces had it), so Enter moves on.
 */
const ChatEndNotice = ({ end }: { end: ChatEnd }) => {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus({ preventScroll: true }), []);
  return (
    <div role="status" className="phase-enter flex flex-col items-center gap-3 rounded-md bg-primary/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <p className="text-sm font-medium text-primary">{end.message}</p>
      <Button ref={button} onClick={end.onContinue} className="shrink-0">
        {end.continueLabel}<ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

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
  onRetry,
  canRetry,
  avatarFallback,
  ended,
  speechLang,
}: ChatPanelProps) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const dictation = useSpeechDictation(speechLang ?? i18n.language, setInput);

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

      <ChatMessages
        messages={messages}
        heightClass={heightClass}
        userLabel={userLabel}
        speakerStyles={speakerStyles}
        busy={busy}
        onRetry={onRetry}
        canRetry={canRetry}
        avatarFallback={avatarFallback}
      />

      {toolbar && <div className="border-t border-border px-4 py-2">{toolbar}</div>}

      <div className="space-y-3 border-t border-border p-4">
        {ended ? (
          <ChatEndNotice end={ended} />
        ) : disabled && disabledReason ? (
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
        {!ended && (onEnd || footerNote) && (
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

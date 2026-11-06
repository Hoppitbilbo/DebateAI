import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Flag, Mic, MicOff, Radio, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ChatMessages from "./ChatMessages";
import Dictionary, { type DictionaryHandle } from "./Dictionary";
import TargetWords from "./TargetWords";
import { usedTargetWords } from "../vocabulary";
import { dictionarySite } from "../wiktionary";
import type { AvatarFallback } from "../speakerAvatar";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import type { LiveControls } from "@/hooks/useLiveAi";
import type { ActivityMessage } from "../types";
import { loadDraft, pruneDrafts, saveDraft } from "../draft";

interface ChatPanelProps {
  messages: ActivityMessage[];
  /** The language the characters speak (practice language code): the dictionary looks words up in it. */
  dictionaryLang?: string;
  /** The teacher's words to practise, ticked off as the student uses them. */
  targetWords?: string[];
  /** Language of the dictation (BCP 47) when the teacher fixed one; the interface language otherwise. */
  speechLang?: string;
  onSend: (text: string) => void;
  /** A reply is being written: the student can draft the next message but not send it. */
  busy?: boolean;
  /** Stops the reply being written (shown in place of Send while busy). */
  onStop?: () => void;
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
  /** Where the unsent text is kept in this browser (see draft.ts); none: not kept. */
  draftKey?: string;
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
  onStop,
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
  draftKey,
  dictionaryLang,
  targetWords = [],
}: ChatPanelProps) => {
  const { t, i18n } = useTranslation();
  const uiCode = (i18n.language || "it").slice(0, 2);
  const site = useMemo(() => (dictionaryLang ? dictionarySite(dictionaryLang, uiCode) : null), [dictionaryLang, uiCode]);
  const dictionary = useRef<DictionaryHandle>(null);
  const onWordTap = useCallback((word: string, rect: DOMRect) => dictionary.current?.lookUp(word, rect), []);
  const usedWords = useMemo(
    () => usedTargetWords(targetWords, messages.filter((m) => m.role === "user").map((m) => m.content)),
    [targetWords, messages],
  );
  const [input, setInput] = useState(() => (draftKey ? loadDraft(draftKey) : ""));
  // A new attempt (another key) starts from its own draft.
  const [shownKey, setShownKey] = useState(draftKey);
  if (shownKey !== draftKey) {
    setShownKey(draftKey);
    setInput(draftKey ? loadDraft(draftKey) : "");
  }
  useEffect(() => {
    if (draftKey) saveDraft(draftKey, input);
  }, [draftKey, input]);
  useEffect(() => pruneDrafts(), []);
  const dictation = useSpeechDictation(speechLang ?? i18n.language, setInput, (kind) =>
    toast.error(t(`platform.activity.dictationFailed.${kind}`), { id: "dictation-failure" }));

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
          <div className="flex items-center gap-2 text-sm" role="status">
            <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", liveOn ? "animate-pulse bg-red-500" : "bg-muted-foreground/50")} />
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
      {live?.liveUnsupported && (
        <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">{t("platform.live.unsupported")}</p>
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
        onWordTap={site ? onWordTap : undefined}
        wordLang={dictionaryLang}
      />

      {toolbar && <div className="border-t border-border px-4 py-2">{toolbar}</div>}
      {(site || targetWords.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-1.5">
          {site && <Dictionary ref={dictionary} site={site} />}
          {targetWords.length > 0 && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("platform.vocabulary.chatTitle")} · {t("platform.vocabulary.usedCount", { used: usedWords.size, total: targetWords.length })}
              </span>
              <TargetWords words={targetWords} used={usedWords} />
            </div>
          )}
        </div>
      )}

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
                // Enter that confirms an IME composition (e.g. Japanese) is not a send.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                liveOn ? t("platform.live.typeWhileLive") : dictation.listening ? t("platform.activity.dictating") : placeholder || t("platform.activity.placeholder")
              }
              disabled={disabled}
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
                disabled={disabled}
                title={dictation.listening ? t("platform.activity.stopDictation") : t("platform.activity.dictate")}
                aria-pressed={dictation.listening}
              >
                {dictation.listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            {busy && onStop ? (
              <Button type="button" size="icon" variant="outline" onClick={onStop} aria-label={t("platform.activity.stopReply")} title={t("platform.activity.stopReply")}>
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button type="button" size="icon" onClick={submit} disabled={busy || disabled || !input.trim()} aria-label={t("platform.activity.send")}>
                <Send className="h-4 w-4" />
              </Button>
            )}
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

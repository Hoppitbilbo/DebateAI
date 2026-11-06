import { memo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { cn } from "@/lib/utils";
import type { ActivityMessage } from "../types";
import { useChatScroll } from "../useChatScroll";
import { useWikiImage } from "../wikiImage";
import { fallbackIcon, GENERIC_AI_NAME, wikiTitleOf, type AvatarFallback } from "../speakerAvatar";
import { wordAtPoint } from "../wordAtPoint";

/** A word tapped in a character's message, with its box on the page (for the dictionary). */
export type WordTap = (word: string, rect: DOMRect) => void;

/** Wikipedia portrait of the speaker when the page has one, otherwise an Icons8 picture. */
const SpeakerAvatar = memo(function SpeakerAvatar({ name, role, fallback }: { name?: string; role: ActivityMessage["role"]; fallback: AvatarFallback }) {
  const photo = useWikiImage(wikiTitleOf(name));
  return (
    <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-accent">
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover object-top" loading="lazy" decoding="async" />
      ) : (
        <img src={fallbackIcon(name, role, fallback)} alt="" className="h-7 w-7 object-contain" />
      )}
    </span>
  );
});

interface MessageProps {
  message: ActivityMessage;
  userLabel?: string;
  speakerStyle?: string;
  onRetry?: (id: string) => void;
  retryDisabled?: boolean;
  avatarFallback: AvatarFallback;
  onWordTap?: WordTap;
  /** The language of the characters' words, to find word boundaries. */
  wordLang?: string;
}

const ChatMessage = memo(function ChatMessage({ message, userLabel, speakerStyle, onRetry, retryDisabled, avatarFallback, onWordTap, wordLang }: MessageProps) {
  const { t } = useTranslation();
  const tapWord = onWordTap && !message.streaming && !message.error
    ? (e: MouseEvent) => {
        // links keep working, and a selection is the student copying text
        if ((e.target as Element).closest("a, button") || !window.getSelection()?.isCollapsed) return;
        const hit = wordAtPoint(e.clientX, e.clientY, wordLang);
        if (hit) onWordTap(hit.word, hit.rect);
      }
    : undefined;
  return (
    message.role === "system" ? (
      <div className="chat-message mx-auto max-w-[90%] rounded-md bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    ) : (
      <div className={cn("chat-message flex items-end gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
        {message.role !== "user" && <SpeakerAvatar name={message.name} role={message.role} fallback={avatarFallback} />}
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-4 py-2.5",
            message.role === "user"
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : cn("rounded-bl-sm border border-border bg-background/60", speakerStyle),
            message.error && "border-destructive/60 bg-destructive/10",
          )}
        >
          <p className="mb-0.5 text-xs font-semibold opacity-80">
            {message.role === "user" ? message.name || userLabel || t("platform.common.you") : message.name || GENERIC_AI_NAME}
          </p>
          {message.content ? (
            message.role === "user" ? (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            ) : (
              <div onClick={tapWord}>
                <MarkdownViewer content={message.content} className="prose-sm" />
              </div>
            )
          ) : (
            <span className="flex gap-1 py-1" aria-label={t("platform.activity.typing")}>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
            </span>
          )}
          {message.error && onRetry && (
            <Button size="sm" variant="outline" className="mt-2 h-7" onClick={() => onRetry(message.id)} disabled={retryDisabled}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {t("platform.activity.retry")}
            </Button>
          )}
        </div>
        {message.role === "user" && <SpeakerAvatar name={message.name} role={message.role} fallback={avatarFallback} />}
      </div>
    )
  );
});

interface ChatMessagesProps {
  messages: ActivityMessage[];
  heightClass: string;
  userLabel?: string;
  speakerStyles?: Record<string, string>;
  busy?: boolean;
  onRetry?: (id: string) => void;
  canRetry?: (id: string) => boolean;
  avatarFallback?: AvatarFallback;
  /** Called when the student taps a word in a character's message (the dictionary). */
  onWordTap?: WordTap;
  wordLang?: string;
}

/** Input changes never re-render the history; streaming only re-renders the changed row. */
const ChatMessages = memo(function ChatMessages({ messages, heightClass, userLabel, speakerStyles, busy, onRetry, canRetry, avatarFallback = "person", onWordTap, wordLang }: ChatMessagesProps) {
  const { t } = useTranslation();
  const { viewportRef, contentRef } = useChatScroll(messages);

  return (
    <div ref={viewportRef} className={cn("overflow-y-auto p-4", heightClass)} aria-live="polite">
      <div ref={contentRef} className={cn("space-y-4", messages.length === 0 && "h-full")}>
        {messages.length === 0 && (
          <p className="flex h-full items-center justify-center text-center text-muted-foreground">{t("platform.activity.emptyChat")}</p>
        )}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            userLabel={message.role === "user" ? userLabel : undefined}
            speakerStyle={message.speakerKey ? speakerStyles?.[message.speakerKey] : undefined}
            onRetry={message.error && onRetry && canRetry?.(message.id) ? onRetry : undefined}
            retryDisabled={message.error ? busy : undefined}
            avatarFallback={avatarFallback}
            onWordTap={message.role === "assistant" ? onWordTap : undefined}
            wordLang={wordLang}
          />
        ))}
      </div>
    </div>
  );
});

export default ChatMessages;

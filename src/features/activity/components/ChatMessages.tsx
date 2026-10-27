import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Bot, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { cn } from "@/lib/utils";
import type { ActivityMessage } from "../types";
import { useChatScroll } from "../useChatScroll";

interface MessageProps {
  message: ActivityMessage;
  userLabel?: string;
  speakerStyle?: string;
  onRetry?: (id: string) => void;
  retryDisabled?: boolean;
}

const ChatMessage = memo(function ChatMessage({ message, userLabel, speakerStyle, onRetry, retryDisabled }: MessageProps) {
  const { t } = useTranslation();
  return (
    message.role === "system" ? (
      <div className="chat-message mx-auto max-w-[90%] rounded-md bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    ) : (
      <div className={cn("chat-message flex items-end gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
        {message.role !== "user" && <Bot className="mb-1 h-5 w-5 shrink-0 text-primary" aria-hidden />}
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm",
            message.role === "user"
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : cn("rounded-bl-sm border border-border bg-background/60", speakerStyle),
            message.error && "border-destructive/60 bg-destructive/10",
          )}
        >
          <p className="mb-0.5 text-xs font-semibold opacity-80">
            {message.role === "user" ? message.name || userLabel || t("platform.common.you") : message.name || "AI"}
          </p>
          {message.content ? (
            message.role === "user" ? (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            ) : (
              <MarkdownViewer content={message.content} className="prose-sm prose-invert" />
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
        {message.role === "user" && <User className="mb-1 h-5 w-5 shrink-0 text-primary" aria-hidden />}
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
}

/** Input changes never re-render the history; streaming only re-renders the changed row. */
const ChatMessages = memo(function ChatMessages({ messages, heightClass, userLabel, speakerStyles, busy, onRetry, canRetry }: ChatMessagesProps) {
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
          />
        ))}
      </div>
    </div>
  );
});

export default ChatMessages;

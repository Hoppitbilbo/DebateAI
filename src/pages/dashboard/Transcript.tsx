import { useTranslation } from "react-i18next";
import type { TranscriptMessage } from "@/lib/api";
import { EmptyState } from "./common";

/** The messages of an attempt, student on the right and characters on the left. */
const Transcript = ({ messages, studentName }: { messages: TranscriptMessage[]; studentName?: string }) => {
  const { t } = useTranslation();
  if (messages.length === 0) return <EmptyState>{t("platform.session.emptyTranscript")}</EmptyState>;
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-2 print:max-h-none print:overflow-visible">
      {messages.map((m, i) => (
        <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary/15 p-3" : m.role === "system" ? "text-center text-xs text-muted-foreground" : "mr-8 rounded-lg border border-border p-3"}>
          {m.role !== "system" && <p className="mb-1 text-xs font-semibold text-primary">{m.role === "user" ? m.name || studentName || t("platform.common.student") : m.name || "AI"}</p>}
          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        </div>
      ))}
    </div>
  );
};

export default Transcript;

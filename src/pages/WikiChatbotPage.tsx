import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WikiRef } from "@/lib/api";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { titleOf, useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { recipeFor } from "@/features/activity/recipe";
import { APPS } from "@/features/activity/types";

const app = APPS["wiki-chatbot"];

/** The student explores a Wikipedia page by talking with it. */
const WikiChatbotPage = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState<WikiRef | null>(null);

  const { summaries, loading } = useWikiSummaries([page]);
  const summary = bioOf(page, summaries);
  // The server writes the character's instructions from this recipe.
  const recipe = page ? recipeFor(app.type, { character: page.title, bio: summary }) : undefined;

  const flow = useActivityFlow(app.type, {
    live: (phase) => (phase === "chat" && page ? { recipe, characterName: page.title, characterBio: summary } : null),
    context: { page: page?.title },
    restore: (saved) => {
      const title = titleOf(saved.page);
      if (title) setPage({ title });
    },
  });
  const { preset, engine } = flow;

  useEffect(() => {
    if (preset.character) setPage(preset.character);
  }, [preset.character]);

  const start = async () => {
    if (!page) return;
    if (!(await flow.begin(page.title, { page }, []))) return;
    await engine.open({
      recipe,
      name: page.title,
      fallback: { role: "assistant", content: t("platform.apps.wikiChatbot.welcome", { title: page.title }) },
    });
  };

  const restart = () =>
    flow.restart(() => {
      if (!preset.character) setPage(null);
    });

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      setup={{
        title: t("platform.apps.wikiChatbot.setupTitle"),
        description: t("platform.apps.wikiChatbot.setupDescription"),
        canStart: !!page && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            <CharacterPicker label={t("platform.apps.wikiChatbot.topicLabel")} value={page} onChange={setPage} locked={!!preset.character} />
            {page && summary && <p className="line-clamp-6 rounded-md bg-background/50 p-3 text-sm text-muted-foreground">{summary}</p>}
          </>
        ),
      }}
      chat={{
        ready: !!page,
        onSend: (text) => engine.runTurn(text, () => engine.respond({ recipe, name: page?.title })),
        placeholder: t("platform.apps.wikiChatbot.placeholder", { title: page?.title }),
        live: engine.live,
        avatarFallback: "page",
      }}
      reflection={{
        prompt: t("platform.apps.wikiChatbot.reflectionPrompt", { title: page?.title }),
        brief: () => ({ activity: `${t("apps.wikiChatbot.title")}: ${page?.title}`, characters: page?.title ?? "", topic: page?.title }),
      }}
      feedback={{
        title: `${t("apps.wikiChatbot.title")} - ${page?.title ?? ""}`,
        facts: [{ label: t("platform.apps.wikiChatbot.topicLabel"), value: page?.title }],
      }}
    />
  );
};

export default WikiChatbotPage;

import type { ComponentType } from "react";
import { BookOpen, MessageSquare, Search, Speech, User, Users } from "lucide-react";
import type { AppType } from "@/lib/api";

/** Icon of each learning app. */
export const APP_ICONS: Record<AppType, ComponentType<{ className?: string }>> = {
  "convinci-tu": Speech,
  "doppia-intervista": Users,
  "wiki-chatbot": MessageSquare,
  "personaggio-misterioso": Search,
  "impersona-tu": User,
  "you-moderate": BookOpen,
};

export const APP_TYPES = Object.keys(APP_ICONS) as AppType[];

import type { LucideIcon } from "lucide-react";
import {
  BookOpen, Brain, CheckCircle, Eye, Lightbulb, MessageCircle, MessageSquare, Play, Search, Target, Users, Zap,
} from "lucide-react";
import type { AppType } from "@/lib/api";

/**
 * The teacher tutorials as data: each slide's texts are in the "tutorial"
 * namespace under <ns>.slides.<id>.{title,content,bullet1..bulletN}.
 */
export interface TutorialSlide {
  id: string;
  icon: LucideIcon;
  bullets: number;
}

export interface Tutorial {
  /** Key of the app in the "tutorial" translations. */
  ns: string;
  slides: TutorialSlide[];
}

const slide = (id: string, icon: LucideIcon, bullets = 4): TutorialSlide => ({ id, icon, bullets });

export const TUTORIALS: Partial<Record<AppType, Tutorial>> = {
  "convinci-tu": {
    ns: "convinciTu",
    slides: [
      slide("welcome", Play), slide("howItWorks", Target), slide("debatePreparation", Brain), slide("collaborativeLearning", Users),
      slide("visibleThinking", Eye), slide("teacherEvaluation", BookOpen), slide("selfReflection", Lightbulb), slide("examples", MessageSquare),
    ],
  },
  "doppia-intervista": {
    ns: "doppiaIntervista",
    slides: [
      slide("welcome", Play), slide("characterComparison", MessageCircle), slide("strategicQuestioning", Target), slide("collaborativeAnalysis", Users),
      slide("criticalThinking", Brain), slide("selfEvaluation", Eye), slide("reflection", Lightbulb), slide("examples", BookOpen),
    ],
  },
  "personaggio-misterioso": {
    ns: "personaggioMisterioso",
    slides: [
      slide("welcome", Play, 3), slide("howItWorks", Target), slide("selectCharacter", Search, 3), slide("askQuestions", MessageSquare),
      slide("technology", Lightbulb), slide("classroomUse", Users), slide("examples", BookOpen),
    ],
  },
  "you-moderate": {
    ns: "youModerate",
    slides: [
      slide("welcome", Play, 3), slide("moderatorRole", Users), slide("peerCollaboration", MessageCircle), slide("setupDebate", Target),
      slide("moderationSkills", Lightbulb), slide("criticalThinking", Zap), slide("reflection", CheckCircle), slide("applications", BookOpen),
    ],
  },
  "impersona-tu": {
    ns: "impersonaTu",
    slides: [
      slide("welcome", Users), slide("peerLearning", Brain), slide("thinkAloud", MessageSquare), slide("criticalThinking", Eye),
      slide("collaborativeReview", BookOpen), slide("teacherFacilitation", Target), slide("reflectionAndGrowth", Lightbulb), slide("examples", CheckCircle),
    ],
  },
};

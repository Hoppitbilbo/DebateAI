
import { Message } from "./conversation";

export interface ReflectionQuestion {
  id: string;
  text: string;
}

export interface ReflectionConfig {
  title: string;
  description: string;
  questions: string[] | ReflectionQuestion[];
}

export interface ReflectionResult {
  userReflection: string;
  aiEvaluation?: string;
  submittedAt: Date;
}

export interface ReflectionSession {
  id: string;
  activityType: string;
  characterName?: string;
  topic?: string;
  userReflection?: string;
  aiEvaluation?: string;
  conversation: Message[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ReflectionData {
  userReflection: string;
  aiEvaluation: string;
  timestamp: string;
}

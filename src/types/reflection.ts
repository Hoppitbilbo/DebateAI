/**
 * @file Defines common TypeScript types related to the reflection and evaluation process.
 */

import { Message } from "./conversation";

/**
 * @interface ReflectionQuestion
 * @description Represents a single structured reflection question.
 * @property {string} id - A unique identifier for the question.
 * @property {string} text - The text of the question.
 */
export interface ReflectionQuestion {
  id: string;
  text: string;
}

/**
 * @interface ReflectionConfig
 * @description Defines the configuration for a reflection session.
 * @property {string} title - The title of the reflection activity.
 * @property {string} description - The instructions or description for the reflection.
 * @property {string[] | ReflectionQuestion[]} questions - An array of questions, which can be simple strings or structured question objects.
 */
export interface ReflectionConfig {
  title: string;
  description: string;
  questions: string[] | ReflectionQuestion[];
}

/**
 * @interface ReflectionResult
 * @description Represents the outcome of a reflection session.
 * @property {string} userReflection - The text written by the user.
 * @property {string} [aiEvaluation] - An optional AI-generated evaluation of the user's reflection or performance.
 * @property {Date} submittedAt - The timestamp when the reflection was submitted.
 */
export interface ReflectionResult {
  userReflection: string;
  aiEvaluation?: string;
  submittedAt: Date;
}

/**
 * @interface ReflectionSession
 * @description Represents a complete reflection session, including all related data for storage or download.
 * @property {string} id - A unique identifier for the session.
 * @property {string} activityType - The type of educational activity (e.g., "ConvinciTu", "WikiInterview").
 * @property {string} [characterName] - The name of the character(s) involved in the activity.
 * @property {string} [topic] - The topic of the activity.
 * @property {string} [userReflection] - The user's reflection text.
 * @property {string} [aiEvaluation] - The AI's evaluation text.
 * @property {Message[]} conversation - The full conversation history.
 * @property {Date} createdAt - The timestamp when the session was created.
 * @property {Date} [completedAt] - An optional timestamp for when the session was completed.
 */
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

/**
 * @interface ReflectionData
 * @description A simplified structure for holding reflection data.
 * @property {string} userReflection - The user's reflection text.
 * @property {string} aiEvaluation - The AI's evaluation text.
 * @property {string} timestamp - The timestamp of the reflection.
 */
export interface ReflectionData {
  userReflection: string;
  aiEvaluation: string;
  timestamp: string;
}

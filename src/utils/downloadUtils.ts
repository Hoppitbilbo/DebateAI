/**
 * @file Utility functions for generating and downloading activity summaries as Markdown files.
 * @remarks These functions handle the conversion of conversation and reflection data into a
 * formatted Markdown string and trigger a file download in the browser.
 */

import { Message } from "@/types/conversation";

/**
 * @interface DownloadReflectionData
 * @description Defines the data structure required to generate a reflection summary file.
 * @property {string} activityType - The name of the activity (e.g., "ConvinciTu").
 * @property {string} [characterName] - The name of the character(s) involved.
 * @property {string} [topic] - The topic of the activity.
 * @property {Message[]} conversation - The full conversation history.
 * @property {string} userReflection - The user's written reflection.
 * @property {string} [aiEvaluation] - The AI-generated evaluation.
 */
interface DownloadReflectionData {
  activityType: string;
  characterName?: string;
  topic?: string;
  conversation: Message[];
  userReflection: string;
  aiEvaluation?: string;
}

/**
 * @function conversationToMarkdown
 * @description Converts an array of chat messages into a Markdown formatted string.
 * @param {Message[]} conversation - The array of message objects.
 * @returns {string} A string representing the conversation in Markdown format.
 */
const conversationToMarkdown = (conversation: Message[]): string => {
  return conversation.map(msg => {
    let speaker = 'AI';
    if (msg.role === 'user') {
      speaker = 'Studente';
    } else if (msg.role === 'system') {
      speaker = 'Sistema';
    } else if (msg.role === 'assistant' && msg.characterName) {
      speaker = msg.characterName;
    }
                   
    return `**${speaker}:** ${msg.content}\n\n`;
  }).join('');
};

/**
 * @function generateReflectionMarkdown
 * @description Generates a complete Markdown string for a reflection session.
 * @param {DownloadReflectionData} data - The data for the reflection session.
 * @returns {string} The formatted Markdown content.
 */
export const generateReflectionMarkdown = (data: DownloadReflectionData): string => {
  const { activityType, characterName, topic, conversation, userReflection, aiEvaluation } = data;
  
  let markdown = `# Attività di Riflessione: ${activityType}\n\n`;
  
  if (characterName) {
    markdown += `## Personaggio: ${characterName}\n\n`;
  }
  
  if (topic) {
    markdown += `## Argomento: ${topic}\n\n`;
  }
  
  markdown += `## Conversazione\n\n`;
  markdown += conversationToMarkdown(conversation);
  
  markdown += `## Riflessione dello Studente\n\n${userReflection}\n\n`;
  
  if (aiEvaluation) {
    markdown += `## Valutazione dell'IA\n\n${aiEvaluation}\n\n`;
  }
  
  markdown += `---\nGenerato da AI-Debate.Tech - ${new Date().toLocaleDateString()}\n`;
  
  return markdown;
};

/**
 * @function downloadMarkdown
 * @description Triggers a browser download for the given content as a Markdown file.
 * @param {string} content - The string content to be downloaded.
 * @param {string} [filename="riflessione"] - The base name for the downloaded file.
 */
export const downloadMarkdown = (content: string, filename: string = "riflessione"): void => {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.md`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(link.href);
};

/**
 * @function downloadReflection
 * @description A high-level function that combines Markdown generation and downloading for a reflection session.
 * @param {DownloadReflectionData} data - The data for the reflection session.
 */
export const downloadReflection = (data: DownloadReflectionData): void => {
  const markdown = generateReflectionMarkdown(data);
  downloadMarkdown(markdown, `${data.activityType.toLowerCase().replace(/\s+/g, '-')}`);
};


import { Message } from "@/types/conversation";

interface DownloadReflectionData {
  activityType: string;
  characterName?: string;
  topic?: string;
  conversation: Message[];
  userReflection: string;
  aiEvaluation?: string;
}

/**
 * Converts an array of chat messages to a markdown formatted string
 */
const conversationToMarkdown = (conversation: Message[]): string => {
  return conversation.map(msg => {
    // Determine the speaker name based on role
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
 * Generates markdown content for a reflection session
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
 * Downloads content as a markdown file
 */
export const downloadMarkdown = (content: string, filename: string = "riflessione"): void => {
  // Create a blob from the markdown content
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  
  // Create a temporary link element
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.md`;
  
  // Append link to body, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Release the object URL
  URL.revokeObjectURL(link.href);
};

/**
 * Combines generation and download of reflection markdown
 */
export const downloadReflection = (data: DownloadReflectionData): void => {
  const markdown = generateReflectionMarkdown(data);
  downloadMarkdown(markdown, `${data.activityType.toLowerCase().replace(/\s+/g, '-')}`);
};

import common from './common.json';
import navigation from './navigation.json';
import hero from './hero.json';
import appsPage from './appsPage.json';
import features from './features.json';
import apps from './apps';
import chat from './chat.json';
import feedback from './feedback.json';
import errors from './errors.json';
import language from './language.json';
import teacherGuide from './teacherGuide.json';
import aboutPage from './aboutPage.json';
import footer from './footer.json';
import tutorialsPage from './tutorialsPage.json';

// AI and evaluation sections would need to be extracted from the original file
// For now, we'll create a combined export
export default {
  common,
  navigation,
  hero,
  appsPage,
  features,
  apps,
  chat,
  feedback,
  errors,
  language,
  teacherGuide,
  aboutPage,
  footer,
  tutorialsPage,
  // These sections would need to be extracted separately
  ai: {
    systemInstructions: {
      character: "Eres {{name}}. Tu biografía es: \"{{bio}}\". Responde directamente a la pregunta del usuario en primera persona como {{name}}. Sé conciso, 1-2 oraciones, y no excedas los 150 caracteres. Evita presentarte o repetir quién eres (ej. \"Como {{name}}...\").",
      dialogue: "Eres {{name}}, una figura histórica descrita como: \"{{bio}}\". Tu estilo de diálogo es \"{{style}}\". Habla en primera persona como {{name}}. Responde de manera concisa, idealmente dentro de 1-2 oraciones y no excediendo los 150 caracteres. Evita presentarte o repetir quién eres al inicio de cada respuesta (ej. evita frases como \"Como {{name}}...\"). Interactúa naturalmente basándote en el contexto de la conversación.",
      evaluation: "Eres un asistente educativo experto en evaluar actividades de aprendizaje basadas en juegos de rol y reflexiones. Tu tarea es analizar una conversación de juego y la auto-reflexión de un estudiante.",
      convinciTu: "Eres {{name}}, un personaje histórico. Tu objetivo es convencer al estudiante de hacer algo específico relacionado con tu personaje y el contexto histórico en el que vives, como se especifica en \"{{prompt}}\". Nunca reveles que eres una IA. Interactúa con el estudiante de manera coloquial y convincente, manteniéndote fiel a tu personaje. El estudiante intentará convencerte de no hacer lo que te has propuesto. Debes contraargumentar e intentar persuadirlo."
    }
  },
  evaluation: {
    context: "CONTEXTO DEL JUEGO:",
    gameDescription: "El estudiante participó en un juego llamado \"Adivina el Personaje Misterioso\". El objetivo era identificar un personaje histórico ({{character}}) haciendo preguntas a una IA que interpretaba ese personaje.",
    fallbackFeedback: "Tu participación muestra compromiso. Sigue practicando para mejorar aún más."
  },
  prompts: {
    student: "Estudiante",
    error: "Error durante {{error}}: Por favor, inténtalo de nuevo más tarde.",
    evaluationError: "Error de evaluación"
  }
};
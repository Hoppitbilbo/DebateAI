# AI-Debate.Tech - AI-Powered Educational Apps

Welcome to **AI-Debate.Tech**, a collection of interactive educational applications designed to make learning more engaging and fun through the power of Artificial Intelligence, powered by Google's Gemini API.

## About the Project

AI-Debate.Tech transforms traditional homework and learning exercises into exciting, interactive experiences. Our mission is to make education more accessible, effective, and enjoyable for everyone. We believe in enhancing the learning process by providing AI-powered tools that support both students and teachers.

Our applications are built on the principle that technology should be a tool to empower educators, not replace them. We provide personalized support to students while allowing teachers to guide and supervise the learning journey.

## Our Applications

Here's a look at the different educational apps available on our platform:

### 🗣️ Historical AI Dialogue
Converse with AI characters based on real content from Wikipedia. This app transforms educational topics into interactive conversations, allowing you to engage with historical figures and learn about their lives and times.

### 👥 Double Interview
Interact simultaneously with two historical figures in parallel conversations. This unique educational dialogue allows you to compare and contrast different perspectives on a variety of topics.

### 💬 WikiChat AI
Chat with an AI that represents any Wikipedia topic. This is the perfect tool for in-depth, interactive learning on any subject you can imagine.

### 🕵️ Guess the Mystery Character
Challenge the AI by asking a limited number of questions to guess a chosen historical figure. This game tests your deductive reasoning and knowledge of history.

### 💡 Teaching Prompt Creator
This tool helps teachers and students create effective prompts for Artificial Intelligence in educational and learning activities.

### 🤝 Convince YOU
Challenge your persuasion skills by trying to convince historical figures of your ideas on various topics.

### 🎭 You Impersonate
Put yourself in the shoes of a historical figure and engage in a dialogue with another AI-powered character. This app is a great way to test your empathy and role-playing skills.

## Technologies Used

This project is built with a modern tech stack to provide a seamless and interactive user experience:

- **Google Genai:** The powerful Google Gen AI SDK for TypeScript and JavaScript that powers our AI features using Gemini models.
- **Vite:** A next-generation frontend tooling that provides a faster and leaner development experience.
- **TypeScript:** A statically typed superset of JavaScript that adds type safety to our codebase.
- **React:** A popular JavaScript library for building user interfaces.
- **shadcn-ui:** A collection of re-usable components that helps us build beautiful and accessible user interfaces.
- **Tailwind CSS:** A utility-first CSS framework that allows for rapid UI development.
- **Wikipedia API:** Powers our historical and educational content, enabling interactive learning with accurate information from Wikipedia's vast knowledge base.

## Getting Started

To get started with this project locally, follow these steps:

1.  **Clone the repository:**
    ```sh
    git clone <YOUR_GIT_URL>
    ```

2.  **Navigate to the project directory:**
    ```sh
    cd <YOUR_PROJECT_NAME>
    ```

3.  **Install the necessary dependencies:**
    ```sh
    npm i
    ```

4.  **Set up your Google AI Studio API Key:**
    - Create an account on [Google AI Studio](https://makersuite.google.com/)
    - Generate an API key for Gemini models
    - Create a `.env` file in the root directory of the project
    - Add your API key to the `.env` file:
      ```
      VITE_GEMINI_API_KEY="your-api-key-here"
      ```
    - Note: The `.env` file is already added to `.gitignore` to ensure your API key remains secure

5.  **Start the development server:**
    ```sh
    npm run dev
    ```
This will start the development server with auto-reloading and an instant preview of your changes.

> **Note:** For production environments, it's recommended to implement server-side API key handling for better security. Please refer to the [Google Gen AI SDK documentation](https://googleapis.github.io/js-genai/) for best practices.

## Google Genai Integration

This project leverages the powerful Google Gen AI SDK for TypeScript and JavaScript. The SDK supports both the Gemini Developer API and Vertex AI implementations.

### Key Features

- Works with Gemini 2.0 features
- Supports streaming responses for more responsive interactions
- Can be deployed on school servers or personal computers
- No chat history collection - respects privacy

### Deployment Options

You can install this application on:
- Your school server
- Your personal computer

Google's plans for AI Studio as of August 2025 are very generous, making this application accessible for educational institutions.

### API Usage

The application uses the Google Genai API through the `@google/genai` package:

```javascript
import {GoogleGenAI} from '@google/genai';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

async function main() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: 'Why is the sky blue?',
  });
  console.log(response.text);
}
```

For more detailed information and advanced usage, please refer to the [official documentation](https://googleapis.github.io/js-genai/).

## How to Contribute

We welcome contributions to AI-Debate.Tech! This is an open-source project, and we appreciate any help or suggestions for improvements. If you'd like to contribute, please fork the repository and submit a pull request with your changes.

---

Thank you for your interest in AI-Debate.Tech! We hope you enjoy using our educational apps.

**SPECIAL THANKS**

- **Google** for providing the powerful Gemini API that makes these educational applications possible.
- **Wikipedia** for their comprehensive API that enables access to a vast repository of knowledge, allowing users to chat about any topic available on Wikipedia.

All our applications implement the Wikipedia API to provide accurate and up-to-date information, making learning interactive and engaging. You can chat with AI about virtually any topic covered in Wikipedia's extensive database.

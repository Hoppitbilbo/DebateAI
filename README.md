# AI-Debate.Tech - AI-Powered Educational Apps

Welcome to **AI-Debate.Tech**, a collection of interactive educational applications designed to make learning more engaging and fun through the power of Artificial Intelligence, powered by Google's Gemini API.

## About the Project

AI-Debate.Tech transforms traditional homework and learning exercises into exciting, interactive experiences. Our mission is to make education more accessible, effective, and enjoyable for everyone. We believe in enhancing the learning process by providing AI-powered tools that support both students and teachers.

Our applications are built on the principle that technology should be a tool to empower educators, not replace them. We provide personalized support to students while allowing teachers to guide and supervise the learning journey.

---

## 🚀 Getting Started

To get started with this project locally, follow these steps:

### Prerequisites

Make sure you have [Bun](https://bun.sh/) installed on your system.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/ai-debate-tech.git
    ```

2.  **Navigate to the project directory:**
    ```sh
    cd ai-debate-tech
    ```

3.  **Install the necessary dependencies:**
    ```sh
    bun install
    ```

4.  **Set up your Google AI Studio API Key:**
    - Create an account on [Google AI Studio](https://makersuite.google.com/)
    - Generate an API key for Gemini models
    - Create a `.env` file in the root directory of the project by copying the example:
      ```sh
      cp .env.example .env
      ```
    - Add your API key to the `.env` file:
      ```
      VITE_GEMINI_API_KEY="your-api-key-here"
      ```
    - **Note:** The `.env` file is already added to `.gitignore` to ensure your API key remains secure.

5.  **Start the development server:**
    ```sh
    bun run dev
    ```
This will start the development server with auto-reloading and an instant preview of your changes.

> **Note:** For production environments, it's recommended to implement server-side API key handling for better security. Please refer to the [Google Gen AI SDK documentation](https://ai.google.dev/docs) for best practices.

---

## 🛠️ Technologies Used

This project is built with a modern tech stack to provide a seamless and interactive user experience:

- **Vite:** A next-generation frontend tooling that provides a faster and leaner development experience.
- **React:** A popular JavaScript library for building user interfaces.
- **TypeScript:** A statically typed superset of JavaScript that adds type safety to our codebase.
- **Tailwind CSS:** A utility-first CSS framework that allows for rapid UI development.
- **shadcn/ui:** A collection of re-usable components that helps us build beautiful and accessible user interfaces.
- **Google Generative AI:** The official SDK for accessing Google's Gemini models.
- **React Router:** For client-side routing and navigation.
- **i18next:** A powerful internationalization framework for translating the application into multiple languages.
- **Wikipedia API:** Powers our historical and educational content, enabling interactive learning with accurate information from Wikipedia's vast knowledge base.

---

## 📂 Project Structure

The codebase is organized to be modular and maintainable. Here is a high-level overview of the `src` directory:

-   `components/`: Contains all the React components.
    -   `shared/`: Reusable components used across multiple pages and applications (e.g., `AppLayout`, `ChatInterface`).
    -   `ui/`: Low-level UI components from `shadcn/ui` (e.g., `Button`, `Card`).
    -   `[AppName]/`: Components specific to a single educational application (e.g., `ConvinciTu/`, `WikiInterview/`).
-   `context/`: React context providers for global state management (e.g., `AnimationContext`).
-   `hooks/`: Custom React hooks that encapsulate reusable logic (e.g., `useIsMobile`, `useToast`).
-   `i18n/`: Internationalization configuration and locale files for different languages.
-   `lib/`: General utility functions (e.g., `cn` for merging class names).
-   `pages/`: Top-level components that represent the application's pages/routes.
-   `services/`: Modules responsible for communicating with external APIs, particularly the Google AI service.
-   `styles/`: Global CSS files, including the design system variables.
-   `types/`: TypeScript type definitions shared across the application.
-   `utils/`: Utility functions for specific domains like prompt building, evaluation, and downloads.

---

## 📚 Our Applications

Here's a look at the different educational apps available on our platform:

-   **🗣️ Historical AI Dialogue:** Converse with AI characters based on real content from Wikipedia.
-   **👥 Double Interview:** Interact simultaneously with two historical figures in parallel conversations.
-   **💬 WikiChat AI:** Chat with an AI that represents any Wikipedia topic.
-   **🕵️ Guess the Mystery Character:** A game to test your deductive reasoning by asking questions to guess a historical figure.
-   **💡 Teaching Prompt Creator:** A tool to help teachers and students create effective prompts for AI in educational activities. (*Coming Soon*)
-   **🤝 Convince YOU:** Challenge your persuasion skills by trying to convince historical figures of your ideas.
-   **🎭 You Impersonate:** Put yourself in the shoes of a historical figure and engage in a dialogue with another AI-powered character.

---

## 🤝 How to Contribute

We welcome contributions to AI-Debate.Tech! This is an open-source project, and we appreciate any help, from bug fixes to new feature ideas.

If you'd like to contribute, please:
1.  Fork the repository.
2.  Create a new branch for your feature or fix.
3.  Commit your changes and push them to your fork.
4.  Submit a pull request with a clear description of your changes.

Feel free to open an issue if you find a bug or have a suggestion for improvement!

---

## 🙏 Special Thanks

-   **Google** for providing the powerful Gemini API that makes these educational applications possible.
-   **Wikipedia** for their comprehensive API that enables access to a vast repository of knowledge, allowing users to chat about any topic available on Wikipedia's extensive database.

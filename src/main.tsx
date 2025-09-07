/**
 * @file The main entry point for the React application.
 * @remarks This file is responsible for rendering the root `App` component into the DOM.
 * It also wraps the application with the `I18nextProvider` to enable internationalization.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App.tsx';
import './index.css';
import i18n from './i18n';

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
);

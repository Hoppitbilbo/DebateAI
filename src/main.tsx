import './instrument';
import React from 'react';
import * as Sentry from '@sentry/react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App.tsx';
import './index.css';
import i18n, { i18nReady } from './i18n';



const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

// The first render waits for the user's language (a separate download unless
// it is Italian), so the page does not flash in another language.
void i18nReady.then(() =>
  createRoot(rootElement, { onRecoverableError: Sentry.reactErrorHandler() }).render(
    <I18nextProvider i18n={i18n}>
      <Sentry.ErrorBoundary fallback={<p role="alert">{i18n.t('common.error')}</p>}>
        <App />
      </Sentry.ErrorBoundary>
    </I18nextProvider>
  ),
);

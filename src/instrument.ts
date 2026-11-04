import * as Sentry from "@sentry/react";

// Load before the app so startup errors are captured too. An empty DSN opts out.
if (import.meta.env.VITE_SENTRY_DSN) {
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.consoleIntegration({ levels: [] }),
      Sentry.breadcrumbsIntegration({ dom: false }),
    ],
    // Production samples page traces; the server keeps every AI request anyway.
    tracesSampleRate: environment === "production" ? 0.1 : 1,
    tracePropagationTargets: [/^\/api\//],
    // Student conversations and authentication data must stay out of telemetry.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
    },
  });
}

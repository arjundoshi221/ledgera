// Sentry browser SDK init. No-op when NEXT_PUBLIC_SENTRY_DSN is unset so local
// dev / preview builds don't need Sentry configured.

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "local",
  })
}

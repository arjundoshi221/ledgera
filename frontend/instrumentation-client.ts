// Sentry browser SDK init. No-op when NEXT_PUBLIC_SENTRY_DSN is unset so local
// dev / preview builds don't need Sentry configured.
//
// Sentry v10 auto-detects this file at the project root; the legacy
// `sentry.client.config.ts` name was removed in v10.

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

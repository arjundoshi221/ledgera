// Sentry Node/Edge SDK init for Next.js server-side code. No-op when
// NEXT_PUBLIC_SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "local",
  })
}

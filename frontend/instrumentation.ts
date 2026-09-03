// Next.js server-side instrumentation entrypoint. Sentry v10 requires this
// file (not the legacy `sentry.server.config.ts`) to bootstrap the Node and
// Edge runtimes. Init is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs"

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "local",
    })
  }
}

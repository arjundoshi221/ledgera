/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
}

// Only wrap with Sentry's webpack plugin when a DSN is configured at build time.
// The instrumentation files already DSN-gate Sentry.init at runtime, but the
// webpack plugin runs regardless of runtime gating, which adds build weight
// when the DSN is unset (our current prod state). Source-maps upload is
// intentionally disabled — it requires SENTRY_AUTH_TOKEN in the Railway env,
// which is out of scope here (see B46). All other behavior is left at Sentry's
// defaults.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require("@sentry/nextjs")
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    sourcemaps: { disable: true },
  })
} else {
  module.exports = nextConfig
}

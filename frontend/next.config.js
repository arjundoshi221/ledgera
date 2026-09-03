const { withSentryConfig } = require("@sentry/nextjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
}

// Sentry v10 needs withSentryConfig to inject the instrumentation-client entry
// into the webpack build. Source-maps upload is intentionally disabled — it
// requires SENTRY_AUTH_TOKEN in the Railway env, which is out of scope here
// (see B46). All other behavior is left at Sentry's defaults.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
})

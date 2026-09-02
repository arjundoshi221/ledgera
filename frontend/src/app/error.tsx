"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry.init is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset, so
    // captureException here is safe to call unconditionally.
    Sentry.captureException(error)
    console.error("[root error boundary]", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong.</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        The app hit an unexpected error. If this keeps happening, please refresh
        the page or contact support.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}

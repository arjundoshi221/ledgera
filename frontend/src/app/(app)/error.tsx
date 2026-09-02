"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: hook into observability once B20 lands (Sentry.captureException(error))
    console.error("[app error boundary]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">The page hit an error.</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Something broke while loading this page. Use the sidebar to navigate
        elsewhere, or try again.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}

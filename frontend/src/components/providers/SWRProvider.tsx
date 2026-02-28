"use client"

import { SWRConfig } from 'swr'
import { useEffect } from 'react'
import { swrConfig } from '@/lib/hooks'
import { checkCacheVersion } from '@/lib/cache'

const CACHE_VERSION = '1.0.0' // Update this when making breaking API changes

export function SWRProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Check cache version on mount
    checkCacheVersion(CACHE_VERSION)
  }, [])

  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  )
}

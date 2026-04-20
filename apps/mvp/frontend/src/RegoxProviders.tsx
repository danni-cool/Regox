import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSharedState } from '@regox/client'

// Module-level so all island instances share one QueryClient via ES module cache.
const queryClient = new QueryClient()

export default function RegoxProviders({ children }: { children: React.ReactNode }) {
  const [_theme] = useSharedState<'light' | 'dark'>('theme', 'light')

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Per-page rendering config type. Usage: export const regox = { ... } satisfies RegoxPageConfig

export type RegoxPageConfig =
  | { mode: 'ssg' }
  | { mode: 'isr'; revalidate: number }  // revalidate in seconds
  | { mode: 'ssr' }
  | { mode: 'csr' }

// Default when no export is present: 'csr'

export interface RegoxConfig {
  build?: {
    outDir?: string
    ssg?: {
      output?: 'embed' | 'external'
    }
  }
  routing?: {
    apiPrefix?: string
    notFound?: '404' | 'csr-shell'
  }
  dev?: {
    port?: number
    goPort?: number
    proxy?: Record<string, unknown>
    clientOnlyPackages?: string[]
  }
  openapi?: {
    spec?: string        // path to openapi.yaml, default: "openapi.yaml"
    generateTypes?: boolean
    mocksDir?: string    // where mock JSON files live, default: "frontend/mocks"
  }
  export?: {
    ssgDir?: string
  }
  providers?: string  // path relative to app root, e.g. './frontend/src/RegoxProviders.tsx'
}

// --- Compiler types ---

export interface PageMeta {
  filePath: string
  route: string
  mode: 'ssr' | 'isr' | 'ssg' | 'csr'
  revalidate?: number
  pageName: string
  dataType: string | null
  templPath: string
  propsPath: string
}

export type IslandMap = Map<string, IslandMeta>

export interface IslandMeta {
  componentName: string
  filePath: string
  props: SerializableProp[]
  reason: string[]
}

export interface SerializableProp {
  name: string
  type: string
  expression: 'literal' | 'field-access' | 'call-expression' | 'array' | 'unsupported'
  value: string
}

export interface CompileOptions {
  pageName: string
  goPackage?: string
  goImport?: string
  filePath?: string
}

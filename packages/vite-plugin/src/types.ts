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
  }
  openapi?: {
    spec?: string        // path to openapi.yaml, default: "openapi.yaml"
    generateTypes?: boolean
    mocksDir?: string    // where mock JSON files live, default: "frontend/mocks"
  }
  export?: {
    ssgDir?: string
  }
}

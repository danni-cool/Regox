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
    spec?: string
    generateTypes?: boolean
  }
  export?: {
    ssgDir?: string
  }
}

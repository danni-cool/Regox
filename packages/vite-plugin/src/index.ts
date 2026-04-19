import type { Plugin } from 'vite'
import type { RegoxConfig } from './types'

export function regox(config: RegoxConfig): Plugin {
  return {
    name: 'regox',
    // TODO: implement
    // - scan pages/ for RegoxPageConfig exports (rendering mode)
    // - compile SSR/ISR pages: JSX → templ (sentinel + AST approach)
    // - extract Islands: replace with <div data-island="..."> mount points
    // - generate manifest.json: page → Island bundle mapping
    // - generate Go struct skeletons from PageData types (*.gen.go)
  }
}

export type { RegoxConfig }

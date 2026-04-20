import { parse } from '@babel/parser'
import { traverseFast } from '@babel/types'
import type { Node } from '@babel/types'

export interface EventEntry {
  key: string
  direction: 'emit' | 'listen'
  file: string
}

export function scanEventUsage(source: string, file: string): EventEntry[] {
  const entries: EventEntry[] = []
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  } catch {
    return entries
  }

  traverseFast(ast as unknown as Node, (node) => {
    if (node.type !== 'CallExpression') return
    const callee = (node as any).callee
    if (callee?.type !== 'Identifier') return
    const args = (node as any).arguments
    if (!args || args.length === 0) return
    const firstArg = args[0]
    if (firstArg?.type !== 'StringLiteral') return
    const key: string = firstArg.value

    if (callee.name === 'useEmit') {
      entries.push({ key, direction: 'emit', file })
    } else if (callee.name === 'useEvent') {
      entries.push({ key, direction: 'listen', file })
    }
  })

  return entries
}

export type EventMap = Record<string, { emitters: string[]; listeners: string[] }>

export function buildEventMap(entries: EventEntry[]): EventMap {
  const map: EventMap = {}
  for (const e of entries) {
    if (!map[e.key]) map[e.key] = { emitters: [], listeners: [] }
    if (e.direction === 'emit') {
      map[e.key].emitters.push(e.file)
    } else {
      map[e.key].listeners.push(e.file)
    }
  }
  return map
}

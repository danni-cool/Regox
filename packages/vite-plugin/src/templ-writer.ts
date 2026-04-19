import fs from 'node:fs'
import path from 'node:path'
import type { PageMeta } from './types.ts'

export function writeTemplFiles(
  meta: PageMeta,
  templ: string,
  propsStruct: string,
): void {
  fs.mkdirSync(path.dirname(meta.templPath), { recursive: true })
  fs.writeFileSync(meta.templPath, templ, 'utf-8')

  if (propsStruct.trim()) {
    fs.writeFileSync(meta.propsPath, propsStruct, 'utf-8')
  }
}

import fs from 'node:fs'
import path from 'node:path'
import * as parser from '@babel/parser'
import type {
  JSXElement,
  JSXFragment,
  JSXChild,
  JSXOpeningElement,
  JSXExpressionContainer,
  StringLiteral,
  TemplateLiteral,
  FunctionDeclaration,
  ArrowFunctionExpression,
  FunctionExpression,
} from '@babel/types'

type FnNode = FunctionDeclaration | ArrowFunctionExpression | FunctionExpression

export function compileLayout(src: string): string {
  const ast = parser.parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })

  let rootJsx: JSXElement | JSXFragment | null = null

  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration
      if (
        decl.type === 'FunctionDeclaration' ||
        decl.type === 'ArrowFunctionExpression' ||
        decl.type === 'FunctionExpression'
      ) {
        rootJsx = extractReturn(decl)
      }
    }
  }

  if (!rootJsx) throw new Error('go-layout-writer: no default export function found')

  const lines: string[] = ['package templates', '', 'templ Layout(title string, stylesheet string) {', '\t<!DOCTYPE html>']

  emitJsx(rootJsx, lines, 1)

  lines.push('}')
  return lines.join('\n') + '\n'
}

export function writeGoLayout(layoutPath: string, outDir: string): void {
  const src = fs.readFileSync(layoutPath, 'utf-8')
  const output = compileLayout(src)
  const outPath = path.join(outDir, 'Layout.templ')
  fs.writeFileSync(outPath, output, 'utf-8')
}

function extractReturn(fn: FnNode): JSXElement | JSXFragment | null {
  const body = fn.body
  if (!body) return null
  if (body.type === 'JSXElement' || body.type === 'JSXFragment') return body
  if (body.type === 'BlockStatement') {
    for (const stmt of body.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        const arg = stmt.argument
        if (arg.type === 'JSXElement' || arg.type === 'JSXFragment') return arg
      }
    }
  }
  return null
}

function indent(depth: number): string {
  return '\t'.repeat(depth)
}

function emitJsx(node: JSXElement | JSXFragment, lines: string[], depth: number): void {
  if (node.type === 'JSXFragment') {
    for (const child of node.children) {
      emitChild(child, lines, depth)
    }
    return
  }

  const opening = node.openingElement
  const tagName = getTagName(opening)

  if (tagName === '!DOCTYPE') return

  // PascalCase = Island mount
  if (/^[A-Z]/.test(tagName)) {
    const cls = extractAttrValue(opening, 'className') ?? extractAttrValue(opening, 'class') ?? ''
    const clsAttr = cls ? ` class="${cls}"` : ''
    lines.push(`${indent(depth)}<div data-island="${tagName}"${clsAttr}></div>`)
    return
  }

  // Handle <script dangerouslySetInnerHTML>
  if (tagName === 'script') {
    const dsi = extractDangerouslySetInnerHTML(opening)
    if (dsi !== null) {
      lines.push(`${indent(depth)}<script>${dsi}</script>`)
      return
    }
  }

  const attrs = emitAttributes(opening)
  const selfClosing = node.closingElement === null

  if (selfClosing) {
    lines.push(`${indent(depth)}<${tagName}${attrs}/>`)
    return
  }

  lines.push(`${indent(depth)}<${tagName}${attrs}>`)

  for (const child of node.children) {
    emitChild(child, lines, depth + 1)
  }

  lines.push(`${indent(depth)}</${tagName}>`)
}

function emitChild(child: JSXChild, lines: string[], depth: number): void {
  switch (child.type) {
    case 'JSXElement':
      emitJsx(child as JSXElement, lines, depth)
      break
    case 'JSXFragment':
      emitJsx(child as JSXFragment, lines, depth)
      break
    case 'JSXText': {
      const text = child.value.replace(/^\n[\t ]*/, '').replace(/\n[\t ]*$/, '')
      if (text.trim()) lines.push(`${indent(depth)}${text}`)
      break
    }
    case 'JSXExpressionContainer': {
      const expr = (child as JSXExpressionContainer).expression
      if (expr.type === 'JSXEmptyExpression') break
      if (expr.type === 'Identifier') {
        if (expr.name === 'children') {
          lines.push(`${indent(depth)}{ children... }`)
        } else {
          lines.push(`${indent(depth)}{ ${expr.name} }`)
        }
      } else {
        throw new Error(
          `go-layout-writer: unsupported JSX expression type "${expr.type}" — only plain identifiers are supported in _layout.tsx`
        )
      }
      break
    }
  }
}

function getTagName(opening: JSXOpeningElement): string {
  const name = opening.name
  if (name.type === 'JSXIdentifier') return name.name
  throw new Error(
    `go-layout-writer: JSXMemberExpression tags (e.g. "React.StrictMode") are not supported in _layout.tsx`
  )
}

function emitAttributes(opening: JSXOpeningElement): string {
  const parts: string[] = []
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute') continue
    const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : String(attr.name)

    if (name === 'dangerouslySetInnerHTML') continue

    const htmlName = name === 'className' ? 'class' : name

    if (!attr.value) {
      parts.push(` ${htmlName}`)
      continue
    }

    if (attr.value.type === 'StringLiteral') {
      parts.push(` ${htmlName}="${attr.value.value}"`)
      continue
    }

    if (attr.value.type === 'JSXExpressionContainer') {
      const expr = attr.value.expression
      if (expr.type === 'Identifier') {
        parts.push(` ${htmlName}={ ${expr.name} }`)
        continue
      }
      if (expr.type === 'StringLiteral') {
        parts.push(` ${htmlName}="${(expr as StringLiteral).value}"`)
        continue
      }
    }
  }
  return parts.join('')
}

function extractAttrValue(opening: JSXOpeningElement, attrName: string): string | null {
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute') continue
    const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : ''
    if (name !== attrName) continue
    if (!attr.value) return ''
    if (attr.value.type === 'StringLiteral') return attr.value.value
  }
  return null
}

function extractDangerouslySetInnerHTML(opening: JSXOpeningElement): string | null {
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute') continue
    if ((attr.name as any).name !== 'dangerouslySetInnerHTML') continue
    if (!attr.value || attr.value.type !== 'JSXExpressionContainer') continue
    const expr = attr.value.expression
    if (expr.type !== 'ObjectExpression') continue
    for (const prop of expr.properties) {
      if (prop.type !== 'ObjectProperty') continue
      const key =
        prop.key.type === 'Identifier'
          ? (prop.key as import('@babel/types').Identifier).name
          : prop.key.type === 'StringLiteral'
            ? (prop.key as StringLiteral).value
            : null
      if (key !== '__html') continue
      const val = prop.value
      if (val.type === 'StringLiteral') return val.value
      if (val.type === 'TemplateLiteral') {
        if ((val as TemplateLiteral).expressions.length === 0) {
          return (val as TemplateLiteral).quasis[0].value.cooked ?? ''
        }
      }
    }
  }
  return null
}

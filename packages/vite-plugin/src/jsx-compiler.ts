import { parse } from '@babel/parser'
import * as t from '@babel/types'
import type { IslandMap, IslandMeta, CompileOptions } from './types.ts'

export class CompileError extends Error {
  filePath?: string
  constructor(message: string, filePath?: string) {
    super(message)
    this.filePath = filePath
  }
}

export interface ScaffoldSpec {
  name: string
  renderPropSrc: string
  props: Array<{ name: string }>
}

export type OnScaffold = (spec: ScaffoldSpec) => void

interface EmitCtx {
  islandMap: IslandMap
  paramNames: Set<string>
  loopVars: Set<string>
  filePath: string
  onScaffold?: OnScaffold
}

export function compileJSXToTempl(
  source: string,
  islandMap: IslandMap,
  opts: CompileOptions,
  onScaffold?: OnScaffold,
): { templ: string; propsStruct: string } {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })

  const exportDefault = ast.program.body.find(
    (n): n is t.ExportDefaultDeclaration => t.isExportDefaultDeclaration(n),
  )
  if (!exportDefault || !t.isFunctionDeclaration(exportDefault.declaration)) {
    throw new CompileError(`No default export function found`, opts.filePath)
  }
  const func = exportDefault.declaration

  const funcName = func.id?.name ?? opts.pageName
  const { paramNames, dataType } = extractParams(func)

  const jsxRoot = findJSXReturn(func.body)
  if (!jsxRoot) throw new CompileError(`No JSX return found in ${funcName}`, opts.filePath)

  const ctx: EmitCtx = {
    islandMap,
    paramNames,
    loopVars: new Set(),
    filePath: opts.filePath ?? '',
    onScaffold,
  }

  const body = emitNode(jsxRoot, '  ', ctx)

  const pkg = opts.goPackage ?? 'templates'
  const imp = opts.goImport ?? 'regox.dev/mvp/generated'
  const resolvedDataType = dataType ? `generated.${dataType}` : null
  const sig = resolvedDataType
    ? `templ ${funcName}(data ${resolvedDataType})`
    : `templ ${funcName}()`

  const lines = [
    `package ${pkg}`,
    '',
    `import "fmt"`,
    ...(resolvedDataType ? [`import "${imp}"`] : []),
    '',
    `${sig} {`,
    body,
    `}`,
    '',
  ]

  return { templ: lines.join('\n'), propsStruct: '' }
}

function extractParams(func: t.FunctionDeclaration): {
  paramNames: Set<string>
  dataType: string | null
} {
  const paramNames = new Set<string>()
  let dataType: string | null = null
  const param = func.params[0]
  if (!param) return { paramNames, dataType }

  if (t.isObjectPattern(param)) {
    for (const prop of param.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        paramNames.add(prop.key.name)
      }
    }
    const ta = param.typeAnnotation
    if (t.isTSTypeAnnotation(ta)) {
      const inner = ta.typeAnnotation
      if (t.isTSTypeReference(inner) && t.isIdentifier(inner.typeName)) {
        dataType = inner.typeName.name
      }
    }
  }
  return { paramNames, dataType }
}

function findJSXReturn(body: t.BlockStatement): t.JSXElement | t.JSXFragment | null {
  for (const stmt of body.body) {
    if (t.isReturnStatement(stmt) && stmt.argument) {
      if (t.isJSXElement(stmt.argument) || t.isJSXFragment(stmt.argument)) {
        return stmt.argument
      }
    }
  }
  return null
}

function emitNode(node: t.Node, indent: string, ctx: EmitCtx): string {
  if (t.isJSXElement(node)) return emitJSXElement(node, indent, ctx)
  if (t.isJSXFragment(node)) {
    return node.children.map(c => emitNode(c, indent, ctx)).filter(Boolean).join('\n')
  }
  if (t.isJSXText(node)) {
    const text = node.value.replace(/\n\s*/g, ' ').trim()
    return text ? `${indent}${text}` : ''
  }
  if (t.isJSXExpressionContainer(node)) {
    if (t.isJSXEmptyExpression(node.expression)) return ''
    return emitExpression(node.expression as t.Expression, indent, ctx)
  }
  throw new CompileError(`Unsupported JSX node: ${node.type}`, ctx.filePath)
}

function emitJSXElement(node: t.JSXElement, indent: string, ctx: EmitCtx): string {
  const opening = node.openingElement
  const rawName = t.isJSXIdentifier(opening.name) ? opening.name.name : ''

  if (rawName === 'Client') return emitClientElement(node, indent, ctx)

  if (ctx.islandMap.has(rawName)) return emitIslandMount(rawName, ctx.islandMap.get(rawName)!, indent)

  if (/^[A-Z]/.test(rawName)) {
    throw new CompileError(
      `Non-Island component <${rawName}> in SSR template.\nComponent <${rawName}> not found in IslandMap. If it's an Island, implement Pass 1 first (M3). If it's a Go-only component, convert to a .templ sub-component.`,
      ctx.filePath,
    )
  }

  const attrs = (opening.attributes as t.JSXAttribute[])
    .filter(a => t.isJSXAttribute(a) && getAttrName(a) !== 'key')
    .map(a => emitJSXAttr(a as t.JSXAttribute, ctx))
    .filter(Boolean)

  const attrSep = attrs.length ? ' ' + attrs.join(' ') : ''
  const selfClose = node.openingElement.selfClosing || node.children.length === 0

  if (selfClose) return `${indent}<${rawName}${attrSep}>`

  // Inline text-only elements: <h1>Hello</h1>
  const nonEmptyChildren = node.children.filter(
    c => !(t.isJSXText(c) && c.value.replace(/\n\s*/g, '').trim() === '')
  )
  if (
    nonEmptyChildren.length === 1 &&
    t.isJSXText(nonEmptyChildren[0])
  ) {
    const text = (nonEmptyChildren[0] as t.JSXText).value.replace(/\n\s*/g, ' ').trim()
    return `${indent}<${rawName}${attrSep}>${text}</${rawName}>`
  }

  const children = node.children.map(c => emitNode(c, indent + '  ', ctx)).filter(Boolean).join('\n')
  return `${indent}<${rawName}${attrSep}>\n${children}\n${indent}</${rawName}>`
}

function emitClientElement(node: t.JSXElement, indent: string, ctx: EmitCtx): string {
  const attrs = node.openingElement.attributes as t.JSXAttribute[]

  // Guard: spread attributes are not supported
  const spreadAttr = node.openingElement.attributes.find(a => t.isJSXSpreadAttribute(a))
  if (spreadAttr) {
    throw new CompileError(`<Client> does not support spread attributes`, ctx.filePath)
  }

  // Extract name prop — required
  const nameAttr = attrs.find(a => t.isJSXAttribute(a) && getAttrName(a as t.JSXAttribute) === 'name')
  if (!nameAttr || !t.isJSXAttribute(nameAttr) || !t.isStringLiteral(nameAttr.value)) {
    throw new CompileError(
      `<Client> is missing required string literal "name" prop`,
      ctx.filePath,
    )
  }
  const islandName = (nameAttr.value as t.StringLiteral).value

  // Extract className — applied to div, not serialized
  const classAttr = attrs.find(a => t.isJSXAttribute(a) && getAttrName(a as t.JSXAttribute) === 'className')
  let classValue: string | undefined
  if (classAttr && t.isJSXAttribute(classAttr)) {
    if (t.isStringLiteral(classAttr.value)) {
      classValue = classAttr.value.value
    } else if (t.isJSXExpressionContainer(classAttr.value)) {
      throw new CompileError(
        `<Client name="${islandName}"> className must be a string literal, not an expression`,
        ctx.filePath,
      )
    }
  }

  // Collect remaining props (exclude name, className)
  const propsAttrs = attrs.filter(a => {
    if (!t.isJSXAttribute(a)) return false
    const n = getAttrName(a)
    return n !== 'name' && n !== 'className'
  }) as t.JSXAttribute[]

  // Build props entries for templ output
  const propsEntries = propsAttrs.map(a => {
    const propName = getAttrName(a)
    if (!a.value) return `${indent}    "${propName}": true,`
    if (t.isStringLiteral(a.value)) return `${indent}    "${propName}": "${a.value.value}",`
    if (t.isJSXExpressionContainer(a.value)) {
      const goExpr = emitGoExpr(a.value.expression as t.Expression, ctx)
      return `${indent}    "${propName}": ${goExpr},`
    }
    throw new CompileError(`Unsupported prop value on <Client name="${islandName}">`, ctx.filePath)
  })

  const classLine = classValue ? `\n${indent}  class="${classValue}"` : ''

  // Form 2 detection: check for render prop children
  const nonEmptyChildren = node.children.filter(
    c => !(t.isJSXText(c) && c.value.replace(/\n\s*/g, '').trim() === '')
  )

  if (nonEmptyChildren.length > 0) {
    // Children present — must be exactly one JSXExpressionContainer wrapping an arrow function
    if (
      nonEmptyChildren.length !== 1 ||
      !t.isJSXExpressionContainer(nonEmptyChildren[0]) ||
      !t.isArrowFunctionExpression((nonEmptyChildren[0] as t.JSXExpressionContainer).expression)
    ) {
      throw new CompileError(
        `<Client name="${islandName}"> children must be a single render prop arrow function:\n` +
        `  {({ prop1, prop2 }) => { /* hooks and JSX */ }}`,
        ctx.filePath,
      )
    }

    // Extract prop names from the render prop's destructured parameter
    const arrow = (nonEmptyChildren[0] as t.JSXExpressionContainer).expression as t.ArrowFunctionExpression
    const renderProps: Array<{ name: string }> = []
    const firstParam = arrow.params[0]
    if (t.isObjectPattern(firstParam)) {
      for (const p of firstParam.properties) {
        if (t.isObjectProperty(p) && t.isIdentifier(p.key)) {
          renderProps.push({ name: p.key.name })
        }
      }
    }

    // Notify caller (index.ts) to scaffold or validate the island file
    ctx.onScaffold?.({
      name: islandName,
      renderPropSrc: '',
      props: renderProps,
    })
  }

  // Both Form 1 and Form 2 emit the same data-island mount point
  return [
    `${indent}<div`,
    `${indent}  data-island="${islandName}"`,
    `${indent}  data-island-props={ templ.JSONString(map[string]any{`,
    ...propsEntries,
    `${indent}  }) }${classLine}`,
    `${indent}></div>`,
  ].join('\n')
}

function getAttrName(attr: t.JSXAttribute): string {
  return t.isJSXIdentifier(attr.name) ? attr.name.name : attr.name.name.name
}

function emitJSXAttr(attr: t.JSXAttribute, ctx: EmitCtx): string {
  const name = getAttrName(attr)
  const goName = name === 'className' ? 'class' : name

  if (!attr.value) return goName
  if (t.isStringLiteral(attr.value)) return `${goName}="${attr.value.value}"`
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = emitGoExpr(attr.value.expression as t.Expression, ctx)
    return `${goName}={ ${expr} }`
  }
  throw new CompileError(`Unsupported attribute value: ${attr.value?.type}`, ctx.filePath)
}

function emitExpression(expr: t.Expression, indent: string, ctx: EmitCtx): string {
  if (t.isConditionalExpression(expr)) {
    const test = emitGoExpr(expr.test, ctx)
    const yes = emitNode(expr.consequent, indent + '  ', ctx)
    const no = emitNode(expr.alternate, indent + '  ', ctx)
    return `${indent}if ${test} {\n${yes}\n${indent}} else {\n${no}\n${indent}}`
  }

  if (t.isLogicalExpression(expr) && expr.operator === '&&') {
    const test = emitGoExpr(expr.left, ctx)
    const body = emitNode(expr.right, indent + '  ', ctx)
    return `${indent}if ${test} {\n${body}\n${indent}}`
  }

  if (t.isCallExpression(expr)) return emitCallExpr(expr, indent, ctx)

  if (t.isTemplateLiteral(expr)) {
    return `${'  '.repeat(indent.length / 2)}{ ${emitTemplateLiteral(expr, ctx)} }`
  }

  return `${indent}{ fmt.Sprint(${emitGoExpr(expr, ctx)}) }`
}

function emitCallExpr(call: t.CallExpression, indent: string, ctx: EmitCtx): string {
  if (!t.isMemberExpression(call.callee)) {
    throw new CompileError(`Unsupported call expression`, ctx.filePath)
  }
  const method = t.isIdentifier(call.callee.property) ? call.callee.property.name : ''

  if (['filter', 'sort', 'find', 'reduce', 'findIndex'].includes(method)) {
    throw new CompileError(
      `.${method}() not supported in SSR templates.\nHint: pre-process in resolver, or move to an Island.`,
      ctx.filePath,
    )
  }

  if (method !== 'map') {
    throw new CompileError(`Unsupported method: .${method}()`, ctx.filePath)
  }

  const arrExpr = emitGoExpr(call.callee.object as t.Expression, ctx)
  const callback = call.arguments[0]
  if (!t.isArrowFunctionExpression(callback)) {
    throw new CompileError(`map() callback must be an arrow function`, ctx.filePath)
  }

  const paramName = t.isIdentifier(callback.params[0]) ? callback.params[0].name : '_'
  const bodyCtx: EmitCtx = {
    ...ctx,
    loopVars: new Set([...ctx.loopVars, paramName]),
  }

  const body = emitNode(callback.body as t.Node, indent + '  ', bodyCtx)
  return `${indent}for _, ${paramName} := range ${arrExpr} {\n${body}\n${indent}}`
}

function emitGoExpr(expr: t.Expression, ctx: EmitCtx): string {
  if (t.isMemberExpression(expr)) {
    const parts = flattenMember(expr, ctx)
    const root = parts[0]
    const fields = parts.slice(1).map(capitalize)
    const isParam = ctx.paramNames.has(root) && !ctx.loopVars.has(root)
    if (isParam) {
      return `data.${capitalize(root)}` + (fields.length ? '.' + fields.join('.') : '')
    }
    return root + (fields.length ? '.' + fields.join('.') : '')
  }

  if (t.isIdentifier(expr)) {
    const name = expr.name
    if (ctx.paramNames.has(name) && !ctx.loopVars.has(name)) return `data.${capitalize(name)}`
    return name
  }

  if (t.isUnaryExpression(expr) && expr.operator === '!') {
    return `!${emitGoExpr(expr.argument, ctx)}`
  }

  if (t.isStringLiteral(expr)) return `"${expr.value}"`
  if (t.isNumericLiteral(expr)) return String(expr.value)
  if (t.isBooleanLiteral(expr)) return String(expr.value)
  if (t.isTemplateLiteral(expr)) return emitTemplateLiteral(expr, ctx)

  throw new CompileError(`Unsupported expression type: ${expr.type}\nHint: pre-process in resolver`, ctx.filePath)
}

// Compile a JS template literal to a Go fmt.Sprintf call.
// `` `/products/${p.id}` `` → `fmt.Sprintf("/products/%v", p.Id)`
function emitTemplateLiteral(expr: t.TemplateLiteral, ctx: EmitCtx): string {
  if (expr.expressions.length === 0) {
    return `"${expr.quasis[0].value.cooked ?? expr.quasis[0].value.raw}"`
  }
  const fmt = expr.quasis.map(q => q.value.cooked ?? q.value.raw).join('%v')
  const args = expr.expressions.map(e => emitGoExpr(e as t.Expression, ctx)).join(', ')
  return `fmt.Sprintf("${fmt}", ${args})`
}

function flattenMember(expr: t.MemberExpression, ctx: EmitCtx): string[] {
  const parts: string[] = []
  let cur: t.Expression = expr
  while (t.isMemberExpression(cur)) {
    if (cur.computed) {
      throw new CompileError(`Dynamic member access not supported — use a local variable in resolver`, ctx.filePath)
    }
    if (!t.isIdentifier(cur.property)) {
      throw new CompileError(`Dynamic member access not supported`, ctx.filePath)
    }
    parts.unshift(cur.property.name)
    cur = cur.object as t.Expression
  }
  if (!t.isIdentifier(cur)) throw new CompileError(`Non-identifier at member root`, ctx.filePath)
  parts.unshift(cur.name)
  return parts
}

function emitIslandMount(name: string, meta: IslandMeta, indent: string): string {
  const supportedProps = meta.props.filter(
    p => p.expression === 'literal' || p.expression === 'field-access',
  )
  const unsupportedProps = meta.props.filter(
    p => p.expression !== 'literal' && p.expression !== 'field-access',
  )

  const propsEntries = supportedProps.map(p => `${indent}    "${p.name}": ${p.value},`).join('\n')
  const todoComments = unsupportedProps
    .map(p => `${indent}    // TODO: unsupported prop "${p.name}" omitted`)
    .join('\n')

  const propsBlock = [propsEntries, todoComments].filter(Boolean).join('\n')

  return [
    `${indent}<div`,
    `${indent}  data-island="${name}"`,
    `${indent}  data-island-props={ templ.JSONString(map[string]any{`,
    propsBlock,
    `${indent}  }) }`,
    `${indent}></div>`,
  ].join('\n')
}

const GO_INITIALISMS = new Set([
  'id', 'url', 'uri', 'api', 'html', 'json', 'xml', 'sql', 'http', 'https',
  'uuid', 'uid', 'ip', 'tcp', 'udp', 'rpc', 'eof', 'cpu', 'ram', 'acl',
])

function capitalize(s: string): string {
  if (GO_INITIALISMS.has(s.toLowerCase())) return s.toUpperCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

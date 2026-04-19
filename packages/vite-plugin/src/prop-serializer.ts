import * as t from '@babel/types'
import type { SerializableProp } from './types.ts'

export function serializeProps(
  attrs: t.JSXAttribute[],
  paramNames: Set<string>,
): SerializableProp[] {
  return attrs
    .filter(attr => {
      const name = t.isJSXIdentifier(attr.name) ? attr.name.name : attr.name.name.name
      return name !== 'key'
    })
    .map(attr => serializeAttr(attr, paramNames))
}

function serializeAttr(attr: t.JSXAttribute, paramNames: Set<string>): SerializableProp {
  const name = t.isJSXIdentifier(attr.name) ? attr.name.name : attr.name.name.name

  if (!attr.value) {
    return { name, type: 'boolean', expression: 'literal', value: 'true' }
  }

  if (t.isStringLiteral(attr.value)) {
    return { name, type: 'string', expression: 'literal', value: `"${attr.value.value}"` }
  }

  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression
    if (t.isJSXEmptyExpression(expr)) {
      return { name, type: 'unknown', expression: 'unsupported', value: '' }
    }
    return serializeExpr(name, expr as t.Expression, paramNames)
  }

  return { name, type: 'unknown', expression: 'unsupported', value: '' }
}

function serializeExpr(
  name: string,
  expr: t.Expression,
  paramNames: Set<string>,
): SerializableProp {
  if (t.isStringLiteral(expr)) {
    return { name, type: 'string', expression: 'literal', value: `"${expr.value}"` }
  }
  if (t.isNumericLiteral(expr)) {
    return { name, type: 'number', expression: 'literal', value: String(expr.value) }
  }
  if (t.isBooleanLiteral(expr)) {
    return { name, type: 'boolean', expression: 'literal', value: String(expr.value) }
  }

  if (t.isMemberExpression(expr)) {
    const parts = flattenMember(expr)
    if (!parts) return { name, type: 'unknown', expression: 'unsupported', value: '' }
    const [root, ...fields] = parts
    const goFields = fields.map(capitalize)
    let value: string
    if (paramNames.has(root)) {
      value = `data.${capitalize(root)}` + (goFields.length ? '.' + goFields.join('.') : '')
    } else {
      value = root + (goFields.length ? '.' + goFields.join('.') : '')
    }
    return { name, type: 'string', expression: 'field-access', value }
  }

  if (t.isIdentifier(expr)) {
    const goName = paramNames.has(expr.name) ? `data.${capitalize(expr.name)}` : expr.name
    return { name, type: 'unknown', expression: 'field-access', value: goName }
  }

  if (t.isCallExpression(expr)) {
    return { name, type: 'unknown', expression: 'call-expression', value: '' }
  }

  if (t.isArrayExpression(expr)) {
    return { name, type: 'unknown', expression: 'array', value: '' }
  }

  return { name, type: 'unknown', expression: 'unsupported', value: '' }
}

function flattenMember(expr: t.MemberExpression): string[] | null {
  const parts: string[] = []
  let cur: t.Expression = expr
  while (t.isMemberExpression(cur)) {
    if (!t.isIdentifier(cur.property)) return null
    parts.unshift(cur.property.name)
    cur = cur.object as t.Expression
  }
  if (!t.isIdentifier(cur)) return null
  parts.unshift(cur.name)
  return parts
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

import { describe, it, expect } from 'vitest'
import { serializeProps } from '../prop-serializer'
import { parse } from '@babel/parser'
import * as t from '@babel/types'

function parseJSXAttr(jsxSrc: string) {
  const src = `function F({ product }) { return <CartButton ${jsxSrc} /> }`
  const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  let attrs: t.JSXAttribute[] = []
  function walk(node: t.Node) {
    if (t.isJSXOpeningElement(node) && t.isJSXIdentifier(node.name) && node.name.name === 'CartButton') {
      attrs = node.attributes.filter(t.isJSXAttribute) as t.JSXAttribute[]
    }
    for (const key of Object.keys(node) as (keyof typeof node)[]) {
      const child = (node as any)[key]
      if (Array.isArray(child)) child.forEach((c: any) => c?.type && walk(c))
      else if (child?.type) walk(child)
    }
  }
  walk(ast.program)
  return { attrs, paramNames: new Set(['product']) }
}

describe('serializeProps', () => {
  it('serializes string literal prop', () => {
    const { attrs, paramNames } = parseJSXAttr('label="加入购物车"')
    const props = serializeProps(attrs, paramNames)
    expect(props).toEqual([
      { name: 'label', type: 'string', expression: 'literal', value: '"加入购物车"' },
    ])
  })

  it('serializes number literal prop', () => {
    const { attrs, paramNames } = parseJSXAttr('count={3}')
    const props = serializeProps(attrs, paramNames)
    expect(props).toEqual([
      { name: 'count', type: 'number', expression: 'literal', value: '3' },
    ])
  })

  it('serializes field-access prop with Go data. prefix', () => {
    const { attrs, paramNames } = parseJSXAttr('productId={product.id}')
    const props = serializeProps(attrs, paramNames)
    expect(props).toEqual([
      { name: 'productId', type: 'string', expression: 'field-access', value: 'data.Product.Id' },
    ])
  })

  it('serializes multi-level field access', () => {
    const { attrs, paramNames } = parseJSXAttr('city={product.vendor.city}')
    const props = serializeProps(attrs, paramNames)
    expect(props[0]).toMatchObject({
      name: 'city',
      expression: 'field-access',
      value: 'data.Product.Vendor.City',
    })
  })

  it('marks call-expression props as todo (no build failure)', () => {
    const { attrs, paramNames } = parseJSXAttr('items={getItems()}')
    const props = serializeProps(attrs, paramNames)
    expect(props[0]).toMatchObject({
      name: 'items',
      expression: 'call-expression',
      value: '',
    })
  })

  it('marks arrow function props as unsupported', () => {
    const { attrs, paramNames } = parseJSXAttr('fn={x => x}')
    const props = serializeProps(attrs, paramNames)
    expect(props[0]).toMatchObject({
      name: 'fn',
      expression: 'unsupported',
      value: '',
    })
  })

  it('drops key attribute', () => {
    const { attrs, paramNames } = parseJSXAttr('key={product.id} productId={product.id}')
    const props = serializeProps(attrs, paramNames)
    expect(props).toHaveLength(1)
    expect(props[0].name).toBe('productId')
  })
})

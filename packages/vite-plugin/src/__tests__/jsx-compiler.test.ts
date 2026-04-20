import { describe, it, expect } from 'vitest'
import { compileJSXToTempl, CompileError } from '../jsx-compiler'
import type { IslandMap, IslandMeta, CompileOptions } from '../types'

const baseOpts: CompileOptions = {
  pageName: 'ProductPage',
  goPackage: 'templates',
  goImport: 'regox.dev/mvp/generated',
  filePath: '/project/pages/product/[id].tsx',
}

function compile(source: string, islandMap: IslandMap = new Map(), opts = baseOpts) {
  return compileJSXToTempl(source.trim(), islandMap, opts)
}

// ── templ function signature ──────────────────────────────────────────────────

describe('templ function signature', () => {
  it('emits templ function with data param when dataType present', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div></div>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('templ ProductPage(data generated.ProductPageData)')
  })

  it('emits templ function with no params for no-data pages', () => {
    const src = `export default function IndexPage() { return <div></div> }`
    const { templ } = compile(src, new Map(), { ...baseOpts, pageName: 'IndexPage' })
    expect(templ).toContain('templ IndexPage()')
    expect(templ).not.toContain('data generated')
  })

  it('includes package declaration', () => {
    const src = `export default function ProductPage({ product }: ProductPageData) { return <div></div> }`
    const { templ } = compile(src)
    expect(templ.startsWith('package templates')).toBe(true)
  })

  it('includes fmt import', () => {
    const src = `export default function ProductPage({ product }: ProductPageData) { return <div></div> }`
    const { templ } = compile(src)
    expect(templ).toContain('import "fmt"')
  })
})

// ── HTML elements ─────────────────────────────────────────────────────────────

describe('HTML element passthrough', () => {
  it('passes through basic HTML tags', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <main><h1>Hello</h1></main>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('<main>')
    expect(templ).toContain('<h1>Hello</h1>')
  })

  it('converts className to class', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div className="container"></div>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('class="container"')
    expect(templ).not.toContain('className')
  })

  it('passes through aria-* and data-* attributes unchanged', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <button aria-label="close" data-testid="btn">X</button>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('aria-label="close"')
    expect(templ).toContain('data-testid="btn"')
  })

  it('drops key attribute', () => {
    const src = `
      export default function ShopPage({ products }: ShopPageData) {
        return <ul>{products.map(p => <li key={p.id}>{p.title}</li>)}</ul>
      }
    `
    const { templ } = compile(src, new Map(), { ...baseOpts, pageName: 'ShopPage' })
    expect(templ).not.toContain('key=')
  })
})

// ── Member expressions ────────────────────────────────────────────────────────

describe('member expression compilation', () => {
  it('capitalizes fields and prefixes with data. for function params', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <h1>{product.title}</h1>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('{ fmt.Sprint(data.Product.Title) }')
  })

  it('handles multi-level field access', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <p>{product.vendor.name}</p>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('{ fmt.Sprint(data.Product.Vendor.Name) }')
  })

  it('keeps loop variable without data. prefix', () => {
    const src = `
      export default function ShopPage({ products }: ShopPageData) {
        return <ul>{products.map(p => <li>{p.title}</li>)}</ul>
      }
    `
    const { templ } = compile(src, new Map(), { ...baseOpts, pageName: 'ShopPage' })
    expect(templ).toContain('{ fmt.Sprint(p.Title) }')
    expect(templ).not.toContain('data.P.')
  })
})

// ── Conditional expressions ───────────────────────────────────────────────────

describe('conditional compilation', () => {
  it('compiles ternary to if/else', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div>{product.inStock ? <span>In Stock</span> : <span>Out of Stock</span>}</div>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('if data.Product.InStock {')
    expect(templ).toContain('<span>In Stock</span>')
    expect(templ).toContain('} else {')
    expect(templ).toContain('<span>Out of Stock</span>')
  })

  it('compiles logical AND to if without else', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div>{!product.inStock && <span>Out of Stock</span>}</div>
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('if !data.Product.InStock {')
    expect(templ).toContain('<span>Out of Stock</span>')
    expect(templ).not.toContain('else')
  })
})

// ── Loop compilation ──────────────────────────────────────────────────────────

describe('map() → for...range', () => {
  it('compiles .map() to for...range loop', () => {
    const src = `
      export default function ShopPage({ products }: ShopPageData) {
        return <ul>{products.map(p => <li>{p.title}</li>)}</ul>
      }
    `
    const { templ } = compile(src, new Map(), { ...baseOpts, pageName: 'ShopPage' })
    expect(templ).toContain('for _, p := range data.Products {')
    expect(templ).toContain('<li>')
    expect(templ).toContain('{ fmt.Sprint(p.Title) }')
  })
})

// ── Island substitution ───────────────────────────────────────────────────────

describe('Island component substitution', () => {
  it('replaces Island component with data-island mount', () => {
    const islandMap: IslandMap = new Map([
      ['CartButton', {
        componentName: 'CartButton',
        filePath: '/project/src/CartButton.tsx',
        props: [
          { name: 'productId', type: 'string', expression: 'field-access', value: 'data.Product.Id' },
        ],
        reason: ['useState', 'onClick'],
      } satisfies IslandMeta],
    ])
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div><CartButton productId={product.id} /></div>
      }
    `
    const { templ } = compile(src, islandMap)
    expect(templ).toContain('data-island="CartButton"')
    expect(templ).toContain('data-props=')
    expect(templ).toContain('"productId": data.Product.Id') // uses IslandMeta.props.value directly
    expect(templ).not.toContain('@CartButton')
  })

  it('omits unsupported props from data-island mount with TODO comment', () => {
    const islandMap: IslandMap = new Map([
      ['CartButton', {
        componentName: 'CartButton',
        filePath: '/project/src/CartButton.tsx',
        props: [
          { name: 'productId', type: 'string', expression: 'field-access', value: 'data.Product.Id' },
          { name: 'items', type: 'string[]', expression: 'unsupported', value: '' },
        ],
        reason: ['useState'],
      } satisfies IslandMeta],
    ])
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <div><CartButton productId={product.id} items={product.variants} /></div>
      }
    `
    const { templ } = compile(src, islandMap)
    expect(templ).toContain('"productId": data.Product.Id')
    expect(templ).toContain('// TODO: unsupported prop "items" omitted')
    expect(templ).not.toContain('"items":')
  })
})

// ── <Client> Form 1 — self-closing island mount ───────────────────────────────

describe('<Client> Form 1 — self-closing island mount', () => {
  it('emits data-island mount for <Client name="X" />', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <div>
            <Client name="AddToCart" productId={product.id} />
          </div>
        )
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('data-island="AddToCart"')
    expect(templ).toContain('"productId": data.Product.ID')
  })

  it('applies className to mount-point div, not data-props', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <div>
            <Client name="AddToCart" productId={product.id} className="mt-4" />
          </div>
        )
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('class="mt-4"')
    expect(templ).not.toContain('"className"')
  })

  it('does not serialize the name prop into data-props', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <div>
            <Client name="AddToCart" productId={product.id} />
          </div>
        )
      }
    `
    const { templ } = compile(src)
    expect(templ).not.toContain('"name"')
  })

  it('throws CompileError when name prop is missing', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <Client productId={product.id} />
      }
    `
    expect(() => compile(src)).toThrow(CompileError)
  })

  it('serializes string literal props into data-props', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <div>
            <Client name="AddToCart" label="Add to cart" />
          </div>
        )
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('"label": "Add to cart"')
  })
})

// ── <Client> Form 2 — render prop inline island extraction ───────────────────

describe('<Client> Form 2 — render prop inline extraction', () => {
  it('emits data-island mount point for render prop form', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <div>
            <Client name="WishlistToggle" productId={product.id}>
              {({ productId }) => {
                const [saved, setSaved] = useState(false)
                return <button onClick={() => setSaved(s => !s)}>Save</button>
              }}
            </Client>
          </div>
        )
      }
    `
    const { templ } = compile(src)
    expect(templ).toContain('data-island="WishlistToggle"')
    expect(templ).toContain('"productId": data.Product.ID')
  })

  it('calls onScaffold with name and props list', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <Client name="WishlistToggle" productId={product.id}>
            {({ productId }) => {
              const [saved, setSaved] = useState(false)
              return <button>Save</button>
            }}
          </Client>
        )
      }
    `
    const scaffolds: any[] = []
    compileJSXToTempl(src.trim(), new Map(), baseOpts, (spec) => scaffolds.push(spec))
    expect(scaffolds).toHaveLength(1)
    expect(scaffolds[0].name).toBe('WishlistToggle')
    expect(scaffolds[0].props).toContainEqual({ name: 'productId' })
  })

  it('throws CompileError when children is not a render prop arrow function', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return (
          <Client name="X">
            <div>not a render prop</div>
          </Client>
        )
      }
    `
    expect(() => compile(src)).toThrow(CompileError)
  })
})

// ── Fast-fail cases ───────────────────────────────────────────────────────────

describe('fast-fail on unsupported patterns', () => {
  it('throws on .filter() with hint', () => {
    const src = `
      export default function ProductPage({ products }: ProductPageData) {
        return <ul>{products.filter(p => p.active).map(p => <li>{p.title}</li>)}</ul>
      }
    `
    expect(() => compile(src)).toThrow('pre-process in resolver')
  })

  it('throws on .sort() with hint', () => {
    const src = `
      export default function ProductPage({ products }: ProductPageData) {
        return <ul>{products.sort().map(p => <li>{p.title}</li>)}</ul>
      }
    `
    expect(() => compile(src)).toThrow('pre-process in resolver')
  })

  it('compiles template literal to fmt.Sprintf', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <p>{\`Hello \${product.name}\`}</p>
      }
    `
    const result = compile(src)
    expect(result.templ).toContain('fmt.Sprintf')
    expect(result.templ).toContain('"Hello %v"')
  })

  it('compiles template literal in href attribute to fmt.Sprintf', () => {
    const src = `
      export default function ProductPage({ product }: ProductPageData) {
        return <a href={\`/products/\${product.id}\`}>link</a>
      }
    `
    const result = compile(src)
    expect(result.templ).toContain('fmt.Sprintf')
    expect(result.templ).toContain('"/products/%v"')
  })
})

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { routeToTemplPath, extractPageMeta } from '../page-scanner'

const PAGES_DIR = '/project/frontend/pages'
const TEMPLATES_DIR = '/project/backend/templates'

describe('routeToTemplPath', () => {
  it('converts simple route to templ path', () => {
    expect(routeToTemplPath('/shop', TEMPLATES_DIR)).toBe(
      path.join(TEMPLATES_DIR, 'shop.templ')
    )
  })

  it('converts dynamic route to double-underscore path', () => {
    expect(routeToTemplPath('/product/[id]', TEMPLATES_DIR)).toBe(
      path.join(TEMPLATES_DIR, 'product__id.templ')
    )
  })

  it('converts index route', () => {
    expect(routeToTemplPath('/', TEMPLATES_DIR)).toBe(
      path.join(TEMPLATES_DIR, 'index.templ')
    )
  })

  it('converts nested dynamic route', () => {
    expect(routeToTemplPath('/user/[id]/orders/[orderId]', TEMPLATES_DIR)).toBe(
      path.join(TEMPLATES_DIR, 'user__id__orders__orderId.templ')
    )
  })
})

describe('extractPageMeta', () => {
  const makeFile = (content: string, filePath = '/project/frontend/pages/product/[id].tsx') =>
    ({ content, filePath, pagesDir: PAGES_DIR, templatesDir: TEMPLATES_DIR })

  it('extracts mode from regox export', () => {
    const meta = extractPageMeta({
      content: `export const regox = { mode: 'ssr' } satisfies RegoxPageConfig`,
      filePath: '/project/frontend/pages/shop.tsx',
      pagesDir: PAGES_DIR,
      templatesDir: TEMPLATES_DIR,
    })
    expect(meta.mode).toBe('ssr')
  })

  it('defaults to csr when no regox export', () => {
    const meta = extractPageMeta({
      content: `export default function IndexPage() { return <div/> }`,
      filePath: '/project/frontend/pages/index.tsx',
      pagesDir: PAGES_DIR,
      templatesDir: TEMPLATES_DIR,
    })
    expect(meta.mode).toBe('csr')
  })

  it('extracts ISR revalidate value', () => {
    const meta = extractPageMeta({
      content: `export const regox = { mode: 'isr', revalidate: 300 } satisfies RegoxPageConfig`,
      filePath: '/project/frontend/pages/shop.tsx',
      pagesDir: PAGES_DIR,
      templatesDir: TEMPLATES_DIR,
    })
    expect(meta.mode).toBe('isr')
    expect(meta.revalidate).toBe(300)
  })

  it('extracts pageName from default export function', () => {
    const meta = extractPageMeta(makeFile(`
      export const regox = { mode: 'ssr' } satisfies RegoxPageConfig
      export default function ProductPage({ product }: ProductPageData) { return <div/> }
    `))
    expect(meta.pageName).toBe('ProductPage')
  })

  it('extracts dataType from destructured parameter', () => {
    const meta = extractPageMeta(makeFile(`
      export default function ProductPage({ product }: ProductPageData) { return <div/> }
    `))
    expect(meta.dataType).toBe('ProductPageData')
  })

  it('sets dataType null for no-param pages', () => {
    const meta = extractPageMeta({
      content: `export default function IndexPage() { return <div/> }`,
      filePath: '/project/frontend/pages/index.tsx',
      pagesDir: PAGES_DIR,
      templatesDir: TEMPLATES_DIR,
    })
    expect(meta.dataType).toBeNull()
  })

  it('builds correct templPath', () => {
    const meta = extractPageMeta(makeFile(
      `export default function ProductPage({ product }: ProductPageData) { return <div/> }`
    ))
    expect(meta.templPath).toBe(path.join(TEMPLATES_DIR, 'product__id.templ'))
  })
})

import { describe, it, expect } from 'vitest'
import { compileLayout, writeGoLayout } from '../go-layout-writer.ts'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('compileLayout', () => {
  it('emits package declaration and templ signature', () => {
    const src = `
export default function Layout({ children, title = 'App', stylesheet = '' }) {
  return (
    <html lang="en">
      <head><title>{title}</title></head>
      <body>{children}</body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('package templates')
    expect(out).toContain('templ Layout(title string, stylesheet string)')
  })

  it('compiles {children} to { children... }', () => {
    const src = `
export default function Layout({ children }) {
  return <html><body>{children}</body></html>
}
`
    const out = compileLayout(src)
    expect(out).toContain('{ children... }')
    expect(out).not.toContain('{children}')
  })

  it('compiles {title} prop to Go templ expression', () => {
    const src = `
export default function Layout({ children, title = 'App', stylesheet = '' }) {
  return <html><head><title>{title}</title></head><body>{children}</body></html>
}
`
    const out = compileLayout(src)
    expect(out).toContain('{ title }')
  })

  it('compiles href={stylesheet} to conditional Go templ block', () => {
    const src = `
export default function Layout({ children, title = 'App', stylesheet = '' }) {
  return (
    <html>
      <head>
        <link rel="stylesheet" href={stylesheet} />
      </head>
      <body>{children}</body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('if stylesheet != ""')
    expect(out).toContain('<link rel="stylesheet" href={ stylesheet }')
  })

  it('compiles dangerouslySetInnerHTML script to inline Go templ script', () => {
    const fouc = `(function(){var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark')})()`
    const src = `
export default function Layout({ children }) {
  return (
    <html>
      <head>
        <script dangerouslySetInnerHTML={{ __html: \`${fouc}\` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('<script>')
    expect(out).toContain(fouc)
    expect(out).toContain('</script>')
    expect(out).not.toContain('dangerouslySetInnerHTML')
  })

  it('compiles PascalCase island components to data-island div mounts', () => {
    const src = `
export default function Layout({ children }) {
  return (
    <html>
      <body>
        <nav><ThemeToggle /></nav>
        {children}
      </body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('data-island="ThemeToggle"')
    expect(out).not.toContain('<ThemeToggle')
  })

  it('compiles CartBadge island inside nav', () => {
    const src = `
export default function Layout({ children }) {
  return (
    <html>
      <body>
        <nav><span>Cart</span><CartBadge /></nav>
        {children}
      </body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('data-island="CartBadge"')
  })

  it('preserves static HTML attributes verbatim', () => {
    const src = `
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('lang="en"')
    expect(out).toContain('class="min-h-screen flex flex-col bg-background text-foreground"')
  })

  it('resolves dangerouslySetInnerHTML when __html references a top-level const', () => {
    const src = `
const SCRIPT = \`(function(){var x=1})()\`

export default function Layout({ children }) {
  return (
    <html>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('<script>(function(){var x=1})()</script>')
    expect(out).not.toContain('SCRIPT')
    expect(out).not.toContain('dangerouslySetInnerHTML')
  })

  it('emits DOCTYPE at top of templ body', () => {
    const src = `
export default function Layout({ children }) {
  return (
    <html><body>{children}</body></html>
  )
}
`
    const out = compileLayout(src)
    expect(out).toContain('<!DOCTYPE html>')
  })
})

describe('writeGoLayout', () => {
  it('writes Layout.templ to outDir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regox-test-'))
    try {
      const layoutSrc = `
export default function Layout({ children, title = 'App', stylesheet = '' }) {
  return (
    <html lang="en">
      <head>
        <title>{title}</title>
        <link rel="stylesheet" href={stylesheet} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
`
      const layoutPath = path.join(tmpDir, '_layout.tsx')
      fs.writeFileSync(layoutPath, layoutSrc)

      writeGoLayout(layoutPath, tmpDir)

      const out = fs.readFileSync(path.join(tmpDir, 'Layout.templ'), 'utf-8')
      expect(out).toContain('package templates')
      expect(out).toContain('templ Layout(title string, stylesheet string)')
      expect(out).toContain('{ children... }')
    } finally {
      fs.rmSync(tmpDir, { recursive: true })
    }
  })
})

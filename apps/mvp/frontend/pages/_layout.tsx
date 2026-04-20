import React from 'react'

// Island mount points — not real React components, compiled away by Vite plugin
declare function CartBadge(props: {}): JSX.Element
declare function ThemeToggle(props: {}): JSX.Element

interface LayoutProps {
  children: React.ReactNode
  title?: string
  stylesheet?: string
}

const FOUC_SCRIPT = `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')})()`

export default function Layout({ children, title = 'Regox MVP', stylesheet = '' }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href={stylesheet} />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <nav className="bg-background border-b border-border sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-primary tracking-tight">Regox Shop</a>
            <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="/products" className="hover:text-foreground transition-colors">Products</a>
              <a href="/news" className="hover:text-foreground transition-colors">News</a>
              <a href="/cart" className="relative hover:text-foreground transition-colors flex items-center gap-1">
                <span>Cart</span>
                <CartBadge />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
        <footer className="bg-background border-t border-border mt-16">
          <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
            © 2026 Regox Shop — built with Regox framework
          </div>
        </footer>
      </body>
    </html>
  )
}

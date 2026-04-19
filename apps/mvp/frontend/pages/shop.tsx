// ISR page — cached, revalidated every 5 minutes.
import type { RegoxPageConfig } from '../regox'

export type PageData = {
  products: Array<{
    id: string
    title: string
    price: number
  }>
}

export const regox = { mode: 'isr', revalidate: 300 } satisfies RegoxPageConfig

export default function ShopPage({ products }: PageData) {
  return (
    <main>
      <h1>Shop</h1>
      <ul>
        {products.map(p => (
          <li key={p.id}>{p.title} — {p.price}</li>
        ))}
      </ul>
    </main>
  )
}

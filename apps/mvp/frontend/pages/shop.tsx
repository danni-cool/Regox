import type { RegoxPageConfig } from '../regox'
import type { ShopPageData } from '../generated/types'

export const regox = { mode: 'isr', revalidate: 300 } satisfies RegoxPageConfig

export default function ShopPage({ products }: ShopPageData) {
  return (
    <main>
      <h1>Shop</h1>
      <ul>
        {products.map(p => (
          <li key={p.id}>
            {p.title} — {p.price}
            {!p.inStock && <span> (Out of Stock)</span>}
          </li>
        ))}
      </ul>
    </main>
  )
}

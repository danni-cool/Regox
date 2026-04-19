// SSR page — Go renders shell, CartButton is an Island.
import type { RegoxPageConfig } from '../../regox'

export type PageData = {
  product: {
    id: string
    title: string
    price: number
    inStock: boolean
  }
}

export const regox = { mode: 'ssr' } satisfies RegoxPageConfig

export default function ProductPage({ product }: PageData) {
  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.price}</p>
      {/* CartButton will be extracted as an Island by the Vite plugin */}
      {/* <CartButton productId={product.id} /> */}
    </main>
  )
}

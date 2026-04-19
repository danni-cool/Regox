import type { RegoxPageConfig } from '../../../regox'
import type { ProductPageData } from '../../generated/types'
import { CartButton } from '../../src/CartButton'

export const regox = { mode: 'ssr' } satisfies RegoxPageConfig

export default function ProductPage({ product }: ProductPageData) {
  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.price}</p>
      {product.inStock ? <span>In Stock</span> : <span>Out of Stock</span>}
      <CartButton productId={product.id} />
    </main>
  )
}

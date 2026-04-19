import type { RegoxPageConfig } from '../../../regox'
import type { ProductPageData } from '../../generated/types'

export const regox = { mode: 'ssr' } satisfies RegoxPageConfig

export default function ProductPage({ product }: ProductPageData) {
  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.price}</p>
      {product.inStock ? <span>In Stock</span> : <span>Out of Stock</span>}
      {/* CartButton will be auto-detected as Island (useState + onClick) */}
      {/* <CartButton productId={product.id} /> */}
    </main>
  )
}

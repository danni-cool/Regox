import { useResolverData } from '../../lib/useResolverData'
import type { components } from '../../generated/types'
import type { RegoxPageConfig } from '../../lib/types'

export const regox: RegoxPageConfig = { mode: 'ssr' }

type ProductDetailPageData = components['schemas']['ProductDetailPageData']

export default function ProductDetailPage() {
  const data = useResolverData<ProductDetailPageData>('products/[id]')

  if (!data) return null

  const { product, reviews } = data

  return (
    <div className="max-w-3xl mx-auto p-6">
      <a href="/products" className="text-blue-600 hover:underline mb-4 inline-block">← Back to Products</a>
      <div className="grid grid-cols-2 gap-8 mt-4">
        <div>
          <img src={product.imageURL} alt={product.name} className="w-full rounded-lg shadow" />
        </div>
        <div>
          <span className="text-sm text-blue-600 font-medium">{product.category}</span>
          <h1 className="text-2xl font-bold mt-2">{product.name}</h1>
          <p className="text-3xl font-bold text-gray-900 mt-3">${product.price.toFixed(2)}</p>
          <p className="text-gray-600 mt-4">{product.description}</p>
          {product.stock > 0
            ? <p className="text-green-600 text-sm mt-2">{product.stock} in stock</p>
            : <p className="text-red-500 text-sm mt-2">Out of stock</p>
          }
          <div
            data-island="AddToCart"
            data-island-props={JSON.stringify({ productId: product.id, productName: product.name, price: product.price })}
            className="mt-6"
          />
        </div>
      </div>
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Customer Reviews</h2>
        <div data-island="Reviews" data-island-props={JSON.stringify({ productId: product.id })} />
      </section>
      <div data-island="CartBadge" />
    </div>
  )
}

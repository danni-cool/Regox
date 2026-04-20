import type { RegoxPageConfig } from '../regox.d'
import type { components } from '../generated/types'
import { useResolverData } from '../lib/useResolverData'

export const regox: RegoxPageConfig = { mode: 'isr', revalidate: 60 }

type ProductsPageData = components['schemas']['ProductsPageData']

export default function ProductsPage() {
  const data = useResolverData<ProductsPageData>('products')

  if (!data) return <div>Loading...</div>

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">All Products</h1>
      <div className="grid grid-cols-3 gap-6">
        {data.products.map(p => (
          <a key={p.id} href={`/products/${p.id}`} className="block border rounded-lg overflow-hidden hover:shadow-md transition">
            <img src={p.imageURL} alt={p.name} className="w-full h-48 object-cover" />
            <div className="p-4">
              <span className="text-xs text-blue-600 font-medium">{p.category}</span>
              <h3 className="font-medium mt-1">{p.name}</h3>
              <p className="text-gray-800 font-bold mt-1">${p.price.toFixed(2)}</p>
              {p.stock === 0 && <span className="text-red-500 text-sm">Out of stock</span>}
            </div>
          </a>
        ))}
      </div>
    </main>
  )
}

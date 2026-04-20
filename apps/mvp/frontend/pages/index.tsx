import type { RegoxPageConfig } from '../regox.d'
import type { components } from '../generated/types'
import { useResolverData } from '../lib/useResolverData'

export const regox: RegoxPageConfig = { mode: 'ssr' }

type HomePageData = components['schemas']['HomePageData']

export default function HomePage() {
  // Key matches operationId suffix: GetHomePage → 'home'
  // Go injects this key into __REGOX_STATE__ when rendering SSR pages.
  const data = useResolverData<HomePageData>('home')

  if (!data) return <div>Loading...</div>

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Welcome to Regox Shop</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Featured Products</h2>
        <div className="grid grid-cols-3 gap-4">
          {data.featuredProducts.map(p => (
            <a key={p.id} href={`/products/${p.id}`} className="block border rounded-lg p-4 hover:shadow-md transition">
              <img src={p.imageURL} alt={p.name} className="w-full h-40 object-cover rounded mb-2" />
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-gray-600">${p.price.toFixed(2)}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Latest News</h2>
        <div className="space-y-4">
          {data.latestNews.map(n => (
            <a key={n.id} href={`/news/${n.id}`} className="block border rounded-lg p-4 hover:shadow-md transition">
              <h3 className="font-medium">{n.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{n.summary}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

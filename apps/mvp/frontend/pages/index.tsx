import type { RegoxPageConfig } from '../regox.d'
import type { components } from '../generated/types'
import { useResolverData } from '@regox/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

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
            <Card key={p.id} className="flex flex-col">
              <img src={p.imageURL} alt={p.name} className="w-full h-40 object-cover rounded-t-lg" />
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <span className="font-bold">${p.price.toFixed(2)}</span>
              </CardContent>
              <CardFooter>
                <Button size="sm" asChild className="w-full">
                  <a href={`/products/${p.id}`}>View</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Latest News</h2>
        <div className="space-y-4">
          {data.latestNews.map(n => (
            <Card key={n.id} className="hover:shadow-md transition">
              <CardHeader>
                <CardTitle className="text-base">{n.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{n.summary}</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/news/${n.id}`}>Read more</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}

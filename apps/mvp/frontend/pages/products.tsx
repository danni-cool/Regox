import type { RegoxPageConfig } from '../regox.d'
import type { components } from '../generated/types'
import { useResolverData } from '@regox/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

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
          <Card key={p.id} className="flex flex-col overflow-hidden">
            <img src={p.imageURL} alt={p.name} className="w-full h-48 object-cover" />
            <CardHeader>
              <Badge variant="secondary" className="w-fit">{p.category}</Badge>
              <CardTitle className="text-base mt-1">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <span className="font-bold text-gray-800">${p.price.toFixed(2)}</span>
              {p.stock === 0 && (
                <Badge variant="destructive" className="ml-2">Out of stock</Badge>
              )}
            </CardContent>
            <CardFooter>
              <Button size="sm" asChild className="w-full">
                <a href={`/products/${p.id}`}>View</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  )
}

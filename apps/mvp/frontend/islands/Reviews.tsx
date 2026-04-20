import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

interface Review {
  id: string
  productId: string
  author: string
  rating: number
  body: string
  publishedAt: string
}

interface ReviewsProps {
  productId: string
}

export default function Reviews({ productId }: ReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then(r => r.json())
      .then((data: Review[]) => setReviews(data ?? []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading reviews...</p>
  }

  if (reviews.length === 0) {
    return <p className="text-muted-foreground text-sm">No reviews yet.</p>
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <Card key={r.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="font-medium">{r.author}</span>
            <Badge variant="secondary">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{r.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { useState, useEffect } from 'react'

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
    return <p className="text-gray-400 text-sm">Loading reviews...</p>
  }

  if (reviews.length === 0) {
    return <p className="text-gray-500 text-sm">No reviews yet.</p>
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <div key={r.id} className="border rounded p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{r.author}</span>
            <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
          </div>
          <p className="text-gray-700 text-sm">{r.body}</p>
        </div>
      ))}
    </div>
  )
}

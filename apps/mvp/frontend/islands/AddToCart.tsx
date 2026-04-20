import { useState } from 'react'
import { useCartStore } from '../lib/stores/cart'
import { useEmit } from '../lib/useEmit'

interface AddToCartProps {
  productId: string
  productName: string
  price: number
}

type CartUpdatedEvent = { productId: string; quantity: number; productName: string }

export default function AddToCart({ productId, productName, price }: AddToCartProps) {
  const [qty, setQty] = useState(1)
  const [isPosting, setIsPosting] = useState(false)
  const addItem = useCartStore(s => s.addItem)
  const emit = useEmit<CartUpdatedEvent>('cart:updated')

  async function handleAdd() {
    if (isPosting) return
    setIsPosting(true)
    try {
      addItem(productId, qty)
      emit({ productId, quantity: qty, productName })
      await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productID: productId, quantity: qty }),
      })
    } catch {
      // Optimistic update stays; server sync failed silently in demo
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border rounded">
        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-gray-100">−</button>
        <span className="px-4">{qty}</span>
        <button onClick={() => setQty(q => q + 1)} className="px-3 py-2 hover:bg-gray-100">+</button>
      </div>
      <button
        onClick={handleAdd}
        disabled={isPosting}
        className="flex-1 bg-blue-600 text-white rounded py-2 px-6 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPosting ? 'Adding...' : `Add to Cart — $${(price * qty).toFixed(2)}`}
      </button>
    </div>
  )
}

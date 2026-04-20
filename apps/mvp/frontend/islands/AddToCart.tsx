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
    <div className="flex items-center gap-4">
      <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setQty(q => Math.max(1, q - 1))}
          className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
        >
          −
        </button>
        <span className="px-5 py-3 font-semibold text-gray-900 min-w-[3rem] text-center">{qty}</span>
        <button
          onClick={() => setQty(q => q + 1)}
          className="px-4 py-3 text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
        >
          +
        </button>
      </div>
      <button
        onClick={handleAdd}
        disabled={isPosting}
        className="flex-1 bg-indigo-600 text-white rounded-xl py-3 px-8 font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
      >
        {isPosting ? 'Adding...' : `Add to Cart — $${(price * qty).toFixed(2)}`}
      </button>
    </div>
  )
}

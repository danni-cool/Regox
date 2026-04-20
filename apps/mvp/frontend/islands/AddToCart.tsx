import { useState } from 'react'
import { useCartStore } from '../lib/stores/cart'
import { useEmit } from '@regox/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

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
      addItem(productId, qty, productName, price)
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
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setQty(q => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          −
        </Button>
        <Input
          type="number"
          value={qty}
          onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 text-center"
          min={1}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setQty(q => q + 1)}
          aria-label="Increase quantity"
        >
          +
        </Button>
      </div>
      <Button
        onClick={handleAdd}
        disabled={isPosting}
        className="flex-1"
      >
        {isPosting ? 'Adding...' : `Add to Cart — $${(price * qty).toFixed(2)}`}
      </Button>
    </div>
  )
}

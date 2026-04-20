import { useState } from 'react'
import { useCartStore } from '../lib/stores/cart'
import { useEvent } from '@regox/client'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Badge } from '../components/ui/badge'

type CartUpdatedEvent = { productId: string; quantity: number; productName: string }
type CheckoutState = 'idle' | 'processing' | 'success' | 'error'

export default function CartView() {
  const { items, totalCount, removeItem, updateItem, clearCart } = useCartStore()
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle')

  useEvent<CartUpdatedEvent>('cart:updated', ({ productId, quantity }) => {
    updateItem(productId, quantity)
  })

  async function handleCheckout() {
    if (checkoutState === 'processing') return
    setCheckoutState('processing')
    try {
      const res = await fetch('/api/orders', { method: 'POST' })
      if (!res.ok) throw new Error('checkout failed')
      clearCart()
      setCheckoutState('success')
    } catch {
      setCheckoutState('error')
    }
  }

  if (checkoutState === 'success') {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center">
        <CardContent className="py-12">
          <p className="text-2xl font-bold text-green-600">Order placed!</p>
          <p className="text-muted-foreground mt-2">Thank you for your purchase.</p>
          <Button variant="link" className="mt-6" asChild>
            <a href="/products">Continue shopping</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center">
        <CardContent className="py-12">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button variant="link" className="mt-4" asChild>
            <a href="/products">Browse products</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cart
          <Badge variant="secondary">{totalCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, i) => (
          <div key={item.productId}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)} × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.productId)}
                  aria-label="Remove item"
                >
                  ×
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-lg font-bold">Total: ${total.toFixed(2)}</p>
        <Button
          onClick={handleCheckout}
          disabled={checkoutState === 'processing'}
        >
          {checkoutState === 'processing' ? 'Processing...' : 'Checkout'}
        </Button>
      </CardFooter>
      {checkoutState === 'error' && (
        <p className="px-6 pb-4 text-sm text-destructive">Checkout failed. Please try again.</p>
      )}
    </Card>
  )
}

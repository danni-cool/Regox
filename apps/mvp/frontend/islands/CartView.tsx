import { useState } from 'react'
import { useCartStore } from '../lib/stores/cart'
import { useEvent } from '../lib/useEvent'

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
      <div className="text-center py-12">
        <p className="text-2xl font-bold text-green-600">Order placed!</p>
        <p className="text-gray-600 mt-2">Thank you for your purchase.</p>
        <a href="/products" className="mt-6 inline-block text-blue-600 hover:underline">Continue shopping</a>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Your cart is empty.</p>
        <a href="/products" className="mt-4 inline-block text-blue-600 hover:underline">Browse products</a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Cart ({totalCount} items)</h1>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.productId} className="flex items-center justify-between border rounded p-4">
            <div>
              <p className="font-medium">{item.productId}</p>
              <p className="text-gray-500 text-sm">Qty: {item.quantity}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateItem(item.productId, Math.max(1, item.quantity - 1))}
                className="px-2 py-1 border rounded hover:bg-gray-100"
              >−</button>
              <span className="w-8 text-center">{item.quantity}</span>
              <button
                onClick={() => updateItem(item.productId, item.quantity + 1)}
                className="px-2 py-1 border rounded hover:bg-gray-100"
              >+</button>
              <button
                onClick={() => removeItem(item.productId)}
                className="ml-2 text-red-500 hover:text-red-700 text-sm"
              >Remove</button>
            </div>
          </div>
        ))}
      </div>
      {checkoutState === 'error' && (
        <p className="text-red-500 text-sm mt-4">Checkout failed. Please try again.</p>
      )}
      <button
        onClick={handleCheckout}
        disabled={checkoutState === 'processing'}
        className="mt-6 w-full bg-blue-600 text-white rounded py-3 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {checkoutState === 'processing' ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  )
}

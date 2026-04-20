import { useState, useEffect } from 'react'
import { useEvent } from '../lib/useEvent'

interface ToastMessage {
  id: number
  text: string
}

type CartUpdatedEvent = { productName: string; quantity: number }

let nextId = 0

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEvent<CartUpdatedEvent>('cart:updated', ({ productName, quantity }) => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, text: `✓ Added ${quantity}× ${productName} to cart` }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  })

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 space-y-3 z-50">
      {toasts.map(t => (
        <div
          key={t.id}
          className="bg-gray-900 text-white text-sm rounded-xl px-5 py-3 shadow-2xl flex items-center gap-2 animate-in"
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

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
    setToasts(prev => [...prev, { id, text: `Added ${quantity}× ${productName} to cart` }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  })

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className="bg-gray-900 text-white text-sm rounded px-4 py-2 shadow-lg">
          {t.text}
        </div>
      ))}
    </div>
  )
}

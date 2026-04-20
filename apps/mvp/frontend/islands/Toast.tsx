import { Toaster, toast } from 'sonner'
import { useEvent } from '@regox/client'

type CartUpdatedEvent = { productName: string; quantity: number }

function CartToastBridge() {
  useEvent<CartUpdatedEvent>('cart:updated', ({ productName, quantity }) => {
    toast.success(`Added ${quantity}× ${productName} to cart`)
  })
  return null
}

export default function Toast() {
  return (
    <>
      <CartToastBridge />
      <Toaster position="bottom-right" richColors />
    </>
  )
}

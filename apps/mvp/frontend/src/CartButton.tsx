import { useState } from 'react'

interface CartButtonProps {
  productId: string
}

export function CartButton({ productId }: CartButtonProps) {
  const [added, setAdded] = useState(false)
  return (
    <button onClick={() => setAdded(true)}>
      {added ? '✓ Added' : 'Add to Cart'}
    </button>
  )
}

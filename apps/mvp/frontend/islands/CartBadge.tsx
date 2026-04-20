import { useCartStore } from '../lib/stores/cart'

export default function CartBadge() {
  const totalCount = useCartStore(s => s.totalCount)

  if (totalCount === 0) return null

  return (
    <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 inline-flex items-center justify-center">
      {totalCount}
    </span>
  )
}

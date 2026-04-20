import { useCartStore } from '../lib/stores/cart'

export default function CartBadge() {
  const totalCount = useCartStore(s => s.totalCount)

  return (
    <a href="/cart" className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white border rounded-full px-4 py-2 shadow hover:shadow-md transition">
      🛒
      {totalCount > 0 && (
        <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {totalCount}
        </span>
      )}
    </a>
  )
}

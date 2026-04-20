import { useCartStore } from '../lib/stores/cart'
import { Badge } from '../components/ui/badge'

export default function CartBadge() {
  const totalCount = useCartStore(s => s.totalCount)

  if (totalCount === 0) return null

  return (
    <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
      {totalCount}
    </Badge>
  )
}

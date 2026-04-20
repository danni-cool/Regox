import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItemState {
  productId: string
  quantity: number
}

interface CartState {
  items: CartItemState[]
  totalCount: number
  addItem: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  updateItem: (productId: string, quantity: number) => void
  clearCart: () => void
  setFromServer: (items: CartItemState[]) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      totalCount: 0,

      addItem: (productId, quantity) => set(state => {
        const existing = state.items.find(i => i.productId === productId)
        const items = existing
          ? state.items.map(i => i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i)
          : [...state.items, { productId, quantity }]
        return { items, totalCount: items.reduce((sum, i) => sum + i.quantity, 0) }
      }),

      removeItem: (productId) => set(state => {
        const items = state.items.filter(i => i.productId !== productId)
        return { items, totalCount: items.reduce((sum, i) => sum + i.quantity, 0) }
      }),

      updateItem: (productId, quantity) => set(state => {
        const items = quantity <= 0
          ? state.items.filter(i => i.productId !== productId)
          : state.items.map(i => i.productId === productId ? { ...i, quantity } : i)
        return { items, totalCount: items.reduce((sum, i) => sum + i.quantity, 0) }
      }),

      clearCart: () => set({ items: [], totalCount: 0 }),

      setFromServer: (items) => set({
        items,
        totalCount: items.reduce((sum, i) => sum + i.quantity, 0),
      }),
    }),
    { name: 'regox-cart' },
  )
)

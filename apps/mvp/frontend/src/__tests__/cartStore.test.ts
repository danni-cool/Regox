import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../../lib/stores/cart'

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], totalCount: 0 })
  })

  it('addItem increments totalCount', () => {
    useCartStore.getState().addItem('prod-01', 2)
    expect(useCartStore.getState().totalCount).toBe(2)
  })

  it('addItem same product accumulates quantity', () => {
    useCartStore.getState().addItem('prod-01', 1)
    useCartStore.getState().addItem('prod-01', 3)
    expect(useCartStore.getState().totalCount).toBe(4)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('clearCart resets to zero', () => {
    useCartStore.getState().addItem('prod-01', 5)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().totalCount).toBe(0)
  })
})

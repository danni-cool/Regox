import type { RegoxPageConfig } from '../lib/types'

export const regox: RegoxPageConfig = { mode: 'csr' }

export default function CartPage() {
  return (
    <div>
      <div data-island="CartView" />
      <div data-island="Toast" />
    </div>
  )
}

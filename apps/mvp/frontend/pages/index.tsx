// M1 validation harness only — M2 Island extraction builds on pages/.
// In production Regox, the framework handles createRoot; M1 does it manually.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useSharedState } from '../lib/useSharedState'
import { init } from '../src/regox-runtime'

export const regox = { mode: 'csr' } satisfies import('../regox').RegoxPageConfig

function CounterA() {
  const [count, setCount] = useSharedState('counter', 0)
  return (
    <div>
      <p>Counter A: {count}</p>
      <button onClick={() => setCount((n) => n + 1)}>+1 from A</button>
    </div>
  )
}

function CounterB() {
  const [count] = useSharedState<number>('counter', 0)
  return <p>Counter B sees: {count}</p>
}

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Regox MVP — M1</h1>
      <p>CSR page. useSharedState cross-component sync demo:</p>
      <hr />
      <CounterA />
      <CounterB />
    </main>
  )
}

init()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
)

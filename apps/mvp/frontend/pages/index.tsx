// CSR page — standard React SPA, no Go resolver needed.

export const regox = { mode: 'csr' } satisfies import('../regox').RegoxPageConfig

export default function HomePage() {
  return (
    <main>
      <h1>Regox MVP</h1>
    </main>
  )
}

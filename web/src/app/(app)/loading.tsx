// Shown while a page's data is fetched on the server, so navigation feels
// immediate instead of leaving the previous screen frozen.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-64 w-72 max-w-[85vw] shrink-0 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

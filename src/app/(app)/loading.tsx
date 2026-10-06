import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Caricamento">
      <Skeleton className="mb-2 h-4 w-24 rounded-full" />
      <Skeleton className="mb-8 h-8 w-64 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-80 rounded-2xl" />
    </div>
  )
}

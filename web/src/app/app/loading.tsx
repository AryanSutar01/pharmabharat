import { Card, Skeleton } from "@/components/ui";

/** Shown instantly while an /app page loads (the free-tier database can take a moment). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton() {
  return (
    <div>
      {/* Mobile Skeleton */}
      <div className="md:hidden space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-[150px] mb-2" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden md:block rounded-md border">
        <div className="border-b">
          <div className="flex h-10 items-center px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="ml-4 h-4 w-[150px]" />
            <Skeleton className="ml-4 h-4 w-[150px]" />
            <Skeleton className="ml-4 h-4 w-[100px]" />
            <Skeleton className="ml-4 h-4 w-[100px]" />
            <Skeleton className="ml-4 h-4 w-[80px]" />
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b">
            <div className="flex h-16 items-center px-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="ml-4 h-4 w-[150px]" />
              <Skeleton className="ml-4 h-4 w-[150px]" />
              <Skeleton className="ml-4 h-4 w-[100px]" />
              <Skeleton className="ml-4 h-4 w-[100px]" />
              <Skeleton className="ml-4 h-4 w-[80px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

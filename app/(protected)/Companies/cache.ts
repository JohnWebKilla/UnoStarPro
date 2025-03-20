// Client-side cache for Stripe data
export const subscriptionDetailsCache = new Map<
  number,
  { data: any; timestamp: number }
>();

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to manually clear the cache for a specific company
export function clearSubscriptionCache(companyId: number): void {
  const wasCached = subscriptionDetailsCache.has(companyId);
  subscriptionDetailsCache.delete(companyId);
  console.log(
    `Client-side cache ${wasCached ? "cleared" : "was already empty"} for company ${companyId}`
  );
}

// Function to clear the entire cache
export function clearAllSubscriptionCache(): void {
  const size = subscriptionDetailsCache.size;
  subscriptionDetailsCache.clear();
  console.log(`Cleared entire client-side cache (${size} items)`);
}

// Function to check if a company's data is in the cache
export function isCompanyCached(companyId: number): boolean {
  const cached = subscriptionDetailsCache.get(companyId);
  if (!cached) return false;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
  return !isExpired;
}

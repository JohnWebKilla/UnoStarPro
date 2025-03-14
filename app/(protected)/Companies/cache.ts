// Client-side cache for Stripe data
export const subscriptionDetailsCache = new Map<
  number,
  { data: any; timestamp: number }
>();

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

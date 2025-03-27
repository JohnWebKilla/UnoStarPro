import { redis, createCacheKey, CacheKeys } from "./upstash";

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60; // 1 hour

// Key prefixes for different types of data
const PAYMENT_METHODS_KEY = (companyId: number) =>
  `payment_methods:${companyId}`;
const STRIPE_DATA_KEY = (companyId: number) => `stripe_data:${companyId}`;
const STRIPE_PLANS_KEY = "stripe_plans";

// Helper function to safely serialize data
function safeSerialize(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("Error serializing data:", error);
    throw new Error("Failed to serialize data for cache");
  }
}

// Helper function to safely deserialize data
function safeDeserialize<T>(data: string | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("Error deserializing data:", error);
    return null;
  }
}

// Helper function to set cache with expiration
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    const serializedValue = safeSerialize(value);
    // Ensure TTL is a positive integer
    const validTtl = Math.max(1, Math.floor(Number(ttl)));
    if (Number.isNaN(validTtl)) {
      console.warn(`Invalid TTL provided for key ${key}, using default TTL`);
      await redis.set(key, serializedValue, { ex: CACHE_TTL });
    } else {
      await redis.set(key, serializedValue, { ex: validTtl });
    }
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    throw error;
  }
}

// Helper function to get cache
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<string>(key);
    return safeDeserialize<T>(data);
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
}

// Helper function to delete cache
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Error deleting cache for key ${key}:`, error);
    throw error;
  }
}

// Helper function to flush all cache
export async function clearAllCache(): Promise<void> {
  try {
    await redis.flushall();
  } catch (error) {
    console.error("Error clearing all cache:", error);
    throw error;
  }
}

// Stripe-related function type definitions
export type CachePaymentMethodsFn = (
  companyId: number,
  paymentMethods: any[]
) => Promise<void>;
export type GetCachedPaymentMethodsFn = (
  companyId: number
) => Promise<any[] | null>;
export type CacheStripeDataFn = (companyId: number, data: any) => Promise<void>;
export type GetCachedStripeDataFn = (companyId: number) => Promise<any>;
export type CacheStripePlansFn = (plans: any) => Promise<void>;
export type GetCachedStripePlansFn = () => Promise<any>;
export type InvalidateStripeCacheFn = (companyId: number) => Promise<void>;
export type InvalidatePaymentMethodsCacheFn = (
  companyId: number
) => Promise<void>;
export type InvalidateStripePlansCacheFn = () => Promise<void>;

// Stripe-related types
interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface StripeData {
  data: any;
  cacheTime: number;
}

// Export all Stripe-related functions
export async function cachePaymentMethods(
  companyId: number,
  paymentMethods: StripePaymentMethod[]
): Promise<void> {
  const key = createCacheKey(CacheKeys.STRIPE.PAYMENT_METHODS, companyId);
  await setCache(key, paymentMethods);
}

export async function getCachedPaymentMethods(
  companyId: number
): Promise<StripePaymentMethod[] | null> {
  const key = createCacheKey(CacheKeys.STRIPE.PAYMENT_METHODS, companyId);
  return getCache<StripePaymentMethod[]>(key);
}

export async function cacheStripeData(
  companyId: number,
  data: any
): Promise<void> {
  const key = createCacheKey(CacheKeys.STRIPE.DATA, companyId);
  const dataWithTimestamp: StripeData = {
    data,
    cacheTime: Date.now(),
  };
  await setCache(key, dataWithTimestamp);
}

export async function getCachedStripeData(
  companyId: number
): Promise<any | null> {
  const key = createCacheKey(CacheKeys.STRIPE.DATA, companyId);
  const cachedData = await getCache<StripeData>(key);

  if (cachedData && Date.now() - cachedData.cacheTime < 5 * 60 * 1000) {
    return cachedData.data;
  }
  return null;
}

export async function cacheStripePlans(plans: any): Promise<void> {
  const dataWithTimestamp: StripeData = {
    data: plans,
    cacheTime: Date.now(),
  };
  await setCache(CacheKeys.STRIPE.PLANS, dataWithTimestamp, 24 * 60 * 60);
}

export async function getCachedStripePlans(): Promise<any | null> {
  const cachedData = await getCache<StripeData>(CacheKeys.STRIPE.PLANS);

  if (cachedData && Date.now() - cachedData.cacheTime < 60 * 60 * 1000) {
    return cachedData.data;
  }
  return null;
}

export async function invalidateStripeCache(companyId: number): Promise<void> {
  const key = createCacheKey(CacheKeys.STRIPE.DATA, companyId);
  await deleteCache(key);
}

export async function invalidatePaymentMethodsCache(
  companyId: number
): Promise<void> {
  const key = createCacheKey(CacheKeys.STRIPE.PAYMENT_METHODS, companyId);
  await deleteCache(key);
}

export async function invalidateStripePlansCache(): Promise<void> {
  await deleteCache(CacheKeys.STRIPE.PLANS);
}

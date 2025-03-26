import { RedisManager } from "./redis-manager";

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60; // 1 hour

// Key prefixes for different types of data
const PAYMENT_METHODS_KEY = (companyId: number) =>
  `payment_methods:${companyId}`;
const STRIPE_DATA_KEY = (companyId: number) => `stripe_data:${companyId}`;
const STRIPE_PLANS_KEY = "stripe_plans";

// Helper function to set cache with expiration
export async function setCache<T>(
  key: string,
  value: T,
  expiryInSeconds: number = 300
): Promise<boolean> {
  try {
    const redis = await RedisManager.getConnection();
    await redis.set(key, JSON.stringify(value), "EX", expiryInSeconds);
    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
}

// Helper function to get cache
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await RedisManager.getConnection();
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
}

// Helper function to delete cache
export async function deleteCache(key: string): Promise<boolean> {
  try {
    const redis = await RedisManager.getConnection();
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Error deleting cache for key ${key}:`, error);
    return false;
  }
}

// Helper function to flush all cache
export async function clearAllCache(): Promise<boolean> {
  try {
    const redis = await RedisManager.getConnection();
    await redis.flushall();
    return true;
  } catch (error) {
    console.error("Error clearing all cache:", error);
    return false;
  }
}

// Function to check if Redis is connected
export function isRedisConnected(): boolean {
  return RedisManager.isConnected();
}

// Function to explicitly disconnect Redis (useful for cleanup)
export async function disconnectRedis(): Promise<void> {
  await RedisManager.disconnect();
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

// Export all Stripe-related functions
export const cachePaymentMethods: CachePaymentMethodsFn = async (
  companyId,
  paymentMethods
) => {
  try {
    await setCache(PAYMENT_METHODS_KEY(companyId), paymentMethods);
  } catch (error) {
    console.error("Error caching payment methods:", error);
  }
};

export const getCachedPaymentMethods: GetCachedPaymentMethodsFn = async (
  companyId
) => {
  try {
    return await getCache<any[]>(PAYMENT_METHODS_KEY(companyId));
  } catch (error) {
    console.error("Error getting cached payment methods:", error);
    return null;
  }
};

export const cacheStripeData: CacheStripeDataFn = async (companyId, data) => {
  try {
    const dataWithTimestamp = {
      data,
      cacheTime: Date.now(),
    };
    await setCache(STRIPE_DATA_KEY(companyId), dataWithTimestamp);
  } catch (error) {
    console.error("Error caching Stripe data:", error);
  }
};

export const getCachedStripeData: GetCachedStripeDataFn = async (companyId) => {
  try {
    const cachedData = await getCache<{
      data: any;
      cacheTime: number;
    }>(STRIPE_DATA_KEY(companyId));

    if (
      cachedData &&
      Date.now() - (cachedData.cacheTime || 0) < 5 * 60 * 1000
    ) {
      return cachedData.data;
    }
    return null;
  } catch (error) {
    console.error("Error getting cached Stripe data:", error);
    return null;
  }
};

export const cacheStripePlans: CacheStripePlansFn = async (plans) => {
  try {
    const dataWithTimestamp = {
      data: plans,
      cacheTime: Date.now(),
    };
    await setCache(STRIPE_PLANS_KEY, dataWithTimestamp, 24 * 60 * 60);
  } catch (error) {
    console.error("Error caching Stripe plans:", error);
  }
};

export const getCachedStripePlans: GetCachedStripePlansFn = async () => {
  try {
    const cachedData = await getCache<{
      data: any;
      cacheTime: number;
    }>(STRIPE_PLANS_KEY);

    if (
      cachedData &&
      Date.now() - (cachedData.cacheTime || 0) < 60 * 60 * 1000
    ) {
      return cachedData.data;
    }
    return null;
  } catch (error) {
    console.error("Error getting cached Stripe plans:", error);
    return null;
  }
};

export const invalidateStripeCache: InvalidateStripeCacheFn = async (
  companyId
) => {
  try {
    await deleteCache(STRIPE_DATA_KEY(companyId));
  } catch (error) {
    console.error("Error invalidating Stripe cache:", error);
  }
};

export const invalidatePaymentMethodsCache: InvalidatePaymentMethodsCacheFn =
  async (companyId) => {
    try {
      await deleteCache(PAYMENT_METHODS_KEY(companyId));
    } catch (error) {
      console.error("Error invalidating payment methods cache:", error);
    }
  };

export const invalidateStripePlansCache: InvalidateStripePlansCacheFn =
  async () => {
    try {
      await deleteCache(STRIPE_PLANS_KEY);
    } catch (error) {
      console.error("Error invalidating Stripe plans cache:", error);
    }
  };

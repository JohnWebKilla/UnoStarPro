import Redis from "ioredis";
import { Stripe } from "stripe";

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60; // 1 hour

// Key prefixes for different types of data
const PAYMENT_METHODS_KEY = (companyId: number) =>
  `payment_methods:${companyId}`;
const STRIPE_DATA_KEY = (companyId: number) => `stripe_data:${companyId}`;
const STRIPE_PLANS_KEY = "stripe_plans";

// Initialize Redis client based on available configuration
let redisClient: Redis | null = null;

if (process.env.REDIS_URL && process.env.REDIS_PASSWORD) {
  const url = `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_URL}`;
  redisClient = new Redis(url);

  redisClient.on("error", (error) => {
    console.error("Redis Client Error:", error);
  });

  redisClient.on("connect", () => {
    console.log("Redis Client Connected");
  });
}

// Export Redis client getter
export const getRedisClient = () => redisClient;

// Helper function to set cache with expiration
export async function setCache(
  key: string,
  value: any,
  expiryInSeconds: number = CACHE_TTL
): Promise<void> {
  if (!redisClient) return;

  const serializedValue = JSON.stringify(value);
  await redisClient.set(key, serializedValue);
  await redisClient.expire(key, expiryInSeconds);
}

// Helper function to get cache
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;

  const value = await redisClient.get(key);
  if (!value) return null;

  try {
    return JSON.parse(value.toString()) as T;
  } catch (error) {
    console.error(`Error parsing cached value for key ${key}:`, error);
    return null;
  }
}

// Helper function to delete cache
export async function deleteCache(key: string): Promise<void> {
  if (!redisClient) return;
  await redisClient.del(key);
}

// Helper function to flush all cache
export async function flushCache(): Promise<void> {
  if (!redisClient) return;
  await redisClient.flushall();
}

// Stripe-related function type definitions
export type CachePaymentMethodsFn = (
  companyId: number,
  paymentMethods: Stripe.PaymentMethod[]
) => Promise<void>;
export type GetCachedPaymentMethodsFn = (
  companyId: number
) => Promise<Stripe.PaymentMethod[] | null>;
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
    return await getCache<Stripe.PaymentMethod[]>(
      PAYMENT_METHODS_KEY(companyId)
    );
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
    if (redisClient) {
      await redisClient.del(STRIPE_DATA_KEY(companyId));
    }
  } catch (error) {
    console.error("Error invalidating Stripe cache:", error);
  }
};

export const invalidatePaymentMethodsCache: InvalidatePaymentMethodsCacheFn =
  async (companyId) => {
    try {
      if (redisClient) {
        await redisClient.del(PAYMENT_METHODS_KEY(companyId));
      }
    } catch (error) {
      console.error("Error invalidating payment methods cache:", error);
    }
  };

export const invalidateStripePlansCache: InvalidateStripePlansCacheFn =
  async () => {
    try {
      if (redisClient) {
        await redisClient.del(STRIPE_PLANS_KEY);
      }
    } catch (error) {
      console.error("Error invalidating Stripe plans cache:", error);
    }
  };

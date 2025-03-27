import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error("UPSTASH_REDIS_REST_URL is not defined");
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("UPSTASH_REDIS_REST_TOKEN is not defined");
}

const url = process.env.UPSTASH_REDIS_REST_URL;
const formattedUrl = url.startsWith("https://") ? url : `https://${url}`;

// Create Redis client with proper configuration
export const redis = new Redis({
  url: formattedUrl,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: false, // We'll handle serialization manually for better control
});

// Test the connection
redis
  .ping()
  .then(() => {
    console.log("Successfully connected to Upstash Redis");
  })
  .catch((error) => {
    console.error("Failed to connect to Upstash Redis:", error);
  });

// Cache TTL in seconds
export const CACHE_TTL = 3600; // 1 hour

// Helper function to create cache keys
export function createCacheKey(prefix: string, ...parts: (string | number)[]) {
  return [prefix, ...parts].join(":");
}

// Cache key prefixes
export const CacheKeys = {
  COMPANIES: "companies",
  DRIVERS: "drivers",
  USERS: "users",
  PAYROLL: "payroll",
  EXPENSES: "expenses",
  SCHEDULING: "scheduling",
  DASHBOARD: "dashboard",
  STRIPE: {
    PAYMENT_METHODS: "stripe:payment_methods",
    DATA: "stripe:data",
    PLANS: "stripe:plans",
  },
} as const;

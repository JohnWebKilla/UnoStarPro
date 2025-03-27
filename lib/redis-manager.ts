import { Redis } from "@upstash/redis";

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export class RedisManager {
  private static instance: RedisManager;
  private redis: Redis;

  private constructor() {
    this.redis = redis;
  }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  static async getConnection(): Promise<Redis> {
    return RedisManager.getInstance().redis;
  }

  // Test Redis connection
  static async testConnection(): Promise<boolean> {
    try {
      await RedisManager.getInstance().redis.ping();
      console.log("Successfully connected to Upstash Redis");
      return true;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      return false;
    }
  }

  // Set cache with TTL
  static async setCache(
    key: string,
    value: any,
    ttl: number = 3600
  ): Promise<boolean> {
    try {
      await RedisManager.getInstance().redis.set(key, JSON.stringify(value), {
        ex: ttl,
      });
      return true;
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  }

  // Get cache
  static async getCache(key: string): Promise<any> {
    try {
      const data = await RedisManager.getInstance().redis.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error) {
      console.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  // Delete cache
  static async deleteCache(key: string): Promise<boolean> {
    try {
      await RedisManager.getInstance().redis.del(key);
      return true;
    } catch (error) {
      console.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  }

  // Clear all cache
  static async clearAllCache(): Promise<boolean> {
    try {
      await RedisManager.getInstance().redis.flushall();
      return true;
    } catch (error) {
      console.error("Error clearing all cache:", error);
      return false;
    }
  }
}

// Export individual functions for backward compatibility
export const {
  getConnection,
  testConnection,
  setCache,
  getCache,
  deleteCache,
  clearAllCache,
} = RedisManager;

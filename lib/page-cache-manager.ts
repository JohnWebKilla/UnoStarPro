import { Role } from "@/types/role";
import { setCache, getCache, deleteCache, getRedisClient } from "@/lib/redis";

export interface PageData {
  path: string;
  data: any;
  lastFetched: string;
}

interface PageConfig {
  path: string;
  fetchFunction: () => Promise<any>;
}

const PAGE_CACHE_PREFIX = "page:";
const PAGE_CACHE_TTL = 300; // 5 minutes

const pageConfigs: Record<Role, PageConfig[]> = {
  admin: [],
  user: [],
  customer: [],
  driver: [],
  superadmin: [],
};

export async function prefetchPageData(
  userId: string,
  role: Role
): Promise<void> {
  const configs = pageConfigs[role] || [];

  await Promise.all(
    configs.map(async (config) => {
      try {
        const data = await config.fetchFunction();
        const pageData: PageData = {
          path: config.path,
          data,
          lastFetched: new Date().toISOString(),
        };

        const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${config.path}`;
        await setCache(cacheKey, JSON.stringify(pageData), PAGE_CACHE_TTL);
      } catch (error) {
        console.error(`Error prefetching data for ${config.path}:`, error);
      }
    })
  );
}

export async function invalidatePageCache(
  userId: string,
  path?: string
): Promise<void> {
  if (path) {
    // Invalidate specific page
    const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
    await deleteCache(cacheKey);
  } else {
    // Invalidate all pages for user
    const pattern = `${PAGE_CACHE_PREFIX}${userId}:*`;
    const redis = await getRedisClient();
    if (!redis) {
      console.warn(
        "Redis client not initialized, skipping pattern-based cache invalidation"
      );
      return;
    }
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => deleteCache(key)));
    }
  }
}

export async function refreshPageData(
  userId: string,
  role: Role,
  path: string
): Promise<void> {
  const configs = pageConfigs[role] || [];
  const config = configs.find((c) => c.path === path);

  if (!config) {
    throw new Error(`No configuration found for path: ${path}`);
  }

  try {
    const data = await config.fetchFunction();
    const pageData: PageData = {
      path: config.path,
      data,
      lastFetched: new Date().toISOString(),
    };

    const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
    await setCache(cacheKey, JSON.stringify(pageData), PAGE_CACHE_TTL);
  } catch (error) {
    console.error(`Error refreshing data for ${path}:`, error);
    throw error;
  }
}

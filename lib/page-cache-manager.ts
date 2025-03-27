import { Role } from "@/types/role";
import {
  setCache,
  getCache,
  deleteCache,
  RedisManager,
} from "@/lib/redis-manager";

export interface PageData {
  path: string;
  data: any;
  lastFetched: string;
  expiresAt?: number;
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

export async function getPageData(
  userId: string,
  path: string
): Promise<PageData | null> {
  const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
  const cachedData = await getCache(cacheKey);

  if (!cachedData) {
    return null;
  }

  try {
    const pageData: PageData = JSON.parse(cachedData);
    if (pageData.expiresAt && pageData.expiresAt < Date.now()) {
      await deleteCache(cacheKey);
      return null;
    }
    return pageData;
  } catch (error) {
    console.error("Error parsing cached data:", error);
    await deleteCache(cacheKey);
    return null;
  }
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
    const redis = await RedisManager.getConnection();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((key: string) => deleteCache(key)));
    }
  }
}

export async function refreshPageData(
  userId: string,
  role: Role,
  path: string
): Promise<void> {
  const config = pageConfigs[role]?.find((cfg) => cfg.path === path);
  if (!config) {
    throw new Error(`No configuration found for path: ${path}`);
  }

  try {
    const data = await config.fetchFunction();
    const pageData: PageData = {
      path,
      data,
      lastFetched: new Date().toISOString(),
      expiresAt: Date.now() + PAGE_CACHE_TTL * 1000,
    };

    const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
    await setCache(cacheKey, JSON.stringify(pageData), PAGE_CACHE_TTL);
  } catch (error) {
    console.error(`Error refreshing page data for ${path}:`, error);
    throw error;
  }
}

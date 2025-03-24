import { getRedisClient } from "./redis";
import { Role } from "@/types/role";
import { createClient } from "@/utils/supabase/client";

const PAGE_CACHE_PREFIX = "page_data:";
const PAGE_CACHE_TTL = 3600; // 1 hour in seconds

export interface PageData {
  path: string;
  data: any;
  lastFetched: string;
}

interface PageConfig {
  path: string;
  fetchFunction: () => Promise<any>;
}

interface CountResponse {
  count: number | null;
}

// Helper function to create Supabase client
async function getSupabase() {
  return await createClient();
}

// Define data fetching functions
async function fetchDashboardData(role: Role) {
  const supabase = await getSupabase();
  const data: any = {
    stats: {},
    recentActivity: [],
  };

  // Fetch data based on role
  switch (role) {
    case "admin":
    case "superadmin":
      const { data: countData } = await supabase
        .from("users")
        .select("count", { count: "exact", head: true });
      const { data: recentUsers } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      data.stats.totalUsers = countData || 0;
      data.recentActivity = recentUsers;
      break;

    case "customer":
    case "user":
    case "driver":
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("role", role)
        .single();
      data.profile = userData;
      break;
  }

  return data;
}

async function fetchUsersData() {
  const supabase = await getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  return { users };
}

// Define page configurations for each role
const pageConfigs: Record<Role, PageConfig[]> = {
  admin: [
    {
      path: "/Dashboard",
      fetchFunction: async () => fetchDashboardData("admin"),
    },
    {
      path: "/Users",
      fetchFunction: fetchUsersData,
    },
  ],
  customer: [
    {
      path: "/Dashboard",
      fetchFunction: async () => fetchDashboardData("customer"),
    },
  ],
  user: [
    {
      path: "/Dashboard",
      fetchFunction: async () => fetchDashboardData("user"),
    },
  ],
  superadmin: [
    {
      path: "/Dashboard",
      fetchFunction: async () => fetchDashboardData("superadmin"),
    },
    {
      path: "/Users",
      fetchFunction: fetchUsersData,
    },
  ],
  driver: [
    {
      path: "/Dashboard",
      fetchFunction: async () => fetchDashboardData("driver"),
    },
  ],
};

export async function prefetchPageData(
  userId: string,
  role: Role
): Promise<void> {
  const redis = await getRedisClient();
  const configs = pageConfigs[role] || [];

  // Fetch and cache data for all pages configured for the role
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
        await redis.set(
          cacheKey,
          JSON.stringify(pageData),
          "EX",
          PAGE_CACHE_TTL
        );
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
  const redis = await getRedisClient();
  const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;

  const cachedData = await redis.get(cacheKey);
  if (!cachedData) return null;

  try {
    return JSON.parse(cachedData) as PageData;
  } catch (error) {
    console.error("Error parsing cached page data:", error);
    return null;
  }
}

export async function invalidatePageCache(
  userId: string,
  path?: string
): Promise<void> {
  const redis = await getRedisClient();

  if (path) {
    // Invalidate specific page
    const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
    await redis.del(cacheKey);
  } else {
    // Invalidate all pages for user
    const pattern = `${PAGE_CACHE_PREFIX}${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
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

    const redis = await getRedisClient();
    const cacheKey = `${PAGE_CACHE_PREFIX}${userId}:${path}`;
    await redis.set(cacheKey, JSON.stringify(pageData), "EX", PAGE_CACHE_TTL);
  } catch (error) {
    console.error(`Error refreshing data for ${path}:`, error);
    throw error;
  }
}

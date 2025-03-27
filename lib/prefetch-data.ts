import { format, subMonths } from "date-fns";
import { setCache } from "./redis-manager";
import { fetchWithAuth } from "./fetch-utils";
import { createClient } from "@/utils/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CACHE_TTL = 3600; // 1 hour cache
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface ApiData {
  [key: string]: any;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<ApiData | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await fetchWithAuth(url);
      if (data) return data;

      console.log(`Attempt ${i + 1} failed for ${url}, retrying...`);
      await delay(RETRY_DELAY * (i + 1)); // Exponential backoff
    } catch (error) {
      console.error(`Attempt ${i + 1} error for ${url}:`, error);
      if (i === retries - 1) return null;
      await delay(RETRY_DELAY * (i + 1));
    }
  }
  return null;
}

export async function prefetchData(
  role: { role: string },
  userId: string
): Promise<void> {
  console.log(
    `Starting data prefetch for role: ${role.role}, userId: ${userId}`
  );

  // Verify authentication first with retries
  const supabase = createClient();
  let session = null;

  // Try to get session with retries
  for (let i = 0; i < 3; i++) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      session = sessionData.session;
      break;
    }
    console.log(`Attempt ${i + 1}: Waiting for session to be available...`);
    await delay(1000); // Wait 1 second between attempts
  }

  if (!session) {
    console.error("No active session found after retries, aborting prefetch");
    return;
  }

  console.log("Session verified, proceeding with data prefetch");

  const currentDate = new Date();
  const currentMonth = format(currentDate, "yyyy-MM");
  const sixMonthsAgo = format(subMonths(currentDate, 6), "yyyy-MM");

  try {
    const prefetchPromises: Promise<void>[] = [];

    // Companies data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/companies`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache("companies:list", data, CACHE_TTL);
            await setCache("api:/api/companies", data, CACHE_TTL);
            console.log("Companies data cached successfully");
          }
        }
      )
    );

    // Drivers data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/drivers`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache("drivers:client-list", data, CACHE_TTL);
            await setCache("api:/api/drivers", data, CACHE_TTL);
            console.log("Drivers data cached successfully");
          }
        }
      )
    );

    // Users data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/users`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache(`users:list:${userId}`, data, CACHE_TTL);
            await setCache("api:/api/users", data, CACHE_TTL);
            console.log("Users data cached successfully");
          }
        }
      )
    );

    // Payroll data
    prefetchPromises.push(
      fetchWithRetry(
        `${BASE_URL}/api/payroll/monthly-summary?month=${currentMonth}`
      ).then(async (data: ApiData | null) => {
        if (data) {
          await setCache(`payroll:${currentMonth}`, data, CACHE_TTL);
          await setCache(
            `api:/api/payroll/monthly-summary?month=${currentMonth}`,
            data,
            CACHE_TTL
          );
          console.log("Payroll data cached successfully");
        }
      })
    );

    // Expenses data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/expenses?month=${currentMonth}`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache(
              `expenses:${currentMonth}:${userId}`,
              data,
              CACHE_TTL
            );
            await setCache(
              `api:/api/expenses?month=${currentMonth}`,
              data,
              CACHE_TTL
            );
            console.log("Expenses data cached successfully");
          }
        }
      )
    );

    // Expenses chart data
    prefetchPromises.push(
      fetchWithRetry(
        `${BASE_URL}/api/expenses/chart?startMonth=${sixMonthsAgo}&endMonth=${currentMonth}`
      ).then(async (data: ApiData | null) => {
        if (data) {
          await setCache(
            `expenses:chart:${sixMonthsAgo}:${currentMonth}:${userId}`,
            data,
            CACHE_TTL
          );
          await setCache(
            `api:/api/expenses/chart?startMonth=${sixMonthsAgo}&endMonth=${currentMonth}`,
            data,
            CACHE_TTL
          );
          console.log("Expenses chart data cached successfully");
        }
      })
    );

    // Scheduling data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/scheduling`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache("scheduling:data", data, CACHE_TTL);
            await setCache("api:/api/scheduling", data, CACHE_TTL);
            console.log("Scheduling data cached successfully");
          }
        }
      )
    );

    // Dashboard data
    prefetchPromises.push(
      fetchWithRetry(`${BASE_URL}/api/dashboard`).then(
        async (data: ApiData | null) => {
          if (data) {
            await setCache(`dashboard:${userId}`, data, CACHE_TTL);
            await setCache("api:/api/dashboard", data, CACHE_TTL);
            console.log("Dashboard data cached successfully");
          }
        }
      )
    );

    // Wait for all prefetch operations to complete
    const results = await Promise.allSettled(prefetchPromises);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Prefetch operation ${index} failed:`, result.reason);
      }
    });

    console.log(
      `Data prefetch completed for role: ${role.role}, userId: ${userId}`
    );
  } catch (error) {
    console.error("Error during data prefetch:", error);
  }
}

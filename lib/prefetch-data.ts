import { SupabaseClient } from "@supabase/supabase-js";
import { setCache } from "@/lib/redis";
import { format, subMonths } from "date-fns";

export async function prefetchData(
  supabase: SupabaseClient,
  userId: string,
  role?: string
) {
  try {
    const currentMonth = format(new Date(), "yyyy-MM");
    const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM");

    // Common data for all roles
    const commonPromises = [
      // Fetch and cache companies
      Promise.race([
        supabase
          .from("companies")
          .select("*")
          .then(async ({ data: companies }) => {
            if (companies) {
              await setCache("companies:list", companies, 3600);
            }
          }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Companies fetch timeout")), 5000)
        ),
      ]),
    ];

    // Role-specific data
    if (role === "admin" || role === "manager") {
      const adminPromises = [
        // Fetch and cache drivers
        Promise.race([
          supabase
            .from("drivers")
            .select("*")
            .then(async ({ data: drivers }) => {
              if (drivers) {
                await setCache("drivers:client-list", drivers, 3600);
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Drivers fetch timeout")), 5000)
          ),
        ]),
        // Fetch and cache users
        Promise.race([
          supabase
            .from("users")
            .select("*")
            .then(async ({ data: users }) => {
              if (users) {
                await setCache(`users:list:${userId}`, users, 3600);
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Users fetch timeout")), 5000)
          ),
        ]),
        // Fetch and cache payroll data
        Promise.race([
          supabase
            .from("payroll")
            .select("*")
            .then(async ({ data: payroll }) => {
              if (payroll) {
                await setCache(
                  `payroll:summary:${currentMonth}:${userId}`,
                  payroll,
                  3600
                );
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Payroll fetch timeout")), 5000)
          ),
        ]),
        // Fetch and cache expenses
        Promise.race([
          supabase
            .from("expenses")
            .select("*")
            .then(async ({ data: expenses }) => {
              if (expenses) {
                await setCache(
                  `expenses:${currentMonth}:${userId}`,
                  expenses,
                  3600
                );
                await setCache(
                  `expenses:chart:${sixMonthsAgo}:${currentMonth}:${userId}`,
                  expenses,
                  3600
                );
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Expenses fetch timeout")), 5000)
          ),
        ]),
        // Fetch and cache scheduling data
        Promise.race([
          Promise.all([
            supabase.from("users").select("*"),
            supabase.from("schedules").select("*"),
          ]).then(async ([employeesResult, schedulesResult]) => {
            if (employeesResult.data && schedulesResult.data) {
              const scheduleData = {
                employees: employeesResult.data,
                schedules: schedulesResult.data,
              };
              await setCache("scheduling:data", scheduleData, 3600);
            }
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Scheduling fetch timeout")),
              5000
            )
          ),
        ]),
        // Fetch and cache dashboard data
        Promise.race([
          supabase
            .from("dashboard_stats")
            .select("*")
            .then(async ({ data: stats }) => {
              if (stats) {
                await setCache(`dashboard:${userId}`, stats, 3600);
              }
            }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Dashboard fetch timeout")), 5000)
          ),
        ]),
      ];

      // Wait for all promises to settle, even if some fail
      const results = await Promise.allSettled([
        ...commonPromises,
        ...adminPromises,
      ]);

      // Log which prefetch operations succeeded and which failed
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Prefetch operation ${index} failed:`, result.reason);
        } else {
          console.log(`Prefetch operation ${index} succeeded`);
        }
      });
    } else {
      await Promise.allSettled(commonPromises);
    }

    console.log("Data prefetch completed for role:", role);
  } catch (error) {
    console.error("Error prefetching data:", error);
    // Don't throw error to prevent blocking sign-in
  }
}

import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { StatsCards } from "./components/stats-cards";
import { PageHeader } from "./components/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { getDriversAction } from "./server-actions";
import { DriversClientProvider } from "./components/DriversClientProvider";
import { DriversDataTable } from "./components/DriversDataTable";

// Set revalidation period for Incremental Static Regeneration
export const revalidate = 60; // Revalidate every 60 seconds

export default async function DriversPage() {
  // Fetch drivers from server action
  const drivers = await getDriversAction();

  return (
    <DriversClientProvider initialDrivers={drivers}>
      <PageTransition>
        <div className="space-y-4">
          <PageHeader />
          <StatsCards />
          <DriversDataTable data={drivers} />
        </div>
      </PageTransition>
    </DriversClientProvider>
  );
}

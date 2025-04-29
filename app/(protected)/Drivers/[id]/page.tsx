import { PageTransition } from "@/components/ui/page-transition";
import { getDriverAction, getDriversAction } from "../server-actions";
import DriverDetailWrapper from "./components/DriverDetailWrapper";
import { DriversClientProvider } from "../components/DriversClientProvider";

// Set revalidation period for Incremental Static Regeneration
export const revalidate = 60; // Revalidate every 60 seconds

export default async function DriverDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  // Properly await and extract the ID to fix the NextJS error
  const { id } = await Promise.resolve(params);
  const driverId = id;

  // Use Promise.all to fetch both data sets in parallel
  const [driver, drivers] = await Promise.all([
    getDriverAction(Number(driverId)).catch(() => null),
    getDriversAction(),
  ]);

  return (
    <DriversClientProvider initialDrivers={drivers}>
      <PageTransition>
        <DriverDetailWrapper
          serverDriver={driver}
          driverId={driverId}
          skipInitialFetch={true}
        />
      </PageTransition>
    </DriversClientProvider>
  );
}

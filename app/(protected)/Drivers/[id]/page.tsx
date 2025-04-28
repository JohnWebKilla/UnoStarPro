import { PageTransition } from "@/components/ui/page-transition";
import { getDriverAction } from "../server-actions";
import DriverDetail from "./components/DriverDetail";

// Set revalidation period for Incremental Static Regeneration
export const revalidate = 60; // Revalidate every 60 seconds

export default async function DriverDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const driverId = params.id;
  const driver = await getDriverAction(Number(driverId));

  return (
    <PageTransition>
      <DriverDetail driver={driver} driverId={driverId} />
    </PageTransition>
  );
}
